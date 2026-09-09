# Task 2 implementation report

## Result

Added service-configuration candidates, remote vision-model filtering, and reusable model discovery state while preserving `ModelDiscoveryField` behavior.

## TDD evidence

- RED: focused tests initially failed because the new service/model helpers and hook did not exist; the non-elevated Node run also hit the known `C:\Users\Administrator` `EPERM` environment restriction.
- GREEN: `pnpm exec vitest run --config test/vitest.image-translation.config.ts test/vision-models.test.ts test/model-discovery.test.tsx`
  - 2 test files passed
  - 20 tests passed

## Changes

- Added deterministic service-instance labels and filtering by enabled/API key/LLM provider kind.
- Added discovered vision-model options that keep supported/unknown models and hide explicit unsupported models.
- Added `useModelDiscovery` with 400ms debounce, abort cleanup, refresh, error handling, and custom discovery manual-entry fallback.
- Refactored `ModelDiscoveryField` to consume the shared hook.
- Added the hook test file to `test:image`.

## Self-review

- Only Task 2 source, tests, package script, and this report are intended for the commit.
- Existing configured-model overloads remain available for current image settings code.
- No hotlink generated file or unrelated formatting changes are included.
