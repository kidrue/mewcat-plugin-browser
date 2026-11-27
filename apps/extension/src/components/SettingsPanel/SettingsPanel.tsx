import { useAtom, useSetAtom } from "jotai"
import type React from "react"
import { useCallback } from "react"

import { AUTO_DETECT_OPTION, EXTENSION_INFO, languages } from "@/constants"
import {
    isPageSummaryAvailable,
    isTranslationContextAvailable,
    PAGE_SUMMARY_UNAVAILABLE_MESSAGE
} from "@/features/page-summary"
import { websiteRulePatch } from "@/features/reading"
import {
    readingStatusLabels,
    usePageReadingControls
} from "@/hooks/usePageReadingControls"
import {
    configAtom,
    getTranslationServiceOptions,
    updateConfigAtom
} from "@/state"

import Button from "../Button"
import FeatureAvailability from "../FeatureAvailability"
import FeedbackButton from "../FeedbackButton"
import GitHubIcon from "../GitHubIcon"
import NativeSelect from "../NativeSelect"
import ReadingGuide from "../ReadingGuide"
import { SkyMascot } from "../SkyArtwork"
import SummaryPageButton from "../SummaryPageButton"
import CustomToggle from "../Switch"
import Tooltip from "../Tooltip"
import { GearPath } from "./GearPath"
import {
    ActionRow,
    ArrowIcon,
    AvailabilityHint,
    Header,
    HeaderActions,
    HeaderInfo,
    HeaderLogo,
    HeaderMascot,
    HeaderSubtitle,
    HeaderTitle,
    HeaderVersion,
    HelpIcon,
    LanguageBox,
    LanguageLabel,
    LanguageLabelRight,
    LanguageRow,
    ListItem,
    ListItemLabel,
    ModelSelectWrapper,
    MoreActions,
    PanelContainer,
    PopupBackdrop,
    PopupIconButton,
    PopupPortrait,
    PopupScenery,
    ReadingActions,
    RepositoryLink,
    Section,
    SettingsButton,
    SummaryInfo
} from "./styles"
import type { SettingsPanelProps } from "./types"

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    currentTabUrl,
    executePageAction,
    variant = "floating"
}) => {
    const [config] = useAtom(configAtom)

    const updateConfig = useSetAtom(updateConfigAtom)

    const reading = usePageReadingControls(executePageAction)

    const languageOptions = [AUTO_DETECT_OPTION, ...languages.languages]
    const targetLanguageOptions = languages.languages

    const isAlwayTranslateSite = config.alwaysTranslateUrls?.includes(
        currentTabUrl?.hostname || ""
    )

    const modelOptions = getTranslationServiceOptions(config.aiModelList || [])
    const hasUsableGenerativeModel = isPageSummaryAvailable(config)
    const contextAvailable = isTranslationContextAvailable(config)

    const handleToggleTranslation = useCallback(
        (checked: boolean) => {
            updateConfig({ isSelectedTranslate: checked })
        },
        [updateConfig]
    )

    const handleToggleContext = useCallback(
        (checked: boolean) => {
            updateConfig({ enableContext: checked })
        },
        [updateConfig]
    )

    const handleTogglePageSummary = useCallback(
        (checked: boolean) => {
            updateConfig({ enablePageSummary: checked })
        },
        [updateConfig]
    )

    const handleDetectedLanguageChange = useCallback(
        (value: string) => {
            updateConfig({ detectedLanguage: value })
        },
        [updateConfig]
    )

    const handleTargetLanguageChange = useCallback(
        (value: string) => {
            updateConfig({ targetLanguage: value })
        },
        [updateConfig]
    )

    const handleCurrentModelChange = useCallback(
        (value: string) => {
            updateConfig({ currentModel: value })
        },
        [updateConfig]
    )

    const handleOpenSettings = useCallback(() => {
        const runtime = chrome.runtime
        const openFallback = () => {
            if (typeof chrome.tabs?.create === "function") {
                chrome.tabs.create({ url: runtime.getURL("options.html") })
                return
            }

            // 网页内的悬浮面板没有 tabs 权限，通过后台打开设置页。
            if (typeof runtime?.sendMessage === "function") {
                runtime.sendMessage({ type: "OPEN_OPTIONS" }, () => {
                    void runtime.lastError
                })
            }
        }

        // popup 直接使用浏览器 API，避免开发环境后台重载时消息丢失。
        if (typeof runtime?.openOptionsPage === "function") {
            runtime.openOptionsPage(() => {
                if (runtime.lastError) {
                    openFallback()
                }
            })
            return
        }

        openFallback()
    }, [])

    const websiteRuleSelector = (
        <NativeSelect
            aria-label="此网站自动翻译"
            size="sm"
            disabled={
                !currentTabUrl || !/^https?:$/.test(currentTabUrl.protocol)
            }
            value={
                config.neverTranslateUrls?.includes(
                    currentTabUrl?.hostname ?? ""
                )
                    ? "never"
                    : isAlwayTranslateSite
                      ? "always"
                      : "default"
            }
            options={[
                { value: "default", label: "跟随语言设置" },
                { value: "always", label: "总是自动翻译" },
                { value: "never", label: "不自动翻译" }
            ]}
            onChange={rule => {
                if (currentTabUrl?.hostname) {
                    void updateConfig(
                        websiteRulePatch(config, currentTabUrl.hostname, rule)
                    )
                }
            }}
        />
    )

    return (
        <PanelContainer $variant={variant}>
            {variant === "embedded" && (
                <PopupScenery aria-hidden="true">
                    <PopupBackdrop />
                </PopupScenery>
            )}
            <Header>
                <HeaderLogo size={40} />
                <HeaderInfo>
                    <HeaderTitle>
                        译趣喵
                        {variant === "embedded" && (
                            <>
                                {" "}
                                <HeaderVersion>
                                    {EXTENSION_INFO.version}
                                </HeaderVersion>
                            </>
                        )}
                    </HeaderTitle>
                    <HeaderSubtitle>晴空来信 · 智能翻译助手</HeaderSubtitle>
                </HeaderInfo>
                {variant === "embedded" && (
                    <>
                        <RepositoryLink
                            as="a"
                            href={EXTENSION_INFO.repositoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub 项目"
                            title="在新标签页打开 GitHub 项目"
                        >
                            <GitHubIcon />
                        </RepositoryLink>
                        <HeaderActions>
                            <FeedbackButton iconOnly />
                            <PopupIconButton
                                type="button"
                                aria-label="高级设置"
                                title="高级设置"
                                onClick={handleOpenSettings}
                            >
                                <GearPath />
                            </PopupIconButton>
                        </HeaderActions>
                    </>
                )}
                {variant === "embedded" ? (
                    <PopupPortrait aria-hidden="true">
                        <SkyMascot />
                    </PopupPortrait>
                ) : (
                    <HeaderMascot />
                )}
            </Header>
            <Section>
                <ListItem>
                    <ListItemLabel>启用划词翻译</ListItemLabel>
                    <CustomToggle
                        aria-label="启用划词翻译"
                        checked={config.isSelectedTranslate}
                        onChange={handleToggleTranslation}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>
                        AI 智能上下文
                        <Tooltip
                            content="结合网页上下文提升翻译效果，支持 mewCat 自有服务或已配置的 LLM。mewCat 会发送限长网页上下文并计入额度；开启后可能增加翻译时长。"
                            position="top"
                            width={200}
                        >
                            <HelpIcon>?</HelpIcon>
                        </Tooltip>
                    </ListItemLabel>
                    <CustomToggle
                        aria-label="AI 智能上下文"
                        checked={
                            contextAvailable && (config.enableContext ?? false)
                        }
                        disabled={!contextAvailable}
                        onChange={handleToggleContext}
                    />
                </ListItem>
                <ListItem>
                    <SummaryInfo>
                        <ListItemLabel>
                            自动总结页面
                            <Tooltip
                                content="总结与翻译使用同一模型，页面内容将发送到当前所选翻译模型，请确认内容适合发送。"
                                position="top"
                                width={220}
                            >
                                <HelpIcon>?</HelpIcon>
                            </Tooltip>
                        </ListItemLabel>
                        {!hasUsableGenerativeModel && (
                            <AvailabilityHint role="status">
                                {PAGE_SUMMARY_UNAVAILABLE_MESSAGE}
                                开关状态会保留。
                            </AvailabilityHint>
                        )}
                    </SummaryInfo>
                    <CustomToggle
                        aria-label="自动总结页面"
                        checked={
                            hasUsableGenerativeModel &&
                            (config.enablePageSummary ?? false)
                        }
                        disabled={!hasUsableGenerativeModel}
                        onChange={handleTogglePageSummary}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>总是翻译此网站</ListItemLabel>
                    <CustomToggle
                        aria-label="总是翻译此网站"
                        checked={Boolean(isAlwayTranslateSite)}
                        disabled={
                            !currentTabUrl ||
                            !/^https?:$/.test(currentTabUrl.protocol)
                        }
                        onChange={checked => {
                            if (currentTabUrl?.hostname) {
                                void updateConfig(
                                    websiteRulePatch(
                                        config,
                                        currentTabUrl.hostname,
                                        checked ? "always" : "default"
                                    )
                                )
                            }
                        }}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>翻译服务</ListItemLabel>
                    <ModelSelectWrapper>
                        <NativeSelect
                            aria-label="翻译服务"
                            value={String(config.currentModel)}
                            onChange={handleCurrentModelChange}
                            options={modelOptions}
                            placeholder="选择服务"
                            size="sm"
                        />
                    </ModelSelectWrapper>
                </ListItem>
            </Section>

            <LanguageRow>
                <LanguageBox>
                    <LanguageLabel>网页语言</LanguageLabel>
                    <NativeSelect
                        aria-label="网页语言"
                        value={
                            executePageAction
                                ? (reading.state?.sourceLanguage ?? "auto")
                                : config.detectedLanguage
                        }
                        disabled={
                            !executePageAction ||
                            reading.unavailable ||
                            reading.pending
                        }
                        onChange={
                            executePageAction
                                ? value => void reading.run("source", value)
                                : handleDetectedLanguageChange
                        }
                        options={languageOptions}
                        placeholder="检测中..."
                        size="sm"
                    />
                </LanguageBox>
                <ArrowIcon aria-hidden="true">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </ArrowIcon>
                <LanguageBox>
                    <LanguageLabelRight>目标语言</LanguageLabelRight>
                    <NativeSelect
                        aria-label="目标语言"
                        value={config.targetLanguage}
                        onChange={handleTargetLanguageChange}
                        options={targetLanguageOptions}
                        placeholder="选择语言"
                        size="sm"
                    />
                </LanguageBox>
                <ReadingActions>
                    {executePageAction && reading.state?.status !== "idle" && (
                        <p role="status">
                            {reading.state
                                ? readingStatusLabels[reading.state.status]
                                : "正在读取当前页…"}
                            {!!reading.state?.translated &&
                                ` · 已翻译 ${reading.state.translated} 段`}
                            {!!reading.state?.failed &&
                                `，失败 ${reading.state.failed} 段`}
                        </p>
                    )}
                    <ActionRow>
                        {executePageAction && (
                            <Button
                                htmlType="button"
                                size="sm"
                                fullWidth
                                disabled={
                                    reading.unavailable || reading.pending
                                }
                                onClick={() =>
                                    void reading.run(
                                        reading.active ? "clear" : "start"
                                    )
                                }
                            >
                                {reading.active ? "显示原文" : "翻译当前页"}
                            </Button>
                        )}
                        <SummaryPageButton
                            available={hasUsableGenerativeModel}
                            compact
                        />
                    </ActionRow>
                    {!!reading.state?.failed && (
                        <Button
                            htmlType="button"
                            type="ghost"
                            size="sm"
                            disabled={reading.pending}
                            onClick={() => void reading.run("retry")}
                        >
                            重试失败内容
                        </Button>
                    )}
                </ReadingActions>

                <MoreActions>
                    <summary>更多页面设置与使用引导</summary>
                    <div>
                        {reading.state?.reason && (
                            <p role="status">{reading.state.reason}</p>
                        )}
                        <label>此网站自动翻译{websiteRuleSelector}</label>
                        {!contextAvailable && (
                            <FeatureAvailability
                                available={false}
                                saved={
                                    config.enableContext ||
                                    config.enablePageSummary
                                }
                            />
                        )}
                        {variant === "embedded" && (
                            <ReadingGuide
                                targetLanguage={config.targetLanguage}
                                onTargetLanguageChange={language =>
                                    updateConfig({ targetLanguage: language })
                                }
                            />
                        )}
                    </div>
                </MoreActions>
            </LanguageRow>

            {variant === "floating" && (
                <SettingsButton type="button" onClick={handleOpenSettings}>
                    <GearPath />
                    高级设置
                </SettingsButton>
            )}
        </PanelContainer>
    )
}
