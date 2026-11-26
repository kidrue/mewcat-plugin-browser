import React from "react"

import { AddModel } from "../AddModel"
import {
    EmptyStateDescription,
    EmptyStateMark,
    EmptyStatePanel,
    EmptyStateTitle
} from "./styles"
import type { AIModelEmptyStateProps } from "./types"

export const AIModelEmptyState: React.FC<AIModelEmptyStateProps> = ({
    onItemClick
}) => {
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
