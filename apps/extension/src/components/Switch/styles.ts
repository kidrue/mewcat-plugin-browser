import styled from "styled-components"

import { sizeOf } from "./utils"

export const SwitchTrack = styled.span<{ $checked: boolean; $size: string }>`
    position: relative;
    width: 100%;
    height: 100%;
    /* 适中圆角滑轨，保持紧凑而不做成胶囊 */
    border-radius: var(--radius-sm);
    background: ${p =>
        p.$checked ? "var(--primary-color)" : "var(--bg-tertiary)"};
    box-shadow: inset 0 0 0 1px
        ${p => (p.$checked ? "var(--primary-hover)" : "var(--border-color)")};
    transition:
        background var(--transition-fast),
        box-shadow var(--transition-fast);
    flex-shrink: 0;

    &::before {
        content: "";
        position: absolute;
        top: ${p => (sizeOf(p.$size).height - sizeOf(p.$size).knob) / 2}px;
        left: ${p => (sizeOf(p.$size).height - sizeOf(p.$size).knob) / 2}px;
        width: ${p => sizeOf(p.$size).knob}px;
        height: ${p => sizeOf(p.$size).knob}px;
        border-radius: var(--radius-sm);
        /* 开合状态由「位置 + 闸块颜色」双重编码，不只靠颜色 */
        background: ${p =>
            p.$checked ? "var(--text-inverse)" : "var(--gray-400)"};
        transform: translateX(
            ${p => {
                const s = sizeOf(p.$size)
                return p.$checked ? `${s.width - s.height}px` : "0"
            }}
        );
        transition:
            transform var(--transition-fast),
            background var(--transition-fast);
    }
`

export const SwitchInput = styled.input`
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;

    &:focus-visible + ${SwitchTrack} {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
`

export const SwitchContainer = styled.label<{
    $disabled: boolean
    $size: string
}>`
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    cursor: ${p => (p.$disabled ? "not-allowed" : "pointer")};
    opacity: ${p => (p.$disabled ? 0.5 : 1)};
    width: ${p => sizeOf(p.$size).width}px;
    height: ${p => sizeOf(p.$size).height}px;

    ${p =>
        !p.$disabled &&
        `
        &:hover ${SwitchTrack} {
            box-shadow: inset 0 0 0 1px var(--primary-muted);
        }
    `}
`
