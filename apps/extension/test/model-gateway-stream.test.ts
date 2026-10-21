import { describe, expect, it, vi } from "vitest"

import { handleModelGatewayStream } from "../src/background/messages/model-gateway"
import type { ModelGatewayGenerateRequest } from "../src/messaging/modelGatewayContracts"
import { AiModel_Platform_Enum } from "../src/types"

const request: ModelGatewayGenerateRequest = {
    type: "generate",
    feature: "concept-explanation",
    model: {
        id: "stream-model",
        name: "Stream model",
        enabled: true,
        type: AiModel_Platform_Enum.OPENAI,
        params: {
            apiKey: "test-key",
            modelName: "test-model",
            isOfficial: true
        }
    },
    messages: [{ role: "user", content: "Explain gravity" }]
}

const encode = (value: unknown) =>
    new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`)
const chunk = (content: string) =>
    encode({ choices: [{ delta: { content }, finish_reason: null }] })
const finish = () => encode({ choices: [{ delta: {}, finish_reason: "stop" }] })

function network() {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
        start(value) {
            controller = value
        }
    })
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
        init?.signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true }
        )
        return new Response(body, {
            headers: { "Content-Type": "text/event-stream" }
        })
    })
    return {
        fetch,
        get controller() {
            return controller
        }
    }
}

describe("model gateway streaming", () => {
    it("accepts CRLF chunks split inside UTF-8 and finishes at DONE without waiting for socket close", async () => {
        const source = network()
        const deltas: string[] = []
        const result = handleModelGatewayStream(
            request,
            { onDelta: text => deltas.push(text) },
            { fetch: source.fetch, recordUsage: async () => {} }
        )
        const bytes = new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"引力"},"finish_reason":null}]}\r\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\r\ndata: [DONE]\r\n\r\n'
        )
        for (const byte of bytes)
            source.controller.enqueue(new Uint8Array([byte]))
        expect(await result).toEqual({ success: true, text: "引力" })
        expect(deltas).toEqual(["引力"])
    })
    it("delivers deltas before completion and records final reported usage once", async () => {
        const source = network()
        const deltas: string[] = []
        const recordUsage = vi.fn(async () => {})
        const result = handleModelGatewayStream(
            request,
            { onDelta: text => deltas.push(text) },
            { fetch: source.fetch, recordUsage }
        )
        source.controller.enqueue(chunk("## 简释\n"))
        await vi.waitFor(() => expect(deltas).toEqual(["## 简释\n"]))
        expect(recordUsage).not.toHaveBeenCalled()
        source.controller.enqueue(chunk("引力。"))
        source.controller.enqueue(finish())
        source.controller.enqueue(
            encode({
                choices: [],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 4,
                    total_tokens: 14
                }
            })
        )
        source.controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
        source.controller.close()
        expect(await result).toEqual({ success: true, text: "## 简释\n引力。" })
        expect(deltas.join("")).toBe("## 简释\n引力。")
        expect(
            JSON.parse(String(source.fetch.mock.calls[0][1]?.body))
        ).toMatchObject({
            stream: true,
            stream_options: { include_usage: true }
        })
        expect(recordUsage).toHaveBeenCalledExactlyOnceWith({
            modelId: "stream-model",
            modelName: "Stream model",
            feature: "concept-explanation",
            source: "reported",
            counts: { inputTokens: 10, outputTokens: 4, totalTokens: 14 }
        })
    })

    it("aborts the network and estimates only the partial output once", async () => {
        const source = network()
        const abort = new AbortController()
        const recordUsage = vi.fn(async () => {})
        const deltas: string[] = []
        const result = handleModelGatewayStream(
            request,
            { signal: abort.signal, onDelta: text => deltas.push(text) },
            { fetch: source.fetch, recordUsage }
        )
        source.controller.enqueue(chunk("引力"))
        await vi.waitFor(() => expect(deltas).toEqual(["引力"]))
        abort.abort()
        expect(await result).toMatchObject({
            success: false,
            error: { code: "TIMEOUT_OR_ABORTED" }
        })
        expect(source.fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
        expect(recordUsage).toHaveBeenCalledTimes(1)
        expect(recordUsage.mock.calls[0][0]).toMatchObject({
            source: "estimated",
            counts: { outputTokens: 2 }
        })
    })

    it("does not treat a truncated stream as a successful explanation", async () => {
        const source = network()
        const result = handleModelGatewayStream(
            request,
            { onDelta: () => {} },
            { fetch: source.fetch, recordUsage: async () => {} }
        )
        source.controller.enqueue(chunk("半段解释"))
        source.controller.close()
        expect(await result).toMatchObject({
            success: false,
            error: { code: "INVALID_RESPONSE" }
        })
    })

    it("maps authentication failures without leaking provider details or rejecting auxiliary promises", async () => {
        const result = await handleModelGatewayStream(
            request,
            { onDelta: () => {} },
            {
                fetch: async () =>
                    new Response("private provider detail", { status: 401 }),
                recordUsage: async () => {}
            }
        )
        expect(result).toMatchObject({
            success: false,
            error: {
                code: "AUTHENTICATION_FAILED",
                message: "模型认证失败，请检查 API Key"
            }
        })
    })

    it("times out while awaiting the next chunk and ignores metrics failures", async () => {
        const source = network()
        const result = handleModelGatewayStream(
            { ...request, timeoutMs: 150 },
            { onDelta: () => {} },
            {
                fetch: source.fetch,
                recordUsage: async () => {
                    throw new Error("storage unavailable")
                }
            }
        )
        source.controller.enqueue(chunk("引力"))
        expect(await result).toMatchObject({
            success: false,
            error: { code: "TIMEOUT_OR_ABORTED", message: "模型请求超时" }
        })
    })
})
