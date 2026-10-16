import { useEffect, useState } from "react"
import styled from "styled-components"

import { languages } from "@/constants"
import { STORAGE_NAMES } from "@/constants/storage"

import Button from "../Button"
import NativeSelect from "../NativeSelect"

const Card = styled.section`
    margin: 12px 0;
    padding: 16px;
    border: 1px solid var(--border-color, #cfe0ef);
    border-radius: 12px;
    background: var(--bg-secondary, white);
    font-size: 13px;
    line-height: 1.7;
    h2 {
        font-size: 16px;
        margin: 0 0 8px;
    }
    button {
        margin: 8px 8px 0 0;
        padding: 6px 12px;
        cursor: pointer;
    }
`
const storageKey = `${STORAGE_NAMES.extensionConfig}-reading-guide-v1`

export default function ReadingGuide({
    targetLanguage,
    onTargetLanguageChange,
    helpOnly = false
}: {
    targetLanguage: string
    onTargetLanguageChange: (language: string) => void | Promise<unknown>
    helpOnly?: boolean
}) {
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
    const finish = async (saveLanguage: boolean) => {
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
    }
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
