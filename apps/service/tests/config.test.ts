import { describe, expect, it } from "vitest"

import repositoryOrigins from "../config/allowed-origins.json" with { type: "json" }
import { loadConfig } from "../src/config.js"

const environment = {
    SILICONFLOW_API_KEY: "test-key",
    SILICONFLOW_MODEL: "test-model"
}

describe("仓库来源白名单", () => {
    it("未设置环境变量时使用仓库中的扩展来源", () => {
        expect(loadConfig(environment).ALLOWED_ORIGINS.split(",")).toEqual(
            repositoryOrigins
        )
    })

    it("空环境变量沿用仓库白名单", () => {
        expect(
            loadConfig({
                ...environment,
                ALLOWED_ORIGINS: ""
            }).ALLOWED_ORIGINS.split(",")
        ).toEqual(repositoryOrigins)
    })

    it("允许环境变量显式覆盖仓库白名单", () => {
        const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        expect(
            loadConfig({ ...environment, ALLOWED_ORIGINS: origin })
                .ALLOWED_ORIGINS
        ).toBe(origin)
    })
})
