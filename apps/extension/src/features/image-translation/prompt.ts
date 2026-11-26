export const visionTranslationPrompt = `识别图片中的所有可见文字，并将其翻译为目标语言。仅返回 JSON 对象，不要添加说明或 Markdown。

返回格式为 {"blocks":[...]}。每个区块必须包含：
- box：[ymin, xmin, ymax, xmax]，图片坐标归一化到 0–1000；
- sourceText：识别到的原文；
- translatedText：翻译后的目标语言文字；
- writingMode："horizontal" 或 "vertical"。

目标语言由请求指定。坐标顺序必须严格为 [ymin, xmin, ymax, xmax]。若图片中没有可见文字，返回 {"blocks":[]}。`
