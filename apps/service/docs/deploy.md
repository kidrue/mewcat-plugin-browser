# 服务部署与运维

生产使用单台 Linux 主机、Docker Compose、Nginx 和 HTTPS。API 容器只绑定宿主机 `127.0.0.1:3000`，SQLite 使用命名卷，由单个 API 进程访问。构建、迁移与恢复始终使用同一个 Compose 项目名。

## Docker 验收

在仓库根目录运行以下命令。Linux CI 强制执行 Docker 专项检查。

```bash
docker build --target tools -t mewcat-tools:ci -f apps/service/Dockerfile .
docker build --target runtime -t mewcat-api:ci -f apps/service/Dockerfile .
pnpm --filter @mewcat/service test:docker
node scripts/container-smoke.mjs
```

[`Dockerfile`](../Dockerfile) 从服务端 workspace 的依赖闭包构建，使用 `pnpm deploy --legacy` 导出。tools 镜像包含 Prisma CLI，runtime 镜像包含运行依赖和编译产物，工作目录均为 `/app`。容器 smoke 使用临时 Compose 项目、数据库和测试密钥，验证迁移、启动、健康检查、SDK 注册和用量查询，结束后清理临时资源。测试不调用付费接口。缺少 Docker 时，`test:docker` 直接失败，普通测试会报告跳过的容器测试数量。

## 首次初始化

以下命令在阿里云服务器的 Bash 中执行，适用于 Ubuntu 22.04/24.04。先配置域名 A 记录，按实际网络配置 AAAA 记录。在轻量服务器和宿主机防火墙放行 TCP 80、443，按管理与部署来源放行 SSH，保持 3000 仅可从本机访问。中国内地节点的备案与接入条件见 [阿里云使用限制](https://help.aliyun.com/zh/simple-application-server/product-overview/usage-notes)。

```bash
sudo -i
cat /etc/os-release
apt-get update
apt-get install -y ca-certificates curl git nginx
# 按 Docker 官方说明安装 Docker Engine、Buildx 和 Compose v2。
systemctl enable --now docker nginx
docker compose version
uname -m
```

使用支持 `docker compose up --wait --wait-timeout` 的 Compose v2。安装及处理系统自带 Docker 包的步骤见 [Docker Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)。

### 构建镜像和生成密钥

源码目录只用于构建。后续命令在同一个 Bash 会话中执行。新装使用默认项目名 `mewcat-service`，已有实例沿用现有项目名和数据库卷。

```bash
MEWCAT_SOURCE=/opt/mewCat-service-src
MEWCAT_DEPLOY=/opt/mewCat-service
git clone https://github.com/kidrue/mewcat-plugin-browser.git "$MEWCAT_SOURCE"
install -m 0700 -d "$MEWCAT_DEPLOY"
export MEWCAT_IMAGE_TAG="$(git -C "$MEWCAT_SOURCE" rev-parse HEAD)"

docker build --target tools -t "mewcat-tools:$MEWCAT_IMAGE_TAG" \
  -f "$MEWCAT_SOURCE/apps/service/Dockerfile" "$MEWCAT_SOURCE"
docker build --target runtime -t "mewcat-api:$MEWCAT_IMAGE_TAG" \
  -f "$MEWCAT_SOURCE/apps/service/Dockerfile" "$MEWCAT_SOURCE"
cp "$MEWCAT_SOURCE/apps/service/compose.yaml" \
  "$MEWCAT_SOURCE/apps/service/deploy/compose.images.yaml" "$MEWCAT_DEPLOY/"
cd "$MEWCAT_DEPLOY"
dc=(docker compose --project-directory "$PWD" -p mewcat-service \
  -f compose.yaml -f compose.images.yaml)

test -f .env || install -m 0600 "$MEWCAT_SOURCE/.env.example" .env
chmod 600 .env
${EDITOR:-vi} .env
```

在服务器 `.env` 填写 `SILICONFLOW_API_KEY` 和 `SILICONFLOW_MODEL`，按需设置 [API 限额](api.md#默认限额)及 [统计配置](analytics.md)。部署目录的 `.env` 由 Compose 加载。本机开发配置使用仓库根 `.env.local`，两个文件都包含可能的秘密，应存放在各自运行环境。允许来源维护在 [`config/allowed-origins.json`](../config/allowed-origins.json)，`ALLOWED_ORIGINS` 留空时使用镜像内的列表，手动部署可用逗号分隔的列表明确覆盖。更换扩展渠道、开发路径或 Chrome 配置后，从 `chrome://extensions` 核对实际 ID。

```bash
install -d -m 0700 -o 1000 -g 1000 secrets
"${dc[@]}" run --rm --no-deps --pull never \
  -e KEYS_FILE=/app/secrets/server-keys.json \
  -v "$PWD/secrets:/app/secrets" migrate node dist/scripts/admin.js keys
"${dc[@]}" run --rm --no-deps --pull never migrate
"${dc[@]}" up -d --no-deps --no-build --wait api
curl --fail http://127.0.0.1:3000/health
```

首次生成的密钥文件归容器用户 UID 1000，API 只读挂载。保存命令显示的签名公钥指纹，用于扩展固定服务器身份。已有实例保留原密钥。扩展接入时使用 HTTPS 服务地址、相应的 `host_permissions` 及签名公钥指纹。

### Nginx 与 HTTPS

已有站点时先核对端口和 Nginx 配置。使用 [Nginx 模板](../deploy/nginx.conf) 将 80/443 的流量转发至 API。它覆盖入站 `X-Forwarded-For`，应用只信任明确配置的代理 IP/CIDR。

```bash
MEWCAT_GATEWAY=$(docker inspect "$("${dc[@]}" ps -q api)" \
  --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}')
test -n "$MEWCAT_GATEWAY" || { echo '未找到容器网关'; exit 1; }
sed -i "s/^TRUST_PROXY=.*/TRUST_PROXY=127.0.0.1,::1,$MEWCAT_GATEWAY/" .env
"${dc[@]}" up -d --no-deps --no-build --wait api

MEWCAT_DOMAIN=translate.example.com
sed "s/translate.example.com/$MEWCAT_DOMAIN/g" "$MEWCAT_SOURCE/apps/service/deploy/nginx.conf" \
  > /etc/nginx/conf.d/mewcat.conf
nginx -t && systemctl reload nginx
apt-get install -y certbot python3-certbot-nginx
MEWCAT_EMAIL=ops@example.com
certbot --nginx -d "$MEWCAT_DOMAIN" --redirect --agree-tos --non-interactive -m "$MEWCAT_EMAIL"
systemctl enable --now certbot.timer
certbot renew --dry-run
curl --fail "https://$MEWCAT_DOMAIN/health"
```

运行前替换域名和证书通知邮箱。已有 Certbot 时沿用原安装和续期配置。Docker 网络重建后重新核对实际网关，再更新 `TRUST_PROXY` 并重新创建 API 容器。

## GitHub Actions 自动部署

[`deploy-service.yml`](../../../.github/workflows/deploy-service.yml) 在 `main` 上按改动路径触发，也可手动运行「后端构建与部署」。服务目录文档改动也符合路径过滤。工作流执行检查、验证构建、smoke 和 Docker 测试，构建以提交 SHA 标记的 tools 与 runtime 镜像。部署用 SSH 分块直传镜像，服务器无需访问镜像仓库。部署任务要求 `main`、`production` 环境和仓库 Variable `SERVICE_DEPLOY_ENABLED=true`。未经授权保持关闭。

### SSH 与部署配置

部署服务器需要 Bash、tar、gzip、flock 和 Docker Compose v2。SSH 用户需能执行 Docker，读写部署目录及备份所需配置和密钥。防火墙需允许 Runner 访问 SSH，例如为固定出口的 Runner 设置白名单。通过下列命令核对现有项目与卷，避免更新时创建空数据库。

```bash
docker inspect "$("${dc[@]}" ps -q api)" \
  --format '{{index .Config.Labels "com.docker.compose.project"}}'
docker inspect "$("${dc[@]}" ps -q api)" \
  --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}'
```

从可信管理机生成专用无口令 SSH 密钥，将公钥安装到部署用户的 `~/.ssh/authorized_keys`。从阿里云控制台取得服务器主机公钥指纹，和管理机扫描结果核对后，将完整 `known_hosts` 行存入环境 Secret。

```bash
# 可信管理机
ssh-keygen -t ed25519 -N '' -C 'github-actions-mewcat' -f ./mewcat_actions
ssh-keyscan -t ed25519 -p 22 example.com > aliyun_known_hosts
ssh-keygen -lf aliyun_known_hosts
# 阿里云控制台终端
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

替换服务器主机名和 SSH 端口。工作流启用严格主机密钥校验。将 `production` 环境的部署分支限制为 `main`。

| 配置位置 | 名称 | 值或用途 |
| --- | --- | --- |
| 仓库 Variables | `SERVICE_DEPLOY_ENABLED` | 明确批准启用时设为 `true` |
| 仓库 Variables | `ALIYUN_PLATFORM` | 默认 `linux/amd64`，ARM 服务器设为 `linux/arm64`。构建和部署均读取 |
| 仓库 Variables | `ALIYUN_SSH_PORT`、`ALIYUN_DEPLOY_PATH`、`ALIYUN_COMPOSE_PROJECT` | 默认分别为 `22`、`/opt/mewCat-service`、`mewcat-service` |
| `production` Secrets | `ALIYUN_HOST`、`ALIYUN_USER` | 服务器域名或公网 IPv4、SSH 用户 |
| `production` Secrets | `ALIYUN_SSH_PRIVATE_KEY`、`ALIYUN_SSH_KNOWN_HOSTS` | 完整部署私钥和经核验的完整 `known_hosts` 行 |
| `production` Secrets | `SILICONFLOW_API_KEY` | 生产供应商密钥 |
| `production` Secrets | `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`FEEDBACK_TO` | 七项同时填写或同时留空。全部留空时保留服务器原有设置 |
| `production` Variables | `SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL` | 默认 `https://api.siliconflow.cn/v1`、`deepseek-ai/DeepSeek-V4-Flash` |
| `production` Variables | `CLIENT_DAILY_CHARACTERS`、`IP_DAILY_CHARACTERS`、`GLOBAL_DAILY_CHARACTERS`、`GLOBAL_DAILY_REQUESTS` | 默认分别为 `500000`、`500000`、`0`、`0` |
| `production` Variables | `TRUST_PROXY` | 明确的代理 IP/CIDR 列表。留空保留服务器现有设置 |
| `production` Variables | `ANALYTICS_ADMIN_CLIENT_IDS`、`ANALYTICS_ADMIN_CLEAR` | 用逗号分隔设备 UUID。ID 列表留空保留服务器现有配置，`ANALYTICS_ADMIN_CLEAR=true` 优先清空名单，清空后将开关移除或设回 `false` |

工作流从构建产物导出来源白名单并同步到服务器 `.env`。上述生产凭据只通过 SSH stdin 写入受限远端临时文件，在停止旧 API 前验证配置并原子更新 `.env`。服务器身份密钥、分析内容密钥和分析开关按服务器原有配置保留。变更 GitHub Secrets 后重新运行部署以更新运行实例。部署使用 GitHub 并发组及服务器 `.deploy.lock`，进行中的迁移不会被新运行取消。

### 反馈邮件

手动部署时在服务器 `.env` 设置 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`。发件邮箱须为 SMTP 服务商授权地址。固定收件人由 `FEEDBACK_TO` 设置，默认 `kidrue.me@gmail.com`。默认端口 587 使用 STARTTLS，端口 465 或 `SMTP_SECURE=true` 使用隐式 TLS。连接、问候和读写超时分别为 10 秒，连接要求 TLS 并校验证书。四项必需 SMTP 配置缺失时反馈接口返回 `503 FEEDBACK_UNAVAILABLE`，翻译服务仍可运行。应用专用密码存入 `SMTP_PASS`。

`pnpm --filter @mewcat/service check` 包含加密 API、限流、重放、撤销和本地 SMTP 测试，验证 STARTTLS、固定收件人及 `Reply-To`。本地测试不会投递到真实邮箱。经授权完成生产部署后，用测试设备提交一条反馈，核对回执、收件箱及垃圾邮件，再确认翻译正常。

## 发布后管理

成功发布时更新 `.deploy/current`，发布文件和镜像 SHA 记录在 `.deploy/releases/`，配置和 SQLite 备份在 `.deploy/backups/`。每次更新都会短暂停止 API，迁移或健康检查失败后须检查失败版本日志，`.deploy/current` 仍指向上次成功发布。脚本不会自动回滚 SQLite。

```bash
cd /opt/mewCat-service
# 按现有部署填写项目名，并加载该版本的镜像标签。
. .deploy/current/image.env
export MEWCAT_IMAGE_TAG
dc=(docker compose --project-directory "$PWD" -p mewcat-service \
  -f .deploy/current/compose.yaml -f .deploy/current/compose.images.yaml)
"${dc[@]}" ps
"${dc[@]}" logs --tail=100 api
"${dc[@]}" run --rm --no-deps --pull never migrate node dist/scripts/admin.js clients
# 需要撤销已确认的设备时替换 UUID。
"${dc[@]}" run --rm --no-deps --pull never migrate node dist/scripts/admin.js revoke '<clientId>'
```

没有自动发布记录时，使用首次初始化的 `dc` 和镜像标签。健康检查通过后，[`cleanup-images.sh`](../deploy/cleanup-images.sh) 清理该部署目录记录的旧镜像，保留当前镜像及仍被运行中或已停止容器引用的镜像。老镜像可能需要从对应提交重建或重新导入。卷、密钥和历史备份独立保留，备份与失败上传留在 `/tmp/mewcat-*` 的文件需单独维护。

## 备份与恢复

[`deploy.sh`](../deploy/deploy.sh) 备份旧配置和密钥，停止 API 后复制完整 SQLite 数据目录（包括可能存在的 WAL 文件），再执行迁移。手工备份与恢复共用部署锁。先按 [发布后管理](#发布后管理) 设置 `dc` 和镜像标签，再在部署目录运行。

```bash
(
  set -euo pipefail
  umask 077
  exec 9>.deploy.lock
  flock -n 9
  backup="/var/backups/mewcat/$(date +%Y%m%d-%H%M%S)"
  install -d -m 0700 "$backup/data"
  cp -a .env secrets "$backup/"
  printf 'MEWCAT_IMAGE_TAG=%s\n' "$MEWCAT_IMAGE_TAG" > "$backup/image.env"
  if [[ -L .deploy/current ]]; then
    readlink -f .deploy/current > "$backup/previous-release"
  fi
  "${dc[@]}" stop api
  trap '"${dc[@]}" start api' EXIT
  "${dc[@]}" run --rm --no-deps --pull never --user 0 \
    -v "$backup/data:/backup" migrate cp -a /app/data/. /backup/
)
```

备份含运行凭据与服务器身份，内容分析密钥也随 `.env` 保存。使用访问受控的服务器外部存储。恢复需配对使用旧数据库、对应的镜像、Compose 文件和服务器密钥。自动备份在完成过成功部署时附有 `previous-release`。首次自动部署前的备份可能缺少 `previous-release` 和 `image.env`，此时先把 `MEWCAT_IMAGE_TAG` 设为初装时的提交 SHA。旧镜像已被清理时，先重新导入或从对应提交构建两组镜像。

```bash
(
  set -euo pipefail
  cd /opt/mewCat-service
  umask 077
  exec 9>.deploy.lock
  flock -n 9
  backup=/var/backups/mewcat/替换为备份目录
  project=mewcat-service
  release="$PWD"
  if [[ -s "$backup/previous-release" ]]; then
    release=$(<"$backup/previous-release")
    . "$release/image.env"
  elif [[ -s "$backup/image.env" ]]; then
    . "$backup/image.env"
  fi
  [[ ${MEWCAT_IMAGE_TAG:-} =~ ^[a-f0-9]{40}$ ]]
  export MEWCAT_IMAGE_TAG
  restore_dc=(docker compose --project-directory "$PWD" -p "$project" \
    -f "$release/compose.yaml" -f "$release/compose.images.yaml")
  test -s "$backup/data/mewcat.db"
  test -s "$backup/.env"
  test -s "$backup/secrets/server-keys.json"
  docker image inspect "mewcat-api:$MEWCAT_IMAGE_TAG" "mewcat-tools:$MEWCAT_IMAGE_TAG" >/dev/null
  "${restore_dc[@]}" config --quiet

  safety="/var/backups/mewcat/pre-restore-$(date +%Y%m%d-%H%M%S)"
  install -d -m 0700 "$safety/data"
  cp -a .env secrets "$safety/"
  "${restore_dc[@]}" stop api
  "${restore_dc[@]}" run --rm --no-deps --pull never --user 0 \
    -v "$backup/data:/restore:ro" -v "$safety/data:/before" \
    migrate sh -ec '
      find /app/data -mindepth 1 -maxdepth 1 -exec mv -t /before -- {} +
      cp -a /restore/. /app/data/
    '
  cp -a "$backup/.env" .env
  cp -a "$backup/secrets/." secrets/
  "${restore_dc[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 api
  curl --fail http://127.0.0.1:3000/health

  if [[ "$release" == "$PWD" ]]; then
    release="$PWD/.deploy/releases/restored-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$release"
    cp compose.yaml compose.images.yaml "$release/"
    printf 'MEWCAT_IMAGE_TAG=%s\n' "$MEWCAT_IMAGE_TAG" > "$release/image.env"
  fi
  ln -sfn "$release" .deploy/current
)
```

运行前替换备份路径并核对原 Compose 项目名。恢复使用原数据库卷，避免运行 `docker compose down -v`。检查公网健康和设备能否以原身份建立签名加密连接。

## 排障

使用对应部署版本的 Compose 配置检查 `ps` 和 `logs --tail=100 api`，并核对失败发布日志中的迁移结果。宿主机健康、外部不可用时检查 DNS、防火墙与 `nginx -t`。多设备共同触发异常 IP 限额时核对实际代理网关。容器无法启动时检查 `.env` 必填项、密钥所有者 UID 1000 和数据库迁移。真实翻译失败时查供应商模型、余额和限额，服务不会自动重试付费翻译。
