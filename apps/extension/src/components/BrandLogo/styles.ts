import styled from "styled-components"

export const LogoImage = styled.img<{ $size: number }>`
    display: block;
    width: ${props => props.$size}px;
    height: ${props => props.$size}px;
    flex: none;
    object-fit: cover;
    border-radius: 24%;
    user-select: none;
    -webkit-user-drag: none;
`
