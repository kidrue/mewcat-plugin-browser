# mewCat（译趣喵）

浏览器翻译扩展及其后端服务的 pnpm monorepo。需要 Node.js 22.12+ 和 pnpm 10.20.0。

| 包 | 目录 | 用途 |
| --- | --- | --- |
| `@mewcat/extension` | `apps/extension` | WXT / React 浏览器扩展 |
| `@mewcat/service` | `apps/service` | Fastify / Prisma 翻译及反馈服务 |
| `@mewcat/protocol` | `packages/mewcat-protocol` | 加密协议、校验和公共类型 |
| `@mewcat/client` | `packages/mewcat-client` | 浏览器 SDK 和 IndexedDB 身份存储 |

## 本地使用

```bash
pnpm install --frozen-lockfile
# 首次使用时复制 .env.example 为根目录 .env.local，再填写需要的配置。
# 已有 .env.local 的环境不要覆盖它。

pnpm dev:extension   # 扩展开发服务使用 3001 端口
pnpm dev:service     # 后端默认使用 3000 端口
```

后端首次启动前还需要初始化本地数据库及密钥：

```bash
pnpm --filter @mewcat/service admin keys
pnpm --filter @mewcat/service db:migrate
```

本地应用命令统一读取仓库根目录 `.env.local`，已有进程环境变量优先，密码中的 `$` 原样保留。后端的数据和密钥默认位于 `apps/service/data` 和 `apps/service/secrets`。扩展继续使用原有生产服务地址及公钥指纹。

```bash
pnpm check                    # workspace、共享包和两应用的检查
pnpm build:verify             # 两应用的验证构建，不上传 Sentry
pnpm build:verify extension   # 只验证构建扩展
pnpm build:verify service     # 只验证构建后端
pnpm build:extension          # 正式扩展构建，配置完整时上传 Sentry
pnpm build:service            # 后端构建
pnpm format                  # 格式化
```

生产扩展加载目录为 `apps/extension/.output/chrome-mv3`，开发目录为 `apps/extension/.output/chrome-mv3-dev`；迁移前加载根 `.output` 的 Chrome 扩展需要改为新目录。

## 自动化流程

- PR：始终生成 `CI 结果` 检查，按改动范围验证受影响应用；文档 PR 也能正常完成检查。
- 扩展：推送 `main` 且涉及扩展、共享包或公共构建配置时检查并构建；扩展版本升级后才发布到 GitHub Release / Chrome Web Store。
- 后端：推送 `main` 且涉及后端、共享包或公共构建配置时检查、构建镜像并保存产物。
- 后端部署只有在目标仓库配置 `SERVICE_DEPLOY_ENABLED=true` 后启用。本次迁移保持关闭，原仓库的线上发布入口保持原状。

详细触发规则、Docker 验收和后续切换清单见 [monorepo 使用说明](docs/monorepo.md)。

扩展功能说明见 [扩展 README](apps/extension/README.md)；服务端接口与运行说明见 [服务端 README](apps/service/README.md)。
