import type React from "react"
import { useState } from "react"

import { openFeedbackPage } from "@/utils/openFeedbackPage"

import { Trigger } from "./styles"
import type { FeedbackButtonProps } from "./types"

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
    iconOnly = false
}) => {
    const [error, setError] = useState(false)
    return (
        <>
            <Trigger
                $iconOnly={iconOnly}
                type="button"
                aria-label="意见反馈"
                title="意见反馈"
                onClick={() => {
                    setError(false)
                    void openFeedbackPage().catch(() => setError(true))
                }}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                >
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m4 7 8 6 8-6" />
                </svg>
                {!iconOnly && "意见反馈"}
            </Trigger>
            {error && <span role="alert">无法打开反馈页，请重试</span>}
        </>
    )
}
