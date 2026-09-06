# Image Translation Model Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在图片翻译设置中提供独立的模型平台和对应视觉模型级联选择，同时保持 `imageTranslationModelId` 为唯一持久化状态。

**Architecture:** 在 `visionModels.ts` 中以纯函数从可用视觉模型派生平台选项、平台下模型选项和当前平台；设置页只消费这些派生值。平台切换时保存目标平台首个模型 ID，运行时图片翻译链路保持不变。

**Tech Stack:** TypeScript 5.8、React 18、Jotai、styled-components、Vitest、jsdom、WXT MV3

**Spec:** `docs/superpowers/specs/2026-09-07-image-translation-model-platform-design.md`

## Global Constraints

- 图片翻译平台和模型选择不得修改 `currentModel`。
- 只展示 `enabled=true`、API Key 非空且 `capabilities.vision=true` 的模型。
- 不新增持久化的平台字段，不修改图片翻译消息协议与后台调用链。
- 修改 `src/` 后执行 `pnpm format`；全部修改完成后执行 `pnpm check`，再追加 `AGENTS.md` 修改记录。
- 用户要求在当前工作区分批提交；保留与本功能无关的 `.superpowers/` 未跟踪文件。

---

### Task 1: 视觉平台与模型派生工具

**Files:**
- Modify: `test/vision-models.test.ts`
- Modify: `src/utils/visionModels.ts`

**Interfaces:**
- Consumes: `BaseModel.type`、现有 `getVisionModelOptions(models)` 可用模型过滤规则、`platformNameMap`
- Produces: `getVisionPlatformOptions(models): VisionPlatformOption[]`、`getVisionModelOptions(models, platform?): VisionModelOption[]`、`getVisionPlatformSelection(selectedModelId, models): AiModel_Platform_Enum | ""`

- [x] **Step 1: Write the failing tests**

新增测试，使用 OPENAI/GEMINI 的可用视觉模型以及禁用、无 Key、非视觉模型，断言平台选项按首次出现顺序去重，只包含 OPENAI/GEMINI；断言传入 GEMINI 后模型选项只包含 GEMINI 模型；断言有效模型 ID 推导出平台、无效 ID 返回空字符串。

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts`

Expected: FAIL，因为新的平台派生函数尚未导出，且 `getVisionModelOptions` 尚不支持平台过滤。

- [x] **Step 3: Write minimal implementation**

复用同一个 `isUsableVisionModel` 过滤器；用 `Set<AiModel_Platform_Enum>` 去重平台；平台标签读取 `platformNameMap`；模型选项在可选 `platform` 参数存在时按 `model.type` 过滤；平台选择根据有效模型 ID 查找其 `type`。

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

提交 `src/utils/visionModels.ts` 与 `test/vision-models.test.ts`，提交信息：`feat: derive image translation model platforms`。

### Task 2: 图片设置页级联选择

**Files:**
- Modify: `test/image-settings-ui.test.tsx`
- Modify: `src/options/Image.tsx`

**Interfaces:**
- Consumes: Task 1 的 `getVisionPlatformOptions`、`getVisionModelOptions`、`getVisionPlatformSelection`
- Produces: `模型平台` 与 `视觉模型` 两个 `NativeSelect`；平台变化写入 `{ imageTranslationModelId: firstModelId }`

- [x] **Step 1: Write the failing tests**

将原单下拉测试扩展为两个平台、多个模型：断言平台选择包含 ChatGPT/Gemini，初始平台由已选模型推导；模型选择只包含当前平台的模型；切换平台保存新平台第一个模型 ID；重新渲染后显示新平台和模型；所有写入均不包含 `currentModel`。同时覆盖无可用视觉模型时两个选择框都禁用。

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/image-settings-ui.test.tsx`

Expected: FAIL，因为页面尚无 `模型平台` 选择框且模型尚未按平台过滤。

- [x] **Step 3: Write minimal implementation**

在 `Image.tsx` 中派生平台选项与当前平台，增加 `模型平台` FormRow；平台 `onChange` 读取目标平台的首个模型并只更新 `imageTranslationModelId`；现有模型下拉改为使用当前平台过滤后的选项；保留快捷按钮修复和能力测试逻辑。

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/image-settings-ui.test.tsx`

Expected: PASS。

- [x] **Step 5: Commit**

提交 `src/options/Image.tsx` 与 `test/image-settings-ui.test.tsx`，提交信息：`feat: select image translation platform and model`。

### Task 3: 文档、全量验证与收尾提交

**Files:**
- Create: `docs/superpowers/specs/2026-09-07-image-translation-model-platform-design.md`
- Create: `docs/superpowers/plans/2026-09-07-image-translation-model-platform.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Task 1、Task 2 的最终行为与验证结果
- Produces: 可追溯的设计、实施计划与修改记录

- [x] **Step 1: Format source files**

Run: `pnpm format`

Expected: exit code 0。

- [x] **Step 2: Run focused tests after formatting**

Run: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts test/image-settings-ui.test.tsx`

Expected: PASS。

- [x] **Step 3: Run full project verification**

Run: `pnpm check`

Expected: exit code 0，typecheck、lint、format、规则同步、拼写和全部测试均通过。

- [x] **Step 4: Append the change log**

在 `AGENTS.md` 末尾追加 `2026-09-07 — 图片翻译支持独立选择模型平台与模型`，记录工具函数、设置页级联选择、单一持久化状态和测试。

- [x] **Step 5: Verify the final documented workspace**

Run: `pnpm check`

Expected: exit code 0。

- [x] **Step 6: Commit**

提交设计、计划和 `AGENTS.md`，提交信息：`docs: record image translation model selection`。
