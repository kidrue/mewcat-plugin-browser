# Sentry 错误监控实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 mewCat 的 background、扩展页面和 content script 增加生产环境 Sentry 错误上报、隐私遮盖 Replay 与可还原源码的 source map 发布流程。

**Architecture:** 使用 `@sentry/browser` 在各独立运行上下文直接初始化；全网页只由一个尽早运行的 monitoring content script 启用 Replay，其他 content script 复用全局错误监听。纯函数负责事件脱敏和配置生成，React 错误边界及关键 catch 路径通过统一 `captureException` 接口补充已处理异常；WXT `build:done` 钩子调用 `@sentry/cli` 上传并删除 hidden source map。

**Tech Stack:** TypeScript 5.8、WXT 0.21.4、React 18、`@sentry/browser` 10.74.0、`@sentry/cli` 3.7.0、Vitest 4、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-09-11-sentry-error-monitoring-design.md`

## Global Constraints

- 仅在生产环境且 `WXT_SENTRY_DSN` 非空时启用运行时上报。
- 保留完整网页 URL，包括 path、query 和 fragment。
- 不设置 Sentry 用户身份，不主动采集账号、手机号、IP、Cookie、Authorization、API Key、原文、译文、Prompt、图片内容、请求体或响应体。
- Replay 固定使用 `maskAllText: true`、`maskAllInputs: true`、`blockAllMedia: true`，不设置 `unmask` 或 `unblock`。
- 错误采样率 100%，`replaysSessionSampleRate: 0`、`replaysOnErrorSampleRate: 1`、`tracesSampleRate: 0`。
- `SENTRY_AUTH_TOKEN` 只能用于构建，不得出现在 `WXT_` 变量、扩展 bundle、日志、ZIP 或 CRX 中。
- 保留工作区现有未提交修改，不重置、不覆盖、不把无关改动纳入 Sentry 提交。
- 修改 `src/` 后执行 `pnpm format`；完成后执行 `pnpm check` 并追加 `AGENTS.md` 修改记录。

---

### Task 1: 纯配置与敏感数据过滤

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/monitoring/types.ts`
- Create: `src/monitoring/sanitize.ts`
- Create: `src/monitoring/config.ts`
- Create: `test/sentry-monitoring.test.ts`
- Modify: `package.json` 的 `test:image` 文件列表

**Interfaces:**
- Produces: `RuntimeContext = "background" | "content" | "popup" | "options" | "sidepanel"`。
- Produces: `sanitizeSentryValue(value: unknown, key?: string): unknown`。
- Produces: `sanitizeSentryEvent<T extends Event>(event: T): T` 与 `sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null`。
- Produces: `createSentryRuntimeConfig(input: RuntimeConfigInput): RuntimeConfigResult`，包含 `enabled`、release、tags、采样率及 Replay 开关。

- [ ] **Step 1: 安装锁定版本依赖**

Run: `pnpm add @sentry/browser@10.74.0 && pnpm add -D @sentry/cli@3.7.0`

Expected: `package.json` 和 `pnpm-lock.yaml` 仅增加 Sentry 运行时与构建依赖。

- [ ] **Step 2: 编写失败测试**

在 `test/sentry-monitoring.test.ts` 覆盖以下输入：

```ts
expect(createSentryRuntimeConfig({
  dsn: "https://public@example.ingest.sentry.io/1",
  isProduction: true,
  runtimeContext: "content",
  enableReplay: true,
  version: "0.0.5",
})).toMatchObject({
  enabled: true,
  release: "mewcat@0.0.5",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
})

expect(sanitizeSentryValue({
  apiKey: "sk-secret",
  nested: { authorization: "Bearer secret", status: 500 },
})).toEqual({
  apiKey: "[Filtered]",
  nested: { authorization: "[Filtered]", status: 500 },
})

expect(sanitizeSentryEvent({
  request: { url: "https://example.com/private?q=kept", data: "secret" },
  user: { id: "user" },
} as Event)).toMatchObject({
  request: { url: "https://example.com/private?q=kept" },
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-monitoring.test.ts`

Expected: FAIL，提示 `@/monitoring/config` 或导出函数不存在。

- [ ] **Step 4: 实现最小纯函数**

`config.ts` 只根据显式输入生成配置，不直接读取浏览器全局：

```ts
export function createSentryRuntimeConfig(input: RuntimeConfigInput) {
  const enabled = input.isProduction && input.dsn.trim().length > 0
  return {
    enabled,
    dsn: input.dsn,
    environment: "production",
    release: `mewcat@${input.version}`,
    sampleRate: 1,
    tracesSampleRate: 0,
    replaysSessionSampleRate: input.enableReplay ? 0 : undefined,
    replaysOnErrorSampleRate: input.enableReplay ? 1 : undefined,
    tags: { runtime_context: input.runtimeContext, extension_version: input.version },
  }
}
```

`sanitize.ts` 递归清理敏感键和 token 模式；`sanitizeSentryEvent` 明确保留 `request.url`，删除 `user`、request data、敏感 headers、附件及不受控 extras。

- [ ] **Step 5: 运行目标测试并格式化**

Run: `pnpm format && pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-monitoring.test.ts`

Expected: PASS，所有配置和脱敏断言通过。

### Task 2: 运行时 SDK 初始化

**Files:**
- Create: `src/monitoring/sentry.ts`
- Create: `src/monitoring/index.ts`
- Modify: `test/sentry-monitoring.test.ts`

**Interfaces:**
- Consumes: `createSentryRuntimeConfig`、`sanitizeSentryEvent`、`sanitizeBreadcrumb`、`RuntimeContext`。
- Produces: `initializeSentry(options: InitializeSentryOptions): boolean`。
- Produces: `captureExtensionException(error: unknown, context: CaptureContext): string | undefined`。
- Produces: `flushSentry(timeout?: number): Promise<boolean>`。

- [ ] **Step 1: 为 SDK 适配器编写失败测试**

通过注入 `SentryAdapter` mock 验证：开发环境不调用 `init`；background 不创建 Replay；content 创建一次 Replay；同一 global scope 重复初始化不重复调用；手动捕获只附加 `feature`、`operation`、`page_url`，不附加业务对象。

```ts
expect(initializeSentry({
  runtimeContext: "content",
  enableReplay: true,
  adapter,
  env: { isProduction: true, dsn: TEST_DSN },
})).toBe(true)
expect(adapter.replayIntegration).toHaveBeenCalledWith({
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-monitoring.test.ts`

Expected: FAIL，提示 `initializeSentry` 不存在。

- [ ] **Step 3: 实现适配器**

运行时从 `import.meta.env.PROD`、`import.meta.env.WXT_SENTRY_DSN` 和 `chrome.runtime.getManifest().version` 获取值；传入 `beforeSend`、`beforeBreadcrumb` 和可选 Replay integration。使用当前 global scope 上的 `Symbol.for("mewcat.sentry.initialized")` 防止同一上下文重复初始化。

```ts
initializeSentry({ runtimeContext: "content", enableReplay: true, pageUrl: location.href })
captureExtensionException(error, {
  feature: "page-translation",
  operation: "translate",
  pageUrl: location.href,
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm format && pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-monitoring.test.ts`

Expected: PASS，且测试 transport 不产生外部网络请求。

### Task 3: 各入口初始化与 React 错误边界

**Files:**
- Create: `src/entrypoints/monitoring.content.ts`
- Create: `src/components/MonitoringErrorBoundary/index.tsx`
- Modify: `src/components/index.ts`
- Modify: `src/entrypoints/background.ts`
- Modify: `src/entrypoints/options/main.tsx`
- Modify: `src/entrypoints/popup/main.tsx`
- Modify: `src/entrypoints/sidepanel/main.tsx`
- Modify: `src/options/index.tsx`
- Modify: `src/entrypoints/selection-translate.content.tsx`
- Modify: `src/entrypoints/image-translate.content.tsx`
- Modify: `src/entrypoints/translation-control-center.content.tsx`
- Modify: `src/entrypoints/page-summary.content.tsx`
- Create: `test/sentry-entrypoints.test.tsx`
- Modify: `package.json` 的 `test:image` 文件列表

**Interfaces:**
- Consumes: `initializeSentry`、`captureExtensionException`。
- Produces: `<MonitoringErrorBoundary context={{ feature, operation }} fallbackRender?>`，保留原有 `ErrorFallback` 可见行为。

- [ ] **Step 1: 编写入口与边界失败测试**

源码契约断言覆盖 background/options/popup/sidepanel 初始化；`monitoring.content.ts` 必须 `runAt: "document_start"`、`matches: ["<all_urls>"]` 且启用 Replay。组件测试抛出渲染错误后断言 `captureExtensionException` 恰好一次，fallback 仍可重试。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/sentry-entrypoints.test.tsx`

Expected: FAIL，入口或 `MonitoringErrorBoundary` 不存在。

- [ ] **Step 3: 接入入口**

新增 content script：

```ts
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    initializeSentry({
      runtimeContext: "content",
      enableReplay: true,
      pageUrl: location.href,
    })
  },
})
```

background 在注册监听器前初始化且禁用 Replay；三个扩展页面入口在 `createRoot` 前初始化并启用 Replay。其他 content UI 只包裹错误边界，不再次初始化 SDK。

- [ ] **Step 4: 实现 React 边界并保留原兜底**

基于项目现有 `react-error-boundary`：

```tsx
<ErrorBoundary
  fallbackRender={fallbackRender ?? (() => null)}
  onError={error => captureExtensionException(error, context)}
>
  {children}
</ErrorBoundary>
```

Options 现有边界增加 `onError`；popup 和 sidepanel 根节点使用可见 `ErrorFallback`；页面 content UI 使用局部空 fallback，避免覆盖宿主页面。

- [ ] **Step 5: 运行入口测试**

Run: `pnpm format && pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/sentry-entrypoints.test.tsx`

Expected: PASS，错误上报一次且原 UI 行为保持。

### Task 4: 已捕获异常与后台消息上下文

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/contents/TranslationControlCenter.tsx`
- Modify: `src/contents/selectionTranslate.tsx`
- Modify: `src/contents/imageTranslationOverlay.ts`
- Modify: `src/page-summary/PageSummaryController.ts`
- Modify: `test/settings-panel-page-summary.test.tsx`
- Modify: `test/image-translation-content.test.tsx`
- Create: `test/sentry-background-reporting.test.ts`
- Modify: `package.json` 的 `test:image` 文件列表

**Interfaces:**
- Consumes: `captureExtensionException(error, { feature, operation, pageUrl })`。
- Produces: `monitorBackgroundHandler(operation, handler)`，返回与原 handler 相同的 resolved value，并在 rejected 时上报后原样抛出。

- [ ] **Step 1: 编写失败测试**

验证 background handler reject 时上报一次、保留 `sender.tab.url`、不传 `message.data`；handler 正常返回时不上报。现有页面总结、图片和翻译 catch 测试增加固定 operation 的断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-background-reporting.test.ts test/image-translation-content.test.tsx test/settings-panel-page-summary.test.tsx`

Expected: FAIL，未调用统一捕获接口。

- [ ] **Step 3: 包装后台入口并补充关键 catch**

```ts
try {
  return await handler(message)
} catch (error) {
  captureExtensionException(error, {
    feature: "background-message",
    operation,
    pageUrl: message.sender?.tab?.url,
  })
  throw error
}
```

页面路径仅传固定 feature/operation 与 `location.href`；不传模型配置、请求体、选中文本、翻译结果或图片数据。

- [ ] **Step 4: 运行目标测试确认通过**

Run: `pnpm format && pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-background-reporting.test.ts test/image-translation-content.test.tsx test/settings-panel-page-summary.test.tsx`

Expected: PASS，且原错误返回、重试和 UI 状态断言不变。

### Task 5: Source map、单次构建与 CI 配置

**Files:**
- Modify: `wxt.config.ts`
- Create: `scripts/upload-sentry-sourcemaps.cjs`
- Modify: `scripts/build-with-timing.cjs`
- Modify: `.github/workflows/release.yml`
- Create: `test/sentry-build.test.cjs`
- Modify: `package.json` 的 `test:chrome-web-store` 文件列表

**Interfaces:**
- Produces: `uploadSentrySourceMaps({ outputDir, version, env }): Promise<"uploaded" | "skipped">` 的脚本级行为。
- Consumes: `WXT_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_AUTH_TOKEN`。

- [ ] **Step 1: 编写构建失败测试**

测试读取构建脚本并在临时目录执行 fake CLI：无四项配置时返回 `skipped`；缺少任一项时非零退出且只打印变量名；齐全时依次调用 `sourcemaps inject`、`sourcemaps upload`，然后删除 `.map`；任何日志都不含 token。工作流断言 token 来自 `secrets.SENTRY_AUTH_TOKEN`，其他三项来自 `vars`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/sentry-build.test.cjs`

Expected: FAIL，上传脚本不存在。

- [ ] **Step 3: 实现安全上传脚本**

使用 Vite `loadEnv("production", process.cwd(), "")` 合并进程环境与 `.env.local`，校验输出目录解析后位于仓库 `.output` 内；使用 `execFileSync` 参数数组调用本地 `sentry-cli`，不拼接 shell 字符串、不打印凭据。上传成功后仅删除已验证输出目录内的 `.map`。

CLI 调用顺序：

```text
sentry-cli sourcemaps inject <outputDir>
sentry-cli sourcemaps upload --org <org> --project <project> --release mewcat@<version> <outputDir>
```

- [ ] **Step 4: 将上传放进 WXT 构建完成钩子**

`wxt.config.ts` 在 production 使用 `build.sourcemap: "hidden"`，`build:done` 钩子调用上传脚本；钩子完成后 WXT `zip` 才读取输出目录。`build-with-timing.cjs` 改为只调用一次 `pnpm package`，因为 WXT `zip` 自身包含 `internalBuild()`，避免原流程重复构建和重复上传。

- [ ] **Step 5: 更新 CI**

Release job 的 Build 步骤注入：

```yaml
env:
  WXT_SENTRY_DSN: ${{ vars.WXT_SENTRY_DSN }}
  SENTRY_ORG: ${{ vars.SENTRY_ORG }}
  SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

在 Build 前验证四项非空，输出只显示缺失变量名。

- [ ] **Step 6: 运行构建测试**

Run: `node --test test/sentry-build.test.cjs`

Expected: PASS，覆盖跳过、部分配置、成功、CLI 失败和安全删除路径。

### Task 6: 隐私说明、完整验证与真实接收检查

**Files:**
- Modify: `docs/chrome-web-store-automation.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: 前五个任务的运行时、测试和构建流程。
- Produces: Chrome Web Store 隐私披露清单与项目修改记录。

- [ ] **Step 1: 更新隐私与发布文档**

记录完整 URL 属于浏览历史、Replay 点击/滚动属于用户活动；说明文字、输入和媒体遮盖、Sentry 第三方处理、错误诊断用途，以及商店后台仍需人工更新数据使用披露。

- [ ] **Step 2: 运行格式化和目标测试**

Run: `pnpm format && pnpm exec vitest run --config test/vitest.image-translation.config.ts test/sentry-monitoring.test.ts test/sentry-entrypoints.test.tsx test/sentry-background-reporting.test.ts`

Expected: PASS，无外部网络请求。

- [ ] **Step 3: 运行全量检查**

Run: `$env:VITEST_MAX_WORKERS='2'; pnpm check`

Expected: exit 0；记录测试数量和既有 lint warnings。

- [ ] **Step 4: 运行生产构建并检查产物**

Run: `pnpm build`

Expected: source map 上传成功；最终 `.output/chrome-mv3-prod-*.zip` 存在，ZIP 中无 `.map`、`SENTRY_AUTH_TOKEN`、token 值或 `.env.local`，bundle 中 release 为当前 manifest 版本。

- [ ] **Step 5: 发送隔离测试错误**

使用临时本地 HTML 加载生产监控 bundle，页面只包含固定测试文本，调用：

```ts
captureExtensionException(new Error("mewCat Sentry integration test"), {
  feature: "monitoring",
  operation: "smoke-test",
  pageUrl: "https://example.com/mewcat-sentry-smoke-test?case=full-url",
})
await flushSentry(5000)
```

Expected: Sentry 接收一条 `mewCat Sentry integration test`，包含 release、`runtime_context`、完整测试 URL 和关联 Replay；Replay 的测试文字不可读、媒体不可见。

- [ ] **Step 6: 追加修改记录**

在 `AGENTS.md` 末尾追加本次文件、捕获范围、隐私边界、source map 流程和实际验证结果，不修改已有记录。
