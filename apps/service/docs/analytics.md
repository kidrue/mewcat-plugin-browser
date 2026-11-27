# 调用留存与设备翻译统计

服务端默认记录指定 API 的调用元数据。扩展的设备翻译统计由用户主动开启，使用独立的数据和统计口径。管理员可在同一面板中查看两组数据。

## 接口调用留存

`/health`、`/v1/keys`、`/v1/clients/register`、`/v1/usage`、`/v1/feedback`、`/v1/translate` 和 `/v1/chat/completions` 的成功与失败响应记录时间、路由、HTTP 状态、规范错误码和耗时。公共调用和认证失败不关联设备，注册成功关联分配的 `clientId`。用量详情、活动上报、卸载回执及管理员查询不进入调用画像。

设备按签名身份识别。更换密钥或清除扩展数据会产生新设备，共用 IP 的设备仍分别统计。调用统计仅覆盖到达本服务的请求，缓存命中和直连其他供应商不计入。语言参数 `auto` 表示自动检测。管理员的全站调用概览只统计翻译和对话生成，设备列表与画像还包含注册、用量和反馈调用。列表也可包含只有活动记录的设备，其调用计数为零。

## 内容采集和分析

默认启用行为明细和日汇总；**内容采集、自动模型分析默认关闭**。完整功能需在服务环境配置：

```dotenv
ANALYTICS_CAPTURE_CONTENT=true
ANALYTICS_AUTO_ANALYZE=true
ANALYTICS_CONTENT_KEY=<专用32字节密钥的标准Base64>
```

启用采集后，`/v1/translate` 通过校验并预占额度时会保存加密原文，翻译成功后还会保存加密译文。开启分析后，原文会交给供应商单独提取主题。上游翻译失败时已采集的原文仍可分析。对话生成的消息和输出、反馈正文和邮箱均不进入内容画像。生产启用采集前应同步更新面向用户的数据说明。

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

在仓库根目录运行。生产容器用 `docker compose exec api node dist/scripts/admin.js` 并附加相同的 `analytics` 子命令，Compose 选择见 [部署与运维](deploy.md#发布后管理)。

```bash
pnpm --filter @mewcat/service admin analytics help
pnpm --filter @mewcat/service admin analytics summary --from 2026-11-01 --to 2026-11-05
pnpm --filter @mewcat/service admin analytics profile '<clientId>'
pnpm --filter @mewcat/service admin analytics calls --client '<clientId>' --outcome failed --limit 100
pnpm --filter @mewcat/service admin analytics export --from 2026-11-01 --to 2026-11-05 --output calls.jsonl
pnpm --filter @mewcat/service admin analytics export --client '<clientId>' --include-content --output content.jsonl
pnpm --filter @mewcat/service admin analytics analyze --limit 10
pnpm --filter @mewcat/service admin analytics retry '<clientId>'
pnpm --filter @mewcat/service admin analytics purge '<clientId>'
```

时间区间为 UTC 左闭右开，默认最近 30 个 UTC 日（含今天）。聚合 summary 只接受 UTC 零点边界，calls/export 可接受 ISO UTC 时间。画像固定展示近 7/30 日、活跃天数、语言、UTC 小时、错误与兴趣。所有结果为 JSON，大整数以十进制字符串输出；记录为 JSONL。calls 的 nextCursor 配合 `--cursor` 翻页，export 自动逐页输出。

导出默认只有结构化调用及翻译元数据。`--include-content` 必须同时指定输出文件并提供内容密钥；到期内容为 null。文件使用独占创建，拒绝覆盖，权限请求为 0600（Windows 实际权限遵循 ACL）；请自行安全存储。普通命令不会向日志输出内容。

`analyze` 显式进行有界的付费供应商请求，即使自动分析关闭也可运行，仍受相同预算、租约和尝试上限控制。`retry` 只重排未达 3 次上限的 failed 任务。`purge` 删除该设备的调用、翻译内容、分析与聚合，阻止在途分析重建旧画像。设备身份和配额继续生效，后续新请求可以生成新画像。设备翻译活动另由用户撤回授权清除。

统计返回采集/分析开关、分析覆盖率、队列状态和保留范围。只有实际观测到的数据可用；保留期外的 p95 返回 null，不把缺失 token 当作精确零费用。进程异常或持久化失败可能丢失调用统计，日志以 `ANALYTICS_PERSIST_FAILED` 告警；`GET /health` 的 `analyticsPersistenceFailures` 暴露实际 HTTP 进程内的累计失败次数，不能作为完整性证明。

分析覆盖率按原翻译请求的时间归属，分析完成时间单独保存。超过分析明细保留期的区间仅保留主题日汇总，覆盖率不再代表完整历史样本。

## 设备翻译统计

- 扩展「关于 → 使用统计」由用户主动开启。新增安装按符合新安装条件的首次授权上报日期计入，升级和重载不算新安装。卸载由浏览器访问一次性回执 URL 记录，离线等情况可能漏报。
- 一次顶层整页翻译成功显示译文时上报页面事件，命中缓存也计入。分批、失败、段落翻译和子框架均不额外计入。活跃设备指区间内至少上报过一次成功整页翻译的设备。首次翻译日期使用服务端接收首个页面事件的日期。
- 按设备去重页面。每日趋势在当日去重，选定区间的总数在整个区间去重。面板的设备平均翻译网页数为区间去重网页数除以区间活跃设备数。设备画像分别展示近 7/30 个 UTC 日去重网页数、安装、卸载回执及最近翻译时间。
- 页面摘要由扩展使用设备随机盐及 URL 的主机名和路径生成，忽略查询参数和片段。服务端再以设备为作用域对摘要计算 HMAC。活动数据中不记录 IP、地理位置、域名、URL、原文或译文。撤回后扩展立即停止上报并清除浏览器卸载 URL，连通服务后删除该设备的活动数据。内容采集开关独立生效。
- 页面记录和卸载设备的状态按 `ANALYTICS_CALL_RETENTION_DAYS` 清理，最多保留 90 个 UTC 日。已启用设备的活动状态可跨越窗口，因此画像中的安装及最近翻译时间可能早于页面记录窗口。

## 管理员面板

在扩展设置的「关于」页点击作者 `kidrue` 进入 `options.html#analytics`。未获授权时复制页面显示的完整设备 UUID，由服务管理员加入 `ANALYTICS_ADMIN_CLIENT_IDS`，逗号分隔，最多 20 个，默认空。重启或部署后点「重新检查」。清除设备存储或更换设备后需重新授权。作者标记是界面信息，查询权限由服务端白名单和设备签名共同决定。撤销设备或修改白名单并重启服务后，新查询受新的授权状态约束。生产同步及清空方法见 [部署与运维](deploy.md#github-actions-自动部署)。

面板默认展示最近 7 个 UTC 日，也可选最近 30 日或最多 90 日的自定义区间。界面结束日期包含当日，UTC 日界是北京时间 08:00，明细时间按浏览器时区展示。画像固定使用近 7/30 个 UTC 日，无需跟随列表筛选。

token 只汇总供应商已报告值，缺失时成本未知。超出留存窗口或缺少观测时，面板显示覆盖不足，缺少有效明细时 p95 不可用。内容采集和自动分析状态按服务器实际配置展示。面板仅展示受控元数据和结构化主题，原文、译文、IP、密钥及数据清除操作均不在查询权限内。

## 管理员接口

两个接口只向已注册、未撤销且在白名单中的设备开放，均使用 [v1 签名加密信封](protocol.md)。查询不写入调用画像、不消耗翻译额度、不调用模型。

`POST /v1/analytics/query` 通过 `TranslationClient.queryAnalytics(input)` 调用，返回调用留存数据。

| `operation` | 必填字段 | 可选字段 |
| --- | --- | --- |
| `overview` | `from`、`to` | 无 |
| `devices` | `from`、`to` | `clientId`、`cursor`、`limit` |
| `profile` | `clientId` | 无 |
| `calls` | `from`、`to` | `clientId`、`route`、`outcome`、`cursor`、`limit` |

`clientId` 使用完整 UUID 精确匹配。`from`、`to` 为 `YYYY-MM-DD`，使用 1–90 个 UTC 日的左闭右开区间。分页默认 20 条，最大 100 条；后续请求传入响应的 `nextCursor`，保留原筛选。调用按 `(createdAt, id)` 正序，设备按 ID 正序。调用的 `outcome` 可取 `success`、`failed` 或 `rejected`，`route` 可筛选注册、用量、反馈、翻译和对话生成。大计数是十进制字符串，返回 `asOf` 和覆盖信息，分页请求之间的数据可以变化。

`POST /v1/analytics/activity` 通过 `TranslationClient.queryDeviceActivity(input)` 调用，返回用户主动授权的设备翻译统计。

| `operation` | 其余请求字段 | 成功响应 `data` 字段 |
| --- | --- | --- |
| `overview` | `from`、`to` | `operation`、`installs`、`uninstalls`、`activeDevices`、`firstTranslationDevices`、`pages`、`days` |
| `profile` | `clientId` | `operation`、`installedAt`、`uninstalledAt`、`lastTranslationAt`、`pagesLast7`、`pagesLast30` |

活动查询使用相同的 UTC 日期格式，范围会裁剪到活动留存窗口。`days` 每项含 `day` 和五项计数，计数以非负整数返回。时间字段是 ISO 8601 字符串或 `null`。已注册但无统计的设备返回空时间和零计数，设备不存在时返回 `404 ANALYTICS_DEVICE_NOT_FOUND`。

两个接口共用每设备每分钟 60 次查询和单进程两个执行槽。未获授权返回 `403 ANALYTICS_FORBIDDEN`，频率超限为 `429 RATE_LIMITED`，查询并发已满为 `503 ANALYTICS_BUSY`。`/v1/analytics/query` 的结果超过 256 KiB 时也返回 `ANALYTICS_BUSY`。扩展切换筛选、离开页面时取消在途请求，后台设置 30 秒超时；服务端停止后续工作前等待当前数据库操作结束，执行槽期间保持占用。
