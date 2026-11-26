import React, { useCallback, useState } from "react"

import Icon from "../Icon"
import {
    AddIcon,
    SCxAddButton,
    SCxAddForm,
    SCxDeleteButton,
    SCxInput,
    SCxListContainer,
    SCxListItem,
    SCxListItemText
} from "./styles"
import type { UrlManagerProps } from "./types"

export const UrlManager: React.FC<UrlManagerProps> = ({
    urls,
    onUrlsChange,
    placeholder = "输入网址，如：example.com",
    emptyText = "暂无配置",
    className
}) => {
    const [newUrl, setNewUrl] = useState("")

    const handleAddUrl = useCallback(() => {
        if (newUrl.trim()) {
            onUrlsChange([...urls, newUrl.trim()])
            setNewUrl("")
        }
    }, [newUrl, onUrlsChange, urls])

    const handleDeleteUrl = useCallback(
        (index: number) => {
            const newUrls = urls.filter((_, i) => i !== index)
            onUrlsChange(newUrls)
        },
        [onUrlsChange, urls]
    )

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                handleAddUrl()
            }
        },
        [handleAddUrl]
    )

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
