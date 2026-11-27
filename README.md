# mewCat（译趣喵）

浏览器翻译扩展及其后端服务的 pnpm monorepo。需要 Node.js 22.12+ 和 pnpm 10.20.0。

[隐私政策](PRIVACY.md)

| 包                  | 目录                       | 用途                             |
| ------------------- | -------------------------- | -------------------------------- |
| `@mewcat/extension` | `apps/extension`           | WXT / React 浏览器扩展           |
| `@mewcat/service`   | `apps/service`             | Fastify / Prisma 翻译及反馈服务  |
| `@mewcat/protocol`  | `packages/mewcat-protocol` | 加密协议、校验和公共类型         |
| `@mewcat/client`    | `packages/mewcat-client`   | 浏览器 SDK 和 IndexedDB 身份存储 |

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm dev:extension
```

首次配置时，按根目录 `.env.example` 创建 `.env.local`。应用命令优先使用进程环境，配置值中的 `$` 原样保留。`pnpm install` 会构建共享包并准备 WXT 和 Prisma 生成文件。

首次运行后端时，初始化本地密钥和数据库后启动服务。

```bash
pnpm --filter @mewcat/service admin keys
pnpm --filter @mewcat/service db:migrate
pnpm dev:service
```

后端默认监听 `127.0.0.1:3000`。数据和密钥默认位于 `apps/service/data` 和 `apps/service/secrets`，相对路径以服务端目录为基准。

## 验证与发布

```bash
pnpm check                    # workspace、共享包和两应用的检查
pnpm build:verify             # 两应用的验证构建，不上传 Sentry
pnpm build:verify extension   # 只验证构建扩展
pnpm build:verify service     # 只验证构建后端
pnpm build:extension          # 正式扩展构建，配置完整时上传 Sentry
pnpm build:service            # 后端构建
pnpm format                  # 格式化
```

扩展加载目录为 `apps/extension/.output/chrome-mv3`，开发产物位于 `apps/extension/.output/chrome-mv3-dev`。

- PR 始终生成 `CI 结果`，按改动范围验证受影响的应用。
- 推送 `main` 时，按应用目录及公共构建路径触发对应流程。仅修改根 README 或根 `docs/` 时跳过两条发布流程。
- 扩展以 `apps/extension/package.json` 的版本发布。后端镜像以提交 SHA 标识，生产部署由 `SERVICE_DEPLOY_ENABLED` 控制。

## 文档

- 扩展：[开发与使用](apps/extension/README.md)、[架构](apps/extension/docs/architecture.md)、[发布手册](apps/extension/docs/chrome-web-store-automation.md)、[测试与浏览器复验](apps/extension/test/README.md)。
- 后端：[本地运行](apps/service/README.md)、[API](apps/service/docs/api.md)、[加密协议](apps/service/docs/protocol.md)、[部署与 Docker 验收](apps/service/docs/deploy.md)、[统计与管理](apps/service/docs/analytics.md)。
- 维护：[协作规范](AGENTS.md)、[项目减法与性能优化计划](docs/superpowers/plans/2026-11-24-project-simplification.md)。
