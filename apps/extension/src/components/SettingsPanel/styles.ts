import styled, { css } from "styled-components"

import BrandLogo from "../BrandLogo"
import { SkyBackdrop, SkyMascot } from "../SkyArtwork"

// ============================================
// Styled Components
// ============================================
export const PopupBackdrop = styled(SkyBackdrop)`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 62% center;
`

// 只裁切装饰层，设置区保持 overflow:visible，给帮助浮层留出空间。
export const PopupScenery = styled.div`
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
    background: var(--bg-primary);
`

export const PopupPortrait = styled.div`
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

export const Header = styled.div`
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

export const HeaderLogo = styled(BrandLogo)`
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-primary-sm);
`

export const HeaderInfo = styled.div`
    flex: 1;
    min-width: 0;
`

export const HeaderMascot = styled(SkyMascot)`
    width: 34px;
    height: 42px;
    flex: none;
    object-fit: cover;
    object-position: 50% 7%;
    border-radius: var(--radius-lg);
    background: var(--primary-light);
`

export const HeaderTitle = styled.h1`
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-1) 0;
    line-height: var(--line-height-tight);
`

export const HeaderVersion = styled.span`
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    letter-spacing: normal;
    white-space: nowrap;
`

export const HeaderSubtitle = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    letter-spacing: 0.04em;
`

export const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: var(--space-4);
`

export const ListItem = styled.div`
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

export const ListItemLabel = styled.span`
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
`

export const SummaryInfo = styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
`

export const AvailabilityHint = styled.div`
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
`

// 帮助图标是这套语言里少数保留圆形的元素之一
export const HelpIcon = styled.span`
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

export const ModelSelectWrapper = styled.div`
    width: 130px;
    flex-shrink: 0;
`

export const LanguageRow = styled.div`
    display: flex;
    flex-wrap: wrap;
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

export const LanguageBox = styled.div`
    flex: 1;
    min-width: 0;
`

export const LanguageLabel = styled.label`
    display: block;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
    font-weight: var(--font-weight-medium);
`

export const LanguageLabelRight = styled(LanguageLabel)`
    text-align: right;
`

export const ArrowIcon = styled.span`
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

export const SettingsButton = styled.button`
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
    border: none;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);

    @supports (backdrop-filter: blur(1px)) {
        background: rgba(238, 248, 255, 0.38);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        backdrop-filter: blur(16px) saturate(1.2);
    }

    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        background: var(--bg-secondary);
        backdrop-filter: none;
    }
`

export const PanelContainer = styled.div<{ $variant: "floating" | "embedded" }>`
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
                  max-height: min(80vh, 720px);
                  overflow-y: auto;
                  overscroll-behavior: contain;
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
                      margin-top: 20px;
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
              `}
`

export const HeaderActions = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);

    [role="alert"] {
        position: absolute;
        top: calc(100% + var(--space-2));
        right: 0;
        width: 220px;
        padding: var(--space-2);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: var(--font-size-xs);
    }
`

export const PopupIconButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    cursor: pointer;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);

    svg {
        width: 16px;
        height: 16px;
    }

    &:hover {
        background: var(--primary-light);
        color: var(--primary-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
`

export const RepositoryLink = styled(PopupIconButton)`
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;

    svg {
        width: 20px;
        height: 20px;
    }
`

export const ReadingActions = styled.div`
    width: 100%;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    p {
        margin: 0 0 var(--space-2);
        line-height: var(--line-height-normal);
    }
`

export const ActionRow = styled.div`
    display: flex;
    gap: var(--space-2);
    > button,
    > div {
        flex: 1;
        min-width: 0;
    }
`

export const MoreActions = styled.details`
    width: 100%;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    summary {
        width: fit-content;
        cursor: pointer;
        padding: var(--space-1) 0;
    }
    summary:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
    > div {
        padding-top: var(--space-2);
    }
    label {
        display: block;
        margin-bottom: var(--space-2);
    }
`
