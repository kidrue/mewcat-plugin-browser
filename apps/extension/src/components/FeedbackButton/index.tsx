import { useState } from "react"
import styled from "styled-components"

import { openFeedbackPage } from "@/utils/openFeedbackPage"

const Trigger = styled.button<{ $iconOnly: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: ${p => (p.$iconOnly ? "0" : "var(--space-2) var(--space-3)")};
    width: ${p => (p.$iconOnly ? "32px" : "auto")};
    min-height: ${p => (p.$iconOnly ? "32px" : "36px")};
    flex-shrink: 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font: inherit;
    font-size: var(--font-size-xs);
    cursor: pointer;
    &:hover {
        background: var(--primary-light);
        color: var(--primary-color);
    }
    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    svg {
        width: 16px;
        height: 16px;
        flex: none;
    }
`

export default function FeedbackButton({
    iconOnly = false
}: {
    iconOnly?: boolean
}) {
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
