# 接口调用留存与设备画像

所有已知业务接口及 `/health`、`/v1/keys` 的成功和失败响应都会保存调用事实，包括时间、路由、HTTP 状态、规范错误码和耗时。认证通过后才关联设备；公共调用、认证失败不归属设备。注册成功关联真正的 `clientId`，不会创建名为 registration 的画像。

身份是设备签名密钥，不是自然人或登录账号。更换密钥或清除扩展数据会产生新设备；同 IP 不合并设备。统计只覆盖到达本后端的请求，不含扩展缓存命中及直接请求 Google、Microsoft 或自定义供应商的翻译。历史缺失的数据不会补造，`auto` 只表示自动检测参数。

## 内容采集和分析

默认启用行为明细和日汇总；**内容采集、自动模型分析默认关闭**。完整功能需在服务环境配置：

```dotenv
ANALYTICS_CAPTURE_CONTENT=true
ANALYTICS_AUTO_ANALYZE=true
ANALYTICS_CONTENT_KEY=<专用32字节密钥的标准Base64>
```

这会改变过去“不保存原文/译文”的行为：对通过校验并成功预占额度的翻译，在数据库加密保存原文及成功的译文；原文也会用于独立的供应商主题分析。上游翻译失败仍可分析原文；参数错误、未授权、额度拒绝不保存内容。上线启用时应同步向产品用户说明这一变化。

使用 `node:crypto` 的 `randomBytes(32).toString('base64')` 生成专用密钥，密钥只配置在服务器，不使用协议签名私钥。AES-256-GCM 使用独立随机 nonce，并绑定请求、内容类型和格式版本。数据库备份必须配套保存密钥；丢失密钥后旧内容无法解密。当前只支持一把活动内容密钥，更换前应先导出或让旧内容到期，不支持自动重加密。

分析使用现有 `SILICONFLOW_BASE_URL`、`SILICONFLOW_MODEL`、`SILICONFLOW_API_KEY`，独立提示词提取受控主题、少量关键词及模型自报置信度。结果表示“近期翻译内容的主题倾向”，不代表用户职业、年龄或自述。原文当作数据处理，不能改变分析指令。正文和关键词不进入普通日志；反馈邮件正文及邮箱不进入画像。

任务存 SQLite，默认单 worker、最多 3 次尝试，可从过期租约恢复。临时网络错误、超时、429 和临时 5xx 退避重试；非法输出失败。模型不提供幂等保证时，超时重试可能重复产生费用，所有尝试都占用分析预算。

## 保留与预算

| 配置                                 | 默认值 | 说明                                   |
| ------------------------------------ | ------ | -------------------------------------- |
| `ANALYTICS_CONTENT_RETENTION_DAYS`   | 30     | 加密原文/译文                          |
| `ANALYTICS_CALL_RETENTION_DAYS`      | 90     | 调用、翻译执行与分析明细               |
| `ANALYTICS_AGGREGATE_RETENTION_DAYS` | 365    | 行为、语言、UTC 时段、错误和主题日汇总 |
| `ANALYTICS_DAILY_ATTEMPTS`           | 100    | 每 UTC 日模型调用尝试数，持久化跨重启  |
| `ANALYTICS_DAILY_CHARACTERS`         | 50000  | 每日采样输入 UTF-16 单元数             |
| `ANALYTICS_SAMPLE_CHARACTERS`        | 4000   | 每次最大采样；不得超过每日预算         |
| `ANALYTICS_POLL_MS`                  | 5000   | 单 worker 轮询间隔                     |
| `ANALYTICS_TIMEOUT_MS`               | 30000  | 模型请求超时                           |

预算耗尽延后至下一 UTC 日；内容到期后停止分析，任务变为 expired。保留期必须满足“内容 <= 调用明细 <= 日汇总”，无效组合在启动时拒绝，避免级联删除提前清理内容或统计分母不完整。清理短期记录不删除长期日汇总。更改保留期不会恢复已删除数据。分析字符/次数预算不是精确货币上限。

重复 API 调用增加行为次数；同设备同日相同规范化内容只贡献一次主题权重。多主题的权重来自模型置信度，画像分开展示 unknown。当前分析版本为 `topics-v1`；新版本需调整代码后显式安排重分析，不自动混合不同版本。

## 管理命令

在 monorepo 根目录运行，下文 `<admin>` 表示 `pnpm --filter @mewcat/service admin`。独立生产仓库使用 `npm run admin --`，容器可用 `node dist/scripts/admin.js`（需提供运行环境）。

```bash
<admin> analytics summary --from 2026-11-01 --to 2026-11-05
<admin> analytics profile <clientId>
<admin> analytics calls --client <clientId> --outcome failed --limit 100
<admin> analytics calls --from 2026-11-01T12:00:00Z --to 2026-11-04T12:00:00Z
<admin> analytics export --from 2026-11-01 --to 2026-11-05 --output calls.jsonl
<admin> analytics export --client <clientId> --include-content --output content.jsonl
<admin> analytics analyze --limit 10
<admin> analytics retry <clientId>
<admin> analytics purge <clientId>
```

时间区间为 UTC 左闭右开，默认最近 30 个 UTC 日（含今天）。聚合 summary 只接受 UTC 零点边界，calls/export 可接受 ISO UTC 时间。画像固定展示近 7/30 日、活跃天数、语言、UTC 小时、错误与兴趣。所有结果为 JSON，大整数以十进制字符串输出；记录为 JSONL。calls 的 nextCursor 配合 `--cursor` 翻页，export 自动逐页输出。

导出默认只有结构化调用及翻译元数据。`--include-content` 必须同时指定输出文件并提供内容密钥；到期内容为 null。文件使用独占创建，拒绝覆盖，权限请求为 0600（Windows 实际权限遵循 ACL）；请自行安全存储。普通命令不会向日志输出内容。

`analyze` 显式进行有界的付费供应商请求，即使自动分析关闭也可运行，仍受相同预算、租约和尝试上限控制。`retry` 只重排未达 3 次上限的 failed 任务。`purge` 删除该设备的调用、翻译内容、分析与聚合，阻止在途分析重建旧画像；保留客户端密钥、nonce 和额度，不等于撤销设备。后续新请求可建立新画像。

统计返回采集/分析开关、分析覆盖率、队列状态和保留范围。只有实际观测到的数据可用；保留期外的 p95 返回 null，不把缺失 token 当作精确零费用。进程异常或持久化失败可能丢失调用统计，日志以 `ANALYTICS_PERSIST_FAILED` 告警；`GET /health` 的 `analyticsPersistenceFailures` 暴露实际 HTTP 进程内的累计失败次数，不能作为完整性证明。

分析覆盖率按原翻译请求的时间归属，分析完成时间单独保存。超过分析明细保留期的区间仅保留主题日汇总，覆盖率不再代表完整历史样本。
