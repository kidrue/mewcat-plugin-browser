# 翻译字符统计与自有服务额度实施计划

> 使用 superpowers:subagent-driven-development 和 superpowers:test-driven-development。逐项完成回归后执行工作区检查。

**目标** 在翻译服务页展示 mewCat 额度，在统计页展示成功翻译的文本字符总量和服务明细。

**口径** 本机自然日、周一开始的本周、自然月。跨日期与服务用每日聚合。以成功送翻的原文 UTF-16 字符计数，失败、空结果、缓存命中、图片、页面总结和概念解释排除。内置与官方服务按服务合并，自定义端点按配置 ID 单列，只存储服务标识、显示名、日期、计数。现有 Token 口径保留。

**架构** 额度从 mewCat 签名加密接口返回。已有 usage 严格响应保持兼容，新增只读 usage/details 返回设备用量、设备与 IP 日限额及重置时间。统计上报在统一文本翻译成功后发送后台消息，单写队列累加本机存储，统计页共用汇总结果。

## 任务

- [x] 合约、SDK 和服务。新增 POST /v1/usage/details 和 usageDetails()，返回 { usedCharacters, limitCharacters, ipLimitCharacters, resetsAt }。服务端集成测试校验非默认配置与旧响应形状。
- [x] 本地字符统计。正常文本翻译路径上报成功的原文字数，后台按设备本机日期和服务串行累加。测试服务归属、失败与空结果、并发和自然周/月边界。存储接口为 readTextTranslationUsage()、clearTextTranslationUsage() 和 summarizeTextTranslationUsage(entries, now?)，汇总返回 { totals, services }，每个周期计数字段 today、week、month，服务行另含 serviceId、serviceName。
- [x] 统计页面。TokenUsage 增加三张总量卡片和按服务明细，显示无历史数据、错误、清空及统计口径，继续渲染已有 Token。测试页面三周期及分组。
- [x] 额度提示和集成。仅选择 mewCat 时读取额度，显示实际额度、用量、剩余和重置时间，处理请求失败。执行格式化、全量检查和验证构建。
