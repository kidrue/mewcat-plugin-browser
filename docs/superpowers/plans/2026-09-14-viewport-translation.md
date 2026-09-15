# 按阅读范围翻译实施计划

> 执行方式：在当前会话按 executing-plans 逐项完成。用户已批准实施，不再为常规编辑与验证增加确认步骤。

**目标：** 在默认关闭的配置下提供三屏范围、快速滚动暂停和动态优先级，减少未阅读内容的请求。

**架构：** 独立 ViewportTranslationScheduler 管理任务，readingViewport 计算位置；ImmersiveTranslator 提供缓存、请求和展示回调。旧默认路径保持兼容。

**技术栈：** TypeScript、DOM / IntersectionObserver、React / Jotai、Vitest / jsdom。

**设计：** docs/superpowers/specs/2026-09-14-viewport-translation-design.md

## 全局约束

- enableViewportTranslation 默认 false；只影响沉浸式网页翻译。
- 已发送请求允许完成，所有后续副作用检查任务和会话身份。
- 不新增依赖或权限；保留当前工作区已有改动；不执行发布。
- src 修改后执行 pnpm format，完成相关测试和 pnpm check。

## 任务 1：阅读位置及调度器

- [x] 新建 test/viewport-translation-scheduler.test.ts，以 DOM 几何夹具验证三屏边界、DOM 顺序、上下滚动优先级、200ms 恢复、缓存等待时滚走、并发、失败去重及销毁。
- [x] 运行 `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/viewport-translation-scheduler.test.ts`，确认缺少调度实现导致失败。
- [x] 新建 src/translation/readingViewport.ts 和 src/translation/ViewportTranslationScheduler.ts。
  接口：`add(nodes: TranslationNode[], retry?: boolean): void`、`setViewportOnly(enabled: boolean): void`、`destroy(): void`；构造参数提供缓存查询、缓存写入、翻译、渲染、错误回调及批次限制。
  每次取任务先获取最新几何并排序；缓存准备后回到待办队列重新选取；网络请求前同步复核；任务身份用于丢弃过期结果。
- [x] 运行上述测试并修复，覆盖嵌套容器及窗口尺寸变化。

## 任务 2：翻译入口与生命周期

- [x] 新建 test/viewport-translation.test.ts，通过真实编排器和模拟网络边界验证远处无请求、滚动补译、默认关闭全译、全文摘要不额外调用、开关切换及会话清理。
- [x] 运行测试确认失败。
- [x] 修改 src/translation/ImmersiveTranslator.ts，将新模式初始、增量和重试送入统一调度器。回调捕获原始文本与配置，使用现有缓存键和翻译服务，保证异步结果不污染新会话。
- [x] 运行入口和调度测试；确保既有缓存相关测试继续通过。

## 任务 3：配置与界面

- [x] 在 test/extension-config-validation.test.ts 和 test/options-basic-page-summary.test.tsx 增加旧配置默认关闭、持久化开启、开关交互断言并确认失败。
- [x] 修改 src/types/config.ts、src/types/extensionConfigSchema.ts、src/state/constants.ts、src/options/Basic.tsx，新增开关。现有 TranslationControlCenter 的配置整体传递沿用，由编排器处理切换。
- [x] 将新增行为测试接入 package.json 的 test:image，保留既有修改。
- [x] 执行 pnpm format、相关测试、pnpm check、生产构建；审查 diff，记录验证结果及已知限制。

## 完成记录（2026-09-15）

- 调度及集成测试 27 项通过；真实浏览器验收 5 项通过。
- 完整 pnpm check 通过，其中 test:image 为 32 个文件、324 项测试。
- pnpm build 通过，产物为 .output/chrome-mv3-prod-20260915.zip。本地验收构建未上传 Sentry Source Map。
- 独立代码审查发现的 3 项动态 DOM / 异步结果问题已修复并复核通过。
- 尺寸变化时延迟重建监听器，避免 ResizeObserver 循环警告；回归测试及浏览器验收通过，控制台无警告或错误。
- 当前分支和用户原有改动保留；未提交、推送或发布。
