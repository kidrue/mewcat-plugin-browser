# 阿里百炼 Token Plan 接入设计

**日期**：2026-09-07  
**状态**：已获用户确认，待实施计划  
**范围**：为阿里百炼模型增加 Token Plan 中国站和国际站官方通道，同时保留现有按量付费与自定义接口。

## 背景

当前阿里百炼只提供一个官方 OpenAI-compatible 地址：

`https://dashscope.aliyuncs.com/compatible-mode/v1`

该地址属于按量付费通道。Token Plan 使用独立的 API Key 和 Base URL，二者不能与按量付费凭据混用：

- 中国站（北京）：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 国际站（新加坡）：`https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- Token Plan 专属 API Key 通常以 `sk-sp-` 开头；个人版与团队版由服务端根据 Key 自动识别，无需在扩展内区分。

官方资料：

- [Token Plan 中国站快速开始](https://help.aliyun.com/zh/model-studio/token-plan-personal-quick-start)
- [Token Plan 国际站接入示例](https://www.alibabacloud.com/help/en/model-studio/cursor)
- [阿里百炼更多工具与使用限制](https://help.aliyun.com/zh/model-studio/more-tools)

## 使用范围风险

阿里云当前文档称 Token Plan 仅限 AI 编程工具和 OpenClaw 类型 Agent，且将自定义应用程序列为不支持的工具类型。浏览器翻译扩展可能被认定为自定义应用，使用 Token Plan 存在订阅被暂停或 API Key 被封禁的风险。

本功能只提供协议层接入能力，并在设置页显示官方使用范围提示与文档链接。正式分发或宣传 Token Plan 支持前，应由项目方进一步向阿里云确认授权范围。

## 需求边界

### 本次包含

- 保留现有阿里百炼按量付费通道。
- 增加 Token Plan 中国站和国际站两条官方通道。
- 支持 Token Plan 的文本翻译、划词翻译、沉浸式翻译和视觉理解翻译。
- 模型发现、单模型连接测试和实际翻译使用完全相同的端点解析逻辑。
- 对存量配置保持兼容；没有新字段的阿里百炼配置继续走现有按量付费地址。

### 本次不包含

- Coding Plan。
- Token Plan 套餐购买、续费、额度查询或用量统计。
- 图片生成、视频生成、语音、Responses API 或 Harness 工具。
- 自动判断 API Key 属于个人版还是团队版。
- 自动将用户的按量付费 Key 转换成 Token Plan Key。

## 方案选择

采用“供应商官方端点档案”方案，而不是拆分平台枚举或分别保存计费方式和地域。

每个官方通道由供应商注册表定义一个不可变档案，配置只持久化 `officialEndpointId`。阿里百炼包含：

| `officialEndpointId` | UI 名称 | Base URL | 公共目录回退 |
| --- | --- | --- | --- |
| `pay-as-you-go-cn` | 按量付费（中国站） | `https://dashscope.aliyuncs.com/compatible-mode/v1/` | 允许 |
| `token-plan-cn` | Token Plan（中国站·北京） | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/` | 禁止 |
| `token-plan-intl` | Token Plan（国际站·新加坡） | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/` | 禁止 |

未设置 `officialEndpointId` 时使用供应商默认档案。阿里百炼默认档案为 `pay-as-you-go-cn`，确保旧数据行为不变。非空但未知的档案 ID 必须返回配置错误，不得静默回退到按量付费地址，以避免凭据和计费通道错配。

## 数据模型

在 `BaseModel.params` 增加：

```typescript
officialEndpointId?: string
```

继续保留现有字段语义：

- `isOfficial !== false`：使用供应商注册表中的官方端点。
- `isOfficial === false`：使用 `baseUrl` 自定义地址，忽略但保留 `officialEndpointId`，便于切回官方模式。
- `baseUrl` 仅在自定义模式下生效。

`ExtensionConfigSchema` 接受可选字符串字段。修复存量配置时不主动写入默认值，由运行时注册表完成默认解析。

## 供应商注册表与端点解析

`ProviderDefinition` 增加可选的官方端点档案集合以及默认档案 ID。其他只有单一官方地址的供应商继续使用当前默认地址，不强制迁移数据。

统一的端点解析输入应至少包含：

```typescript
{
    provider,
    isOfficial,
    customBaseUrl,
    officialEndpointId
}
```

解析规则：

1. 自定义模式且 `customBaseUrl` 非空时，返回规范化后的自定义地址。
2. 官方模式且提供 `officialEndpointId` 时，必须在当前供应商的档案中精确匹配。
3. 官方模式未提供档案 ID 时，返回当前供应商默认地址。
4. 未知档案 ID、空的自定义地址等配置错误应在请求前暴露，不发起错误网络请求。

模型发现、文本生成、视觉生成和连接测试都必须调用该解析器，禁止各模块自行拼接 Token Plan 地址。

## 设置页交互

保留“官方模型 / 自定义”一级切换。

当模型类型为阿里百炼且选择“官方模型”时，显示“官方通道”下拉框：

- 按量付费（中国站）
- Token Plan（中国站·北京）
- Token Plan（国际站·新加坡）

交互规则：

- 请求地址仍为只读展示，并随官方通道即时更新。
- Token Plan 模式显示专属 Key 提示、官方文档链接和使用范围风险提示。
- 切换通道时保留 API Key 和模型 ID，避免清除只展示一次的 Token Plan Key；用户需要重新执行连接测试。
- 不根据 Key 前缀自动切换通道，也不因前缀不匹配阻止请求；前缀只作为提示，避免官方规则变化造成误判。
- Token Plan 显示“支持图片输入”开关；远程目录能确认能力时自动回填，无法确认或改为手动模型 ID 时允许用户显式声明。
- 自定义模式隐藏“官方通道”，继续使用用户填写的 Base URL。

## 模型发现

Token Plan 的可用模型与按量付费目录不同，且会随套餐和地区变化，因此不能在远程发现失败时回退到完整的百炼公共目录。

发现流程：

1. 使用所选 Token Plan Base URL 调用 OpenAI-compatible `/models`。
2. 成功时只展示远程返回的模型；公共目录仅用于补充同 ID 模型的显示名称和视觉能力元数据，不额外加入目录模型。
3. 401/403 显示 Token Plan 凭据或区域不匹配提示。
4. 404/405 等不支持模型发现的响应允许切换到手动填写模型 ID。
5. 网络错误保持错误状态，不显示按量付费候选模型。

模型选择变更后继续保存现有视觉能力声明。手动填写时，视觉能力按现有自定义模型方式由用户显式配置或保持未知。

## 请求与错误处理

文本和视觉请求继续使用 OpenAI-compatible Chat Completions 协议。Token Plan 模式不改变翻译 Prompt、批处理、缓存或上下文逻辑。

错误提示补充通道上下文：

- 401/403：提示确认使用当前地区的 Token Plan `sk-sp-` 专属 Key。
- 404：提示模型不在当前 Token Plan 套餐或地区支持范围内。
- 429：提示可能是请求限流或套餐 Credits 已用尽。
- 未知官方通道：作为不可重试的配置错误返回，不归类为网络故障。

不得在日志、Toast 或错误文本中输出完整 API Key。

## 测试策略

先补失败测试，再实现功能：

1. 端点解析测试：三个百炼官方通道、存量默认、自定义地址、未知档案 ID。
2. 配置校验测试：新字段保留、旧配置兼容、非法类型修复。
3. 模型发现测试：Token Plan 使用正确 Base URL；失败时不回退公共目录；404/405 可手动填写。
4. 网关测试：文本与视觉请求都使用所选 Token Plan 端点；认证、模型不存在和额度错误信息正确。
5. 设置页测试：只对百炼官方模式显示通道选择；切换后更新地址并保留 Key；自定义与其他供应商 UI 不回归。
6. 完成后运行 `pnpm format`、相关 Vitest 测试和 `pnpm check`。

真实 API 冒烟测试需要用户自己的 Token Plan Key。测试时只读取本地忽略文件或环境变量，不提交、不打印 Key；分别验证中国站和国际站的 `/models`、一个文本翻译请求，并仅对套餐实际返回的模型进行测试。

## 验收标准

- 新建或存量阿里百炼模型都能选择三种官方通道。
- 存量百炼配置升级后仍走原按量付费地址。
- 中国站和国际站 Token Plan 的模型发现、测试、文本翻译使用各自正确端点。
- Token Plan 发现失败时不会展示按量付费公共目录模型。
- Token Plan Key 不会因切换通道被清除或泄露。
- 其他供应商、自定义地址、DeepL/DeepLX 行为保持不变。
- 全量检查通过，并在 `AGENTS.md` 追加修改记录。
