import styled from "styled-components"

export const SCxIconContainer = styled.div.withConfig({
    shouldForwardProp: prop => prop !== "clickable"
})<{ size: number | string; clickable: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: ${props =>
        typeof props.size === "number" ? `${props.size}px` : props.size};
    height: ${props =>
        typeof props.size === "number" ? `${props.size}px` : props.size};
    cursor: ${props => (props.clickable ? "pointer" : "default")};
    flex-shrink: 0;

    svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
        transition: all 0.2s ease;
    }

    &:hover svg {
        ${props => (props.clickable ? "transform: scale(1.1);" : "")}
    }
`
