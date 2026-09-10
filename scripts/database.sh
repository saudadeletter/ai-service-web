# Sourced by deploy.sh after engine selection and the shared project lock.
# No host PostgreSQL tools, shell evaluation of .env, or container bind mounts.
for dependency in sha256sum timeout; do
  command -v "$dependency" >/dev/null || fail "缺少命令：$dependency"
done
[[ -f .env ]] || fail '请先恢复备份目录中的 .env 到项目根目录；备份操作则需要已有部署配置。'

temporary_backup=''
phase='检查配置和备份'
cleanup_database_task() { [[ -z "$temporary_backup" ]] || rm -rf -- "$temporary_backup"; }
trap cleanup_database_task EXIT
trap 'printf "数据库操作失败：%s。未自动启动网站，请检查错误后重试。\n" "$phase" >&2' ERR
umask 077
"${compose[@]}" config >/dev/null

verify_backup_file() {
  local name=$1 expected actual
  [[ -f "$restore_path/$name" && -f "$restore_path/$name.sha256" ]] || fail "备份缺少 $name 或校验文件。"
  expected=$(cat -- "$restore_path/$name.sha256")
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || fail "备份 $name 的校验格式不正确。"
  actual=$(sha256sum -- "$restore_path/$name")
  [[ "${actual%% *}" == "$expected" ]] || fail "备份 $name 校验失败，文件可能未传输完整。"
}
if [[ "$action" == restore ]]; then
  [[ -d "$restore_path" ]] || fail '指定的备份目录不存在。'
  verify_backup_file database.dump
  verify_backup_file .env
  [[ -s "$restore_path/database.dump" ]] || fail '数据库备份为空。'
fi

phase='启动并等待数据库'
"${compose[@]}" up -d db
ready=false
for ((attempt=1; attempt<=30; attempt++)); do
  if timeout 8 "${compose[@]}" exec -T db pg_isready -U ai_service -d ai_service -t 3 >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[[ "$ready" == true ]] || fail '数据库未在等待时间内就绪。'

if [[ "$action" == backup ]]; then
  phase='导出数据库与配置'
  [[ ! -L backups ]] || fail 'backups 不能是符号链接，请使用项目内的备份目录。'
  mkdir -p backups
  chmod 700 backups
  temporary_backup=$(mktemp -d "backups/.partial-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
  "${compose[@]}" exec -T db pg_dump -U ai_service -d ai_service -Fc > "$temporary_backup/database.dump"
  [[ -s "$temporary_backup/database.dump" ]] || fail '数据库导出为空，未保存备份。'
  "${compose[@]}" exec -T db pg_restore --list < "$temporary_backup/database.dump" >/dev/null
  cp -- .env "$temporary_backup/.env"
  chmod 600 "$temporary_backup/.env" "$temporary_backup/database.dump"
  for name in database.dump .env; do
    digest=$(sha256sum -- "$temporary_backup/$name")
    printf '%s\n' "${digest%% *}" > "$temporary_backup/$name.sha256"
  done
  if [[ -f .admin-credentials ]]; then
    cp -- .admin-credentials "$temporary_backup/.admin-credentials"
    chmod 600 "$temporary_backup/.admin-credentials"
  fi
  printf 'format=1\ncreated_utc=%s\ndatabase=ai_service\npostgres_major=17\n' "$(date -u +%FT%TZ)" > "$temporary_backup/metadata.txt"
  destination="backups/backup-${temporary_backup##*/.partial-}"
  [[ ! -e "$destination" ]] || fail '目标备份目录已存在，请重试。'
  mv -- "$temporary_backup" "$destination"
  temporary_backup=''
  printf '\n备份完成：%s\n其中包含数据库和 .env 密钥，请将整个目录安全保存到虚拟机之外。\n' "$destination"
  exit 0
fi

phase='检查备份格式与目标数据库'
"${compose[@]}" exec -T db pg_restore --list < "$restore_path/database.dump" >/dev/null
# Count user relations, types, functions and schemas, not only tables in public.
objects=$("${compose[@]}" exec -T db psql -X -U ai_service -d ai_service -v ON_ERROR_STOP=1 -Atc "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE left(n.nspname,3) <> 'pg_' AND n.nspname <> 'information_schema') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE left(n.nspname,3) <> 'pg_' AND n.nspname <> 'information_schema') + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE left(n.nspname,3) <> 'pg_' AND n.nspname <> 'information_schema') + (SELECT count(*) FROM pg_namespace WHERE left(nspname,3) <> 'pg_' AND nspname NOT IN ('information_schema','public')) + (SELECT count(*) FROM pg_largeobject_metadata);")
[[ "$objects" == 0 ]] || fail '目标数据库不是空库，已拒绝恢复；不会清空或覆盖已有数据。请在新环境恢复。'
phase='停止网站并恢复到空数据库'
stop_service web
"${compose[@]}" exec -T db pg_restore -U ai_service -d ai_service --no-owner --no-privileges --single-transaction --exit-on-error < "$restore_path/database.dump"
printf '\n数据库恢复完成，现有 .env 保持不变。\n下一步：bash deploy.sh %s（应用迁移并启动网站）\n' "$engine"
