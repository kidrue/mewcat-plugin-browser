import styled from "styled-components"

const LogoImage = styled.img<{ $size: number }>`
    display: block;
    width: ${props => props.$size}px;
    height: ${props => props.$size}px;
    flex: none;
    object-fit: cover;
    border-radius: 24%;
    user-select: none;
    -webkit-user-drag: none;
`

interface BrandLogoProps {
    className?: string
    size?: number
}

function BrandLogo({ className, size = 40 }: BrandLogoProps) {
    return (
        <LogoImage
            className={className}
            $size={size}
            src={chrome.runtime.getURL("icons/128.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
        />
    )
}

export default BrandLogo
