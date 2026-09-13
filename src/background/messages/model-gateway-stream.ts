import { z } from "zod"

import {
    MODEL_GATEWAY_STREAM_PORT,
    MODEL_GATEWAY_STREAM_TIMEOUT_MS,
    type ModelGatewayResponse,
    type ModelGatewayStreamEvent
} from "@/messaging/modelGatewayContracts"
import { PROVIDER_REGISTRY } from "@/model-management/providers"
import { BaseModelSchema } from "@/types/extensionConfigSchema"

import {
    handleModelGatewayStream,
    type ModelGatewayDependencies
} from "./model-gateway"

const startSchema = z.object({
    type: z.literal("start"),
    request: z.object({
        type: z.literal("generate"),
        feature: z.literal("concept-explanation"),
        model: BaseModelSchema.refine(
            model =>
                model.enabled &&
                PROVIDER_REGISTRY[model.type]?.kind === "llm" &&
                model.params.apiKey.trim() &&
                model.params.modelName.trim()
        ),
        messages: z
            .array(
                z.object({
                    role: z.enum(["system", "user", "assistant"]),
                    content: z.string()
                })
            )
            .min(1),
        enableThinking: z.boolean().optional(),
        timeoutMs: z
            .number()
            .int()
            .positive()
            .max(MODEL_GATEWAY_STREAM_TIMEOUT_MS)
            .optional()
    })
})

export function handleModelGatewayStreamPort(
    port: chrome.runtime.Port,
    dependencies: ModelGatewayDependencies = {}
): void {
    if (port.name !== MODEL_GATEWAY_STREAM_PORT) return
    const controller = new AbortController()
    let started = false
    let closed = false
    let heartbeatId: ReturnType<typeof setInterval> | undefined
    const cleanup = () => {
        if (closed) return
        closed = true
        clearTimeout(startTimeoutId)
        clearInterval(heartbeatId)
        controller.abort()
        port.onMessage.removeListener(onMessage)
        port.onDisconnect.removeListener(cleanup)
        try {
            port.disconnect()
        } catch {
            // The client may have already closed the connection.
        }
    }
    const post = (event: ModelGatewayStreamEvent) => {
        if (closed) return
        try {
            port.postMessage(event)
        } catch {
            cleanup()
        }
    }
    const finish = (response: ModelGatewayResponse) => {
        post({ type: "complete", response })
        cleanup()
    }
    const onMessage = (message: unknown) => {
        if (closed || started) return
        const parsed = startSchema.safeParse(message)
        if (!parsed.success) {
            finish({
                success: false,
                error: {
                    code: "INVALID_CONFIGURATION",
                    message: "概念解释请求无效"
                }
            })
            return
        }
        started = true
        clearTimeout(startTimeoutId)
        // An open port alone does not keep an MV3 worker alive while a model thinks.
        heartbeatId = setInterval(() => post({ type: "heartbeat" }), 20_000)
        void handleModelGatewayStream(
            parsed.data.request,
            {
                signal: controller.signal,
                onDelta: text => post({ type: "delta", text })
            },
            dependencies
        ).then(finish, () =>
            finish({
                success: false,
                error: {
                    code: "NETWORK_FAILURE",
                    message: "概念解释失败，请稍后重试"
                }
            })
        )
    }
    const startTimeoutId = setTimeout(cleanup, 10_000)
    port.onMessage.addListener(onMessage)
    port.onDisconnect.addListener(cleanup)
}
