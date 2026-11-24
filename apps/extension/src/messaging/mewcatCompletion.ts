import type { ChatCompletionInput } from "@mewcat/client"

import { BackgroundResponseError } from "./BackgroundResponseError"
import { sendMessage } from "./index"

export interface MewCatCompletionRequest {
    feature: "translation" | "page-summary"
    input: ChatCompletionInput
}

export type MewCatCompletionResponse =
    | { success: true; text: string }
    | { success: false; errorCode: string; message: string }

export type MewCatCompletionSender = (
    request: MewCatCompletionRequest
) => Promise<MewCatCompletionResponse>

export async function requestMewCatCompletion(
    request: MewCatCompletionRequest,
    send: MewCatCompletionSender = data =>
        sendMessage("mewcat-completion", data)
): Promise<string> {
    const response = await send(request)
    if (response.success === false) {
        throw new BackgroundResponseError(response.errorCode, response.message)
    }
    return response.text
}
