#!/usr/bin/env bash
# Run with bash scripts/deploy.sh podman (or docker). Keep the existing .env/volumes.
set -Eeuo pipefail

fail() { printf '%s\n' "$*" >&2; exit 1; }
engine=${1:-podman}
[[ $# -le 1 && "$engine" =~ ^(podman|docker)$ ]] || fail '用法：bash scripts/deploy.sh [podman|docker]'
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
for dependency in "$engine" curl flock timeout; do
  command -v "$dependency" >/dev/null || fail "缺少命令：$dependency"
done
[[ -f .env ]] || fail '缺少 .env，请先准备项目配置；脚本不会重置已有密码。'

# Lock this checkout, without including configuration in command output.
exec 9>.deploy.lock
flock -n 9 || fail '本项目已有部署正在运行，请等待其完成。'
compose=("$engine" compose -f compose.yaml)
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
"${compose[@]}" stop web
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
"$engine" ps
