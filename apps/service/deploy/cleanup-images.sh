#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# 由 deploy.sh 在健康检查成功后、仍持有部署锁时调用。
deploy_path=${1:?缺少部署目录}
current_tag=${2:?缺少当前镜像版本}
[[ "$current_tag" =~ ^[a-f0-9]{40}$ ]]
cd "$deploy_path"
test -d .deploy/releases

# 仅管理这个部署目录发布过的 SHA，不扫描其他项目来决定删除对象。
declare -A managed_tags=()
shopt -s nullglob
for metadata in .deploy/releases/*/image.env; do
  value=$(cat "$metadata")
  if [[ "$value" =~ ^MEWCAT_IMAGE_TAG=([a-f0-9]{40})$ ]]; then
    managed_tags["${BASH_REMATCH[1]}"]=1
  fi
done
[[ ${managed_tags[$current_tag]+present} ]] || { echo '当前版本缺少发布记录，跳过镜像清理' >&2; exit 1; }

temporary=$(mktemp .deploy/successful-images.XXXXXX)
trap 'rm -f "$temporary"' EXIT
printf '%s\n' "$current_tag" > "$temporary"
mv "$temporary" .deploy/successful-images

# 一次获取镜像和所有容器的引用；任何查询失败都不能继续删除。
images=$(docker image ls --no-trunc --format '{{.Repository}}:{{.Tag}} {{.ID}}')
containers=$(docker container ls -aq)
declare -A used_images=()
if [[ -n "$containers" ]]; then
  mapfile -t container_ids <<< "$containers"
  references=$(docker container inspect --format '{{.Image}}' "${container_ids[@]}")
  while IFS= read -r image_id; do
    [[ -z "$image_id" ]] || used_images["$image_id"]=1
  done <<< "$references"
fi

while read -r image image_id; do
  if [[ "$image" =~ ^mewcat-(api|tools):([a-f0-9]{40})$ ]]; then
    version=${BASH_REMATCH[2]}
    [[ ${managed_tags[$version]+present} ]] || continue
    [[ "$version" != "$current_tag" ]] || continue
    [[ ! ${used_images[$image_id]+present} ]] || continue
    # 不使用 --force；并发出现新容器引用时，由 Docker 拒绝删除。
    if ! docker image rm "$image"; then
      echo "未能清理镜像 $image，留待下次部署重试" >&2
    fi
  fi
done <<< "$images"
echo '镜像清理完成：仅保留当前成功版本及所有被容器引用的镜像'
