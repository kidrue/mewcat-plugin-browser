import { useAtomValue } from "jotai"
import React, { startTransition, useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import styled from "styled-components"

import { EXTENSION_INFO, languages, NAVIGATION_ITEMS } from "@/constants"

import "@/styles/options.scss"

import { ErrorFallback } from "@/components/ErrorFallback"
import { configAtom } from "@/state"

import OptionsContentHeader from "../components/OptionsContentHeader"
import OptionsSidebar from "../components/OptionsSidebar"
import { hideScrollBar } from "../styles/scroll"
import { About } from "./About"
import { Basic } from "./Basic"
import { Image } from "./Image"
import { Selection } from "./Selection"
import TranslateServices from "./TranslateServices"

const Container = styled.div`
    width: 100%;
    height: 100vh;
    display: flex;
    background: var(--bg-primary);
    font-family: var(--font-family);
    color: var(--text-primary);

    @media (max-width: 900px) {
        flex-direction: column;
    }
`

const SidebarWrapper = styled.div`
    flex-shrink: 0;
`

const MainContent = styled.main`
    flex: 1;
    min-width: 0;
    padding: var(--space-7) var(--space-8) var(--space-10);
    overflow-y: auto;
    background: var(--bg-primary);
    ${hideScrollBar}

    @media (max-width: 900px) {
        padding: var(--space-5) var(--space-5) var(--space-8);
    }
`

const IndexOptions: React.FunctionComponent = () => {
    const [activeTab, setActiveTab] = useState("basic")
    const config = useAtomValue(configAtom)

    const renderContent = () => {
        switch (activeTab) {
            case "basic":
                return <Basic />
            case "translation":
                return <TranslateServices />
            case "selection":
                return <Selection />
            case "image":
                return <Image />
            case "about":
                return <About />
            default:
                return <Basic />
        }
    }

    // 报头右侧常驻的状态摘要：源语言 → 目标语言 · 当前模型。
    // 当前所在的 tab 已由书脊上的朱砂竖线指示，标题不再随 tab 变化。
    const statusSummary = useMemo(() => {
        const labelOf = (code?: string) =>
            languages.languages.find(item => item.value === code)?.label
        const source = labelOf(config?.detectedLanguage) ?? "自动检测"
        const target = labelOf(config?.targetLanguage) ?? "简体中文"
        const model = config?.aiModelList?.find(
            item => item.id === config?.currentModel
        )?.name
        return model
            ? `${source} → ${target} · ${model}`
            : `${source} → ${target}`
    }, [
        config?.detectedLanguage,
        config?.targetLanguage,
        config?.currentModel,
        config?.aiModelList
    ])

    return (
        <Container className="options-container">
            <SidebarWrapper>
                <OptionsSidebar
                    title="译趣喵"
                    subtitle="高级设置"
                    navigationItems={NAVIGATION_ITEMS}
                    activeTab={activeTab}
                    onTabChange={id => {
                        startTransition(() => {
                            setActiveTab(id)
                        })
                    }}
                    className="sidebar"
                />
            </SidebarWrapper>

            <MainContent className="content options-scrollbar">
                <OptionsContentHeader
                    title="譯趣貓"
                    version={EXTENSION_INFO.version}
                    status={statusSummary}
                />
                <ErrorBoundary fallbackRender={ErrorFallback}>
                    {renderContent()}
                </ErrorBoundary>
            </MainContent>
        </Container>
    )
}

export default IndexOptions
