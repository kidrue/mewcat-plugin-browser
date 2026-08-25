import React from "react"
import { styled } from "styled-components"

import type { AiModel_Platform_Enum } from "@/types"

import { AddModel } from "../AddModel"

interface AIModelEmptyStateProps {
    onItemClick: (platform: AiModel_Platform_Enum) => void
}

const EmptyStatePanel = styled.section`
    box-sizing: border-box;
    display: flex;
    width: min(100%, 640px);
    flex-direction: column;
    align-items: center;
    margin: var(--space-6) auto;
    padding: var(--space-8);
    text-align: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);

    @media (max-width: 480px) {
        padding: var(--space-5) var(--space-4);
    }
`

const EmptyStateMark = styled.span`
    display: block;
    width: var(--space-5);
    height: var(--space-5);
    margin-bottom: var(--space-4);
    background: var(--primary-color);
    border-radius: var(--radius-sm);
    transform: rotate(45deg);
`

const EmptyStateTitle = styled.h3`
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    line-height: var(--line-height-tight);
`

const EmptyStateDescription = styled.p`
    max-width: 32rem;
    margin: var(--space-3) 0 var(--space-6);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
`

export function AIModelEmptyState({ onItemClick }: AIModelEmptyStateProps) {
    return (
        <EmptyStatePanel>
            <EmptyStateMark aria-hidden="true" />
            <EmptyStateTitle>添加你的第一个 AI 模型</EmptyStateTitle>
            <EmptyStateDescription>
                配置 AI 模型可获得更灵活的翻译能力；未添加时仍会使用 Google 翻译
            </EmptyStateDescription>
            <AddModel label="添加 AI 模型" onItemClick={onItemClick} />
        </EmptyStatePanel>
    )
}
