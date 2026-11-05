# 管理员分析面板

在扩展设置的“关于”页单击作者 `kidrue`，进入 `options.html#analytics`。侧边栏仍选中“关于”。页面读取真实后端数据，不会在网络失败时展示示例数据。

## 首次授权

1. 使用包含此功能的扩展版本打开隐藏页面；未授权时复制页面上的完整设备 ID。
2. 服务管理员在服务端 `ANALYTICS_ADMIN_CLIENT_IDS` 中加入该 UUID；多个 ID 用逗号分隔，最多 20 个。
3. 重启/重新部署服务，再点击页面“重新检查”。清除浏览器设备存储或更换设备后需要重新授权。

该配置默认为空。页面无法自行授权，不要将管理员变量设置为 `WXT_`/`VITE_` 前缀，也不要向扩展提供通用管理密钥。移除白名单或撤销设备后，新请求立即受限（环境变量修改需要重启服务）。

生产仍由 `kidrue/mewCat-servicer` 部署。GitHub Actions 使用同名 repository variable `ANALYTICS_ADMIN_CLIENT_IDS`；变量为空/未设置时保留服务器已有配置。若需清空所有管理权限，将 `ANALYTICS_ADMIN_CLEAR=true` 后部署；清空优先于 ID 列表，完成后将此变量移除或改回 `false`。直接运行配置更新器时，`ANALYTICS_ADMIN_CLIENT_IDS=` 表示显式清空。

## 数据口径

- 全站概览只统计 `/v1/translate`；设备列表和设备画像包含注册、usage、feedback 等业务调用，口径不同。
- 默认近 7 个 UTC 日，支持近 30 日和最多 90 日的自定义范围。结束日期包含当日；UTC 日界为北京时间 08:00。明细时间按浏览器时区展示。
- 画像抽屉固定显示近 7/30 天，不随列表筛选日期改变。
- token 只汇总供应商已报告值，缺失 usage 不代表精确零费用。超出保留期或未观察历史显示覆盖不足；没有明细样本时 p95 不可用。
- 内容采集和自动分析默认关闭。页面会显示实际状态；启用方式及保留策略见既有分析文档。主题是近期翻译内容倾向，不代表个人身份。
- 管理查询不写入业务画像、不消耗翻译额度、不调用模型。只展示受控元数据和结构化主题，不提供原文/译文、IP、密钥或清除数据功能。

## 加密接口

`POST /v1/analytics/query` 沿用 SDK 的 JWE/JWS、防重放、设备撤销和响应验证。通过 `TranslationClient.queryAnalytics(input)` 调用。

| operation | 必填     | 可选                                    |
| --------- | -------- | --------------------------------------- |
| overview  | from, to | 无                                      |
| devices   | from, to | clientId, cursor, limit                 |
| profile   | clientId | 无                                      |
| calls     | from, to | clientId, route, outcome, cursor, limit |

`from/to` 为 `YYYY-MM-DD` UTC 半开区间；分页默认 20、最大 100。clientId 只支持完整 UUID 精确匹配。大计数返回十进制字符串；响应含 `asOf` 与覆盖信息。调用分页按 `(createdAt,id)` 正序，设备按 ID 正序。不同请求不承诺同一个事务快照。

非管理员返回 `403 ANALYTICS_FORBIDDEN`；每管理员设备每分钟最多 60 次查询；单进程最多两个执行中的查询。频率超限为 `429 RATE_LIMITED`，并发满或响应超过 256 KiB 为 `503 ANALYTICS_BUSY`。扩展未部署对应服务接口时会显示接口未上线。

切换筛选、离开页面或关闭页面会取消对应请求，后台还设有 30 秒超时。后端检测连接断开后，在数据库查询阶段之间停止后续工作；正在执行的 SQLite 语句完成前继续占用并发槽，避免实际并发超过两个。分析样本数与聚合执行量因并发或留存缺口无法一致时，覆盖率显示未知，不伪造百分比。
