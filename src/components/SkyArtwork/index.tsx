import styled from "styled-components"

const getAssetUrl = (path: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path)
    }

    return `/${path}`
}

const ArtworkImage = styled.img`
    display: block;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
`

export interface SkyArtworkProps {
    className?: string
}

/**
 * 共用的本地邮局背景。组件只提供资源和无障碍默认值，
 * 由 Options、popup 等入口决定尺寸、裁切与文字遮罩。
 */
export function SkyBackdrop({ className }: SkyArtworkProps) {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl("assets/sky-letter/sky-post-office.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    )
}

/** 晴空来信看板娘澄羽，默认作为装饰图片渲染，不冒充 Live2D。 */
export function SkyMascot({ className }: SkyArtworkProps) {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl("assets/sky-letter/chengyu.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    )
}

export { getAssetUrl }
