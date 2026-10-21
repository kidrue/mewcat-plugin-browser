# AI 模型管理

项目不再内置容易过期的模型枚举或静态模型名称列表。可选模型由供应商接口和 `models.dev` 在运行时发现，设置页显示当前账号可用模型及图片输入能力。

当前支持的平台包括火山引擎、阿里百炼、智谱、腾讯混元、DeepSeek、OpenAI、Moonshot、Gemini、DeepL 和 DeepLX。前八类模型通过统一 OpenAI-compatible 网关调用；Gemini 使用其 OpenAI-compatible 生成端点和官方模型发现接口；DeepL、DeepLX 使用固定翻译接口。

新增供应商时只需扩展 `src/model-management/providers.ts` 的注册信息，并为特殊发现或请求参数补充聚焦测试。不要重新引入数字模型枚举或手工维护的模型白名单。
