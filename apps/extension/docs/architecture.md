# 扩展架构

## 运行入口

| 目录 | 职责 |
| --- | --- |
| `src/entrypoints/` | WXT 后台、内容脚本与扩展页面入口，负责注册、初始化与挂载。 |
| `src/pages/`、`src/components/` | 前者组织设置页、Popup、侧边栏和反馈页，后者维护共享 UI。 |
| `src/contents/`、`src/features/` | 内容脚本集成网页和 DOM，功能模块负责翻译、图片处理、页面总结、阅读操作和用量统计。 |
| `src/background/`、`src/messaging/`、`src/services/` | Service Worker 处理浏览器事件和消息，消息契约约束跨环境调用，服务模块封装请求与监控。 |

## 文本翻译目录

翻译模块在 `src/features/` 下并列存放，每个模块的文件同级组织。跨功能模块和组件模块通过各自的 `index.ts` 导入，模块内部直接引用实现文件。目录与公开入口由 `pnpm test:workspace` 检查，导入边界由扩展的 `pnpm lint` 检查。

| 模块目录 | 职责 |
| --- | --- |
| `page-translation/` | 网页翻译编排、DOM 抽取、原文恢复、视窗调度、页面上下文与诊断。 |
| `paragraph-translation/` | 段落定位和段落翻译快捷键。 |
| `frame-translation/` | iframe 翻译状态和运行时。 |
| `selection-translation/` | 划词翻译入口和概念解释结果解析。 |
| `translation-services/` | 翻译服务选择、场景角色判断、上下文裁剪、服务适配和生成式模型网关调用。 |
| `translation-cache/` | 文本翻译的内存及持久化缓存。 |

## 网页翻译与动态内容

1. [页面初始化](../src/contents/initialize.tsx)检测页面语言，按设置和当前页状态启动翻译。用户可手动覆盖当前页源语言，换页后恢复自动检测。
2. [RuleEngine](../src/features/page-translation/RuleEngine.ts)加载 [rule.json](../src/public/assets/rule.json)，把匹配到的站点规则与通用规则合并。[DOMTraverser](../src/features/page-translation/DOMTraverser.ts)按有效规则遍历 DOM、提取文本块和插入位置，用占位符保留原样内容。[DomSelector](../src/features/page-translation/DomSelector.ts)负责语言过滤、同容器原文去重与排序。段落翻译复用抽取逻辑，并保留代码等原样内容。
3. [ImmersiveTranslator](../src/features/page-translation/ImmersiveTranslator.ts)协调抽取、分批、缓存与 DOM 更新。[lineBreakSegmentation](../src/features/page-translation/lineBreakSegmentation.ts)处理段落内的 `<br>`。译文通过扩展容器渲染，用户可关闭翻译并恢复原文。
4. 启用按阅读范围翻译时，[ViewportTranslationScheduler](../src/features/page-translation/ViewportTranslationScheduler.ts)根据页面或嵌套滚动容器的视窗调度，优先处理视窗及附近内容。快速滚动时暂缓发送，停止后重新计算。复验见[测试说明](../test/README.md)。
5. 子框架通过 [frame-translate.content.ts](../src/entrypoints/frame-translate.content.ts) 和[后台框架消息](../src/background/lib/frame-translation.ts)独立翻译，由主页面协调命令和状态。

整页和段落翻译通过 `ImmersiveTranslator.observeBodyChanges()` 监听 `document.body` 的子树，合并节点增删、文本及 `class`、`style`、`hidden`、`open` 变化，跳过 `[data-translate-id]` 下的译文变动。重新抽取后比较节点身份、容器及原文，清除失效译文和排队任务。宿主重建同一原文的节点时，可重新挂载已有译文。过期会话的响应不得渲染。路径、查询参数及 hash 路由变化视为换页，普通章节锚点保持当前会话。[监听与清理](../src/features/page-translation/ImmersiveTranslator.ts) · [导航判断](../src/features/page-translation/pageNavigation.ts)

### 网页翻译缓存

[TieredTranslationCache](../src/features/translation-cache/TieredTranslationCache.ts)先读 L1 内存缓存，未命中再读 L2 IndexedDB，L2 命中后回填 L1。写入会等待 L2 持久化，L2 初始化失败时仍可使用内存缓存。预设、过期和清理策略见[缓存工厂](../src/features/translation-cache/TranslationCacheFactory.ts)。

[缓存键](../src/features/translation-cache/cacheKeyGenerator.ts)包含规范化文本、源语言、目标语言、翻译服务、角色和上下文。没有 SubtleCrypto 的页面用完整长文本作为持久化键的一部分。强制刷新使当前页关联的译文缓存失效，切换模型、语言或角色时会隔离旧任务。开发和生产的配置、网页数据库及图片缓存使用各自的[存储命名](../src/constants/storage.ts)。

## 翻译服务与模型网关

[翻译路由](../src/features/translation-services/translationService.ts)选择 Google Translate、Microsoft Translator、mewCat 免费翻译或已配置的模型。Google Translate 是首次安装的默认服务。读取旧配置时保留用户显式选择，服务失效时提示用户重新选择。mewCat 免费翻译通过[后台服务](../src/background/lib/mewcat-service.ts)调用共享 `@mewcat/client`，复用持久化设备身份。

[供应商注册表](../src/features/model-management/providers.ts)定义官方地址和发现策略。官方通道从注册表取地址，自定义通道读取 `params.baseUrl`，`params.modelName` 是请求中的模型标识。DeepL 和 DeepLX 使用固定翻译接口。火山引擎、阿里百炼、智谱、腾讯混元、DeepSeek、OpenAI、Moonshot、Gemini 和硅基流动使用 OpenAI-compatible 生成端点。新增供应商时更新注册表，并为专用发现策略或请求参数补测试。

[模型发现](../src/features/model-management/discovery.ts)在填写 API Key 后查询供应商。常规模型列表由 `@xsai/model` 获取，Gemini 官方通道查询官方模型接口，硅基流动官方通道查询聊天模型。适用的官方通道结合 `models.dev` 补充能力信息，并可在发现失败时回退到目录。目录在内存和 `chrome.storage.local` 中缓存 24 小时。自定义端点不支持 `/models`、阿里百炼 Token Plan 不支持查询或已保存模型不在列表时，设置页允许保留或手动输入名称。DeepL 和 DeepLX 无须选择模型。

`capabilities.vision` 用 `true`、`false` 和缺失表示支持图片输入、仅文本及能力未知。读取旧配置时移除 `params.endpoint`，只在旧火山模型缺少 `modelName` 时用原 `endpoint` 补充。已有名称及当前选择继续使用。[迁移实现](../src/features/model-management/catalog.ts) · [模型设置](../src/pages/options/TranslateServices.tsx)

[modelTranslation](../src/features/translation-services/modelTranslation.ts)构建提示词后发送消息。[后台网关](../src/background/messages/model-gateway.ts)使用 `@xsai/generate-text` 和 `@xsai/generate-object` 执行文本和结构化图片请求，统一处理超时、中断及错误码。[流式网关](../src/background/messages/model-gateway-stream.ts)使用 `@xsai/stream-text` 和 Port 返回划词概念解释。[PageSummaryController](../src/features/page-summary/PageSummaryController.ts)管理页面总结的正文提取、模型调用、结果与导航生命周期。

## 图片翻译与站点兼容

- [图片内容脚本](../src/contents/imageTranslate.tsx)管理入口和请求。[后台抓图](../src/background/messages/translate-image.ts)优先下载原图，失败时按候选规则添加临时 DNR 请求头重试。满足条件时截取可见区域并按目标元素、缩放和设备像素比裁剪。下载超时直接返回超时错误。
- [站点配置](../src/background/config/hotlink-sites.ts)按图片和页面地址选择规则。生成表通过 `pnpm sync:hotlink-rules` 从上游规则生成。手工规则保留在源配置。修改规则后执行 `pnpm check:hotlink-rules`，检查 Windows 和 Linux 生成一致性。
- Canvas 站点由 [canvas-sites.ts](../src/background/config/canvas-sites.ts)控制，`WXT_ENABLE_CANVAS_REBUILD` 默认启用，`WXT_CANVAS_ROLLOUT_PERCENT` 默认 100。后台按站点注入 [Main World hook](../src/contents/inject/canvas-image-hook.ts)，内容脚本通过[桥接](../src/contents/bridges/canvas-hook-bridge.ts)读取绘制来源以取回原图。无法重建时可走符合条件的截图路径。
- [结构化图片翻译](../src/background/messages/structured-image-translation.ts)独立解析图片设置的模型和模型名称，预处理图片，要求模型返回结构化文字与位置。[覆盖层](../src/contents/imageTranslationOverlay.ts)在原图上绘制译文。[图片缓存](../src/features/image-translation/cache.ts)在本地按图片哈希、目标语言、模型选择键和结构版本复用结果，合并同键并发请求。

## 配置、反馈与统计

- [configAtom](../src/state/config.ts)提供各扩展上下文的只读配置视图。页面通过 `update-config` 提交字段增量或按 ID 更新模型，[后台](../src/background/messages/update-config.ts)排队读取同步存储的最新值、合并并按需保存。读取和订阅不回写整份配置。并发设置的一次性迁移将 `maxRequestsPerSecond` 写为 8，以单次同步存储调用保存配置和独立迁移标记。保存失败时下次仍可重试。
- Popup 与“设置 → 关于”打开[反馈页](../src/pages/feedback/index.tsx)，复用已开启的标签页。用户填写反馈和可选邮箱，[后台](../src/background/messages/submit-feedback.ts)校验消息来源并附上扩展版本，通过共享客户端发给服务端。反馈页未启用 Replay。调试入口见[测试说明](../test/README.md)。
- [本地翻译字符统计](../src/features/token-usage/textTranslationUsage.ts)按本机日、周（周一开始）和月累计成功翻译的原文 UTF-16 代码单元。页面缓存命中、失败、空结果和无法与原文对齐的批量结果不计入。该统计只保存在本机，可在设置页清空。
- [可选使用统计](../src/background/messages/device-activity.ts)由用户在“设置 → 关于 → 使用统计”授权，默认关闭。启用后向服务端发送安装、卸载和整页翻译使用记录，页标识由本机盐、站点和路径计算。关闭后停止上报并请求服务端删除统计。数据说明见[隐私政策](../../../PRIVACY.md)。

## 错误监控

内容脚本和后台使用独立的 Sentry `BrowserClient` 和 `Scope`。内容脚本只记录扩展来源的错误。后台也记录业务响应中的意外失败，在消息结束前尝试限时发送。预期的取消、配置缺失和无可翻译图片文字等结果会被过滤。原始异常仅在后台与业务响应关联，便于保留堆栈并限制上报数据。扩展页面的监控配置、脱敏逻辑及复验见[监控实现](../src/services/monitoring/sentry.ts)、[上报过滤](../src/services/monitoring/sanitize.ts)和[发布手册](chrome-web-store-automation.md)。

## 设计素材

晴空来信界面使用 `src/public/assets/sky-letter/` 中的运行时插画，通过 `SkyArtwork` 解析路径。复用插画和动效时可参考[素材预览](ui-previews/sky-post-office/materials-preview.html)、[插画提示词](ui-previews/sky-post-office/options-assets.md)和[三花猫加载动效](ui-previews/running-cat-motion.md)。
