import {
    MODEL_GATEWAY_STREAM_PORT,
    MODEL_GATEWAY_STREAM_TIMEOUT_MS,
    type ModelGatewayErrorCode,
    type ModelGatewayGenerateRequest,
    type ModelGatewayResponse,
    type ModelGatewayStreamEvent,
    type ModelGatewayStreamOptions
} from "./modelGatewayContracts"

export function requestModelGatewayStream(
    request: ModelGatewayGenerateRequest,
    options: ModelGatewayStreamOptions,
    connect: () => chrome.runtime.Port = () =>
        chrome.runtime.connect({ name: MODEL_GATEWAY_STREAM_PORT })
): Promise<ModelGatewayResponse> {
    return new Promise(resolve => {
        let port: chrome.runtime.Port | undefined
        let settled = false
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const finish = (response: ModelGatewayResponse) => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            options.signal?.removeEventListener("abort", abort)
            try {
                port?.onMessage.removeListener(onMessage)
                port?.onDisconnect.removeListener(onDisconnect)
            } catch {
                // Extension updates can invalidate listeners before cleanup runs.
            }
            try {
                port?.disconnect()
            } catch {
                // An invalidated extension context may already have lost its port.
            }
            resolve(response)
        }
        const fail = (code: ModelGatewayErrorCode, message: string) =>
            finish({ success: false, error: { code, message } })
        const abort = () => fail("TIMEOUT_OR_ABORTED", "模型请求已取消")
        const onDisconnect = () => {
            // Read lastError inside the listener to acknowledge connection failures.
            void globalThis.chrome?.runtime?.lastError
            fail("NETWORK_FAILURE", "解释连接已断开，请重试")
        }
        const onMessage = (event: ModelGatewayStreamEvent) => {
            if (settled) return
            if (event?.type === "delta" && typeof event.text === "string") {
                try {
                    options.onDelta(event.text)
                } catch {
                    fail("NETWORK_FAILURE", "概念解释失败，请稍后重试")
                }
            } else if (event?.type === "complete") {
                const response = event.response
                if (
                    (response?.success === true &&
                        typeof response.text === "string") ||
                    (response?.success === false &&
                        typeof response.error?.code === "string" &&
                        typeof response.error.message === "string")
                ) {
                    finish(response)
                } else {
                    fail("INVALID_RESPONSE", "模型未返回有效解释，请重试")
                }
            }
        }
        if (options.signal?.aborted) {
            abort()
            return
        }
        try {
            port = connect()
            port.onMessage.addListener(onMessage)
            port.onDisconnect.addListener(onDisconnect)
            options.signal?.addEventListener("abort", abort, { once: true })
            timeoutId = setTimeout(
                () => fail("TIMEOUT_OR_ABORTED", "模型请求超时"),
                MODEL_GATEWAY_STREAM_TIMEOUT_MS + 5_000
            )
            port.postMessage({ type: "start", request })
        } catch {
            fail("NETWORK_FAILURE", "无法连接解释服务，请刷新页面后重试")
        }
    })
}
