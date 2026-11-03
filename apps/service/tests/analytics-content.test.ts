import { describe, expect, it } from "vitest"

import { createContentCipher } from "../src/analytics/content.js"
import { loadConfig } from "../src/config.js"

const key = Buffer.alloc(32, 7).toString("base64")
const environment = { SILICONFLOW_API_KEY: "fake", SILICONFLOW_MODEL: "fake" }

describe("画像内容保护", () => {
    it("默认不开启内容采集，开启时拒绝缺失或无效密钥", () => {
        expect(loadConfig(environment).ANALYTICS_CAPTURE_CONTENT).toBe(false)
        expect(() =>
            loadConfig({ ...environment, ANALYTICS_CAPTURE_CONTENT: "true" })
        ).toThrow()
        expect(() =>
            loadConfig({
                ...environment,
                ANALYTICS_CAPTURE_CONTENT: "true",
                ANALYTICS_CONTENT_KEY: "invalid"
            })
        ).toThrow()
        expect(
            loadConfig({
                ...environment,
                ANALYTICS_CAPTURE_CONTENT: "true",
                ANALYTICS_CONTENT_KEY: key
            }).ANALYTICS_CAPTURE_CONTENT
        ).toBe(true)
        expect(() =>
            loadConfig({
                ...environment,
                ANALYTICS_DAILY_CHARACTERS: "100",
                ANALYTICS_SAMPLE_CHARACTERS: "101"
            })
        ).toThrow()
    })
    it("拒绝会导致内容提前清理或聚合提前丢失的保留期组合", () => {
        expect(() =>
            loadConfig({
                ...environment,
                ANALYTICS_CONTENT_RETENTION_DAYS: "91"
            })
        ).toThrow()
        expect(() =>
            loadConfig({
                ...environment,
                ANALYTICS_AGGREGATE_RETENTION_DAYS: "89"
            })
        ).toThrow()
    })
    it("随机加密并拒绝串用请求、内容类型和密钥", () => {
        const cipher = createContentCipher(key)
        const encrypted = cipher.encrypt("request-a", "original", [
            "private original"
        ])
        expect(encrypted).not.toContain("private")
        expect(encrypted).not.toBe(
            cipher.encrypt("request-a", "original", ["private original"])
        )
        expect(cipher.decrypt("request-a", "original", encrypted)).toEqual([
            "private original"
        ])
        expect(() =>
            cipher.decrypt("request-b", "original", encrypted)
        ).toThrow()
        expect(() =>
            cipher.decrypt("request-a", "translated", encrypted)
        ).toThrow()
        expect(() =>
            createContentCipher(Buffer.alloc(32, 9).toString("base64")).decrypt(
                "request-a",
                "original",
                encrypted
            )
        ).toThrow()
    })
    it("规范化内容摘要有密钥隔离且不混淆数组边界", () => {
        const cipher = createContentCipher(key)
        expect(cipher.digest([" Hello  world "])).toBe(
            cipher.digest(["Hello world"])
        )
        expect(cipher.digest(["a", "b"])).not.toBe(cipher.digest(["a b"]))
        expect(cipher.digest(["hello"])).not.toBe(
            createContentCipher(Buffer.alloc(32, 9).toString("base64")).digest([
                "hello"
            ])
        )
    })
})
