import { createIdentity, publicKeys, seal } from "@mewcat/protocol"
import type { FastifyInstance } from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import { buildApp } from "../src/app.js"
import { loadConfig } from "../src/config.js"
import { testStore } from "./helpers.js"

describe("入口资源保护", () => {
    let fixture: Awaited<ReturnType<typeof testStore>>
    let app: FastifyInstance
    afterEach(async () => {
        await app?.close()
        await fixture?.cleanup()
    })
    it("被限流的请求返回 429，默认不信任伪造的 X-Forwarded-For", async () => {
        fixture = await testStore()
        const identity = await createIdentity()
        app = await buildApp({
            config: loadConfig({
                NODE_ENV: "test",
                SILICONFLOW_API_KEY: "test",
                SILICONFLOW_MODEL: "test",
                INGRESS_REQUESTS_PER_MINUTE: "1"
            }),
            store: fixture.store,
            keys: {
                identity,
                publicKeys: await publicKeys(identity, "server"),
                ipHashSecret: "salt"
            }
        })
        const first = await app.inject({
            method: "GET",
            url: "/v1/keys",
            headers: { "x-forwarded-for": "192.0.2.1" }
        })
        const second = await app.inject({
            method: "GET",
            url: "/v1/keys",
            headers: { "x-forwarded-for": "192.0.2.2" }
        })
        expect(first.statusCode).toBe(200)
        expect(second.statusCode).toBe(429)
        expect(second.json()).toMatchObject({ error: { code: "RATE_LIMITED" } })
    })

    it("公开设备注册仍受每 IP 每日上限保护", async () => {
        fixture = await testStore()
        const serverIdentity = await createIdentity()
        app = await buildApp({
            config: loadConfig({
                NODE_ENV: "test",
                SILICONFLOW_API_KEY: "test",
                SILICONFLOW_MODEL: "test",
                INGRESS_REQUESTS_PER_MINUTE: "10",
                REGISTRATIONS_PER_IP_PER_DAY: "1"
            }),
            store: fixture.store,
            keys: {
                identity: serverIdentity,
                publicKeys: await publicKeys(serverIdentity, "server"),
                ipHashSecret: "salt"
            }
        })
        const register = async (
            identity?: Awaited<ReturnType<typeof createIdentity>>
        ) => {
            const clientIdentity = identity ?? (await createIdentity())
            const clientKeys = await publicKeys(clientIdentity, "registration")
            const path = "/v1/clients/register"
            const envelope = await seal(
                {
                    v: 1,
                    method: "POST",
                    path,
                    timestamp: Date.now(),
                    nonce: crypto.randomUUID(),
                    data: {
                        name: "Chrome Translate",
                        signingKey: clientKeys.signingKey,
                        encryptionKey: clientKeys.encryptionKey
                    }
                },
                clientIdentity.signing.privateKey,
                serverIdentity.encryption.publicKey,
                "registration",
                "server"
            )
            return app.inject({
                method: "POST",
                url: path,
                payload: { envelope }
            })
        }

        const clientIdentity = await createIdentity()
        expect((await register(clientIdentity)).statusCode).toBe(201)
        expect((await register(clientIdentity)).statusCode).toBe(201)
        expect((await register()).statusCode).toBe(429)
        expect(await fixture.store.db.client.count()).toBe(1)
    })
})
