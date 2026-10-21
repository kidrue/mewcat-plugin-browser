# 页面一句话总结开关与渲染实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为扩展增加独立的“自动总结页面”开关，并按页面类型生成目标语言的一句话核心概念总结，安全地渲染在主要文章内容末尾。

**Architecture:** 页面总结作为独立于沉浸式翻译的 content-script 功能运行；它读取共享配置，抽取并采样正文，先进行本地/混合页面分类，再使用对应类型提示词调用现有 model gateway，最后通过 Shadow DOM 卡片插入正文锚点。现有 `ImmersiveTranslator` 中为“AI 智能上下文”服务的摘要逻辑保留为兼容路径，但不再承担页面总结 UI 或开关语义。

**Tech Stack:** TypeScript 5.8、React、WXT MV3 content script、Jotai、Zod、现有 `model-gateway`、Vitest/tsx 测试、Prettier。

**Spec:** `docs/superpowers/specs/2026-09-08-page-summary-design.md`

## Global Constraints

- 默认关闭页面总结：`enablePageSummary` 默认值必须为 `false`。
- 页面总结和 `enableContext` 是两个独立开关；不得用上下文开关代替页面总结开关。
- 页面类型暂定七类：`news`、`knowledge`、`academic`、`technical`、`product`、`discussion`、`general`。
- 总结语言跟随 `targetLanguage`；输出必须是一句话纯文本，不渲染模型返回的 HTML。
- 只处理 `http://` 与 `https://` 页面，并遵守 `neverTranslateUrls` 与页面总结专用排除名单。
- API Key、原始正文、完整 prompt 不得进入页面 DOM 或持久化缓存。
- 所有生产代码先写失败测试再实现；修改 `src/` 后执行 `pnpm format`，每次项目修改后执行 `pnpm check`，然后在 `AGENTS.md` 修改记录追加记录。
- 不新增独立总结模型配置；优先当前有效生成式模型，当前模型不可用时回退到第一个有效生成式模型。

---

### Task 1: 扩展配置模型与默认值

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/types/extensionConfigSchema.ts`
- Modify: `src/state/constants.ts`
- Modify: `test/extension-config-validation.test.ts`

**Interfaces:**
- Produces `ExtensionConfig.enablePageSummary?: boolean`，用于所有 UI 和 content script。
- Produces `ExtensionConfig.pageSummaryDisabledSites?: string[]`，用于站点级排除。

- [ ] **Step 1: Write the failing tests**

在 `test/extension-config-validation.test.ts` 增加以下行为断言：缺失字段时修复结果为 `enablePageSummary: false` 与 `pageSummaryDisabledSites: []`；合法布尔值和字符串数组能保留；非法值回退默认值。

```ts
it("repairs page summary settings with safe defaults", () => {
    const repaired = repairExtensionConfig(
        { ...defaultExtensionConfig, enablePageSummary: undefined },
        defaultExtensionConfig
    )

    expect(repaired.enablePageSummary).toBe(false)
    expect(repaired.pageSummaryDisabledSites).toEqual([])
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run test/extension-config-validation.test.ts`

Expected: FAIL because the config type/schema/defaults do not yet declare the two fields.

- [ ] **Step 3: Implement the minimal configuration change**

在 `ExtensionConfig`、`extensionConfigShape` 和 `defaultExtensionConfig` 中分别加入可选字段、Zod schema 与默认值。保持 `repairExtensionConfig` 的现有逐字段修复策略，不增加迁移脚本。

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run test/extension-config-validation.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/types/config.ts src/types/extensionConfigSchema.ts src/state/constants.ts test/extension-config-validation.test.ts
git commit -m "feat: add page summary configuration"
```

### Task 2: 在设置页和快捷设置面板暴露开关

**Files:**
- Modify: `src/options/Basic.tsx`
- Modify: `src/components/SettingsPanel/index.tsx`
- Modify: `test/options-basic-page-summary.test.tsx` (create)
- Modify: `test/settings-panel-page-summary.test.tsx` (create)

**Interfaces:**
- UI consumes `config.enablePageSummary` and `config.pageSummaryDisabledSites`。
- UI writes through `updateConfigAtom`，不直接操作 storage。

- [ ] **Step 1: Write the failing UI tests**

测试设置页存在“自动总结页面”开关，初始值来自配置，切换后调用 `updateConfig({ enablePageSummary: true })`；快捷设置面板显示同一配置并能切换。测试同时断言文案明确说明“总结会发送页面正文到已配置的生成式 AI 服务”。

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm vitest run test/options-basic-page-summary.test.tsx test/settings-panel-page-summary.test.tsx`

Expected: FAIL because the controls do not exist。

- [ ] **Step 3: Implement the controls**

在 `Basic.tsx` 增加独立 `OptionsSection title="页面总结"`，包含 `CustomToggle`/现有设置页表单控件、隐私说明及当前模型可用性提示。`SettingsPanel` 增加快捷开关，但不复制模型选择逻辑；无可用生成式模型时保留开关状态并显示不可用提示。

- [ ] **Step 4: Run focused UI tests**

Run: `pnpm vitest run test/options-basic-page-summary.test.tsx test/settings-panel-page-summary.test.tsx`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/options/Basic.tsx src/components/SettingsPanel/index.tsx test/options-basic-page-summary.test.tsx test/settings-panel-page-summary.test.tsx
git commit -m "feat: expose page summary toggle in settings"
```

### Task 3: 抽取可复用的生成式模型选择能力

**Files:**
- Modify: `src/translation/translationService.ts`
- Create: `src/page-summary/modelSelection.ts`
- Test: `test/page-summary-model-selection.test.ts`

**Interfaces:**
- `selectPageSummaryModel(config: TranslationRuntimeConfig): BaseModel | null`
- 选择规则：当前模型是可用生成式模型时返回当前模型；否则返回 `aiModelList` 中第一个启用且非 `DEEPL`/`DEEPLX` 的模型；没有候选时返回 `null`。

- [ ] **Step 1: Write failing selection tests**

覆盖当前模型可用、当前模型为 Google/DeepL 时回退、所有模型禁用或缺失时返回 `null`，并断言不会选择禁用模型。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/page-summary-model-selection.test.ts`

Expected: FAIL because the selector is not defined。

- [ ] **Step 3: Implement and route existing summary calls through shared logic**

把现有 `getSelectedModel`/`hasAITranslationEnabled` 中可复用的判断抽到单一模块，页面总结和已有 `buildAiSummary` 共用；不要在 `src/page-summary` 复制平台判断。

- [ ] **Step 4: Run focused tests plus gateway regression tests**

Run: `pnpm vitest run test/page-summary-model-selection.test.ts test/model-gateway.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/translation/translationService.ts src/page-summary/modelSelection.ts test/page-summary-model-selection.test.ts
git commit -m "refactor: share generative model selection for summaries"
```

### Task 4: 实现页面文本抽取、七类混合分类和类型提示词

**Files:**
- Create: `src/page-summary/pageContent.ts`
- Create: `src/page-summary/pageTypes.ts`
- Create: `src/page-summary/pageSummaryPrompts.ts`
- Test: `test/page-summary-classification.test.ts`
- Test: `test/page-summary-prompts.test.ts`

**Interfaces:**
- `extractPageContent(document: Document): PageContentSnapshot`
- `classifyPageType(snapshot: PageContentSnapshot): PageType`
- `buildPageSummaryPrompt(type: PageType, snapshot: PageContentSnapshot, targetLanguage: string): string`
- `PageContentSnapshot` 只包含标题、描述、结构化类型、URL 特征、有限正文片段和候选正文锚点，不保存原始完整正文。

- [ ] **Step 1: Write failing classification and prompt tests**

测试 JSON-LD/`meta`/标题等高置信信号优先；普通 `Article` 默认 `knowledge`；`NewsArticle` → `news`；技术文档、学术、产品、论坛和无法识别页面分别映射到七类；每类 prompt 都包含目标语言、只输出一句话、禁止猜测和对应专属重点。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/page-summary-classification.test.ts test/page-summary-prompts.test.ts`

Expected: FAIL because the modules do not exist。

- [ ] **Step 3: Implement local-first hybrid classification**

先用 DOM/JSON-LD/元数据/URL 规则完成本地分类；低置信度只生成短分类请求，严格将模型返回值限制在七个白名单枚举，非法、超时或失败回退 `general`，不阻断后续总结。

- [ ] **Step 4: Implement per-type prompts**

公共约束包裹不可信正文边界；七类提示词分别强调：新闻事件与影响、知识文章中心观点与依据、学术方法与结果、技术步骤与结论、产品能力与限制、论坛主流答案与分歧、通用页面核心信息。返回值只保留单行纯文本。

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run test/page-summary-classification.test.ts test/page-summary-prompts.test.ts`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/page-summary/pageContent.ts src/page-summary/pageTypes.ts src/page-summary/pageSummaryPrompts.ts test/page-summary-classification.test.ts test/page-summary-prompts.test.ts
git commit -m "feat: classify pages and build typed summary prompts"
```

### Task 5: 实现总结缓存和纯文本结果校验

**Files:**
- Create: `src/page-summary/PageSummaryCache.ts`
- Create: `src/page-summary/summaryResult.ts`
- Modify: `src/constants/storage.ts`
- Test: `test/page-summary-cache.test.ts`
- Test: `test/page-summary-result.test.ts`

**Interfaces:**
- `PageSummaryCache.get(key): Promise<CachedPageSummary | null>`
- `PageSummaryCache.set(key, value): Promise<void>`
- `normalizeSummaryResult(value: string): string | null`
- 缓存键必须包含内容指纹、页面类型、模型指纹、目标语言和 prompt 版本；缓存值不得包含正文、URL 明文或 API Key。

- [ ] **Step 1: Write failing cache/result tests**

覆盖命中、TTL 过期、容量上限清理、正文/语言/模型/prompt 变化导致 miss；结果校验删除 Markdown/HTML、压缩空白、拒绝空结果和多句长结果。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/page-summary-cache.test.ts test/page-summary-result.test.ts`

Expected: FAIL because cache and normalizer are not defined。

- [ ] **Step 3: Implement namespaced cache and normalization**

沿用现有 L1/L2 缓存模式，使用独立 storage namespace，默认 TTL 30 天、最多 500 条、LRU 淘汰；使用 URL/content hash，不持久化原文。将模型输出规范化为一行，并在超过一句时按句号/换行截取首句且保留安全上限。

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run test/page-summary-cache.test.ts test/page-summary-result.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/page-summary/PageSummaryCache.ts src/page-summary/summaryResult.ts src/constants/storage.ts test/page-summary-cache.test.ts test/page-summary-result.test.ts
git commit -m "feat: add page summary cache and output validation"
```

### Task 6: 实现文章末尾渲染卡片和用户提示

**Files:**
- Create: `src/page-summary/PageSummaryRenderer.tsx`
- Create: `src/page-summary/pageSummaryStyles.ts`
- Test: `test/page-summary-renderer.test.tsx`

**Interfaces:**
- `findSummaryAnchor(document: Document): SummaryAnchor | null`
- `renderPageSummary(anchor: SummaryAnchor, state: PageSummaryRenderState): PageSummaryHandle`
- `PageSummaryHandle.update(state): void`、`PageSummaryHandle.remove(): void`

- [ ] **Step 1: Write failing renderer tests**

测试优先插入主要内容容器末尾；不适合直接容纳卡片时插入紧邻兄弟节点；找不到正文时降级到页脚前或 body 末尾；重复渲染只保留一个 `mewcat-page-summary`；加载、成功、失败、内容不足和无模型状态都有明确 UI 提示；菜单可写入禁用站点并移除卡片。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/page-summary-renderer.test.tsx`

Expected: FAIL because renderer does not exist。

- [ ] **Step 3: Implement Shadow DOM renderer**

创建带 `mewcat-` 前缀的 host 和 Shadow Root；所有模型内容使用 React 文本节点/`textContent`；标题固定为“一句话总结”，同时显示七类页面类型标签；按钮提供重试和“不要在此网站自动总结”。

- [ ] **Step 4: Run focused renderer tests**

Run: `pnpm vitest run test/page-summary-renderer.test.tsx`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/page-summary/PageSummaryRenderer.tsx src/page-summary/pageSummaryStyles.ts test/page-summary-renderer.test.tsx
git commit -m "feat: render page summaries at article end"
```

### Task 7: 接入独立 content script 控制器与生命周期

**Files:**
- Create: `src/page-summary/PageSummaryController.ts`
- Create: `src/entrypoints/page-summary.content.tsx`
- Modify: `wxt.config.ts` (only if entrypoint matching/exclude rules require explicit configuration)
- Test: `test/page-summary-controller.test.ts`
- Test: `test/page-summary-integration.test.tsx`

**Interfaces:**
- `PageSummaryController.start(): Promise<void>`
- `PageSummaryController.cancel(): void`
- Controller consumes `enablePageSummary`, `pageSummaryDisabledSites`, `neverTranslateUrls`, target language and model list。

- [ ] **Step 1: Write failing lifecycle/integration tests**

测试：开关关闭不发请求；URL/站点被排除不发请求；一次逻辑页面最多启动一次；SPA URL 变化取消旧请求并卸载旧卡片；缓存命中不调用 gateway；重试是同一页面唯一允许的再次请求入口；请求失败显示提示而不循环。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/page-summary-controller.test.ts test/page-summary-integration.test.tsx`

Expected: FAIL because controller and entrypoint do not exist。

- [ ] **Step 3: Implement controller pipeline**

启动后检查协议、URL、排除站点和开关；等待 DOM 稳定后抽取正文；本地分类，低置信时走短分类请求；构造缓存键并查缓存；选择生成式模型后调用现有 `model-gateway`；规范化结果、写缓存并更新 renderer。使用 `AbortController` 管理页面切换与卸载。

- [ ] **Step 4: Register entrypoint and config subscription**

在独立入口中读取 `configAtom`，仅将必要配置传给 controller；配置变化时启停/重启 controller，不将总结逻辑塞进 `ImmersiveTranslator`。确保 `mewcat-page-summary` 节点在正文重新抽取时被排除。

- [ ] **Step 5: Run focused integration tests**

Run: `pnpm vitest run test/page-summary-controller.test.ts test/page-summary-integration.test.tsx`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/page-summary/PageSummaryController.ts src/entrypoints/page-summary.content.tsx wxt.config.ts test/page-summary-controller.test.ts test/page-summary-integration.test.tsx
git commit -m "feat: enable independent page summary content script"
```

### Task 8: 与现有上下文摘要隔离并补全回归测试

**Files:**
- Modify: `src/translation/ImmersiveTranslator.ts`
- Modify: `src/translation/translationService.ts`
- Modify: `test/model-gateway.test.ts`
- Modify: `test/immersive-translator*.test.ts` (use the existing matching file; create only if absent)

- [ ] **Step 1: Write regression tests**

断言 `enableContext` 开启时现有翻译上下文摘要仍可用；`enablePageSummary` 关闭时不渲染页面卡片；二者同时开启不会发送两次相同页面总结请求；Google/DeepL 当前模型仍不会触发生成式总结。

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run test/model-gateway.test.ts test/immersive-translator*.test.ts`

Expected: 新增隔离断言在接线完成前失败。

- [ ] **Step 3: Make the minimal isolation changes**

保留 `ImmersiveTranslator` 的上下文摘要字段和 prompt 兼容行为；删除任何会把 `enablePageSummary` 隐式解释为 `enableContext` 的分支；让共享模型选择和 gateway 依赖由 page-summary controller 调用。

- [ ] **Step 4: Run regression tests**

Run: `pnpm vitest run test/model-gateway.test.ts test/immersive-translator*.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/translation/ImmersiveTranslator.ts src/translation/translationService.ts test/model-gateway.test.ts test/immersive-translator*.test.ts
git commit -m "refactor: isolate page summary from translation context"
```

### Task 9: 全量验证、文档和修改记录

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-08-page-summary-design.md` only if implementation decisions materially differ from the approved design

- [ ] **Step 1: Run focused feature suite**

Run: `pnpm vitest run test/extension-config-validation.test.ts test/options-basic-page-summary.test.tsx test/settings-panel-page-summary.test.tsx test/page-summary-model-selection.test.ts test/page-summary-classification.test.ts test/page-summary-prompts.test.ts test/page-summary-cache.test.ts test/page-summary-result.test.ts test/page-summary-renderer.test.tsx test/page-summary-controller.test.ts test/page-summary-integration.test.tsx test/model-gateway.test.ts`

Expected: all listed tests pass。

- [ ] **Step 2: Format source files**

Run: `pnpm format`

Expected: Prettier completes without unformatted source files。

- [ ] **Step 3: Run the project gate**

Run: `pnpm check`

Expected: exit code 0；检查 typecheck、lint、format、拼写、规则、选择翻译、图片测试等现有门禁。

- [ ] **Step 4: Manually verify the acceptance path**

在 Chrome 开发构建中：打开设置页确认“自动总结页面”开关可见且默认关闭；开启后访问新闻、技术文档和普通文章，确认卡片出现在主要内容末尾；切换到 Google/DeepL 时看到“无可用生成式模型”提示；按“不要在此网站自动总结”后刷新页面确认不再请求；关闭开关后确认卡片卸载。

- [ ] **Step 5: Append the required modification record**

在 `AGENTS.md` 的“修改记录”末尾追加日期、变更文件/逻辑、原因和验证结果，明确记录 `enablePageSummary`、七类混合分类、末尾渲染和缓存。

- [ ] **Step 6: Review final diff and commit**

```bash
git status --short
git diff --check
git add AGENTS.md docs/superpowers/specs/2026-09-08-page-summary-design.md
git commit -m "feat: add configurable page summary rendering"
```

## Acceptance Checklist

- [ ] 设置页能看到独立“自动总结页面”开关，默认关闭。
- [ ] 快捷设置面板能看到同一状态，且不会误用“AI 智能上下文”状态。
- [ ] 页面类型经过七类白名单校验，低置信度/失败安全回退 `general`。
- [ ] 总结使用当前有效生成式模型或第一个可用回退模型。
- [ ] 总结卡片出现在主要文章内容末尾，不遮挡正文，Shadow DOM 隔离样式。
- [ ] 加载、成功、无内容、无模型、失败和重试状态有 UI 提示。
- [ ] 页面正文、URL、prompt、API Key 不以明文进入持久化总结缓存。
- [ ] 开关关闭、站点排除、SPA 切换和重复注入均有测试覆盖。
- [ ] `pnpm format` 与 `pnpm check` 均通过，并已更新 `AGENTS.md` 修改记录。
