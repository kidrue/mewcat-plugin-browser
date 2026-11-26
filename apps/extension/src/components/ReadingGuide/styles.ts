import styled from "styled-components"

import { skyCardArtwork } from "../SkyArtwork"

export const Card = styled.section`
    margin: 12px 0;
    padding: 16px;
    border: 1px solid var(--border-color, #cfe0ef);
    border-radius: 12px;
    background: var(--bg-secondary, white);
    ${skyCardArtwork("readingGuide")}
    font-size: 13px;
    line-height: 1.7;
    h2 {
        font-size: 16px;
        margin: 0 0 8px;
    }
    button {
        margin: 8px 8px 0 0;
        padding: 6px 12px;
        cursor: pointer;
    }
`
