# mewCat 翻译后端

Fastify、Prisma 和 SQLite 实现的翻译、对话生成与反馈服务。workspace 用法见 [仓库 README](../../README.md)。

## 本地运行

需要 Node.js 22.12+ 和 pnpm 10.20.0。先在根 `.env.local` 配置 `SILICONFLOW_API_KEY` 和 `SILICONFLOW_MODEL`。进程环境优先。

```bash
pnpm install --frozen-lockfile
pnpm --filter @mewcat/service admin keys
pnpm --filter @mewcat/service db:migrate
pnpm dev:service
```

服务默认监听 `http://127.0.0.1:3000`，密钥和数据默认位于本应用的 `secrets/` 与 `data/`。生产由单个 API 进程访问 SQLite。

## 专题文档

- [API](docs/api.md) 提供 SDK 接入、路由、限额与错误码。
- [加密协议](docs/protocol.md) 定义 `v1` 签名加密、设备注册和响应校验。
- [调用留存与设备翻译统计](docs/analytics.md) 说明管理员授权、用户同意、数据口径和管理命令。
- [部署与运维](docs/deploy.md) 包含 Docker 验收、生产部署、反馈邮件、备份与恢复。

## 验证

```bash
pnpm build:packages
pnpm --filter @mewcat/service check
pnpm build:verify service
pnpm --filter @mewcat/service smoke
```

测试使用临时 SQLite、本地模拟供应商及测试密钥。Docker 专项检查在 Linux CI 执行。
