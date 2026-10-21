# mewCat Monorepo

## 通用约定

- 始终使用简体中文回复；代码标识符、命令、路径和日志保留原样。
- 使用 Node.js 22.12+、pnpm 10.20.0 和根目录唯一 `pnpm-lock.yaml`。
- 应用：`apps/extension`（WXT / Vite / React）、`apps/service`（Fastify / Prisma）。
- 共享包：`packages/mewcat-protocol`、`packages/mewcat-client`，通过 `workspace:*` 引用。
- 扩展特有规则见 `apps/extension/AGENTS.md`。
- 修改代码后执行 `pnpm format`，完成相关检查后再声称任务完成。
- Commit 标题和正文使用简体中文，保留 Conventional Commits 类型、作用域和代码标识符。

## 命令

```bash
pnpm install --frozen-lockfile
pnpm dev:extension
pnpm dev:service
pnpm check
pnpm build:verify
pnpm build:extension
pnpm build:service
```

## 配置与发布边界

- 本地配置仅使用根 `.env.local`，进程环境优先；禁止输出真实凭据值。
- `.env*`（除示例）、私钥、数据库、secrets、生成文件不入库、不进入 Docker 构建上下文。
- 扩展仅公开需要的 `WXT_` / `VITE_` 变量，服务端秘密不得进入浏览器包。
- 默认使用 `build:verify` 验证，避免上传 Sentry；测试不得调用付费 API。
- 扩展发布读取扩展子项目版本，保留原 Release/draft 幂等与 CWS OIDC 流程。
- 后端部署需要 `SERVICE_DEPLOY_ENABLED=true`；未明确授权切换线上时保持关闭。
- 共享协议修改必须兼容已发布扩展；保持现有加密协议、设备身份存储及 API 行为。
- Docker 专属验收在 Linux CI 执行；本机缺少 Docker 时必须说明验证限制。

新增功能前先完成可行性、技术选型和落地方案分析，等待用户确认；已确认计划范围内的常规实现和验证直接推进。
