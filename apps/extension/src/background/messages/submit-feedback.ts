import {
    FEEDBACK_ERROR_MESSAGES,
    feedbackSubmissionSchema,
    type FeedbackResponse
} from "@/types/feedback"

import { mewCatService } from "../lib/mewcat-service"

export async function handleSubmitFeedback(
    input: unknown,
    sender: chrome.runtime.MessageSender
): Promise<FeedbackResponse> {
    const feedbackUrl = chrome.runtime.getURL("feedback.html")
    if (
        sender.id !== chrome.runtime.id ||
        sender.url?.split(/[?#]/, 1)[0] !== feedbackUrl
    ) {
        return { success: false, message: "请通过扩展的意见反馈页面提交" }
    }
    const parsed = feedbackSubmissionSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, message: "反馈内容或联系邮箱格式不正确" }
    }
    try {
        await mewCatService.submitFeedback({
            ...parsed.data,
            extensionVersion: chrome.runtime.getManifest().version
        })
        return { success: true }
    } catch (error) {
        const message =
            error instanceof Error &&
            Object.values(FEEDBACK_ERROR_MESSAGES).includes(error.message)
                ? error.message
                : FEEDBACK_ERROR_MESSAGES.NETWORK_FAILURE
        return {
            success: false,
            message
        }
    }
}
