# AI 图片翻译设计

## 目标

让现有单张图片悬浮翻译真正可用：沿用 background 抓图、防盗链、截图兜底和 Canvas 捕获，调用用户单独选择的视觉模型，一次返回原文、译文和文本框，并以可恢复的页面覆盖层原位显示译文。

## 已批准边界

- 支持 OpenAI-compatible Chat Completions 与 Gemini generateContent。
- 单次视觉请求同时完成 OCR、定位和翻译。
- 只处理用户显式点击的单张图片，不做整页批量。
- 页面原位覆盖，不生成或传输完整译图位图。
- 长边最多 2048px，源图片最多 10MB；必要时转 WebP 质量 0.92。
- 文本框坐标为 `[ymin, xmin, ymax, xmax]`，归一化到 0–1000。
- 覆盖层支持横排、竖排、`object-fit/object-position`、滚动和缩放；旋转或倾斜目标不显示按钮。
- 背景采用本地图像区域的代表色与约 92% 不透明底，文字使用高对比色。
- 缓存结构化结果 1 天，键包含图片哈希、目标语言、模型 ID 和 schema 版本；空结果与失败不缓存。
- API Key 仅在 background 使用，生产日志不记录图片、密钥或完整识别文本。

## 数据流

1. Content script 验证目标、读取独立视觉模型 ID并发送 `translate-image` 请求。
2. Background 沿用现有多层抓图策略得到 Blob，预处理后交给对应视觉协议适配器。
3. 适配器要求结构化 JSON；OpenAI-compatible 端点仅在明确不支持 `response_format` 时重试一次纯 JSON 提示。
4. Zod 校验响应，裁剪坐标并为每个块计算背景色和文字色，然后缓存并返回轻量结构化结果。
5. Content script overlay manager 将块映射到 `<img>` 或 `<canvas>` 的真实内容区域；再次点击或功能关闭时恢复。

## 错误与兼容

- 无视觉模型、模型不支持图片、认证失败、限流、超时、无文字、格式错误使用稳定错误码和中文提示。
- 失败不修改目标 DOM，不残留 overlay、observer、listener 或 storage 结果。
- 旧 `translatedImageUrl` 缓存使用旧前缀保留但不读取、不迁移。
- 已知视觉模型自动标记；自定义 OpenAI-compatible 模型由用户显式开启视觉能力。

