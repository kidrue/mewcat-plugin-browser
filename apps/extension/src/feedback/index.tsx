import { useRef, useState, type FormEvent } from "react"
import styled from "styled-components"

import BrandLogo from "@/components/BrandLogo"
import Button from "@/components/Button"
import { EXTENSION_INFO } from "@/constants/options"
import { submitFeedback } from "@/services/feedback"
import { feedbackSubmissionSchema } from "@/types/feedback"

import "@/styles/feedback.scss"

const Page = styled.main`
    width: min(100%, 680px);
    margin: 0 auto;
    padding: 56px 24px;
    header {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
    }
    h1 {
        margin: 0 0 var(--space-1);
        font-size: var(--font-size-2xl);
        letter-spacing: 0.06em;
    }
    header p {
        margin: 0;
        color: var(--text-secondary);
    }
    @media (max-width: 480px) {
        padding: 24px 16px;
        header {
            align-items: flex-start;
        }
    }
`
const Card = styled.section`
    padding: var(--space-6);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    background: var(--bg-secondary);
    box-shadow: var(--shadow-sm);
    @media (max-width: 480px) {
        padding: var(--space-4);
    }
`
const Field = styled.div`
    margin-bottom: var(--space-5);
    label {
        display: block;
        margin-bottom: var(--space-2);
        font-weight: var(--font-weight-medium);
    }
    label span {
        font-size: var(--font-size-sm);
        font-weight: normal;
        color: var(--text-tertiary);
    }
    textarea,
    input {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding: var(--space-3);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-secondary);
        color: var(--text-primary);
        font: inherit;
        line-height: 1.7;
    }
    textarea {
        min-height: 200px;
        resize: vertical;
    }
    input {
        min-height: 44px;
    }
    [aria-invalid="true"] {
        border-color: var(--error);
    }
    :is(input, textarea):focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    small {
        display: block;
        margin-top: var(--space-2);
        color: var(--text-tertiary);
    }
    .field-error {
        color: var(--error);
    }
`
const Note = styled.p`
    margin: var(--space-4) 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    line-height: 1.8;
    overflow-wrap: anywhere;
`
const Notice = styled.p<{ $error?: boolean }>`
    padding: var(--space-3);
    margin: 0 0 var(--space-4);
    border-radius: var(--radius-md);
    background: ${p => (p.$error ? "var(--error-bg)" : "var(--primary-light)")};
    color: ${p => (p.$error ? "var(--error)" : "var(--primary-color)")};
    line-height: 1.7;
`

export default function Feedback() {
    const [message, setMessage] = useState("")
    const [email, setEmail] = useState("")
    const [pending, setPending] = useState(false)
    const [success, setSuccess] = useState(false)
    const [failure, setFailure] = useState("")
    const [errors, setErrors] = useState<{
        message?: string
        replyEmail?: string
    }>({})
    const sending = useRef(false)

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (sending.current) {
            return
        }
        setFailure("")
        setSuccess(false)
        const parsed = feedbackSubmissionSchema.safeParse({
            message,
            ...(email.trim() ? { replyEmail: email.trim() } : {})
        })
        if (!parsed.success) {
            const fields: typeof errors = {}
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as keyof typeof fields
                fields[field] ??= issue.message
            }
            setErrors(fields)
            document
                .getElementById(
                    fields.message ? "feedback-message" : "feedback-email"
                )
                ?.focus()
            return
        }
        setErrors({})
        sending.current = true
        setPending(true)
        try {
            const result = await submitFeedback(parsed.data)
            if (result.success === false) {
                setFailure(result.message)
                return
            }
            setMessage("")
            setEmail("")
            setSuccess(true)
        } catch {
            setFailure("无法提交反馈，请检查网络后重试")
        } finally {
            sending.current = false
            setPending(false)
        }
    }

    return (
        <Page>
            <header>
                <BrandLogo size={48} />
                <div>
                    <h1>意见反馈</h1>
                    <p>告诉我们遇到的问题，或分享你的建议。</p>
                </div>
            </header>
            <Card aria-label="提交意见反馈">
                {success && (
                    <Notice role="status">反馈已提交，感谢你的反馈。</Notice>
                )}
                {failure && (
                    <Notice role="alert" $error>
                        {failure}
                    </Notice>
                )}
                <form
                    onSubmit={event => void handleSubmit(event)}
                    noValidate
                    aria-busy={pending}
                    data-sentry-block
                >
                    <Field>
                        <label htmlFor="feedback-message">
                            反馈内容 <span>必填</span>
                        </label>
                        <textarea
                            id="feedback-message"
                            name="message"
                            rows={8}
                            maxLength={5000}
                            required
                            disabled={pending}
                            placeholder="例如：在哪个操作中遇到了问题？你希望有什么改进？"
                            value={message}
                            aria-invalid={Boolean(errors.message)}
                            aria-describedby={
                                errors.message
                                    ? "feedback-message-hint feedback-message-error"
                                    : "feedback-message-hint"
                            }
                            onChange={event => {
                                setMessage(event.target.value)
                                setErrors(current => ({
                                    ...current,
                                    message: undefined
                                }))
                            }}
                        />
                        <small id="feedback-message-hint">
                            {message.length} / 5000 字，至少填写 5 个字。
                        </small>
                        {errors.message && (
                            <small
                                id="feedback-message-error"
                                className="field-error"
                                role="alert"
                            >
                                {errors.message}
                            </small>
                        )}
                    </Field>
                    <Field>
                        <label htmlFor="feedback-email">
                            联系邮箱 <span>选填，方便回复</span>
                        </label>
                        <input
                            id="feedback-email"
                            name="replyEmail"
                            type="email"
                            autoComplete="email"
                            maxLength={254}
                            disabled={pending}
                            placeholder="你的邮箱地址"
                            value={email}
                            aria-invalid={Boolean(errors.replyEmail)}
                            aria-describedby={
                                errors.replyEmail
                                    ? "feedback-email-error"
                                    : undefined
                            }
                            onChange={event => {
                                setEmail(event.target.value)
                                setErrors(current => ({
                                    ...current,
                                    replyEmail: undefined
                                }))
                            }}
                        />
                        {errors.replyEmail && (
                            <small
                                id="feedback-email-error"
                                className="field-error"
                                role="alert"
                            >
                                {errors.replyEmail}
                            </small>
                        )}
                    </Field>
                    <Note>
                        反馈将发送至 kidrue.me@gmail.com，并附带扩展版本{" "}
                        {EXTENSION_INFO.version}
                        ，方便定位问题。
                    </Note>
                    <Button
                        htmlType="submit"
                        size="lg"
                        fullWidth
                        disabled={pending}
                    >
                        {pending ? "正在提交…" : "提交反馈"}
                    </Button>
                </form>
            </Card>
        </Page>
    )
}
