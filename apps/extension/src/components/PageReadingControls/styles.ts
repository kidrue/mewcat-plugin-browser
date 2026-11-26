import styled from "styled-components"

export const Box = styled.section`
    display: grid;
    gap: 8px;
    padding: 12px;
    margin: 8px 0;
    border: 1px solid var(--border-color, #cfe0ef);
    border-radius: 12px;
    background: var(--bg-secondary, white);
    font-size: 13px;
    button {
        padding: 8px 12px;
        border: 1px solid #cfe0ef;
        border-radius: 8px;
        color: #245d91;
        background: #f0f7ff;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.6;
        cursor: default;
    }
    p {
        margin: 0;
    }
`
