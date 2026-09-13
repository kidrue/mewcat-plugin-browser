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

export const SKY_SCENES = {
    postOffice: "sky-post-office.png",
    coast: "cloud-coast.png",
    desk: "reading-desk.png",
    garden: "hydrangea-garden.png",
    postcards: "blue-postcards.png",
    archive: "letter-archive.png"
} as const

export type SkyScene = keyof typeof SKY_SCENES

export const getSkySceneUrl = (scene: SkyScene) =>
    getAssetUrl(`assets/sky-letter/${SKY_SCENES[scene]}`)

export type SkyIllustration = "mail" | "book" | "picture" | "ledger"

/** 独立透明底插画图标，仅作装饰，不代替操作按钮的可访问名称。 */
export function SkyIllustratedIcon({
    kind,
    className
}: SkyArtworkProps & { kind: SkyIllustration }) {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl(`assets/sky-letter/icon-${kind}.png`)}
            width={64}
            height={64}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    )
}

/**
 * 共用的本地邮局背景。组件只提供资源和无障碍默认值，
 * 由 Options、popup 等入口决定尺寸、裁切与文字遮罩。
 */
export function SkyBackdrop({
    className,
    scene = "postOffice"
}: SkyArtworkProps & { scene?: SkyScene }) {
    return (
        <ArtworkImage
            className={className}
            src={getSkySceneUrl(scene)}
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

/** 阅读姿态为浅蓝纸面肖像，独立裁切使用，不作为透明立绘。 */
export function SkyReadingPortrait({ className }: SkyArtworkProps) {
    return (
        <ArtworkImage
            className={className}
            src={getAssetUrl("assets/sky-letter/chengyu-reading.png")}
            width={1024}
            height={1536}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
        />
    )
}

export { getAssetUrl }
