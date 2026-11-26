import styled from "styled-components"

export const SCxDot = styled.div<{ x: number; y: number }>`
    position: fixed;
    left: ${props => props.x}px;
    top: ${props => props.y}px;
    z-index: 100000;
    width: 24px;
    height: 24px;
    /* 一枚小蓝色邮戳 —— 与页面悬浮球同形制 */
    background: #2878c8;
    border-radius: var(--radius-lg);
    box-shadow:
        inset 0 0 0 1px rgba(251, 248, 240, 0.55),
        0 2px 6px rgba(40, 120, 200, 0.24);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transform: translate(-50%, -100%) translateY(-8px);
    transition: all 0.16s ease;
    opacity: 0;
    animation: fadeInScale 0.2s ease-out forwards;

    &:hover {
        transform: translate(-50%, -100%) translateY(-9px);
    }

    &:active {
        transform: translate(-50%, -100%) translateY(-8px) scale(0.95);
    }

    @keyframes fadeInScale {
        0% {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(-8px) scale(0.85);
        }
        100% {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(-8px) scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        animation: none;
        opacity: 1;
    }
`

export const SCxTooltip = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "show"
})<{ show: boolean }>`
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: #203b57;
    color: #ffffff;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: ${props => (props.show ? 1 : 0)};
    visibility: ${props => (props.show ? "visible" : "hidden")};
    transition: opacity 0.16s ease;
    pointer-events: none;

    &::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: #203b57;
    }
`
