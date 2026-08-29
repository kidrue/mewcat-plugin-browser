# 统一模型网关与模型发现

翻译模型统一由函数式网关调用，不再维护 `TranslationServiceManager`、`UniversalTranslator` 或 `ApiKeyValidator` 类。文本生成与结构化图片翻译分别使用 `@xsai/generate-text`、`@xsai/generate-object`，模型列表使用 `@xsai/model`。

## 运行时结构

- `src/model-management/providers.ts`：供应商类型、官方 `baseURL` 与发现策略的唯一注册表。
- `src/model-management/discovery.ts`：优先调用供应商模型接口，并用 `models.dev` 补充名称和图片输入能力。
- `src/background/messages/model-gateway.ts`：统一执行文本、结构化图片、DeepL 与 DeepLX 请求，处理超时、中断和稳定错误码。
- `src/translation/modelTranslation.ts`：构建翻译提示词并调用后台网关。
- `src/translation/translationService.ts`：在 Google Translate、AI 模型和固定翻译引擎之间进行函数式路由。

## 模型列表

填写 API Key 后，设置页会自动加载模型：

1. 官方或 OpenAI-compatible 接口优先通过供应商 API 获取当前账号实际可用模型。
2. `models.dev` 目录用于失败回退和能力元数据补充，缓存时间为 24 小时。
3. 自定义接口不支持 `/models` 时，设置页才切换到手动模型名称输入。
4. 当前已保存但接口未返回的模型仍保留显示，不会被自动替换。

模型能力使用 `capabilities.vision` 持久化。`true` 表示支持图片输入，`false` 表示仅文本，缺失表示能力未知；不再通过模型名称白名单猜测视觉能力。

## 兼容迁移

旧版 `params.endpoint` 已删除。读取配置时会移除该字段；若旧火山模型的 `modelName` 为空，则把原 `endpoint` 值迁移为 `modelName`。已有非空 `modelName` 始终优先，迁移不会自动改选其他模型。

DeepL 与 DeepLX 没有模型选择器，继续使用各自固定翻译接口。
