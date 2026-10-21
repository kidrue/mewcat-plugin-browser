# mewCat Sentry 错误监控设计

## 目标

为 mewCat Chrome MV3 扩展接入 Sentry，生产环境默认上报错误，并在错误发生时上传经过隐私遮盖的 Session Replay。事件保留完整网页 URL、扩展版本、运行上下文、功能入口、错误栈和必要的操作、网络上下文，使开发者能定位 background、扩展页面和 content script 中的问题。

## 范围与边界

- 覆盖 background service worker、popup、options、sidepanel 和网页 content script。
- 自动捕获未处理异常、未处理 Promise rejection 和 React 渲染错误；关键后台消息处理及翻译入口的已捕获异常通过统一接口手动上报。
- 仅在生产环境且 `WXT_SENTRY_DSN` 非空时启用。开发环境和测试环境不向 Sentry 发送数据。
- 保留完整网页 URL，包括 path、query 和 fragment，以满足复现场景要求。
- 不设置 Sentry 用户身份，不主动采集账号、手机号、IP、Cookie、Authorization、API Key、原文、译文、Prompt、图片内容、请求体或响应体。
- Session Replay 遮盖全部文字和输入内容并屏蔽图片、视频等媒体，不设置 `unmask` 或 `unblock` 例外。
- 不接入性能追踪、Profiling、用户反馈组件或常规日志上报。

## 技术选择

采用 `@sentry/browser` 的多上下文直接接入方案。background 在 service worker 内独立初始化；popup、options 和 sidepanel 在各自页面入口初始化；新增尽早运行的 content script，在扩展 isolated world 中初始化页面错误捕获和 Replay。

不采用 background 集中代理所有事件，因为序列化转发会损失浏览器生成的异常对象、原始堆栈和 Replay 会话关联。不只依赖 React ErrorBoundary，因为它无法覆盖后台、异步和非 React 错误。

## 运行时结构

新增 `src/monitoring/`：

- `sentry.ts`：统一初始化、运行上下文标签、手动异常捕获和测试辅助接口。
- `sanitize.ts`：清理事件、breadcrumb 与异常文本中的凭据和敏感字段，同时保留网页 URL。
- `types.ts`：限定 `background`、`content`、`popup`、`options`、`sidepanel` 等运行上下文和可上报的结构化字段。

初始化配置：

- `enabled`：仅生产环境且 DSN 存在。
- `release`：`mewcat@<manifest version>`。
- `environment`：`production`。
- `sendDefaultPii: false`。
- 错误采样率为 100%。
- `tracesSampleRate: 0`，不发送性能事务。
- content script 与有 DOM 的扩展页面启用 Replay；background 不启用 Replay。
- `replaysSessionSampleRate: 0`，`replaysOnErrorSampleRate: 1`，只在错误发生时上传缓冲的复现过程。
- Replay 显式设置 `maskAllText: true`、`maskAllInputs: true`、`blockAllMedia: true`，不采集网络请求体或响应体。

每个事件附加 `runtime_context`、`extension_version` 和受控的 `feature` / `operation` 标签。页面上下文显式附加当前完整 URL；background 中处理来自 tab 的操作时，只从 Chrome 的 `MessageSender` 或 `Tab` 元数据读取 URL，不附加消息体。

## 捕获策略

- Sentry 默认集成负责未捕获异常和未处理 Promise rejection。
- React 根节点使用统一的错误边界回调；保留现有用户可见的错误兜底界面。
- background 的消息和 Port 入口在最外层捕获异常，附加处理器名称和 sender URL 后再沿用现有错误返回逻辑。
- 翻译控制器、划词翻译、图片翻译和页面总结只在现有 catch 边界上报异常对象及固定 operation，不附加翻译内容或配置对象。
- 不把所有 `console.error` 自动转成事件，避免第三方错误对象或调试输出携带请求配置；控制台信息只作为经过过滤的 breadcrumb。
- Sentry 自身发送失败、被广告拦截器阻止或 DSN 无效时静默失败，不影响翻译和设置功能。

## 数据过滤

`beforeSend` 删除：

- `event.user`
- Cookie、Authorization、Proxy-Authorization、X-API-Key 等请求头
- request data、response data 和附件
- SDK 自动推断的可能包含表单内容的 extras

异常消息、breadcrumb message 和结构化数据使用递归清理器遮盖 Bearer token、常见 API Key、Sentry auth token、JWT 及项目已知的 `apiKey`、`accessToken`、`refreshToken` 字段。URL 字段不经过删除或 query 清理，但 Replay 中页面文字、输入和媒体继续遮盖。

## Source map 与发布

WXT 生产构建生成 hidden source map，并由仓库内的构建脚本调用 `@sentry/cli`。构建完成且四项 Sentry 构建变量齐全时：

1. 为 `.output/chrome-mv3` 的 JavaScript 和 source map 注入 Debug ID。
2. 将 source map 上传到 `kidrue/mewcat-extension`，release 使用 `mewcat@<version>`。
3. 上传成功后删除 `.output` 下的 `.map`，再生成商店 ZIP 和 CRX。

本地未配置任何 Sentry 构建变量时允许普通构建；只配置一部分时构建失败并指出缺失变量，避免出现看似成功但无法还原堆栈的发布。GitHub Actions 使用 Variables 提供 `WXT_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT`，使用 Secret 提供 `SENTRY_AUTH_TOKEN`。工作流不得输出 token，发布包检查不得包含 token 或 `.map` 文件。

## Chrome Web Store 与隐私

完整 URL 属于浏览历史，Replay 的点击和滚动属于用户活动。发布前需要在 Chrome Web Store 数据使用披露和项目隐私政策中说明：收集用途仅为错误诊断；页面文字、输入和媒体被遮盖；数据发送给 Sentry；说明保留期限和删除渠道。代码接入不自动修改商店后台配置。

## 测试与验收

- 单元测试覆盖生产开关、缺少 DSN、运行上下文标签和递归脱敏。
- 配置测试确认 Replay 只在允许的上下文启用，采样率及三项遮盖设置固定。
- React 错误边界和 background handler 测试确认异常被上报一次，原有错误处理结果不变。
- 构建测试确认 source map 上传凭据不会出现在扩展 bundle，最终 ZIP 不包含 `.map`。
- 执行 `pnpm format`、`pnpm check` 和生产构建。
- 使用明确标记的测试异常验证 Sentry 收到事件、完整 URL、运行上下文、release、可还原源码堆栈及关联 Replay；测试事件不包含真实用户内容。

## 失败与降级

- DSN 缺失时 Sentry 保持禁用，扩展正常工作。
- 运行时上报失败不重试阻塞业务，不改变现有错误提示。
- source map 上传失败时生产发布构建失败，防止发布无法定位源码的版本。
- background 被 MV3 提前挂起时，未完成的网络发送可能丢失；受控手动上报在关键异步处理结束前进行短时 flush，但不得显著延迟用户请求。
