# Sentry 上报修复与验证

## 根因与修复

- 旧的本地验证包在构建时清空了 `WXT_SENTRY_DSN`，运行时监控因此关闭。正式包必须保留 DSN；Source Map 上传使用独立的构建凭据，不能通过清空 DSN 控制上传。
- `@sentry/browser@10.74.0` 的 `Sentry.init()` 会在网页 content script 中禁用客户端。content script 和 background 改为独立 `BrowserClient` / `Scope`，避免覆盖宿主网页的全局客户端，也不挂载修改宿主 API 的自动集成。扩展页面继续使用 `Sentry.init()`。
- background 原来只记录抛出的异常，漏掉了被业务代码转换成 `success: false` 的失败。现在普通消息与流式 Port 都记录意外失败，带上操作、错误码、HTTP 状态和可用的原始堆栈；MV3 消息结束前限时刷新发送队列。
- 配置缺失、图片无文字、不支持的图片和主动取消等预期结果不报告。摘要与图片界面通过 `BackgroundResponseError` 识别已由后台负责的失败，避免重复事件；界面自身和消息传输异常仍可报告。
- 原始异常通过后台进程内的 WeakMap 关联，既不放入业务消息，也不上传 provider 响应文本。保留既有的凭据、正文及用户数据过滤。

content script 监听未捕获错误和 Promise 拒绝，只记录包含本扩展来源的错误；宿主网页异常不记录。网页 content script 与 background 不启用 Replay；Replay 仅用于 popup、options、sidepanel，并遮盖文字、输入和媒体。

## 已完成的验证（2026-10-17）

- 真实 SDK 回归覆盖 content script 的扩展环境识别、独立 scope、重复初始化、异常对象去重、宿主错误隔离及无 DOM 的 Service Worker 环境，不使用 SDK mock。
- 后台测试覆盖 `success: false`、主动取消、原始堆栈、隐私过滤与业务响应不变；图片服务覆盖主消息、tab 消息与 storage 备用通道。
- 最终 `pnpm check` 与正式 `pnpm build` 已通过，构建日志显示 `Sentry Source Map：uploaded`。正式包为 `.output/mewCat-1.0.1-20261017 001235.zip`；检查确认已包含 DSN、未包含构建令牌、包内没有 `.map` 文件。
- 手动合成探针经过生产初始化、后台失败响应包装器和真实 Fetch transport。Sentry 接收端返回 HTTP 200，`accepted: true`、`flushed: true`，release 为 `mewcat@1.0.1`。
- 最新探针事件 ID：`ff1cb82882a24b8c9f5c0f8cb28a9a8c`，操作标签 `sentry-smoke-test`。探针不包含真实页面、用户或翻译内容；扩展堆栈帧为合成样本，不用于检验真实 Source Map 解析。
- 额外在独立测试配置的 Chrome 155 中通过 DevTools 加载上述正式构建目录，在 Service Worker 和本机合成网页的扩展隔离环境中触发未捕获错误。两端均为 `initialized: true`、`enabled: true`、`flushed: true`，并观察到真实网络请求返回 HTTP 200。background 事件 ID 为 `2b11586279664bd489fd402e1dec0c7c`，content 事件 ID 为 `efda75eed2ab479ab04a6c269130810d`。测试后关闭了专用浏览器。此测试不修改个人浏览器配置，也不使用真实网页数据。

HTTP 200 证明接收端接受请求，不等于已经验证 Issues 中可见。当前令牌读取项目过滤器和事件详情均返回 HTTP 403，暂时无法核实后台入库、浏览器扩展错误过滤规则或 Source Map 的实际解析效果。需具备 `project:read`、`event:read` 权限的令牌或在 Sentry 后台检查上述事件。

## 复验方式

在不提交的 `.env.local` 中配置 `WXT_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_AUTH_TOKEN`。不要把令牌写入命令历史或聊天。

```bash
pnpm check
pnpm build
pnpm sentry:smoke
```

`pnpm check` 的测试不向线上发送事件；`pnpm sentry:smoke` 会主动发送一个合成错误，应按需手动运行。若请求超时、HTTP 非成功或队列未刷新，脚本以失败退出；输出只包含事件 ID、release 和传输结果，不打印凭据。

安装新的正式构建并刷新目标网页后，在 Sentry 中按 `environment:production`、`release:mewcat@1.0.1`、`runtime_context` 和操作标签检索。线上版本仍需通过正常发布流程更新，本地修复不会改变用户已安装的旧包。
