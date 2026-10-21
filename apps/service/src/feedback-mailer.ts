import type { FeedbackInput } from "@mewcat/protocol"
import nodemailer, { type SendMailOptions } from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js"

import type { Config } from "./config.js"
import { ApiError } from "./errors.js"

export interface FeedbackMailer {
    send(input: FeedbackInput): Promise<void>
    close(): void
}
interface FeedbackTransport {
    sendMail(
        message: SendMailOptions
    ): Promise<{ accepted?: Array<string | { address: string }> }>
    close(): void
}
type TransportFactory = (options: SMTPTransport.Options) => FeedbackTransport

export function createFeedbackMailer(
    config: Config,
    factory: TransportFactory = options => nodemailer.createTransport(options)
): FeedbackMailer {
    const configured = Boolean(
        config.SMTP_HOST &&
            config.SMTP_USER &&
            config.SMTP_PASS &&
            config.SMTP_FROM
    )
    const transport = configured
        ? factory({
              host: config.SMTP_HOST,
              port: config.SMTP_PORT,
              secure: config.SMTP_SECURE || config.SMTP_PORT === 465,
              requireTLS: true,
              auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
              connectionTimeout: 10_000,
              greetingTimeout: 10_000,
              socketTimeout: 10_000,
              logger: false,
              debug: false,
              disableFileAccess: true,
              disableUrlAccess: true
          })
        : undefined
    return {
        async send(input) {
            if (!transport)
                throw new ApiError(
                    503,
                    "FEEDBACK_UNAVAILABLE",
                    "反馈服务暂不可用，请稍后重试"
                )
            try {
                const result = await transport.sendMail({
                    from: { name: "mewCat 译趣喵", address: config.SMTP_FROM },
                    to: config.FEEDBACK_TO,
                    ...(input.replyEmail ? { replyTo: input.replyEmail } : {}),
                    subject: `【译趣喵反馈】v${input.extensionVersion}`,
                    text: `反馈内容：\n${input.message}\n\n联系邮箱：${input.replyEmail ?? "未填写"}\n扩展版本：${input.extensionVersion}\n提交时间：${new Date().toISOString()}\n`
                })
                const accepted = result.accepted?.some(
                    address =>
                        (typeof address === "string"
                            ? address
                            : address.address
                        ).toLowerCase() === config.FEEDBACK_TO.toLowerCase()
                )
                if (!accepted)
                    throw new ApiError(
                        502,
                        "FEEDBACK_SEND_FAILED",
                        "反馈发送失败，请稍后重试"
                    )
            } catch (error) {
                if (error instanceof ApiError) throw error
                if ((error as { code?: string }).code === "ETIMEDOUT") {
                    throw new ApiError(
                        504,
                        "FEEDBACK_TIMEOUT",
                        "反馈发送超时，暂时无法确认是否送达，请稍后再试"
                    )
                }
                throw new ApiError(
                    502,
                    "FEEDBACK_SEND_FAILED",
                    "反馈发送失败，请稍后重试"
                )
            }
        },
        close() {
            transport?.close()
        }
    }
}
