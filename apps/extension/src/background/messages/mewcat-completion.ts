import { chatCompletionInputSchema } from "@mewcat/client"

import type {
    MewCatCompletionRequest,
    MewCatCompletionResponse
} from "@/messaging/mewcatCompletion"

import { mewCatService } from "../lib/mewcat-service"

export async function handleMewCatCompletion(
    request: MewCatCompletionRequest
): Promise<MewCatCompletionResponse> {
    const input = chatCompletionInputSchema.safeParse(request?.input)
    if (
        !input.success ||
        !["translation", "page-summary"].includes(request.feature)
    ) {
        return {
            success: false,
            errorCode: "INVALID_REQUEST",
            message: "mewCat 请求参数无效。"
        }
    }
    try {
        const result = await mewCatService.chatCompletions(
            input.data,
            request.feature === "translation"
        )
        const [choice] = result.choices
        if (choice.finish_reason !== "stop" || !choice.message.content.trim()) {
            return {
                success: false,
                errorCode: "INVALID_RESPONSE",
                message: "mewCat 服务未返回完整结果。"
            }
        }
        return { success: true, text: choice.message.content }
    } catch (error) {
        return {
            success: false,
            errorCode: "NETWORK_FAILURE",
            message:
                error instanceof Error ? error.message : "mewCat 请求失败。"
        }
    }
}
