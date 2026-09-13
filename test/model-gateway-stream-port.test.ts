import { afterEach, describe, expect, it, vi } from "vitest"

import { handleModelGatewayStreamPort } from "../src/background/messages/model-gateway-stream"
import {
    MODEL_GATEWAY_STREAM_PORT,
    type ModelGatewayGenerateRequest
} from "../src/messaging/modelGatewayContracts"
import { requestModelGatewayStream } from "../src/messaging/modelGatewayStream"
import { streamConceptExplanation } from "../src/translation/translationService"
import { AiModel_Platform_Enum, AiRole } from "../src/types"

function event<T>() {
    const listeners = new Set<(value: T) => void>()
    return {
        addListener: (listener: (value: T) => void) => {
            listeners.add(listener)
        },
        removeListener: (listener: (value: T) => void) => {
            listeners.delete(listener)
        },
        emit: (value: T) => {
            for (const listener of listeners) listener(value)
        },
        get size() {
            return listeners.size
        }
    }
}

function ports() {
    let closed = false
    const client = {
        name: MODEL_GATEWAY_STREAM_PORT,
        onMessage: event<unknown>(),
        onDisconnect: event<unknown>(),
        postMessage: (value: unknown) => {
            queueMicrotask(() => server.onMessage.emit(structuredClone(value)))
        },
        disconnect: () => disconnect()
    }
    const server = {
        name: MODEL_GATEWAY_STREAM_PORT,
        onMessage: event<unknown>(),
        onDisconnect: event<unknown>(),
        postMessage: (value: unknown) => {
            queueMicrotask(() => client.onMessage.emit(structuredClone(value)))
        },
        disconnect: () => disconnect()
    }
    function disconnect() {
        if (closed) return
        closed = true
        queueMicrotask(() => {
            client.onDisconnect.emit(undefined)
            server.onDisconnect.emit(undefined)
        })
    }
    return {
        client: client as unknown as chrome.runtime.Port,
        server: server as unknown as chrome.runtime.Port,
        emit: client.onMessage.emit,
        get closed() {
            return closed
        },
        listenerCount: () =>
            client.onMessage.size +
            client.onDisconnect.size +
            server.onMessage.size +
            server.onDisconnect.size
    }
}

const model = {
    id: "model",
    name: "AI",
    enabled: true,
    type: AiModel_Platform_Enum.OPENAI,
    params: { apiKey: "test-key", modelName: "test-model", isOfficial: true }
}
const request: ModelGatewayGenerateRequest = {
    type: "generate",
    model,
    feature: "concept-explanation",
    messages: [{ role: "user", content: "Explain" }]
}

afterEach(() => {
    vi.useRealTimers()
})

describe("concept streaming transport", () => {
    it("still settles when an invalidated context rejects listener cleanup", async () => {
        const pair = ports()
        pair.client.onMessage.removeListener = () => {
            throw new Error("Extension context invalidated")
        }
        const result = requestModelGatewayStream(
            request,
            { onDelta: () => {} },
            () => pair.client
        )
        expect(() =>
            pair.emit({
                type: "complete",
                response: { success: true, text: "finished" }
            })
        ).not.toThrow()
        expect(await result).toEqual({ success: true, text: "finished" })
        expect(pair.closed).toBe(true)
    })
    it("streams the real service through a port and keeps model fallback and prompt context", async () => {
        const pair = ports()
        let source!: ReadableStreamDefaultController<Uint8Array>
        let receivedBody: Record<string, unknown> | undefined
        handleModelGatewayStreamPort(pair.server, {
            fetch: async (_url, init) => {
                receivedBody = JSON.parse(String(init?.body))
                return new Response(
                    new ReadableStream({
                        start(controller) {
                            source = controller
                        }
                    }),
                    { headers: { "Content-Type": "text/event-stream" } }
                )
            },
            recordUsage: async () => {}
        })
        const deltas: string[] = []
        const result = streamConceptExplanation(
            {
                currentModel: "google-translate",
                aiRole: AiRole.DEFAULT,
                aiModelList: [model]
            },
            {
                text: "gravity",
                pageTitle: "Physics",
                context: "Nearby context"
            },
            "zh-CN",
            { onDelta: text => deltas.push(text) },
            {
                modelGatewayStreamSender: (data, options) =>
                    requestModelGatewayStream(data, options, () => pair.client)
            }
        )
        await vi.waitFor(() => expect(source).toBeDefined())
        source.enqueue(
            new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"## 简释\\n"},"finish_reason":null}]}\n\n'
            )
        )
        await vi.waitFor(() => expect(deltas).toEqual(["## 简释\n"]))
        source.enqueue(
            new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"引力"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
            )
        )
        source.close()
        expect(await result).toBe("## 简释\n引力")
        expect(JSON.stringify(receivedBody)).toContain("Physics")
        expect(JSON.stringify(receivedBody)).toContain("Nearby context")
        expect(receivedBody?.model).toBe("test-model")
        expect(pair.closed).toBe(true)
        expect(pair.listenerCount()).toBe(0)
    })

    it("cancels only its own request and ignores late chunks", async () => {
        const first = ports()
        const second = ports()
        const controller = new AbortController()
        const deltas: string[] = []
        const cancelled = requestModelGatewayStream(
            request,
            { signal: controller.signal, onDelta: text => deltas.push(text) },
            () => first.client
        )
        const other = requestModelGatewayStream(
            request,
            { onDelta: () => {} },
            () => second.client
        )
        controller.abort()
        first.emit({ type: "delta", text: "stale" })
        expect(await cancelled).toMatchObject({
            success: false,
            error: { code: "TIMEOUT_OR_ABORTED" }
        })
        expect(deltas).toEqual([])
        expect(second.closed).toBe(false)
        second.emit({
            type: "complete",
            response: { success: true, text: "other result" }
        })
        expect(await other).toEqual({ success: true, text: "other result" })
    })

    it("resolves a lost port as an error and cleans listeners", async () => {
        const pair = ports()
        const result = requestModelGatewayStream(
            request,
            { onDelta: () => {} },
            () => pair.client
        )
        pair.server.disconnect()
        expect(await result).toMatchObject({
            success: false,
            error: { code: "NETWORK_FAILURE" }
        })
        expect(pair.listenerCount()).toBe(0)
    })

    it("bounds a silent connection even when no server responds", async () => {
        vi.useFakeTimers()
        const pair = ports()
        const result = requestModelGatewayStream(
            request,
            { onDelta: () => {} },
            () => pair.client
        )
        await vi.advanceTimersByTimeAsync(310_000)
        expect(await result).toMatchObject({
            success: false,
            error: { code: "TIMEOUT_OR_ABORTED" }
        })
        expect(pair.closed).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("rejects malformed start messages before contacting a provider", async () => {
        const pair = ports()
        const fetch = vi.fn()
        const responses: unknown[] = []
        pair.client.onMessage.addListener(message => responses.push(message))
        handleModelGatewayStreamPort(pair.server, { fetch })
        pair.client.postMessage({
            type: "start",
            request: { ...request, model: null }
        })
        await vi.waitFor(() => expect(pair.closed).toBe(true))
        expect(fetch).not.toHaveBeenCalled()
        expect(responses).toEqual([
            {
                type: "complete",
                response: {
                    success: false,
                    error: {
                        code: "INVALID_CONFIGURATION",
                        message: "概念解释请求无效"
                    }
                }
            }
        ])
    })

    it("keeps an active request alive and aborts its network when the client closes", async () => {
        vi.useFakeTimers()
        const pair = ports()
        let signal: AbortSignal | undefined
        const responses: unknown[] = []
        pair.client.onMessage.addListener(message => responses.push(message))
        handleModelGatewayStreamPort(pair.server, {
            fetch: async (_url, init) => {
                signal = init?.signal ?? undefined
                return new Response(
                    new ReadableStream({
                        start(controller) {
                            signal?.addEventListener(
                                "abort",
                                () =>
                                    controller.error(
                                        new DOMException(
                                            "Aborted",
                                            "AbortError"
                                        )
                                    ),
                                { once: true }
                            )
                        }
                    }),
                    { headers: { "Content-Type": "text/event-stream" } }
                )
            },
            recordUsage: async () => {}
        })
        pair.client.postMessage({ type: "start", request })
        await vi.advanceTimersByTimeAsync(20_000)
        expect(responses).toContainEqual({ type: "heartbeat" })
        expect(signal?.aborted).toBe(false)
        pair.client.disconnect()
        await vi.advanceTimersByTimeAsync(0)
        expect(signal?.aborted).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("requires a configured generative model before opening a stream", async () => {
        const sender = vi.fn()
        await expect(
            streamConceptExplanation(
                { aiRole: AiRole.DEFAULT, aiModelList: [] },
                { text: "gravity" },
                "zh-CN",
                { onDelta: () => {} },
                { modelGatewayStreamSender: sender }
            )
        ).rejects.toMatchObject({ code: "AI_MODEL_REQUIRED" })
        expect(sender).not.toHaveBeenCalled()
    })
})
