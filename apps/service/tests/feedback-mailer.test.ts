import nodemailer from "nodemailer"
import { SMTPServer } from "smtp-server"
import { describe, expect, it, vi } from "vitest"

import { loadConfig } from "../src/config.js"
import { createFeedbackMailer } from "../src/feedback-mailer.js"

const config = loadConfig({
    NODE_ENV: "test",
    SILICONFLOW_API_KEY: "test",
    SILICONFLOW_MODEL: "test",
    SMTP_HOST: "127.0.0.1",
    SMTP_USER: "sender",
    SMTP_PASS: "test-password",
    SMTP_FROM: "sender@example.com"
})
const input = {
    message: "Please improve the translation button.",
    replyEmail: "reader@example.com",
    extensionVersion: "1.0.4"
}

describe("反馈 SMTP 发送器", () => {
    it("通过真实 STARTTLS SMTP 连接发送固定收件人与 Reply-To", async () => {
        let raw = ""
        let encrypted = false
        let recipients: string[] = []
        const server = new SMTPServer({
            onAuth(auth, _session, callback) {
                callback(
                    auth.username === "sender" &&
                        auth.password === "test-password"
                        ? null
                        : new Error("invalid credentials"),
                    { user: "sender" }
                )
            },
            onData(stream, session, callback) {
                encrypted = session.secure
                recipients = session.envelope.rcptTo.map(
                    recipient => recipient.address
                )
                stream.on("data", chunk => {
                    raw += chunk.toString()
                })
                stream.on("end", () => callback(null, "accepted"))
            }
        })
        await new Promise<void>(resolve =>
            server.listen(0, "127.0.0.1", resolve)
        )
        const address = server.server.address()
        if (!address || typeof address === "string")
            throw new Error("SMTP server address missing")
        const mailer = createFeedbackMailer(
            { ...config, SMTP_PORT: address.port },
            options =>
                nodemailer.createTransport({
                    ...options,
                    tls: { rejectUnauthorized: false }
                })
        )
        try {
            await mailer.send(input)
            expect(encrypted).toBe(true)
            expect(recipients).toEqual(["kidrue.me@gmail.com"])
            expect(raw).toContain("Reply-To: reader@example.com")
            expect(raw.replace(/=\r?\n/g, "")).toContain(input.message)
            expect(raw).not.toContain("test-password")
        } finally {
            mailer.close()
            await new Promise<void>(resolve => server.close(resolve))
        }
    })

    it.each([false, true])(
        "不会把未接受指定收件人的响应当作成功（空响应=%s）",
        async missing => {
            const sendMail = vi.fn(async () =>
                missing ? {} : { accepted: ["other@example.com"] }
            )
            const mailer = createFeedbackMailer(config, () => ({
                sendMail,
                close() {}
            }))
            await expect(mailer.send(input)).rejects.toMatchObject({
                status: 502,
                code: "FEEDBACK_SEND_FAILED"
            })
            expect(sendMail).toHaveBeenCalledOnce()
        }
    )

    it("缺少 SMTP 不建立连接，返回可恢复的不可用提示", async () => {
        const factory = vi.fn()
        const mailer = createFeedbackMailer(
            { ...config, SMTP_PASS: "" },
            factory
        )
        await expect(mailer.send(input)).rejects.toMatchObject({
            status: 503,
            code: "FEEDBACK_UNAVAILABLE"
        })
        expect(factory).not.toHaveBeenCalled()
    })

    it.each([
        [
            Object.assign(new Error("private detail"), { code: "ETIMEDOUT" }),
            504,
            "FEEDBACK_TIMEOUT"
        ],
        [new Error("private password"), 502, "FEEDBACK_SEND_FAILED"]
    ])("SMTP 失败使用安全提示且不重试：%s", async (error, status, code) => {
        const sendMail = vi.fn().mockRejectedValue(error)
        const mailer = createFeedbackMailer(config, () => ({
            sendMail,
            close() {}
        }))
        await expect(mailer.send(input)).rejects.toMatchObject({ status, code })
        await expect(mailer.send(input)).rejects.not.toThrow("private")
        expect(sendMail).toHaveBeenCalledTimes(2)
    })
})
