import { useAtom, useSetAtom } from "jotai"
import styled from "styled-components"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import { configAtom, updateConfigAtom } from "@/state"

import NativeSelect from "../NativeSelect"
import CustomToggle from "../Switch"
import Tooltip from "../Tooltip"

// ============================================
// Styled Components
// ============================================

// floating：浮在页面上，需要自己的纸面与边界。
// embedded：已经处在 popup 自己的窗口里，不再叠一层纸。
const PanelContainer = styled.div<{ $variant: "floating" | "embedded" }>`
    width: 320px;
    min-height: 400px;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    font-family: var(--font-family);
    color: var(--text-primary);

    ${p =>
        p.$variant === "floating" &&
        `
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-xl);
    `}
`

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    /* 骑缝线：实线压一枚朱砂方印 */
    position: relative;
    border-bottom: 1px solid var(--rule-strong);

    &::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: -4px;
        width: 8px;
        height: 8px;
        background: var(--primary-color);
    }
`

// 与页面上的悬浮球同形制：朱砂方印 + 内留白边 + 宋体印文
const Seal = styled.div`
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--text-inverse);
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: var(--font-weight-semibold);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 1.5px rgba(251, 248, 240, 0.55);
    user-select: none;
`

const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`

const HeaderTitle = styled.h1`
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-1) 0;
    line-height: var(--line-height-tight);
`

const HeaderSubtitle = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    letter-spacing: 0.04em;
`

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: var(--space-4);
`

const ListItem = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border-light);

    &:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    &:first-child {
        padding-top: 0;
    }
`

const ListItemLabel = styled.span`
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

// 帮助图标是这套语言里少数保留圆形的元素之一
const HelpIcon = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-full);
    border: 1px solid var(--text-tertiary);
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: var(--font-weight-semibold);
    cursor: help;
    transition:
        color var(--transition-fast),
        border-color var(--transition-fast),
        background var(--transition-fast);

    &:hover {
        border-color: var(--primary-color);
        color: var(--primary-color);
        background: var(--primary-light);
    }
`

const ModelSelectWrapper = styled.div`
    width: 130px;
    flex-shrink: 0;
`

const LanguageRow = styled.div`
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-1);
    /* 与底部「高级设置」之间的最小间距 —— 后者用 margin-top:auto 贴底，撑满时不会自带间距 */
    margin-bottom: var(--space-5);
    padding: var(--space-3);
    background: var(--seal-wash);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-light);
`

const LanguageBox = styled.div`
    flex: 1;
    min-width: 0;
`

const LanguageLabel = styled.label`
    display: block;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-medium);
`

const LanguageLabelRight = styled(LanguageLabel)`
    text-align: right;
`

const ArrowIcon = styled.span`
    color: var(--primary-muted);
    display: flex;
    align-items: flex-end;
    padding-bottom: var(--space-1);
    flex-shrink: 0;

    svg {
        width: 16px;
        height: 16px;
    }
`

const SettingsButton = styled.button`
    width: 100%;
    margin-top: auto;
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition:
        color var(--transition-fast),
        border-color var(--transition-fast),
        background var(--transition-fast);

    svg {
        width: 16px;
        height: 16px;
    }

    &:hover {
        background: var(--primary-light);
        border-color: var(--primary-color);
        color: var(--primary-color);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
`

const GearPath = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
)

interface SettingsPanelProps {
    currentTabUrl?: URL
    /** floating = 悬浮球弹出的面板（自带纸面与投影）；embedded = popup 窗口内（不叠纸） */
    variant?: "floating" | "embedded"
}

function SettingsPanel({
    currentTabUrl,
    variant = "floating"
}: SettingsPanelProps) {
    const [config] = useAtom(configAtom)
    const updateConfig = useSetAtom(updateConfigAtom)

    const languageOptions = [AUTO_DETECT_OPTION, ...languages.languages]
    const targetLanguageOptions = languages.languages

    const isAlwayTranslateSite = config.alwaysTranslateUrls?.includes(
        currentTabUrl?.hostname || ""
    )

    const modelOptions =
        config.aiModelList
            ?.filter(model => model.enabled)
            ?.map(model => ({
                value: model.id,
                label: model.name || "意外数据"
            })) || []

    const handleToggleTranslation = (checked: boolean) => {
        updateConfig({ isSelectedTranslate: checked })
    }

    const handleToggleContext = (checked: boolean) => {
        updateConfig({ enableContext: checked })
    }

    const handleDetectedLanguageChange = (value: string) => {
        updateConfig({ detectedLanguage: value })
    }

    const handleTargetLanguageChange = (value: string) => {
        updateConfig({ targetLanguage: value })
    }

    const handleCurrentModelChange = (value: string) => {
        updateConfig({ currentModel: value })
    }

    const handleAddTranslationSite = () => {
        if (!currentTabUrl?.hostname) {
            return
        }
        updateConfig({
            alwaysTranslateUrls: isAlwayTranslateSite
                ? config.alwaysTranslateUrls?.filter(
                      url => url !== currentTabUrl?.hostname
                  )
                : [
                      ...(config.alwaysTranslateUrls || []),
                      currentTabUrl?.hostname
                  ]
        })
    }

    const handleOpenSettings = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })
    }

    return (
        <PanelContainer $variant={variant}>
            <Header>
                <Seal aria-hidden="true">譯</Seal>
                <HeaderInfo>
                    <HeaderTitle>譯趣貓</HeaderTitle>
                    <HeaderSubtitle>智能翻译助手</HeaderSubtitle>
                </HeaderInfo>
            </Header>

            <Section>
                <ListItem>
                    <ListItemLabel>启用划词翻译</ListItemLabel>
                    <CustomToggle
                        checked={config.isSelectedTranslate}
                        onChange={handleToggleTranslation}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>
                        AI 智能上下文
                        <Tooltip
                            content="结合网页上下文提升翻译效果。需要配置 LLM 翻译服务商。注意：开启后会增加翻译时长。"
                            position="top"
                            width={200}
                        >
                            <HelpIcon>?</HelpIcon>
                        </Tooltip>
                    </ListItemLabel>
                    <CustomToggle
                        checked={config.enableContext ?? false}
                        onChange={handleToggleContext}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>总是翻译此网站</ListItemLabel>
                    <CustomToggle
                        checked={isAlwayTranslateSite}
                        onChange={handleAddTranslationSite}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>翻译模型</ListItemLabel>
                    <ModelSelectWrapper>
                        <NativeSelect
                            value={String(config.currentModel)}
                            onChange={handleCurrentModelChange}
                            options={modelOptions}
                            placeholder="选择模型"
                            size="sm"
                        />
                    </ModelSelectWrapper>
                </ListItem>
            </Section>

            <LanguageRow>
                <LanguageBox>
                    <LanguageLabel>网页语言</LanguageLabel>
                    <NativeSelect
                        value={config.detectedLanguage}
                        disabled
                        onChange={handleDetectedLanguageChange}
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
                        value={config.targetLanguage}
                        onChange={handleTargetLanguageChange}
                        options={targetLanguageOptions}
                        placeholder="选择语言"
                        size="sm"
                    />
                </LanguageBox>
            </LanguageRow>

            <SettingsButton onClick={handleOpenSettings}>
                <GearPath />
                高级设置
            </SettingsButton>
        </PanelContainer>
    )
}

export default SettingsPanel
