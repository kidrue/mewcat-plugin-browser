import styled from "styled-components"

export const SCxTooltipWrapper = styled.div`
    position: relative;
    display: inline-block;
`

export const SCxTooltipContent = styled.div.withConfig({
    shouldForwardProp: prop => !["show", "width"].includes(prop)
})<{
    show: boolean
    width?: number | string
}>`
    background: var(--gray-900, #1a1714);
    color: var(--text-inverse, #ffffff);
    padding: 6px 10px;
    border-radius: var(--radius-md);
    font-size: 12px;
    line-height: 1.5;
    opacity: ${props => (props.show ? 1 : 0)};
    visibility: ${props => (props.show ? "visible" : "hidden")};
    transition: all 0.2s ease;
    pointer-events: ${props => (props.show ? "auto" : "none")};
    z-index: 1000;
    max-width: 300px;
    overflow-wrap: break-word;
    /* 没给宽度时按内容定宽 —— 否则会去参照定位父级（可能只有 54px 的悬浮球）折行 */
    width: max-content;
    ${props =>
        props.width
            ? typeof props.width === "number"
                ? `width: ${props.width}px;`
                : `width: ${props.width};`
            : ""}
`

export const SCxTooltipArrow = styled.div`
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--gray-900, #1a1714);
    border-radius: calc(var(--radius-sm) / 3);
    transform: rotate(45deg);
    z-index: -1;
`
