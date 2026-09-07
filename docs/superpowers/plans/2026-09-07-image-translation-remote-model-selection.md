# 图片翻译远程视觉模型选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让图片翻译先选择“翻译服务”中已添加的平台配置，再动态发现并独立选择该配置可用的具体视觉模型。

**Architecture:** 保留 `imageTranslationModelId` 作为平台配置 `BaseModel.id`，新增 `imageTranslationModelName` 保存图片请求使用的实际模型标识。设置页复用现有 `discoverModels()` 获取模型目录；后台仅接收配置 ID，从同步配置中解析凭据并在内存中覆盖模型名，缓存键同时绑定配置 ID 和模型名。

**Tech Stack:** TypeScript、React、Jotai、Vitest、WXT MV3、`@xsai/model`。

**Spec:** `docs/superpowers/specs/2026-09-07-image-translation-remote-model-selection-design.md`

## Global Constraints

- 不把视觉模型自动添加到 `aiModelList`，不修改文本翻译的 `currentModel` 或 `BaseModel.params.modelName`。
- API Key、baseUrl 和其他凭据只能从扩展配置解析，不进入内容脚本消息或用户可见错误。
- 仅文本模型不列入视觉模型候选；图片能力未知的模型可以选择并通过能力测试验证。
- 旧配置使用 `imageTranslationModelId` 对应服务的 `params.modelName` 自动补齐 `imageTranslationModelName`。
- 图片配置继续写入 `sync:extension-config`；后台不得继续读取旧的 `local:extension-config`。
- 所有 `src/` 修改后运行 `pnpm format`；每个功能任务完成后运行对应测试；最终运行 `pnpm check` 和 `pnpm build`。
- 共享工作区中已有的 Logo、品牌组件、版本文档和其他未提交改动不纳入本功能提交。

---

### Task 1: 扩展配置字段与旧配置迁移

**Files:**
- Modify: `src/types/config.ts` — 增加 `imageTranslationModelName?: string`。
- Modify: `src/state/constants.ts` — 默认值增加空的 `imageTranslationModelName`。
- Modify: `src/types/extensionConfigSchema.ts` — schema 接受该字段，并让修复结果保留合法字符串。
- Modify: `src/state/translationService.ts` — 在现有配置归一化流程中补齐/清理图片选择。
- Modify: `src/utils/visionModels.ts` — 新增纯函数 `normalizeImageTranslationSelection`，集中处理迁移规则。
- Test: `test/extension-config-validation.test.ts`、`test/vision-models.test.ts`。

**Interfaces:**
- Consumes: `ExtensionConfig`, `BaseModel[]`、`isVisionCapableModel` 现有类型。
- Produces: `normalizeImageTranslationSelection(config: ExtensionConfig): ExtensionConfig`；后续 UI 和后台都使用同一套迁移语义。

- [ ] **Step 1: Write the failing tests**

```ts
it("fills the visual model name from a legacy selected service", () => {
    const config = repairExtensionConfig(
        {
            ...createValidConfig(),
            imageTranslationModelId: "bailian-service",
            aiModelList: [createModel("bailian-service", {
                type: AiModel_Platform_Enum.BAILIAN,
                enabled: true,
                params: { modelName: "qwen-vl-plus", apiKey: "key" }
            })]
        },
        defaultExtensionConfig
    )

    expect(normalizeImageTranslationSelection(config))
        .toMatchObject({
            imageTranslationModelId: "bailian-service",
            imageTranslationModelName: "qwen-vl-plus"
        })
})

it("clears image selection when its service is disabled or missing", () => {
    const result = normalizeImageTranslationSelection({
        ...defaultExtensionConfig,
        enableImageTranslateButton: true,
        imageTranslationModelId: "missing",
        imageTranslationModelName: "qwen-vl-plus"
    })

    expect(result).toMatchObject({
        imageTranslationModelId: "",
        imageTranslationModelName: "",
        enableImageTranslateButton: false
    })
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/extension-config-validation.test.ts test/vision-models.test.ts`

Expected: FAIL because `imageTranslationModelName` and `normalizeImageTranslationSelection` do not yet exist.

- [ ] **Step 3: Implement the minimal configuration and migration behavior**

Use this decision table inside `normalizeImageTranslationSelection`:

```ts
const service = config.aiModelList.find(
    model => model.id === config.imageTranslationModelId
)
const usable = service?.enabled === true && service.params.apiKey.trim() !== ""

if (!service || !usable) {
    return {
        ...config,
        imageTranslationModelId: "",
        imageTranslationModelName: "",
        enableImageTranslateButton: false
    }
}

return {
    ...config,
    imageTranslationModelName:
        config.imageTranslationModelName?.trim() || service.params.modelName.trim()
}
```

Apply this normalization on storage read, storage write, and subscription through `normalizeStoredConfig`, without changing `currentModel` or the service's `params.modelName`.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/extension-config-validation.test.ts test/vision-models.test.ts`

Expected: PASS, including existing config-repair tests.

- [ ] **Step 5: Commit the configuration slice**

```bash
git add src/types/config.ts src/state/constants.ts src/types/extensionConfigSchema.ts src/state/translationService.ts src/utils/visionModels.ts test/extension-config-validation.test.ts test/vision-models.test.ts
git commit -m "feat: persist independent image model name"
```

### Task 2: 提供平台配置和视觉模型候选工具

**Files:**
- Modify: `src/utils/visionModels.ts` — 将平台候选从平台枚举改为服务配置实例，新增远程模型筛选和标签生成函数。
- Modify: `src/components/ModelDiscoveryField/index.tsx` — 抽取发现请求状态到可复用 hook，保持文本模型字段行为不变。
- Create: `src/hooks/useModelDiscovery.ts` — 统一防抖、取消、刷新、错误和手动输入降级。
- Test: `test/vision-models.test.ts`、新增 `test/model-discovery.test.ts`（如现有测试配置需要则加入 `package.json` 的 `test:image`）。

**Interfaces:**
- Consumes: `BaseModel[]`、`PROVIDER_REGISTRY`、`discoverModels(connection, dependencies, signal)`。
- Produces:

```ts
interface VisionServiceOption {
    value: string // BaseModel.id
    label: string
    service: BaseModel
}

function getVisionServiceOptions(models: BaseModel[]): VisionServiceOption[]
function getVisionModelOptions(models: DiscoveredModel[]): ModelSelectionOption[]
function buildVisionServiceLabel(model: BaseModel, duplicateIndex?: number): string
```

- [ ] **Step 1: Write failing pure-function tests**

覆盖以下断言：

```ts
expect(getVisionServiceOptions([
    enabledBailian,
    disabledOpenAI,
    missingKeyGemini,
    enabledGemini
]).map(option => option.value)).toEqual(["bailian", "gemini"])

expect(getVisionServiceOptions([
    { ...enabledBailian, id: "bailian-1", params: { ...enabledBailian.params, modelName: "qwen-plus" } },
    { ...enabledBailian, id: "bailian-2", params: { ...enabledBailian.params, modelName: "qwen-turbo" } }
]).map(option => option.label)).toEqual([
    "阿里百炼 · qwen-plus · 官方",
    "阿里百炼 · qwen-turbo · 官方"
])

expect(getVisionModelOptions([
    supportedModel,
    unknownModel,
    unsupportedModel
]).map(option => option.value)).toEqual(["supported", "unknown"])
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts test/model-discovery.test.ts`

Expected: FAIL because service-instance options and remote vision filtering are not implemented.

- [ ] **Step 3: Implement the pure helpers and reusable discovery hook**

Filter service options by `enabled`, non-empty `params.apiKey`, and `PROVIDER_REGISTRY[model.type].kind === "llm"`. Build labels from `platformNameMap`, the current text `modelName` (or “未配置模型”), and official/custom mode. Keep duplicate numbering deterministic.

`useModelDiscovery` must return `{ models, isLoading, errorMessage, manualEntry, refresh }`, use a 400 ms debounce, abort on dependency changes/unmount, and set `manualEntry` only for `DISCOVERY_UNSUPPORTED` on custom endpoints. `ModelDiscoveryField` consumes the hook with its existing `BaseModel.params.modelName` value and keeps its existing capability patch behavior.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts test/model-discovery.test.ts`

Expected: PASS; existing `ModelDiscoveryField` tests must remain green.

- [ ] **Step 5: Commit the candidate/discovery slice**

```bash
git add src/utils/visionModels.ts src/components/ModelDiscoveryField/index.tsx src/hooks/useModelDiscovery.ts test/vision-models.test.ts test/model-discovery.test.ts package.json
git commit -m "feat: reuse model discovery for image translation"
```

### Task 3: 改造图片设置页的两级选择

**Files:**
- Modify: `src/options/Image.tsx` — 第一层选择服务配置，第二层动态选择视觉模型，保持测试和快捷按钮隔离。
- Modify: `src/utils/visionModels.ts` — 提供当前服务/模型名推导和空状态辅助函数。
- Test: `test/image-settings-ui.test.tsx`、`test/vision-models.test.ts`。

**Interfaces:**
- Consumes: `getVisionServiceOptions`, `useModelDiscovery`, `getVisionModelOptions`, `imageTranslationModelId`, `imageTranslationModelName`。
- Produces: 只写入 `{ imageTranslationModelId, imageTranslationModelName }` 的 UI 事件；不写入 `currentModel` 或 `aiModelList[*].params.modelName`。

- [ ] **Step 1: Write failing UI tests**

增加异步发现测试：

```ts
mockDiscoverModels.mockResolvedValue([
    { id: "qwen-vl-max", name: "Qwen VL Max", availability: "verified", vision: "supported" },
    { id: "qwen-plus", name: "Qwen Plus", availability: "verified", vision: "unsupported" }
])

await changeSelect(platformSelector, "bailian-service")
await waitFor(() => expect(modelSelector.options).toHaveLength(1))
expect(modelSelector.options[0].value).toBe("qwen-vl-max")

await changeSelect(modelSelector, "qwen-vl-max")
expect(mocks.updateConfig).toHaveBeenLastCalledWith({
    imageTranslationModelName: "qwen-vl-max"
})
expect(mocks.config.currentModel).toBe("text-service")
```

同时测试切换平台会清空模型名、同平台不同服务配置可区分、自定义发现失败进入手动输入、旧模型未返回仍显示当前值。

- [ ] **Step 2: Run the UI tests and verify they fail**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/image-settings-ui.test.tsx`

Expected: FAIL because the current component reads local `aiModelList` vision models and labels them with `BaseModel.name`.

- [ ] **Step 3: Implement the two-level UI**

Use the selected service ID to construct the discovery connection:

```ts
const service = aiModelList.find(model => model.id === imageTranslationModelId)
const discovery = useModelDiscovery(service)
```

On service change, call `updateConfig({ imageTranslationModelId: value, imageTranslationModelName: "", enableImageTranslateButton: false })`. On model change, call only `updateConfig({ imageTranslationModelName: value })`. Preserve the existing capability test, but include the composite selection key in the request guard so a late result from the old model cannot update the new selection.

Use the following empty-state copy: no service → “请先在‘模型’设置中添加并启用 AI 平台并填写 API Key”；loading → “正在获取模型列表…”；no visual candidates → “未发现支持图片的模型，请刷新或手动填写模型名称”；unknown candidates include “图片能力未知”。

- [ ] **Step 4: Run the UI tests and verify they pass**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/image-settings-ui.test.tsx`

Expected: PASS, including existing shortcut, capability-test, empty-state, and `currentModel` isolation tests.

- [ ] **Step 5: Commit the settings UI slice**

```bash
git add src/options/Image.tsx src/utils/visionModels.ts test/image-settings-ui.test.tsx test/vision-models.test.ts
git commit -m "feat: choose image models from configured services"
```

### Task 4: 后台解析独立视觉模型并隔离缓存

**Files:**
- Modify: `src/background/messages/structured-image-translation.ts` — 从同步配置加载服务实例和视觉模型名，生成内存模型副本。
- Modify: `src/translation/PictureCache.ts` — 保持接口不变，将复合选择键作为 `modelId` 输入。
- Modify: `src/utils/visionModels.ts` — 新增 `createVisionModelSelectionKey(serviceId, modelName)`。
- Modify: `test/background-image-translation.test.ts`、`test/image-translation-preprocess-cache.test.ts`。

**Interfaces:**
- Consumes: `imageTranslationModelId`, `imageTranslationModelName`, `aiModelList`。
- Produces: `resolveImageTranslationModel(config, requestedServiceId)` 返回 `{ model: BaseModel, selectionKey: string }`，失败时返回现有安全错误码。

- [ ] **Step 1: Write failing background tests**

```ts
it("overrides only the in-memory model name from image selection", async () => {
    const response = await handler(request, {})

    expect(deps.translate).toHaveBeenCalledWith(
        prepared,
        expect.objectContaining({
            id: "bailian-service",
            params: expect.objectContaining({ modelName: "qwen-vl-max" })
        })
    )
    expect((await deps.loadConfig()).aiModelList[0].params.modelName)
        .toBe("qwen-plus")
})

it("uses sync storage and separates cache keys by visual model name", async () => {
    await createBrowserConfigLoader(getItem)()
    expect(getItem).toHaveBeenCalledWith("sync:extension-config")
    expect(createImageTranslationCacheKey({ ...base, modelId: selectionKeyA }))
        .not.toBe(createImageTranslationCacheKey({ ...base, modelId: selectionKeyB }))
})
```

- [ ] **Step 2: Run the background/cache tests and verify they fail**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/background-image-translation.test.ts test/image-translation-preprocess-cache.test.ts`

Expected: FAIL because the handler currently validates only the stored service model, reads `local:extension-config`, and caches by service ID alone.

- [ ] **Step 3: Implement secure resolution and composite cache identity**

Resolve in this order:

```ts
const service = config.aiModelList.find(model => model.id === requestedServiceId)
if (!service || !service.enabled || !service.params.apiKey.trim()) {
    return failure("MODEL_UNAVAILABLE")
}
const modelName = config.imageTranslationModelName?.trim()
if (!modelName || config.imageTranslationModelId !== requestedServiceId) {
    return failure("MODEL_NOT_FOUND")
}
const selectionKey = createVisionModelSelectionKey(service.id, modelName)
const model = { ...service, params: { ...service.params, modelName } }
```

Use `selectionKey` for `getCache`, `setCache`, deduplication, and response `result.modelId`; keep the request protocol's `modelId` as the service configuration ID for compatibility. Update `createBrowserConfigLoader` to read `toWxtSyncStorageKey(STORAGE_NAMES.extensionConfig)` and return both image-selection fields.

- [ ] **Step 4: Run the background/cache tests and verify they pass**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/background-image-translation.test.ts test/image-translation-preprocess-cache.test.ts`

Expected: PASS, including existing invalid-model, cache-hit, deduplication, and strict-backup tests.

- [ ] **Step 5: Commit the background slice**

```bash
git add src/background/messages/structured-image-translation.ts src/translation/PictureCache.ts src/utils/visionModels.ts test/background-image-translation.test.ts test/image-translation-preprocess-cache.test.ts
git commit -m "feat: resolve image translation model independently"
```

### Task 5: 内容脚本联动、完整验证和记录

**Files:**
- Modify: `src/contents/imageTranslate.tsx` — 将图片可用性和竞态保护绑定到服务 ID + 视觉模型名。
- Modify: `src/utils/visionModels.ts` — `isImageTranslationEnabled` 同时要求合法服务 ID 和非空视觉模型名。
- Modify: `src/types/extensionConfigSchema.ts` — 确认新字段在所有修复路径中保留。
- Modify: `package.json` — 仅在新增测试文件确实需要时加入 `test:image`，避免重复执行。
- Modify: `AGENTS.md` — 全量检查通过后追加本功能修改记录。
- Test: `test/image-translation-content.test.tsx`、`test/extension-config-validation.test.ts`、`test/image-settings-ui.test.tsx`。

**Interfaces:**
- Consumes: `imageTranslationModelId`、`imageTranslationModelName`、`createVisionModelSelectionKey`。
- Produces: 内容脚本只在两项选择都有效时发起请求；任何选择变化都使旧能力测试结果失效。

- [ ] **Step 1: Write failing content/config tests**

```ts
expect(isImageTranslationEnabled({
    enableImageTranslateButton: true,
    imageTranslationModelId: "service",
    imageTranslationModelName: "qwen-vl-max",
    aiModelList: [enabledService]
})).toBe(true)

expect(isImageTranslationEnabled({
    enableImageTranslateButton: true,
    imageTranslationModelId: "service",
    imageTranslationModelName: "",
    aiModelList: [enabledService]
})).toBe(false)
```

Add a UI regression that changes only `imageTranslationModelName` while keeping the same service ID and verifies the previous capability-test response is ignored.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/image-translation-content.test.tsx test/extension-config-validation.test.ts test/image-settings-ui.test.tsx`

Expected: FAIL because enablement currently validates only `imageTranslationModelId`, and the request guard cannot distinguish two visual models under one service.

- [ ] **Step 3: Implement content-side guards and update the changelog**

Pass the composite selection key to the local request/settlement guard while continuing to send only the service ID to background. Ensure changing the model disables the shortcut until a non-empty model name is selected. After all code and tests pass, append an `AGENTS.md` record describing the new field, dynamic discovery, sync loader, migration, and cache isolation.

- [ ] **Step 4: Run formatting and the full quality gate**

Run:

```bash
pnpm format
pnpm check
pnpm build
```

Expected: typecheck succeeds, lint has 0 errors, hotlink rules and spell check pass, all test suites pass, and production build completes.

- [ ] **Step 5: Verify the final diff and commit the integration slice**

First restore/leave unrelated shared-workspace changes untouched. Then inspect `git diff --cached --name-status` and stage only the files listed in this task before committing:

```bash
git add src/contents/imageTranslate.tsx src/utils/visionModels.ts src/types/extensionConfigSchema.ts test/image-translation-content.test.tsx test/extension-config-validation.test.ts test/image-settings-ui.test.tsx AGENTS.md
git commit -m "test: verify independent image model selection"
```

Run `pnpm check` once more after the changelog edit, then inspect `git status --short --branch` and `git log --oneline -6` before reporting completion.

## Plan Self-Review

- Spec coverage: configuration migration is Task 1; discovery reuse and filtering are Task 2; UI behavior and empty/error states are Task 3; secure background resolution and cache identity are Task 4; content guards, changelog, full verification, and commit hygiene are Task 5.
- Placeholder scan: no unresolved placeholder or unspecified implementation step is used.
- Type consistency: `imageTranslationModelId` remains the service `BaseModel.id`; `imageTranslationModelName` is always the remote model string; `createVisionModelSelectionKey` is used for cache/result identity only; content requests continue to use the existing protocol field.
