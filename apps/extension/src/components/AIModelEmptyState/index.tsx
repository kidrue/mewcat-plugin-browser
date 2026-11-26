import React from "react"
import { styled } from "styled-components"

import type { AiModel_Platform_Enum } from "@/types"

import { AddModel } from "../AddModel"

interface AIModelEmptyStateProps {
    onItemClick: (platform: AiModel_Platform_Enum) => void
}

const EmptyStatePanel = styled.div`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-3);
    max-width: 36rem;
`

const EmptyStateMark = styled.span`
    width: 10px;
    height: 10px;
    margin: 7px 2px 0;
    background: var(--primary-color);
    border-radius: 2px;
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
    margin: var(--space-2) 0 var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
`

export function AIModelEmptyState({ onItemClick }: AIModelEmptyStateProps) {
    return (
        <EmptyStatePanel>
            <EmptyStateMark aria-hidden="true" />
            <div>
                <EmptyStateTitle>添加你的第一个 AI 模型</EmptyStateTitle>
                <EmptyStateDescription>
                    配置 AI 模型可获得更灵活的翻译能力；也可直接使用 Google
                    或微软免费翻译
                </EmptyStateDescription>
                <AddModel label="添加 AI 模型" onItemClick={onItemClick} />
            </div>
        </EmptyStatePanel>
    )
}
