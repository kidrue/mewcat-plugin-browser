import { z } from "zod"

export const FEEDBACK_ERROR_MESSAGES: Record<string, string> = {
    FEEDBACK_UNAVAILABLE: "反馈服务暂不可用，请稍后重试",
    FEEDBACK_SEND_FAILED: "反馈发送失败，请稍后重试",
    FEEDBACK_TIMEOUT: "反馈发送超时，暂时无法确认是否送达，请稍后再试",
    RATE_LIMITED: "反馈提交过于频繁，请稍后重试",
    QUOTA_EXCEEDED: "反馈提交次数已达当前时段上限，请稍后重试",
    CLIENT_REVOKED: "当前设备无法提交反馈",
    INVALID_REQUEST: "反馈内容或联系邮箱格式不正确",
    NETWORK_FAILURE: "无法提交反馈，请检查网络后重试"
}

export const feedbackSubmissionSchema = z.strictObject({
    message: z
        .string()
        .trim()
        .min(5, "请填写至少 5 个字的反馈内容")
        .max(5000, "反馈内容不能超过 5000 字"),
    replyEmail: z
        .string()
        .trim()
        .max(254)
        .email("请填写有效的联系邮箱")
        .optional()
})

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>
export type FeedbackResponse =
    | { success: true }
    | { success: false; message: string }
