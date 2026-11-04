import React from "react"
import styled from "styled-components"

import { NAVIGATION_ITEMS } from "@/constants/options"

const Author = styled.button`
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    &:hover {
        color: var(--primary-color);
    }
    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 4px;
        border-radius: var(--radius-sm);
    }
`
export function AuthorAnalyticsEntry({ author }: { author: string }) {
    return (
        <Author
            type="button"
            onClick={() => {
                location.hash = "analytics"
            }}
        >
            {author}
        </Author>
    )
}
export function resolveOptionsTab(hash: string) {
    const tab = hash.slice(1)
    return tab === "analytics" || NAVIGATION_ITEMS.some(item => item.id === tab)
        ? tab
        : "basic"
}
