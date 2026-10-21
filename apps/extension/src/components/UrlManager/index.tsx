import React, { useState } from "react"
import styled from "styled-components"

import Icon from "../Icon"
import type { UrlManagerProps } from "./types"

const SCxListContainer = styled.div`
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    max-height: 220px;
    overflow-y: auto;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-xs);

    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: var(--gray-100);
        border-radius: var(--radius-sm);
    }

    &::-webkit-scrollbar-thumb {
        background: var(--gray-300);
        border-radius: var(--radius-sm);

        &:hover {
            background: var(--gray-400);
        }
    }
`

const SCxListItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
    background: var(--bg-secondary);
    transition: all var(--transition-fast);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: var(--gray-50);
    }
`

const SCxListItemText = styled.span`
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-normal);
    font-family: "Monaco", "Consolas", "Courier New", monospace;
    flex: 1;
    word-break: break-all;
    padding-right: var(--space-3);

    &.empty {
        color: var(--text-tertiary);
        font-style: italic;
        text-align: center;
        padding: var(--space-6) var(--space-4);
        font-family: var(--font-family);
    }
`

const SCxDeleteButton = styled.button`
    background: transparent;
    color: var(--text-tertiary);
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    opacity: 0.6;
    flex-shrink: 0;

    &:hover {
        background: var(--error-bg);
        color: var(--error);
        opacity: 1;
        transform: scale(1.05);
    }

    &:active {
        transform: scale(0.95);
    }
`

const SCxAddForm = styled.div`
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
`

const SCxInput = styled.input`
    flex: 1;
    padding: 0 var(--space-3);
    height: 36px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: "Monaco", "Consolas", "Courier New", monospace;
    color: var(--text-primary);
    background: var(--bg-secondary);
    transition: all var(--transition-fast);

    &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px var(--seal-ring);
    }

    &::placeholder {
        color: var(--text-tertiary);
        font-family: var(--font-family);
    }

    &:hover:not(:focus) {
        border-color: var(--gray-400);
    }
`

const SCxAddButton = styled.button`
    background: var(--primary-color);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--radius-md);
    padding: 0 var(--space-4);
    height: 36px;
    min-width: 80px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    flex-shrink: 0;

    &:hover:not(:disabled) {
        background: var(--primary-hover);
        box-shadow: var(--shadow-primary-sm);
        transform: translateY(-1px);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }

    &:disabled {
        background: var(--gray-300);
        color: var(--text-tertiary);
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
        opacity: 0.6;
    }

    svg {
        width: 14px;
        height: 14px;
    }
`

const AddIcon = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;

    &::before {
        content: "+";
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
    }
`

const UrlManager: React.FC<UrlManagerProps> = ({
    urls,
    onUrlsChange,
    placeholder = "输入网址，如：example.com",
    emptyText = "暂无配置",
    className
}) => {
    const [newUrl, setNewUrl] = useState("")

    const handleAddUrl = () => {
        if (newUrl.trim()) {
            onUrlsChange([...urls, newUrl.trim()])
            setNewUrl("")
        }
    }

    const handleDeleteUrl = (index: number) => {
        const newUrls = urls.filter((_, i) => i !== index)
        onUrlsChange(newUrls)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleAddUrl()
        }
    }

    return (
        <div className={className}>
            <SCxListContainer>
                {urls.length > 0 ? (
                    urls.map((url, index) => (
                        <SCxListItem key={index}>
                            <SCxListItemText>{url}</SCxListItemText>
                            <SCxDeleteButton
                                onClick={() => handleDeleteUrl(index)}
                                title="删除"
                            >
                                <Icon name="delete" size={14} />
                            </SCxDeleteButton>
                        </SCxListItem>
                    ))
                ) : (
                    <SCxListItem>
                        <SCxListItemText className="empty">
                            {emptyText}
                        </SCxListItemText>
                    </SCxListItem>
                )}
            </SCxListContainer>
            <SCxAddForm>
                <SCxInput
                    type="text"
                    placeholder={placeholder}
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <SCxAddButton disabled={!newUrl.trim()} onClick={handleAddUrl}>
                    <AddIcon />
                    添加
                </SCxAddButton>
            </SCxAddForm>
        </div>
    )
}

export default UrlManager
