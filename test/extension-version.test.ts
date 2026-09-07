import { describe, expect, it } from "vitest"

import packageMetadata from "../package.json"
import { EXTENSION_INFO } from "../src/constants/options"

describe("extension product version", () => {
    it("uses package.json as the UI version source", () => {
        expect(EXTENSION_INFO.version).toBe(`v${packageMetadata.version}`)
    })
})
