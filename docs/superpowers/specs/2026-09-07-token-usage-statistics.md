# Token Usage Statistics Design

## Goal

在 options 页面提供仅供本地分析的生成式 AI token 用量统计，帮助开发者识别不同功能和模型的消耗热点。

## Scope

- 覆盖网页翻译、划词翻译、概念解释、页面摘要和图片翻译。
- 仅统计生成式 AI 模型；Google Translate、DeepL、DeepLX 不计入。
- 优先采用供应商返回的真实 usage；缺失时根据输入和输出文本进行本地估算。
- 每条聚合数据标记为 `reported` 或 `estimated`。
- 不保存原文、译文、prompt、图片或 API Key。

## Storage

- 使用环境隔离后的 `chrome.storage.local` 键保存每日聚合数据。
- 维度为日期、模型 ID、模型名称、功能类型和统计来源。
- 每次读写均通过 Zod 做字段级修复；非法记录或字段不会阻断翻译流程。
- 只保留最近 30 个自然日，并支持用户手动清空。

## UI

- options 增加“用量统计”导航项。
- 展示今日、近 7 天、近 30 天的输入、输出和总 token。
- 提供按模型、功能类型、真实/估算来源的聚合明细。
- 空数据、读取异常和清空操作均有明确状态反馈。

## Accuracy

- `reported` 数据采用模型 SDK 返回的 input/output/total usage，并兼容常见字段名。
- `estimated` 数据采用稳定的多语言启发式算法；它用于趋势分析，不宣称等同于具体模型 tokenizer。
- 统计写入失败不得影响模型响应返回。
