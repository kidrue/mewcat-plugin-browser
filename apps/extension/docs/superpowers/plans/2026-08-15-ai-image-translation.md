# AI Image Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use configured vision models to translate one image at a time and render reversible in-page translated text overlays.

**Architecture:** Keep the existing background capture pipeline, add protocol-specific vision adapters returning one validated normalized result, cache that lightweight result, and render it through a target-agnostic overlay manager. Configuration selects a vision model independently from text translation.

**Tech Stack:** TypeScript, React 18, WXT, Jotai, Zod, Vitest, jsdom, OffscreenCanvas.

## Global Constraints

- Work in the current dirty workspace without resetting, cleaning, or committing unrelated user changes.
- Do not create git commits; task reports and reviews use scoped file diffs because the baseline is dirty.
- Use TDD: every production behavior begins with a focused failing test and recorded RED/GREEN evidence.
- Source image limit is 10MB; model input long edge is at most 2048px; WebP fallback quality is 0.92.
- Coordinates are `[ymin, xmin, ymax, xmax]` integers normalized to 0–1000.
- Cache TTL is 24 hours and cleanup threshold is 8MB.
- API keys never leave the extension background context or appear in logs.
- No batch translation, raster export, inpainting, or rotated/skewed-target support.

---

### Task 1: Vision capabilities, configuration, and shared contracts

**Files:** Modify model/config/protocol types and defaults; create focused capability resolver and tests.

**Interfaces:** Produce `ImageTranslationBlock`, `ImageTranslationResult`, discriminated `TranslateImageResponse`, `imageTranslationModelId`, `BaseModel.capabilities.vision`, `isVisionCapableModel`, and `getVisionModelOptions`.

- [x] Write failing tests for known vision models, explicit custom capability, disabled/missing-key exclusion, and selected-model normalization.
- [x] Run the focused tests and record the expected missing-interface failures.
- [x] Implement the shared contracts, defaults, capability registry, and normalization without altering text-model selection.
- [x] Run focused tests and typecheck; record GREEN evidence.

### Task 2: Structured response schema and provider adapters

**Files:** Create `src/image-translation/` provider, schema, endpoint, and prompt modules with focused tests.

**Interfaces:** Produce `translateWithVisionModel(input, model, fetchImpl)`, OpenAI-compatible and Gemini request builders, `parseVisionResponse`, and stable `ImageTranslationErrorCode` values.

- [x] Write failing tests asserting exact OpenAI-compatible and Gemini request shapes, endpoint resolution, response extraction, coordinate clamping, empty-text filtering, and malformed response errors.
- [x] Run tests and record RED failures.
- [x] Implement one shared Zod schema and prompt; use Chat Completions image content plus `json_schema`, and Gemini inline data plus structured output.
- [x] Implement one OpenAI-compatible fallback retry only for an explicit unsupported-`response_format` HTTP response.
- [x] Run focused tests and typecheck; record GREEN evidence.

### Task 3: Image preprocessing, colors, and structured cache

**Files:** Create pure preprocessing/color helpers; refactor `PictureCache` to versioned structured results; add focused tests.

**Interfaces:** Produce `prepareVisionImage`, `decorateBlocksWithColors`, `get/setCachedImageTranslation`, and `withImageTranslationDeduplication` keyed by image hash, language, model ID, and schema version.

- [x] Write failing tests for size validation, resize decisions, 0.92 WebP fallback, contrast colors, model/schema cache isolation, 24-hour expiry, 8MB eviction, and same-request deduplication.
- [x] Run tests and record RED failures.
- [x] Implement minimal browser primitives behind injectable pure boundaries so Node tests do not mock unrelated behavior.
- [x] Run focused tests and typecheck; record GREEN evidence.

### Task 4: Background pipeline integration

**Files:** Refactor the existing `translate-image` handler into capture orchestration plus vision translation; update protocol callers and tests.

**Interfaces:** Consume Tasks 1–3 and return the discriminated structured response through primary, tab-message, and storage channels.

- [x] Write failing handler tests for cache hit, cache miss, provider success, no text, missing model, 401, 429, timeout, malformed output, and no backup-storage leak.
- [x] Run tests and record RED failures.
- [x] Read `local:extension-config` in background, validate the requested model ID, run capture → preprocess → cache/provider → color decoration, and map errors to stable codes.
- [x] Replace noisy console output with safe structured development logging.
- [x] Run focused tests and typecheck; record GREEN evidence.

### Task 5: Reversible image and canvas overlay

**Files:** Create an overlay manager and layout utilities; simplify `imageTranslate.tsx`; update button semantics and tests.

**Interfaces:** Produce `createImageTranslationOverlay(target, result)` returning `{ update, destroy }`, plus pure object-fit mapping and text-layout helpers.

- [x] Write failing jsdom/pure tests for img/canvas rendering, `cover/contain/fill`, object-position, horizontal/vertical text, scroll/resize updates, restore, target removal, and listener cleanup.
- [x] Run tests and record RED failures.
- [x] Implement pointer-transparent rounded blocks, 92% background opacity, high-contrast text, ResizeObserver/scroll/resize synchronization, and reversible cleanup without changing `img.src` or canvas opacity.
- [x] Reject rotated/skewed targets before showing the button and preserve the original DOM on all failures.
- [x] Run focused tests and typecheck; record GREEN evidence.

### Task 6: Settings UI, capability test, documentation, and verification

**Files:** Update the image settings section, package test scripts, image translation documentation, and end-to-end-focused tests.

**Interfaces:** UI persists `imageTranslationModelId`, exposes custom vision capability, and runs a generated-image capability check through the same background provider path.

- [x] Write failing UI tests for empty-state guidance, filtered vision options, independent selection, enable guard, and capability-test outcomes.
- [x] Run tests and record RED failures.
- [x] Implement settings UI and test-image request without adding static assets; add privacy and provider-cost copy.
- [x] Add `test:image` and include it in the normal verification command.
- [x] Run image tests, typecheck, lint, format check, WXT production build, and manual artifact inspection for rounded overlay styles and manifest validity.
