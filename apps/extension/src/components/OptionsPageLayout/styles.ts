import styled from "styled-components"

import { SkyIllustratedIcon } from "@/components/SkyArtwork"

export const Intro = styled.header`
    position: relative;
    isolation: isolate;
    min-width: 0;
    min-height: 196px;
    margin-bottom: var(--space-6);
    padding: var(--space-7) var(--space-8);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    background: var(--bg-secondary);
    box-shadow: var(--shadow-sm);

    @media (max-width: 600px) {
        padding: var(--space-5);
    }
`

export const Artwork = styled.div`
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;

    img {
        position: absolute;
        right: 0;
        width: 70%;
        height: 100%;
        object-fit: cover;
        object-position: 72% 48%;
        opacity: 0.92;
    }

    &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
            90deg,
            var(--bg-secondary) 18%,
            rgba(255, 255, 255, 0.94) 40%,
            rgba(255, 255, 255, 0.7) 62%,
            rgba(255, 255, 255, 0.06)
        );
    }

    @media (max-width: 700px) {
        img {
            width: 70%;
            opacity: 0.3;
        }
    }
`

export const IntroIcon = styled(SkyIllustratedIcon)`
    width: 64px;
    height: 64px;
    flex: none;
    object-fit: contain;
`

export const IntroHeading = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
`

export const Title = styled.h2`
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: clamp(24px, 3vw, 30px);
    font-weight: var(--font-weight-semibold);
    line-height: 1.35;
`

export const Description = styled.p`
    max-width: 580px;
    margin: var(--space-3) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);

    @media (min-width: 1000px) {
        max-width: 68%;
    }
`

export const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-5);
`

export const OptionsCardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-6);
    margin-bottom: var(--space-6);

    > * {
        min-width: 0;
        margin-bottom: 0;
    }

    &:last-child {
        margin-bottom: 0;
    }

    @media (max-width: 1100px) {
        grid-template-columns: minmax(0, 1fr);
    }
`

export const FeatureCardContainer = styled.div`
    container-type: inline-size;
    margin-bottom: var(--space-6);

    &:last-child {
        margin-bottom: 0;
    }
`

export const FeatureCardGrid = styled(OptionsCardGrid)`
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;

    > section {
        margin-bottom: 0;
    }

    @container (min-width: 960px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));

        > section:first-child {
            grid-row: span 2;
        }
    }
`
