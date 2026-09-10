import { useAtomValue } from "jotai"
import React, { startTransition, useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import styled from "styled-components"

import { EXTENSION_INFO, languages, NAVIGATION_ITEMS } from "@/constants"

import "@/styles/options.scss"

import { ErrorFallback } from "@/components/ErrorFallback"
import { SkyBackdrop, SkyMascot } from "@/components/SkyArtwork"
import { configAtom } from "@/state"

import OptionsContentHeader from "../components/OptionsContentHeader"
import OptionsSidebar from "../components/OptionsSidebar"
import { hideScrollBar } from "../styles/scroll"
import { About } from "./About"
import { Basic } from "./Basic"
import { Image } from "./Image"
import { Selection } from "./Selection"
import { TokenUsage } from "./TokenUsage"
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
    min-height: 0;
    padding: var(--space-7) var(--space-8) var(--space-10);
    overflow-y: auto;
    background: var(--bg-primary);
    position: relative;
    ${hideScrollBar}

    @media (max-width: 900px) {
        padding: var(--space-5) var(--space-5) var(--space-8);
    }
`

const Hero = styled.section`
    position: relative;
    isolation: isolate;
    min-height: 340px;
    margin-bottom: var(--space-8);
    overflow: hidden;
    border: 1px solid var(--border-color);
    border-radius: 24px;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-lg);

    @media (max-width: 700px) {
        min-height: 300px;
    }
`

const HeroBackdrop = styled(SkyBackdrop)`
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
`

const HeroShade = styled.div`
    position: absolute;
    z-index: 1;
    inset: 0;
    background:
        linear-gradient(
            90deg,
            rgba(242, 248, 254, 0.98) 0%,
            rgba(242, 248, 254, 0.9) 38%,
            rgba(242, 248, 254, 0.16) 82%
        ),
        linear-gradient(0deg, rgba(32, 59, 87, 0.1), transparent 45%);
`

const HeroMascot = styled(SkyMascot)`
    position: absolute;
    z-index: 2;
    right: 4%;
    bottom: -2%;
    height: 96%;
    width: auto;
    filter: drop-shadow(0 16px 20px rgba(32, 59, 87, 0.16));

    @media (max-width: 700px) {
        right: -10%;
        height: 82%;
        opacity: 0.46;
    }
`

const HeroCopy = styled.div`
    position: relative;
    z-index: 3;
    max-width: 600px;
    padding: 52px 44px 44px;

    @media (max-width: 700px) {
        padding: var(--space-8) var(--space-6) var(--space-7);
    }
`

const HeroEyebrow = styled.span`
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--primary-color);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.16em;

    &::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: var(--radius-full);
        background: var(--stamp-yellow);
        box-shadow: 0 0 0 4px var(--warning-bg);
    }
`

const HeroTitle = styled.h2`
    max-width: 520px;
    margin: var(--space-5) 0 var(--space-4);
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 44px);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.04em;
    line-height: 1.28;
`

const HeroDescription = styled.p`
    max-width: 450px;
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-lg);
    line-height: var(--line-height-relaxed);
`

const HeroFooter = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-7);
`

const HeroStatus = styled.span`
    display: inline-flex;
    align-items: center;
    max-width: min(100%, 320px);
    gap: var(--space-2);
    overflow: hidden;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
`

const HeroStatusDot = styled.span`
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: var(--radius-full);
    background: var(--success);
    box-shadow: 0 0 0 4px var(--success-bg);
`

const HeroAction = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--primary-color);
    border-radius: var(--radius-md);
    background: var(--primary-color);
    color: var(--text-inverse);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    transition:
        background var(--transition-fast),
        transform var(--transition-fast),
        box-shadow var(--transition-fast);

    &:hover {
        background: var(--primary-hover);
        box-shadow: var(--shadow-primary-sm);
    }

    &:active {
        transform: translateY(1px);
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
            case "usage":
                return <TokenUsage />
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
                    title="译趣喵"
                    version={EXTENSION_INFO.version}
                    status={statusSummary}
                />
                {activeTab === "basic" && (
                    <Hero aria-labelledby="sky-letter-title">
                        <HeroBackdrop />
                        <HeroShade aria-hidden="true" />
                        <HeroMascot />
                        <HeroCopy>
                            <HeroEyebrow>晴空来信 · SKY LETTER</HeroEyebrow>
                            <HeroTitle id="sky-letter-title">
                                让每一种语言，都像来信般亲切。
                            </HeroTitle>
                            <HeroDescription>
                                在阅读、工作与探索之间，译趣喵替你把重要的话送到眼前。
                            </HeroDescription>
                            <HeroFooter>
                                <HeroStatus title={statusSummary}>
                                    <HeroStatusDot aria-hidden="true" />
                                    {statusSummary}
                                </HeroStatus>
                                <HeroAction
                                    type="button"
                                    onClick={() => setActiveTab("translation")}
                                >
                                    查看翻译服务
                                </HeroAction>
                            </HeroFooter>
                        </HeroCopy>
                    </Hero>
                )}
                <ErrorBoundary fallbackRender={ErrorFallback}>
                    {renderContent()}
                </ErrorBoundary>
            </MainContent>
        </Container>
    )
}

export default IndexOptions
