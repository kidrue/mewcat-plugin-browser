# Options 翻译服务缺省态实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在没有 AI 模型时，为 Options 翻译服务页提供以“添加第一个 AI 模型”为主行动的居中引导态，并在添加或删除模型时正确切换页面状态。

**Architecture:** 新增独立的 `AIModelEmptyState` 展示组件，复用现有 `AddModel` 平台菜单和 `handleAddModel` 回调。`TranslateServices` 只负责根据 `aiModelList` 选择缺省态或已有模型布局，并在无模型时隐藏模型测试区；通用配置和 Google 翻译选择保持不变。

**Tech Stack:** React 18, TypeScript, styled-components, Jotai, `@floating-ui/react`, existing WXT test scripts with `tsx` and `jsdom`.

**Spec:** `docs/superpowers/specs/2026-08-15-options-translation-services-empty-state-design.md`

## Global Constraints

- Empty state is shown when `config.aiModelList` is missing or empty.
- Google Translate remains available and is explicitly described as the fallback/default service.
- The primary empty-state action opens the existing platform-selection menu.
- Do not change model persistence, selection, add/remove, sort, enable, or test business logic.
- Do not add image assets, new theme colors, or unrelated options-page refactors.
- Existing configured-model layout must remain unchanged.

---

### Task 1: Add a reusable label to the platform menu trigger

**Files:**
- Modify: `src/components/AddModel/index.tsx`
- Test: `test/test-translation-services-empty-state.tsx`

**Interfaces:**
- Consumes: existing `onItemClick: (platform: AiModel_Platform_Enum) => void` callback.
- Produces: `AddModel` prop `label?: string`, defaulting to `"添加模型"`, while preserving the current menu and callback behavior.

- [ ] **Step 1: Write the failing test**

Add a jsdom/React test that renders `AddModel` twice: once without `label` and once with `label="添加 AI 模型"`. Assert that the trigger text uses the default and custom labels respectively, and that clicking the custom trigger exposes the existing platform names from `AI_TRANSLATION_SERVICES`.

```tsx
assert.equal(screen.getByRole("button", { name: "添加模型" }).textContent, "添加模型")
assert.equal(screen.getByRole("button", { name: "添加 AI 模型" }).textContent, "添加 AI 模型")
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: FAIL because `AddModel` currently hard-codes the button label and the test file/label contract does not yet exist.

- [ ] **Step 3: Implement the minimal prop change**

Update `AddModelProps` with `label?: string`, destructure `label = "添加模型"`, and render `{label}` inside the existing `Button`. Do not change `useFloating`, `useInteractions`, placement, or `onItemClick` behavior.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: PASS for default/custom labels and platform-menu opening.

- [ ] **Step 5: Commit the isolated component change**

```powershell
git add src/components/AddModel/index.tsx test/test-translation-services-empty-state.tsx
git commit -m "feat: allow custom add-model trigger labels"
```

### Task 2: Build the standalone AI-model empty-state component

**Files:**
- Create: `src/components/AIModelEmptyState/index.tsx`
- Modify: `test/test-translation-services-empty-state.tsx`

**Interfaces:**
- Consumes: `onItemClick: (platform: AiModel_Platform_Enum) => void` and the new `AddModel label` prop.
- Produces: `AIModelEmptyState` that renders the agreed copy, decorative marker, and `AddModel label="添加 AI 模型"`.

- [ ] **Step 1: Write the failing component assertions**

Extend the test to render `AIModelEmptyState` and assert:

```tsx
assert.ok(screen.getByRole("heading", { name: "添加你的第一个 AI 模型" }))
assert.match(screen.getByText(/未添加时仍会使用 Google 翻译/).textContent ?? "", /Google 翻译/)
assert.ok(screen.getByRole("button", { name: "添加 AI 模型" }))
```

Also assert that the decorative marker has `aria-hidden="true"` and that the panel does not render an image or external asset.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: FAIL because `AIModelEmptyState` does not exist.

- [ ] **Step 3: Implement the minimal component**

Create styled components using only existing theme variables: a bordered paper panel, centered content wrapper, decorative marker, semantic heading/paragraph, and the existing `AddModel` trigger. Keep the panel width fluid with a readable `max-width`, `padding` from spacing variables, and a mobile media query that reduces padding without introducing horizontal overflow.

```tsx
export function AIModelEmptyState({ onItemClick }: Props) {
    return (
        <EmptyStatePanel>
            <EmptyStateMark aria-hidden="true" />
            <EmptyStateTitle>添加你的第一个 AI 模型</EmptyStateTitle>
            <EmptyStateDescription>
                配置 AI 模型可获得更灵活的翻译能力；未添加时仍会使用 Google 翻译
            </EmptyStateDescription>
            <AddModel label="添加 AI 模型" onItemClick={onItemClick} />
        </EmptyStatePanel>
    )
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: PASS for copy, accessible heading/button, decorative marker, and platform menu interaction.

- [ ] **Step 5: Commit the empty-state component**

```powershell
git add src/components/AIModelEmptyState/index.tsx test/test-translation-services-empty-state.tsx
git commit -m "feat: add AI model empty state"
```

### Task 3: Switch TranslateServices between empty and configured states

**Files:**
- Modify: `src/options/TranslateServices.tsx`
- Modify: `src/components/AIModelEmptyState/index.tsx` if prop typing needs adjustment
- Modify: `test/test-translation-services-empty-state.tsx`

**Interfaces:**
- Consumes: `config.aiModelList`, existing `handleAddModel`, `onRemoveModel`, and current model test state.
- Produces: configured layout unchanged when models exist; empty layout when the list is missing/empty.

- [ ] **Step 1: Write the failing state assertions**

Add and export this exact helper from `src/options/TranslateServices.tsx`: `hasConfiguredAiModels(aiModelList?: BaseModel[]): boolean`. It must return false for `undefined`/`[]` and true for a one-model list. In the test, use a Jotai `createStore()` plus `<Provider store={store}>` to seed `configAtom` with an empty config and then a one-model config; assert that empty rendering contains the CTA and no “模型测试” heading, while configured rendering contains the model list and “模型测试”.

```ts
assert.equal(hasConfiguredAiModels(undefined), false)
assert.equal(hasConfiguredAiModels([]), false)
assert.equal(hasConfiguredAiModels([model]), true)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: FAIL because the helper and conditional branches do not yet exist.

- [ ] **Step 3: Implement the conditional layout**

Compute:

```ts
const hasModels = (config?.aiModelList?.length ?? 0) > 0
```

Use `rightSection={hasModels ? <AddModel onItemClick={handleAddModel} /> : undefined}` on the AI-model `OptionsSection`. Render `AIModelEmptyState` instead of `ModelListContainer` when `hasModels` is false. Wrap the existing `TestSection` in `{hasModels && (...)}`. Keep the existing current-service `CustomSelect` and all general configuration `FormRow`s outside this condition.

- [ ] **Step 4: Verify add/delete transitions**

Use the same Jotai test store. Assert that selecting a platform through the empty-state menu invokes the existing add callback and updates the store to one model; then assert the configured layout; finally set `aiModelList` back to an empty array through the store and assert the empty state returns with the model-test heading removed.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npx tsx ./test/test-translation-services-empty-state.tsx`

Expected: PASS for empty/configured branching, platform-menu reuse, add transition, delete-last-model transition, and absence/presence of model testing.

- [ ] **Step 6: Commit the page-state integration**

```powershell
git add src/options/TranslateServices.tsx src/components/AIModelEmptyState/index.tsx test/test-translation-services-empty-state.tsx
git commit -m "feat: guide users to add their first AI model"
```

### Task 4: Run formatting, static checks, and responsive verification

**Files:**
- Modify: only files changed by the formatter, if any
- Test: `test/test-translation-services-empty-state.tsx`

**Interfaces:**
- Consumes: the completed empty-state branch and existing WXT/Options build.
- Produces: verified responsive, accessible, and buildable UI without changing unrelated behavior.

- [ ] **Step 1: Run formatting and generated-file synchronization**

Run: `pnpm format` followed by `pnpm sync:hotlink-rules`.

- [ ] **Step 2: Run all project checks**

Run: `pnpm check`

Expected: exit code 0; existing non-blocking lint warnings may remain, but no new error should be introduced.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: WXT production build and `.output/chrome-mv3-prod-*.zip` creation succeed.

- [ ] **Step 4: Verify narrow layout and accessibility contract**

Run the focused jsdom test at the existing DOM viewport fixture and assert the empty panel does not exceed viewport width. Confirm the CTA is a native button with visible `:focus-visible` styling and the marker is hidden from assistive technology.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the intended files are added/modified beyond pre-existing worktree changes.
