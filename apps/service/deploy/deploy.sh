#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

deploy_path=${1:?缺少部署目录}
project=${2:?缺少 Compose 项目名}
export MEWCAT_IMAGE_TAG=${3:?缺少镜像版本}
incoming=${4:?缺少发布包目录}
[[ "$deploy_path" =~ ^/[a-zA-Z0-9_/-]+$ && "$deploy_path" != / ]]
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]]
[[ "$MEWCAT_IMAGE_TAG" =~ ^[a-f0-9]{40}$ ]]
[[ "$incoming" =~ ^/tmp/mewcat-[0-9]+-[0-9]+$ ]]
trap 'rm -f "$incoming/runtime.env"' EXIT
cd "$deploy_path"
test -s .env || { echo '请先配置服务器 .env'; exit 1; }
test -s secrets/server-keys.json || { echo '请先生成服务器密钥'; exit 1; }
docker compose version
exec 9> .deploy.lock
flock -n 9 || { echo '已有部署正在执行'; exit 1; }

release="$deploy_path/.deploy/releases/$(basename "$incoming")"
mkdir -p "$release"
cp "$incoming/compose.yaml" "$incoming/compose.images.yaml" "$release/"
printf 'MEWCAT_IMAGE_TAG=%s\n' "$MEWCAT_IMAGE_TAG" > "$release/image.env"
compose=(docker compose --project-directory "$deploy_path" -p "$project" -f "$release/compose.yaml" -f "$release/compose.images.yaml")
"${compose[@]}" config --quiet
# 镜像导入完成后才停止旧服务。
gzip -dc "$incoming/images.tar.gz" | docker load
docker image inspect "mewcat-api:$MEWCAT_IMAGE_TAG" "mewcat-tools:$MEWCAT_IMAGE_TAG" > /dev/null
"${compose[@]}" run --rm --no-deps --pull never migrate test -r /app/data

backup="$deploy_path/.deploy/backups/$(basename "$incoming")"
mkdir -p "$backup/data"
cp -a .env secrets "$backup/"
if [[ -L .deploy/current ]]; then
  readlink -f .deploy/current > "$backup/previous-release"
fi
test -s "$incoming/runtime.env" || { echo '缺少生产运行时配置'; exit 1; }
"${compose[@]}" run --rm --no-deps --pull never --user 0 \
  -v "$deploy_path:/deployment" \
  -v "$incoming:/incoming:ro" \
  migrate node dist/scripts/update-runtime-env.js /deployment/.env /incoming/runtime.env
"${compose[@]}" stop api
on_error() {
  echo "部署失败；备份位于 $backup，发布配置位于 $release。检查数据库迁移状态后人工恢复。" >&2
}
trap on_error ERR
# 服务已停止，完整复制 SQLite 目录（包括可能存在的 WAL 文件）。
"${compose[@]}" run --rm --no-deps --pull never --user 0 \
  -v "$backup/data:/backup" migrate cp -a /app/data/. /backup/
"${compose[@]}" run --rm --no-deps --pull never migrate
"${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 api
# 只有健康检查通过才更新成功发布指针。
ln -sfn "$release" .deploy/current
# 清理失败只告警，不影响已健康启动的服务；下次成功部署时重试。
if ! bash "$incoming/cleanup-images.sh" "$deploy_path" "$MEWCAT_IMAGE_TAG"; then
  echo '镜像清理未完成，服务已成功部署，请检查 Docker 状态及磁盘空间。' >&2
fi
rm -f \
  "$incoming/images.tar.gz" \
  "$incoming"/images.tar.gz.part-* \
  "$incoming/compose.yaml" \
  "$incoming/compose.images.yaml" \
  "$incoming/deploy.sh" \
  "$incoming/cleanup-images.sh" \
  "$incoming/runtime.env"
rmdir "$incoming" || true
echo "部署成功：$MEWCAT_IMAGE_TAG；备份：$backup"
