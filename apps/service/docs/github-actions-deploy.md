# GitHub Actions 自动部署到阿里云

推送到 `main` 后，工作流运行测试、类型检查、构建和 smoke 检查，构建 runtime/tools 两个镜像，以提交 SHA 标记，通过 SSH 上传到阿里云服务器。服务器导入镜像、停止 API、备份 SQLite 数据与配置、执行迁移，再启动 API 并等待健康检查。也可以在 Actions → 部署到阿里云 → Run workflow 手动重跑 `main`。

使用镜像文件直传，不需要 ACR、Docker Hub 或 GHCR 账号，服务器更新时也无需访问镜像仓库。镜像包含原生 SQLite 依赖，目标架构必须与服务器一致。上传包含工具镜像，耗时与 GitHub 到服务器的带宽有关。

## 1. 服务器准备（一次）

先按照 [Ubuntu 部署命令](deploy-aliyun.md) 完成初次部署、`.env`、服务器密钥、Nginx 和 HTTPS。默认目录 `/opt/mewCat-service`，默认 Linux x86_64；首次初始化仍按原文档构建。之后自动部署不再拉取源码或现场构建镜像。

SSH 用户必须能执行 Docker、读写部署目录和备份密钥。现有文档使用 root；如果使用专用部署账户，需要预先配置 Docker 权限及目录权限。需要 Bash、tar、gzip、flock 和支持 `docker compose up --wait --wait-timeout` 的 Compose v2 插件。

在服务器检查：

```bash
cd /opt/mewCat-service
docker compose version
uname -m
docker inspect "$(docker compose ps -q api)" --format '{{index .Config.Labels "com.docker.compose.project"}}'
docker inspect "$(docker compose ps -q api)" --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}'
```

记录实际 Compose 项目名和数据库卷名。默认项目名 `mewcat-service` 对应 `mewcat-service_database`。若原部署使用过 `-p` 或 `COMPOSE_PROJECT_NAME`，必须把下面的 `ALIYUN_COMPOSE_PROJECT` 设置为原项目名，否则会创建新的空数据库卷。不要同时运行旧的手动更新流程。

SSH 端口必须允许 GitHub Runner 连接。若防火墙仅放行你的管理 IP，默认托管 Runner 无法连接；可以使用具有固定出口的 Runner 并修改 `runs-on`。数据库和服务仍只通过本机 `127.0.0.1:3000` 提供给 Nginx，不开放公网 3000。

## 2. 配置 SSH 密钥及主机校验

在可信管理机器上生成一对专用、无口令的部署密钥，将公钥追加到服务器对应用户的 `~/.ssh/authorized_keys`，私钥存入下面的 GitHub Secret。它与服务器拉取 GitHub 源码的 Deploy key 用途不同。

```bash
ssh-keygen -t ed25519 -N '' -C 'github-actions-mewcat' -f ./mewcat_actions
```

通过阿里云控制台终端核对服务器主机密钥指纹：

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

在可信管理机器获取 known_hosts 行，并核对其指纹与上述输出一致：

```bash
ssh-keyscan -t ed25519 -p 22 你的服务器IP > aliyun_known_hosts
ssh-keygen -lf aliyun_known_hosts
```

`ssh-keyscan` 自身不能验证服务器身份，所以必须核对。将 `aliyun_known_hosts` 文件的完整内容存入 Secret，不是仅存 SHA256 指纹。使用非 22 端口时，两处命令及下方变量都要使用实际端口。

## 3. GitHub 配置

在仓库 Settings → Environments 创建 `production`，可限制部署分支为 `main`。需要完全自动执行时，不设置人工审批。以下 Secrets 可以放在该环境或仓库 Settings → Secrets and variables → Actions 中：

| Secret | 内容 |
| --- | --- |
| `ALIYUN_HOST` | 服务器公网 IPv4 或域名，不带协议和端口 |
| `ALIYUN_USER` | SSH 用户，例如 `root` |
| `ALIYUN_SSH_PRIVATE_KEY` | 上一步生成的完整私钥，包含 BEGIN/END 行 |
| `ALIYUN_SSH_KNOWN_HOSTS` | 经核验的 known_hosts 行 |
| `SILICONFLOW_API_KEY` | 生产翻译供应商 API Key；必须放在 `production` Environment Secret，不使用 Variable |
| `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE` | 反馈邮件服务器、端口及隐式 TLS 开关，例如 Gmail 使用 `smtp.gmail.com`、`587`、`false` |
| `SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`FEEDBACK_TO` | 反馈发信账号、应用专用密码、发件地址及固定收件地址；七项 SMTP 配置需一并保存在 `production` Environment Secrets |

可选 Variables：

| Variable | 默认值 | 用途 |
| --- | --- | --- |
| `ALIYUN_SSH_PORT` | `22` | SSH 端口 |
| `ALIYUN_DEPLOY_PATH` | `/opt/mewCat-service` | 已完成初始化的绝对路径，仅支持字母、数字、下划线、连字符及 `/` |
| `ALIYUN_COMPOSE_PROJECT` | `mewcat-service` | 必须与现有部署项目名一致 |
| `ALIYUN_PLATFORM` | `linux/amd64` | `uname -m` 为 `aarch64` 时设置 `linux/arm64` |
| `SILICONFLOW_BASE_URL` | `https://api.siliconflow.cn/v1` | 生产翻译供应商 OpenAI 兼容 API 地址 |
| `SILICONFLOW_MODEL` | `deepseek-ai/DeepSeek-V4-Flash` | 生产翻译模型标识符 |

接口访问白名单统一维护在仓库 [`config/allowed-origins.json`](../config/allowed-origins.json)，每项填写完整的 `chrome-extension://扩展ID`。构建会拒绝空列表及非法来源，并将配置打包进产物和镜像；构建后通过 `dist/scripts/export-allowed-origins.js` 导出到 `GITHUB_ENV`，部署时写入服务器 `.env` 的 `ALLOWED_ORIGINS`，覆盖旧值。后续仅需修改这个 JSON 文件并推送 `main`，无需在 GitHub Variables 或服务器重复维护列表。

服务器身份密钥继续只保存在服务器上。供应商 API Key 和 SMTP 配置由 `production` Environment Secrets 管理：工作流仅在部署步骤读取它们，通过 SSH stdin 写入权限为 `0600` 的远端临时文件，不进入 Docker build 参数、镜像、发布压缩包或命令参数。部署脚本先备份旧 `.env`，再原子更新供应商、来源白名单及 SMTP 配置；配置非法时会在停止旧 API 前失败。SMTP 七项要么全部提供，要么全部留空；全部留空时保留服务器原有 SMTP 配置。成功部署后删除临时文件。`.env.local` 仅作本机配置来源，不提交到 Git。更新 GitHub Secrets 后需重新运行部署，运行中的容器才会加载新值。

## 4. 发布后管理

成功发布指向 `.deploy/current`；每次发布的 Compose 文件和镜像 SHA 保存在 `.deploy/releases/`，备份在 `.deploy/backups/`。

每次部署健康检查通过后，自动清理这个部署目录发布过的 `mewcat-api:<SHA>` 和 `mewcat-tools:<SHA>` 镜像，仅保留当前成功版本的一组镜像；当前成功版本记录在 `.deploy/successful-images`。其他项目的镜像、所有仍被容器引用的镜像（包括已停止的容器）都跳过，不使用强制删除或全局 prune。失败部署不触发清理，其遗留镜像在后续成功部署时一并清理；清理失败只告警，不影响已成功启动的服务，下次成功部署重试。

数据库卷、服务器密钥和历史备份不参与清理。`.deploy/backups/` 中的数据库及配置备份仍会随部署次数增长，需要单独维护；超过保留范围的历史版本镜像可能已被删除，恢复时需重新取得对应镜像。失败上传可能在 `/tmp/mewcat-*` 留下镜像包，排查后可清理对应目录。

后续管理使用成功发布对应的镜像和配置，避免直接使用旧源码的 `docker compose up --build`：

```bash
cd /opt/mewCat-service
set -a
. .deploy/current/image.env
set +a
# 如修改过项目名，这里也使用实际项目名。
dc=(docker compose --project-directory "$PWD" -p mewcat-service \
  -f .deploy/current/compose.yaml -f .deploy/current/compose.images.yaml)
"${dc[@]}" ps
"${dc[@]}" logs --tail=100 api
"${dc[@]}" run --rm --no-deps --pull never migrate node dist/scripts/admin.js clients
```

停止 API 后才复制完整 SQLite 目录，包含可能存在的 WAL 文件。备份也包含 `.env` 和 `secrets`，需限制访问，并定期复制到服务器外的安全存储。每次更新会有短暂停机。

迁移失败或健康检查超时会使 Actions 失败，`.deploy/current` 保留上次成功发布。失败版本的配置路径及备份路径会打印在日志中；可能出现 API 停止或新容器不健康的情况。先检查失败发布的日志和迁移状态；不会自动把旧镜像套在已升级数据库上。需要恢复时，停止 API，使用相匹配的数据库备份、密钥、配置及旧版本镜像恢复，不能只切换镜像，也不要执行 `docker compose down -v`。

并发部署使用 GitHub 队列与服务器文件锁，不会因下一次推送取消正在运行的迁移。GitHub 队列最多保留 100 个等待运行，按进入等待的顺序处理，不保证提交先后顺序；大量连续推送后应核对最后成功部署的 SHA。

参考：[GitHub Actions 工作流与并发队列](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)、[Docker Compose 健康等待](https://docs.docker.com/reference/cli/docker/compose/up/)。
