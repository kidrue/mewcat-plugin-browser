import { describe, expect, it } from "vitest"

import { AiRoleOptions, AiRoleSystemPrompts } from "../src/constants/aiRole"
import { resolvePageAiRole } from "../src/translation/pageAiRole"
import { AiRole } from "../src/types/config"

const auto = { aiRole: AiRole.FREE_TRANSLATOR, enableAutoAiRole: true }

describe("page AI role", () => {
    it("adds twelve selectable experts with translation and format instructions", () => {
        const roles = [
            "AI_TRANSLATOR",
            "SECURITY_TRANSLATOR",
            "SCIENCE_TRANSLATOR",
            "ENGINEERING_TRANSLATOR",
            "BUSINESS_TRANSLATOR",
            "MARKETING_TRANSLATOR",
            "EDUCATION_TRANSLATOR",
            "HISTORY_TRANSLATOR",
            "PHILOSOPHY_TRANSLATOR",
            "PSYCHOLOGY_TRANSLATOR",
            "ANIME_TRANSLATOR",
            "SUBTITLE_TRANSLATOR"
        ]
        expect(Object.values(AiRole)).toHaveLength(41)
        for (const key of roles) {
            const role = AiRole[key as keyof typeof AiRole]
            expect(role).toBe(key)
            expect(AiRoleOptions.some(option => option.value === role)).toBe(
                true
            )
            expect(AiRoleSystemPrompts[role]).toContain("仅输出译文")
            expect(AiRoleSystemPrompts[role]).toContain("HTML")
            expect(AiRoleSystemPrompts[role]).toContain("%%")
        }
    })

    it("preserves manual roles when disabled or missing the new setting", () => {
        const page = { url: "https://github.com/org/repo" }
        expect(
            resolvePageAiRole({ aiRole: AiRole.NORTHEAST_DIALECT }, page)
        ).toBe(AiRole.NORTHEAST_DIALECT)
        expect(
            resolvePageAiRole({ ...auto, enableAutoAiRole: false }, page)
        ).toBe(AiRole.FREE_TRANSLATOR)
    })

    it.each([
        ["https://github.com/org/repo", AiRole.GITHUB_TRANSLATOR],
        ["https://gist.github.com/user/id", AiRole.GITHUB_TRANSLATOR],
        ["https://x.com/home", AiRole.TWITTER_TRANSLATOR],
        ["https://www.reddit.com/r/science", AiRole.REDDIT_TRANSLATOR],
        ["https://archiveofourown.org/works/1", AiRole.AO3_TRANSLATOR],
        ["https://arxiv.org/abs/1", AiRole.ACADEMIC_TRANSLATOR],
        ["https://pubmed.ncbi.nlm.nih.gov/1", AiRole.MEDICAL_TRANSLATOR],
        ["https://huggingface.co/models", AiRole.AI_TRANSLATOR],
        ["https://developer.mozilla.org/en-US/docs", AiRole.TECH_TRANSLATOR],
        ["https://www.bbc.com/news/1", AiRole.NEWS_TRANSLATOR],
        ["https://www.amazon.co.jp/item", AiRole.ECOMMERCE_TRANSLATOR]
    ])("matches %s before conflicting page metadata", (url, role) => {
        expect(
            resolvePageAiRole(auto, {
                url,
                title: "Anime subtitles and marketing"
            })
        ).toBe(role)
    })

    it.each([
        "https://github.com.evil.example/repo",
        "https://notgithub.com/",
        "https://github.com@evil.example/",
        "https://example.com/?redirect=https://github.com/",
        "javascript:https://github.com/",
        "not a url"
    ])("does not trust lookalike URL %s", url => {
        expect(resolvePageAiRole(auto, { url })).toBe(AiRole.FREE_TRANSLATOR)
    })

    it.each([
        ["Introduction to machine learning", AiRole.AI_TRANSLATOR],
        ["漏洞公告与网络安全分析", AiRole.SECURITY_TRANSLATOR],
        ["Quantum physics experiments", AiRole.SCIENCE_TRANSLATOR],
        ["Mechanical engineering design", AiRole.ENGINEERING_TRANSLATOR],
        ["Business correspondence", AiRole.BUSINESS_TRANSLATOR],
        ["Digital marketing campaigns", AiRole.MARKETING_TRANSLATOR],
        ["课程教材与教学方法", AiRole.EDUCATION_TRANSLATOR],
        ["History of ancient civilizations", AiRole.HISTORY_TRANSLATOR],
        ["Philosophy and epistemology", AiRole.PHILOSOPHY_TRANSLATOR],
        ["Cognitive psychology", AiRole.PSYCHOLOGY_TRANSLATOR],
        ["Anime character guide", AiRole.ANIME_TRANSLATOR],
        ["Film subtitles", AiRole.SUBTITLE_TRANSLATOR]
    ])("recognizes metadata: %s", (title, role) => {
        expect(
            resolvePageAiRole(auto, {
                url: "https://example.org/article",
                title
            })
        ).toBe(role)
        expect(resolvePageAiRole(auto, { description: title })).toBe(role)
    })

    it("uses word boundaries and falls back without mutating the saved role", () => {
        expect(
            resolvePageAiRole(auto, { title: "Chair repair newsletter" })
        ).toBe(AiRole.FREE_TRANSLATOR)
        expect(resolvePageAiRole(auto, {})).toBe(AiRole.FREE_TRANSLATOR)
        expect(auto.aiRole).toBe(AiRole.FREE_TRANSLATOR)
    })
})
