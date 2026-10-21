# Monorepo 使用与发布

## 迁移来源

扩展以提交 `e16fef5` 为迁移基线，保留 popup 图标调整及 GitHub 漏译修复。
后端从 `kidrue/mewCat-servicer` 的 `96bff6b` 导入当前代码快照；原本机目录和原仓库未改动，原历史仍可在那里查询。

扩展版本保持 `1.0.4`，服务端版本保持 `0.1.0`。扩展使用原有的 `v<version>` Release/tag；后端镜像使用提交 SHA，两者独立发布。

## 配置与开发

根 `.env.local` 是本地配置唯一入口；已合并两应用原有 14 个变量并增加生产中已有的模型名称。`.env.local.pre-monorepo` 是迁移前扩展配置的本地备份。上述文件都被 Git 和 Docker 忽略。

应用脚本经 `scripts/run-with-env.mjs` 启动，以 Node 的 `parseEnv` 解析配置，不展开 `$`，且已有环境变量优先。CI 设置 `MEWCAT_LOAD_LOCAL_ENV=false`，不依赖本地配置。

共享包通过 `workspace:*` 引用，输出 ESM 和类型声明。`pnpm install` 会准备共享包和 WXT/Prisma 生成文件。根开发命令启动共享包监听；修改 SDK 后扩展和服务端均使用新的构建输出。

在应用目录或使用 `pnpm --filter @mewcat/service` 运行命令时，相对数据库路径、密钥路径仍相对于服务端目录。生产 Compose 保持使用服务器自己的 `.env`，不会上传本地 `.env.local`。

浏览器仅公开 `WXT_` / `VITE_` 前缀配置。SMTP、供应商密钥、Sentry 上传令牌等只能用于 Node 构建或服务端运行；不要给它们添加公开前缀。

`pnpm build:verify` 会禁用本地配置和 Sentry 上传，并保留正常的产物校验与 Source Map 清理。正式发布流程仍要求完整的 Sentry 配置。

## 流水线分流

| 改动 | 扩展流程 | 后端流程 |
| --- | --- | --- |
| `apps/extension/**` | 执行 | 不执行 |
| `apps/service/**` | 不执行 | 执行 |
| `packages/**`、公共脚本与根构建配置 | 执行 | 执行 |
| 某条发布 workflow | 执行对应流程 | 执行对应流程 |
| 仅根 README、docs | 不发布 | 不部署 |

PR 比较 merge base 与 PR head；发布 workflow 根据整次 push 的文件变更过滤。重命名同时考虑旧路径和新路径，删除文件同样参与判断。`CI 结果` 始终运行；将它设为分支保护的必需检查。

所有第三方 Actions 固定完整 commit SHA。扩展和后端使用独立并发组；生产部署不取消正在执行的任务，并保留服务端部署锁、数据库备份和健康检查。

## Docker 验收

从仓库根目录执行：

```bash
docker build --target tools -t mewcat-tools:ci -f apps/service/Dockerfile .
docker build --target runtime -t mewcat-api:ci -f apps/service/Dockerfile .
pnpm --filter @mewcat/service test:docker
node scripts/container-smoke.mjs
```

构建阶段使用服务端 workspace 依赖闭包，`pnpm deploy --legacy` 导出独立依赖。tools 镜像保留 Prisma CLI；runtime 镜像仅保留运行所需依赖和编译产物，容器工作目录继续是 `/app`。

容器 smoke 使用独立临时 Compose 项目、数据库和测试密钥，完成数据库迁移、启动、健康检查、SDK 注册及用量查询，结束后删除自己的临时资源，不调用付费接口。Linux CI 强制执行 Docker 专属检查；缺少 Docker 时该检查直接失败。本地普通测试会明确报告 Compose 测试跳过数量。

## 后续线上切换清单

本次仅准备代码与构建流程，不操作远程配置、不推送、不部署、不停用原仓库 workflow。

启用新后端发布入口前，在目标仓库完成以下设置：

1. 创建 `production` Environment；迁入以下 Secrets：`ALIYUN_HOST`、`ALIYUN_USER`、`ALIYUN_SSH_PRIVATE_KEY`、`ALIYUN_SSH_KNOWN_HOSTS`、`SILICONFLOW_API_KEY`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`FEEDBACK_TO`。
2. 迁入仓库 Variables：`ALIYUN_DEPLOY_PATH`、`ALIYUN_COMPOSE_PROJECT`、`ALIYUN_PLATFORM`、`ALIYUN_SSH_PORT`；迁入 production Variables：`SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL`。GitHub Secrets 无法通过读取 API 取回原值，需从原始凭据来源重新配置。
3. 确认部署目录、Compose 项目名、数据库卷及服务器密钥路径与原部署一致，避免创建空数据库或更换服务器身份。
4. PR 的 Linux 容器验收通过后，确认切换窗口，再设置仓库 Variable `SERVICE_DEPLOY_ENABLED=true`，手动执行新后端流水线。
5. 首次部署健康检查、翻译及反馈验证通过后，停用原仓库 `deploy-aliyun.yml`，避免两个仓库同时发布。

现有扩展 CWS OIDC、CRX 签名与 Sentry 配置保留在当前仓库；本次不修改扩展 ID、公钥指纹或发布版本。
