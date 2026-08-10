import React from "react"
import styled, { keyframes } from "styled-components"

interface ImageTranslateButtonProps {
    /** 是否显示 */
    visible: boolean
    /** 是否正在翻译 */
    translating: boolean
    /** 点击事件 */
    onClick: () => void
    /** 按钮位置 */
    position: { x: number; y: number }
    /** 鼠标进入按钮 */
    onMouseEnter?: () => void
    /** 鼠标离开按钮 */
    onMouseLeave?: () => void
}

const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`

const spin = keyframes`
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
`

const SCxButton = styled.button.withConfig({
    shouldForwardProp: prop => !["visible", "translating"].includes(prop)
})<{ visible: boolean; translating: boolean }>`
    position: fixed;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-xl);
    background: #b23a2e;
    border: none;
    box-shadow:
        inset 0 0 0 1.5px rgba(251, 248, 240, 0.6),
        0 3px 10px rgba(142, 42, 32, 0.28);
    cursor: ${props => (props.translating ? "not-allowed" : "pointer")};
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    opacity: ${props => (props.visible ? 1 : 0)};
    pointer-events: ${props => (props.visible ? "auto" : "none")};
    animation: ${props => (props.visible ? fadeIn : "none")} 0.15s ease;
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;

    &:hover {
        transform: ${props =>
            props.translating ? "none" : "translateY(-1px)"};
    }

    &:active {
        transform: ${props => (props.translating ? "none" : "scale(0.96)")};
    }

    svg {
        width: 20px;
        height: 20px;
        fill: white;
        animation: ${props => (props.translating ? spin : "none")} 1s linear
            infinite;
    }
`

export const ImageTranslateButton: React.FC<ImageTranslateButtonProps> = ({
    visible,
    translating,
    onClick,
    position,
    onMouseEnter,
    onMouseLeave
}) => {
    return (
        <SCxButton
            visible={visible}
            translating={translating}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`
            }}
            title={translating ? "翻译中..." : "点击翻译图片"}
        >
            {translating ? (
                <svg viewBox="0 0 24 24">
                    <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="white"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="31.4 31.4"
                        strokeLinecap="round"
                    />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24">
                    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
                </svg>
            )}
        </SCxButton>
    )
}
