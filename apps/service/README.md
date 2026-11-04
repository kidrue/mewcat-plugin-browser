# mewCat 翻译后端

Fastify + Prisma + SQLite 翻译与反馈服务。workspace 用法及部署边界见 [根 README](../../README.md) 和 [monorepo 说明](../../docs/monorepo.md)。

## 本地运行

需要 Node.js 22.12+ 和 pnpm 10.20.0。配置只读取根 `.env.local`，进程环境优先，不要覆盖已有配置。

```bash
pnpm install --frozen-lockfile
pnpm --filter @mewcat/service admin keys
pnpm --filter @mewcat/service db:migrate
pnpm dev:service
```

默认监听 `http://127.0.0.1:3000`，密钥和数据默认位于本应用的 `secrets/` 与 `data/`。生产单进程运行，不能多副本共享 SQLite。

默认每设备、每 IP 每个 UTC 日各 500,000 字符，全站不设置字符或请求次数日上限。`GLOBAL_DAILY_CHARACTERS=0` 和 `GLOBAL_DAILY_REQUESTS=0` 表示关闭对应的全站日限额；分钟限流仍单独生效。

## 调用留存与画像

默认保存已知接口的成功/失败调用及设备行为日汇总。原文/译文采集和模型主题分析需通过 `ANALYTICS_CAPTURE_CONTENT`、`ANALYTICS_AUTO_ANALYZE` 及专用内容密钥显式启用。开启采集后内容加密保存 30 天，调用与分析明细默认 90 天，日汇总默认 365 天；均可配置。

提供设备活跃、语言、UTC 时段、错误分布、内容主题和关键词分析，以及游标查询、JSONL 导出、限量分析、重试和清除。只统计经过本后端的请求；画像身份是设备，不代表自然人或跨设备账号。配置、费用预算和隐私行为见 [调用留存与画像](docs/analytics.md)。

```bash
pnpm --filter @mewcat/service admin analytics help
pnpm --filter @mewcat/service admin analytics summary
pnpm --filter @mewcat/service admin analytics profile <clientId>
```

## API 与协议

接口包含 `GET /health`、`GET /v1/keys`、`POST /v1/clients/register`、`POST /v1/translate`、`POST /v1/usage` 和 `POST /v1/feedback`。POST 业务数据必须通过加密信封发送。

共享 SDK 为 `@mewcat/client`，协议为 `@mewcat/protocol`。详见 [API](docs/api.md) 和 [协议](docs/protocol.md)。

## 验证和部署

```bash
pnpm build:packages
pnpm --filter @mewcat/service check
pnpm build:verify service
pnpm --filter @mewcat/service smoke
```

测试使用临时 SQLite、本地模拟供应商和假密钥，不调用付费 API。Docker 专属检查在 Linux CI 执行。

monorepo 的 `deploy-service.yml` 仅在 `SERVICE_DEPLOY_ENABLED=true` 时部署。生产服务原仓库为 `kidrue/mewCat-servicer`；未切换入口时需将兼容改动同步至原仓库并通过其发布流程上线。本次功能不自动开启内容采集和付费分析。
