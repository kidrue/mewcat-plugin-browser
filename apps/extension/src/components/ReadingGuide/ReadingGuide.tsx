import type React from "react"
import { useCallback, useEffect, useState } from "react"

import { languages } from "@/constants"
import { STORAGE_NAMES } from "@/constants/storage"

import Button from "../Button"
import NativeSelect from "../NativeSelect"
import { Card } from "./styles"
import type { ReadingGuideProps } from "./types"

const storageKey = `${STORAGE_NAMES.extensionConfig}-reading-guide-v1`

export const ReadingGuide: React.FC<ReadingGuideProps> = ({
    targetLanguage,
    onTargetLanguageChange,
    helpOnly = false
}) => {
    const [open, setOpen] = useState(false)
    const [target, setTarget] = useState(targetLanguage)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        if (helpOnly) return
        let active = true
        void Promise.resolve()
            .then(() => chrome.storage.local.get(storageKey))
            .then(value => {
                if (active) setOpen(value[storageKey] !== true)
            })
            .catch(() => {
                if (active) setError("无法读取引导状态，可手动打开使用引导。")
            })
        return () => {
            active = false
        }
    }, [helpOnly])
    useEffect(() => {
        if (!open) setTarget(targetLanguage)
    }, [targetLanguage, open])

    const finish = useCallback(
        async (saveLanguage: boolean) => {
            setBusy(true)
            setError("")
            try {
                if (saveLanguage) await onTargetLanguageChange(target)
                await chrome.storage.local.set({ [storageKey]: true })
                setOpen(false)
            } catch {
                setError("保存失败，请重试。")
            } finally {
                setBusy(false)
            }
        },
        [onTargetLanguageChange, target]
    )
    return (
        <div>
            {!open && (
                <Button
                    htmlType="button"
                    type="ghost"
                    size="sm"
                    onClick={() => {
                        setOpen(true)
                        setError("")
                    }}
                >
                    查看使用引导
                </Button>
            )}
            {open && (
                <Card aria-label="使用引导">
                    <h2>开始使用译趣喵</h2>
                    <p>默认翻译服务无需 API Key，即可开始阅读。</p>
                    <label>
                        想翻译成哪种语言？
                        <NativeSelect
                            aria-label="引导目标语言"
                            value={target}
                            options={languages.languages}
                            onChange={setTarget}
                            disabled={busy}
                        />
                    </label>
                    <ol>
                        <li>点击扩展图标，再点击“翻译当前页”。</li>
                        <li>
                            选中文字，查看划词译文；可在设置中调整触发方式。
                        </li>
                        <li>点击“显示原文”，恢复当前页面。</li>
                    </ol>
                    <p>图片翻译、概念解释和页面总结需要另行配置 AI 模型。</p>
                    <Button
                        htmlType="button"
                        disabled={busy}
                        onClick={() => void finish(true)}
                    >
                        {busy ? "保存中…" : "开始阅读"}
                    </Button>
                    <Button
                        htmlType="button"
                        type="ghost"
                        disabled={busy}
                        onClick={() => void finish(false)}
                    >
                        跳过
                    </Button>
                </Card>
            )}
            {error && <p role="alert">{error}</p>}
        </div>
    )
}
