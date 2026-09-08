# Task 1 implementation report

## Result

Implemented `imageTranslationModelName` persistence and legacy image-selection normalization.

## TDD evidence

- RED: focused Vitest initially failed on the missing field/normalizer (4 failures, 18 existing tests passed).
- GREEN: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/extension-config-validation.test.ts test/vision-models.test.ts`
  - 2 test files passed
  - 22 tests passed

The first non-escalated Node invocation hit the environment's `EPERM` while resolving `C:\Users\Administrator`; the same command succeeded with the required elevated execution.

## Changes

- Added `imageTranslationModelName` to config/default/schema.
- Added `normalizeImageTranslationSelection` and applied it through `normalizeStoredConfig`.
- Legacy selection now derives the visual model name from the selected service's text model.
- Missing, disabled, API-key-less, or non-LLM services clear image selection and disable the shortcut.
- Text model selection and `params.modelName` remain unchanged.

## Self-review

- Only Task 1 source/tests are staged; unrelated formatting changes were removed.
- Provider registry kind is checked before treating a service as usable.
- Existing vision-model tests and config-repair tests remain green.
