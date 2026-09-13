import { useAtom, useSetAtom } from "jotai"
import styled, { css } from "styled-components"

import { AUTO_DETECT_OPTION, languages } from "@/constants"
import {
    configAtom,
    getTranslationServiceOptions,
    updateConfigAtom
} from "@/state"
import { hasUsablePageSummaryModel } from "@/utils/pageSummary"

import BrandLogo from "../BrandLogo"
import NativeSelect from "../NativeSelect"
import { SkyBackdrop, SkyMascot } from "../SkyArtwork"
import CustomToggle from "../Switch"
import Tooltip from "../Tooltip"

// ============================================
// Styled Components
// ============================================

const PopupBackdrop = styled(SkyBackdrop)`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 62% center;
`

// 只裁切装饰层，设置区保持 overflow:visible，给帮助浮层留出空间。
const PopupScenery = styled.div`
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: var(--bg-primary);

    &::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
            linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0.92),
                    rgba(255, 255, 255, 0.64) 48%,
                    rgba(255, 255, 255, 0.06) 78%
                )
                0 0 / 100% 144px no-repeat,
            linear-gradient(
                180deg,
                rgba(242, 248, 254, 0.12),
                rgba(242, 248, 254, 0.28) 140px,
                rgba(242, 248, 254, 0.44)
            );
    }
`

const PopupPortrait = styled.div`
    position: absolute;
    right: -4px;
    bottom: 0;
    width: 76px;
    height: 112px;
    overflow: hidden;
    pointer-events: none;
    mask-image: linear-gradient(#000 82%, transparent);

    img {
        position: absolute;
        top: 0;
        left: 50%;
        width: 156px;
        max-width: none;
        height: auto;
        transform: translateX(-50%);
    }
`

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    /* 信纸折痕：蓝线压着一枚小邮戳 */
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
        border-radius: var(--radius-full);
    }
`

const HeaderLogo = styled(BrandLogo)`
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-primary-sm);
`

const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`

const HeaderMascot = styled(SkyMascot)`
    width: 34px;
    height: 42px;
    flex: none;
    object-fit: cover;
    object-position: 50% 7%;
    border-radius: var(--radius-lg);
    background: var(--primary-light);
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

const SummaryInfo = styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
`

const AvailabilityHint = styled.small`
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
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
    background: linear-gradient(135deg, var(--primary-light), #f5fbff);
    border-radius: var(--radius-lg);
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
    border-radius: var(--radius-md);
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

// 透明度只作用于底色，文字和控件保持完整对比度。
const popupGlassSurface = css`
    position: relative;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.86);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -1px 0 rgba(143, 183, 216, 0.18),
        0 6px 20px rgba(32, 74, 112, 0.1);

    @supports (backdrop-filter: blur(1px)) {
        background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.55),
            rgba(238, 248, 255, 0.38)
        );
        -webkit-backdrop-filter: blur(16px) saturate(1.2) brightness(1.06);
        backdrop-filter: blur(16px) saturate(1.2) brightness(1.06);
    }

    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        background: var(--bg-secondary);
        border-color: var(--border-color);
        backdrop-filter: none;
    }
`

const PanelContainer = styled.div<{ $variant: "floating" | "embedded" }>`
    width: 320px;
    min-height: 400px;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    background:
        radial-gradient(
            circle at 100% 0,
            rgba(126, 190, 235, 0.18),
            transparent 11rem
        ),
        var(--bg-secondary);
    font-family: var(--font-family);
    color: var(--text-primary);

    ${p =>
        p.$variant === "floating"
            ? css`
                  border-radius: var(--radius-xl);
                  border: 1px solid var(--border-color);
                  box-shadow: var(--shadow-xl);
              `
            : css`
                  position: relative;
                  isolation: isolate;
                  width: 100%;
                  background: var(--bg-primary);

                  ${Header} {
                      min-height: 112px;
                      align-items: flex-end;
                      padding-right: 64px;
                      padding-bottom: var(--space-4);
                      margin-bottom: var(--space-3);
                  }

                  ${HeaderTitle} {
                      font-size: var(--font-size-2xl);
                  }

                  ${HeaderSubtitle} {
                      color: var(--text-secondary);
                  }

                  ${AvailabilityHint}, ${LanguageLabel}, ${HelpIcon} {
                      color: var(--text-primary);
                  }

                  ${Section} {
                      ${popupGlassSurface}
                      /* 帮助浮层在卡片内渲染，需要高于后面的玻璃卡片。 */
                      z-index: 2;
                      padding: var(--space-3);
                      margin-bottom: var(--space-3);
                      border-radius: var(--radius-xl);
                  }

                  ${ListItem} {
                      padding: 10px 0;
                      border-bottom-color: rgba(123, 164, 197, 0.28);

                      &:first-child {
                          padding-top: 0;
                      }

                      &:last-child {
                          padding-bottom: 0;
                      }
                  }

                  ${LanguageRow} {
                      ${popupGlassSurface}
                      z-index: 1;
                      margin-top: 0;
                      margin-bottom: var(--space-3);
                  }

                  select {
                      background: rgba(255, 255, 255, 0.46);
                      border-color: rgba(116, 158, 194, 0.48);
                  }

                  ${SettingsButton} {
                      position: relative;
                      z-index: 1;
                      background: #f8fbff;
                      border-color: var(--border-color);
                      box-shadow: 0 3px 12px rgba(32, 74, 112, 0.08);
                      border-radius: var(--radius-lg);
                      color: var(--text-primary);

                      &:hover {
                          background: rgba(255, 255, 255, 0.86);
                          border-color: var(--primary-muted);
                          color: var(--primary-hover);
                      }
                  }
              `}
`

const GearPath = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
)

interface SettingsPanelProps {
    currentTabUrl?: URL
    /** floating = 悬浮球纸面面板；embedded = popup 插画背景与设置卡片 */
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

    const modelOptions = getTranslationServiceOptions(config.aiModelList || [])
    const hasUsableGenerativeModel = hasUsablePageSummaryModel(
        config.aiModelList
    )

    const handleToggleTranslation = (checked: boolean) => {
        updateConfig({ isSelectedTranslate: checked })
    }

    const handleToggleContext = (checked: boolean) => {
        updateConfig({ enableContext: checked })
    }

    const handleTogglePageSummary = (checked: boolean) => {
        updateConfig({ enablePageSummary: checked })
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
        const runtime = chrome.runtime
        if (typeof runtime?.sendMessage === "function") {
            runtime.sendMessage({ type: "OPEN_OPTIONS" }, () => {
                // 读取 lastError 以消费没有可用后台监听器时的 Chrome 警告。
                void chrome.runtime.lastError
            })
            return
        }

        // 仅作为极旧运行环境的降级路径；正常 popup 与内容脚本都走后台消息。
        if (typeof chrome.tabs?.create === "function") {
            chrome.tabs.create({ url: runtime.getURL("options.html") })
        }
    }

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
                    <HeaderTitle>译趣喵</HeaderTitle>
                    <HeaderSubtitle>晴空来信 · 智能翻译助手</HeaderSubtitle>
                </HeaderInfo>
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
                            content="结合网页上下文提升翻译效果。需要配置 LLM 翻译服务商。注意：开启后会增加翻译时长。"
                            position="top"
                            width={200}
                        >
                            <HelpIcon>?</HelpIcon>
                        </Tooltip>
                    </ListItemLabel>
                    <CustomToggle
                        aria-label="AI 智能上下文"
                        checked={config.enableContext ?? false}
                        onChange={handleToggleContext}
                    />
                </ListItem>
                <ListItem>
                    <SummaryInfo>
                        <ListItemLabel>
                            自动总结页面
                            <Tooltip
                                content="页面内容将发送到已配置的生成式 AI 服务，请确认内容适合发送。"
                                position="top"
                                width={220}
                            >
                                <HelpIcon>?</HelpIcon>
                            </Tooltip>
                        </ListItemLabel>
                        {!hasUsableGenerativeModel && (
                            <AvailabilityHint role="status">
                                请先配置可用的生成式 AI 模型；开关状态会保留。
                            </AvailabilityHint>
                        )}
                    </SummaryInfo>
                    <CustomToggle
                        aria-label="自动总结页面"
                        checked={config.enablePageSummary ?? false}
                        onChange={handleTogglePageSummary}
                    />
                </ListItem>
                <ListItem>
                    <ListItemLabel>总是翻译此网站</ListItemLabel>
                    <CustomToggle
                        aria-label="总是翻译此网站"
                        checked={isAlwayTranslateSite}
                        onChange={handleAddTranslationSite}
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
                        aria-label="目标语言"
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
