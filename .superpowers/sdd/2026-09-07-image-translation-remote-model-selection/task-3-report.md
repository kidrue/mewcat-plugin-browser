# Task 3 implementation report

## Result

改造图片设置页为“翻译服务配置 → 远程视觉模型”两级选择，并保持文本翻译配置隔离。

## TDD / verification

- RED: 新增异步 discovery、服务实例隔离、手动输入和模型名独立持久化测试，旧实现按预期失败。
- GREEN: `pnpm exec vitest run --config test/vitest.image-translation.config.ts --environment jsdom test/image-settings-ui.test.tsx`
  - 20 tests passed
  - 1 existing persistence-contract test is blocked by the test environment's unresolved WXT virtual import `#imports` in `src/state/util.ts`.

## Changes

- First selector now lists enabled, keyed AI service configurations; changing it clears the visual model name and shortcut enablement.
- Second selector consumes remote discovery, filters explicit non-vision models, preserves a current model not returned by discovery, and supports manual custom-endpoint entry.
- Model changes write only `imageTranslationModelName`; `currentModel` and text service `params.modelName` stay unchanged.
- Capability-test state is isolated by service/model selection key and late results are ignored.
- Legacy UI state falls back to the selected service's text model name until normalized storage is applied.

## Self-review

- No hotlink files or unrelated source were changed.
- The single failing test is an existing WXT test-environment alias issue, not a feature assertion failure.

## Review follow-up

- Reviewer identified that falling back to the text model name after a service switch could make an empty visual selection appear enabled, and that the old `capabilities.vision` repair guard rejected valid independent selections.
- Fixed by requiring the persisted visual model name for UI enablement and validating image enablement against the selected usable LLM service plus non-empty visual model name.
