import type { ImageTranslationResult } from "@/messaging/protocol"

import type { ImageTranslationOverlay } from "./imageTranslationOverlay"

type ImageTarget = HTMLImageElement | HTMLCanvasElement

export type ImageTranslationControllerAction =
    | "created"
    | "restored"
    | "missing-model"
    | "in-flight"
    | "cancelled"
    | "unsupported"

export interface ImageTranslationControllerDependencies {
    createOverlay: (
        target: ImageTarget,
        result: ImageTranslationResult,
        onDestroy: () => void
    ) => ImageTranslationOverlay
    isEligible?: (target: ImageTarget) => boolean
}

export interface ImageTranslationController {
    translate(
        target: ImageTarget,
        modelId: string | undefined,
        request: () => Promise<ImageTranslationResult>
    ): Promise<ImageTranslationControllerAction>
    destroy(target: ImageTarget): void
    destroyAll(): void
}

/** Owns reversible overlay state while leaving capture and network work outside. */
export function createImageTranslationController(
    deps: ImageTranslationControllerDependencies
): ImageTranslationController {
    const overlays = new Map<ImageTarget, ImageTranslationOverlay>()
    const tokens = new WeakMap<ImageTarget, number>()
    const pendingTokens = new Map<ImageTarget, number>()
    let generation = 0
    let lifecycle = 0

    const destroy = (target: ImageTarget) => {
        tokens.set(target, ++generation)
        pendingTokens.delete(target)
        overlays.get(target)?.destroy()
        overlays.delete(target)
    }

    return {
        async translate(target, modelId, request) {
            if (overlays.has(target)) {
                destroy(target)
                return "restored"
            }
            if (!modelId?.trim()) {
                return "missing-model"
            }
            if (pendingTokens.has(target)) {
                return "in-flight"
            }
            if (deps.isEligible && !deps.isEligible(target)) {
                return "unsupported"
            }
            const token = ++generation
            const lifecycleToken = lifecycle
            tokens.set(target, token)
            pendingTokens.set(target, token)
            try {
                let result: ImageTranslationResult
                try {
                    result = await request()
                } catch (error) {
                    if (
                        tokens.get(target) !== token ||
                        lifecycle !== lifecycleToken
                    ) {
                        return "cancelled"
                    }
                    throw error
                }
                if (
                    tokens.get(target) !== token ||
                    lifecycle !== lifecycleToken ||
                    ("isConnected" in target && !target.isConnected)
                ) {
                    return "cancelled"
                }
                if (deps.isEligible && !deps.isEligible(target)) {
                    return "unsupported"
                }
                const overlay = deps.createOverlay(target, result, () => {
                    if (overlays.get(target) === overlay) {
                        overlays.delete(target)
                    }
                })
                if (tokens.get(target) !== token) {
                    overlay.destroy()
                    return "cancelled"
                }
                overlays.set(target, overlay)
                return "created"
            } finally {
                if (pendingTokens.get(target) === token) {
                    pendingTokens.delete(target)
                }
            }
        },
        destroy,
        destroyAll() {
            overlays.forEach(overlay => overlay.destroy())
            overlays.clear()
            pendingTokens.clear()
            generation++
            lifecycle++
        }
    }
}
