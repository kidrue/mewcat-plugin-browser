import styled, { keyframes } from "styled-components"

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

export const SCxButton = styled.button.withConfig({
    shouldForwardProp: prop => !["visible", "translating"].includes(prop)
})<{ visible: boolean; translating: boolean }>`
    position: fixed;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-xl);
    background: #2878c8;
    border: none;
    box-shadow:
        inset 0 0 0 1.5px rgba(251, 248, 240, 0.6),
        0 3px 10px rgba(40, 120, 200, 0.28);
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
