#!/usr/bin/env bash
# Also accepts the original: bash scripts/deploy.sh podman (or docker).
set -Eeuo pipefail

fail() { printf '%s\n' "$*" >&2; exit 1; }
engine=''
action=deploy
for argument in "$@"; do
  case "$argument" in
    podman|docker) [[ -z "$engine" ]] || fail '只能指定一个容器引擎。'; engine=$argument ;;
    deploy|status|logs|stop) action=$argument ;;
    -h|--help)
      printf '用法：bash deploy.sh [podman|docker] [deploy|status|logs|stop]\n默认：自动识别引擎并部署；首次自动生成 .env，更新保留已有配置与数据。\n'
      exit 0 ;;
    *) fail "未知参数：$argument。使用 bash deploy.sh --help 查看用法。" ;;
  esac
done
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ -z "$engine" ]]; then
  if command -v podman >/dev/null && command -v docker >/dev/null; then
    fail '同时检测到 Podman 和 Docker，请指定原来使用的引擎：bash deploy.sh podman 或 bash deploy.sh docker。'
  elif command -v podman >/dev/null; then engine=podman
  elif command -v docker >/dev/null; then engine=docker
  else fail '请先安装 Podman + podman-compose，或 Docker + Compose 插件。'
  fi
fi
for dependency in "$engine" flock; do
  command -v "$dependency" >/dev/null || fail "缺少命令：$dependency"
done
"$engine" info >/dev/null 2>&1 || fail "$engine 尚未就绪，请检查容器引擎及当前用户权限。"
"$engine" compose version >/dev/null 2>&1 || fail "缺少可用的 Compose provider。Podman 请安装 podman-compose；Docker 请安装 Compose 插件。"
compose=("$engine" compose -f compose.yaml)
stop_service() {
  # Older podman-compose ps cannot filter by service. Filter its project IDs
  # using the standard Compose service label, then check the engine exit code.
  local ids id service
  ids=$("${compose[@]}" ps -q)
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    service=$("$engine" inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$id")
    if [[ "$service" == "$1" ]]; then "$engine" stop "$id"; fi
  done <<< "$ids"
}
if [[ "$action" == status ]]; then
  [[ -f .env ]] || fail '项目尚未初始化，请先运行 bash deploy.sh。'
  exec "${compose[@]}" ps
elif [[ "$action" == logs ]]; then
  [[ -f .env ]] || fail '项目尚未初始化，请先运行 bash deploy.sh。'
  exec "${compose[@]}" logs --tail=100 db web
fi

# Lock this checkout, without including configuration in command output.
exec 9>.deploy.lock
flock -n 9 || fail '本项目已有部署正在运行，请等待其完成。'
if [[ "$action" == stop ]]; then
  [[ -f .env ]] || fail '项目尚未初始化，无需停止。'
  stop_service web
  stop_service db
  printf '网站和数据库已停止，配置与数据卷保留。重新部署：bash deploy.sh %s\n' "$engine"
  exit 0
fi
for dependency in curl timeout; do
  command -v "$dependency" >/dev/null || fail "缺少命令：$dependency"
done
printf '容器引擎：%s\n' "$engine"

# Never source .env as shell code. Temporary files belong to the host user,
# without bind mounts (avoids Rocky SELinux and rootless UID mapping issues).
bootstrap_dir=''
cleanup() { [[ -z "$bootstrap_dir" ]] || rm -rf -- "$bootstrap_dir"; }
trap cleanup EXIT
if [[ ! -e .env && ! -L .env ]]; then
  project=${COMPOSE_PROJECT_NAME:-$(basename -- "$PWD")}
  project=$(printf '%s' "$project" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')
  [[ -n "$project" ]] || fail '无法识别 Compose 项目名称。'
  volumes=$("$engine" volume ls --format '{{.Name}}')
  while IFS= read -r volume; do
    if [[ "$volume" == "${project}_postgres_data" ]]; then
      fail '发现已有数据库卷但缺少 .env。请先恢复原 .env，避免生成与旧数据库不匹配的新密码。'
    fi
  done <<< "$volumes"
  [[ ! -e .admin-credentials ]] || fail '已有管理员凭据文件但缺少 .env，请先恢复原配置。'
  printf '首次部署：在临时容器中生成配置，无需在宿主机安装 Node.js。\n'
  bootstrap_dir=$(mktemp -d .bootstrap.XXXXXX)
  chmod 700 "$bootstrap_dir"
  "$engine" pull docker.io/library/node:24-bookworm-slim
  if ! "$engine" run --rm -i --pull=never --network=none --log-driver=none \
      docker.io/library/node:24-bookworm-slim node --input-type=module \
      < scripts/container-env.mjs > "$bootstrap_dir/env" 2> "$bootstrap_dir/credentials"; then
    fail '配置生成失败；.env 尚未创建。请检查 Node 镜像能否正常运行后重试。'
  fi
  [[ -s "$bootstrap_dir/env" && -s "$bootstrap_dir/credentials" ]] || fail '配置生成结果为空，部署已停止。'
  chmod 600 "$bootstrap_dir/env" "$bootstrap_dir/credentials"
  mv -- "$bootstrap_dir/credentials" .admin-credentials
  mv -- "$bootstrap_dir/env" .env
  printf '配置已生成。管理员初始密码保存在 .admin-credentials（仅当前用户可读）。\n'
fi
phase='检查 Compose 配置'
on_error() {
  code=$?
  printf '\n部署未完成：%s。数据库卷和 .env 均保留。\n' "$phase" >&2
  printf '检查原因后重新运行脚本；若迁移失败，网站保持停止，不自动回退数据库。\n' >&2
  printf '查看日志：%s compose -f compose.yaml logs --tail=100 db web\n' "$engine" >&2
  exit "$code"
}
trap on_error ERR
"${compose[@]}" config >/dev/null

phase='构建网站和迁移镜像'
printf '[1/5] %s（构建失败不会停止现有网站）\n' "$phase"
"${compose[@]}" build migrate web

phase='启动并等待数据库'
printf '[2/5] %s\n' "$phase"
"${compose[@]}" up -d db
db_ready=false
for ((attempt=1; attempt<=30; attempt++)); do
  if timeout 8 "${compose[@]}" exec -T db pg_isready -U ai_service -d ai_service -t 3 >/dev/null 2>&1; then
    db_ready=true
    break
  fi
  sleep 2
done
[[ "$db_ready" == true ]]

phase='停止旧网站并应用数据库迁移'
printf '[3/5] %s\n' "$phase"
stop_service web
"${compose[@]}" run --rm --no-deps migrate

phase='用新镜像重新创建网站'
printf '[4/5] %s\n' "$phase"
"${compose[@]}" up -d --no-deps --force-recreate web

phase='检查套餐页面与数据库连接'
printf '[5/5] %s\n' "$phase"
web_ready=false
for ((attempt=1; attempt<=30; attempt++)); do
  # /packages is dynamic and queries the database, unlike the static home page.
  status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 8 http://127.0.0.1:3000/packages) || status=000
  if [[ "$status" == 200 ]]; then
    web_ready=true
    break
  fi
  sleep 2
done
[[ "$web_ready" == true ]]
printf '\n部署完成：套餐页面 HTTP 200。管理工作台：/admin/overview\n'
printf '本机访问：http://localhost:3000\n状态：bash deploy.sh %s status\n日志：bash deploy.sh %s logs\n' "$engine" "$engine"
if [[ -f .admin-credentials ]]; then
  printf '查看初始管理员密码：cat .admin-credentials（若后来重置过密码，以新密码为准）\n'
fi
"$engine" ps
