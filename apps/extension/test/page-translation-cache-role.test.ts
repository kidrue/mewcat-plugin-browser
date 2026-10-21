import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("page translation cache dimensions", () => {
    it("uses the active AI role and model for cache reads, writes, and page clearing", () => {
        const source = readFileSync(
            new URL(
                "../src/translation/ImmersiveTranslator.ts",
                import.meta.url
            ),
            "utf8"
        )
        const activeRoleReferences = source.match(
            /aiRole: this\.translationRuntimeConfig\.aiRole/g
        )
        const activeModelReferences = source.match(
            /modelId: this\.currentModel/g
        )

        expect(activeRoleReferences).toHaveLength(3)
        expect(activeModelReferences).toHaveLength(3)
        expect(source).not.toContain('aiRole: "translator"')
    })
})
