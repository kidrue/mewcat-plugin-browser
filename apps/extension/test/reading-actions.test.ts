import { describe, expect, it } from "vitest"

import { readingStatus, websiteRulePatch } from "../src/reading/pageActions"

describe("reading actions", () => {
    it("keeps website rules exclusive without touching other sites", () => {
        expect(
            websiteRulePatch(
                {
                    alwaysTranslateUrls: ["a.com", "b.com"],
                    neverTranslateUrls: []
                },
                "a.com",
                "never"
            )
        ).toEqual({
            alwaysTranslateUrls: ["b.com"],
            neverTranslateUrls: ["a.com"]
        })
    })
    it("does not call a partially failed page complete", () => {
        expect(readingStatus(true, false, 3, 1).status).toBe("partial")
        expect(readingStatus(true, true, 3, 0).status).toBe("translating")
        expect(readingStatus(false, false, 0, 0).status).toBe("idle")
        expect(readingStatus(true, false, 3, 0).status).toBe("complete")
    })
})
