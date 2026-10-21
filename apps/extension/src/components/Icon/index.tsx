import React from "react"
import styled from "styled-components"

export interface IconProps {
    name: string
    size?: number | string
    color?: string
    className?: string
    style?: React.CSSProperties
    onClick?: () => void
}

const SCxIconContainer = styled.div.withConfig({
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

// 翻译相关图标
const TranslateIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
    </svg>
)

// 检查/成功图标
const CheckIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
)

// 眼睛图标（显示）
const EyeIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
)

// 眼睛关闭图标（隐藏）
const EyeOffIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
)

// 测试/实验图标
const TestIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
)

// 加载图标
const LoadingIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            opacity="0.25"
        />
        <path
            d="M12 2C6.48 2 2 6.48 2 12"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
        >
            <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                dur="1s"
                from="0 12 12"
                to="360 12 12"
                repeatCount="indefinite"
            />
        </path>
    </svg>
)

// 关闭/取消图标
const CloseIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
    </svg>
)

// 设置图标
const SettingsIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
)

// 链接图标
const LinkIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
    </svg>
)

// 拖拽图标
const DragIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z" />
    </svg>
)

// 帮助图标
const HelpIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
    </svg>
)

// 箭头图标
const ArrowDownIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M7 10l5 5 5-5z" />
    </svg>
)

const ArrowUpIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M7 14l5-5 5 5z" />
    </svg>
)

// 成功状态图标
const SuccessIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
        />
        <path
            d="M9 12l2 2 4-4"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

// 错误状态图标
const ErrorIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
        />
        <line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <line
            x1="9"
            y1="9"
            x2="15"
            y2="15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
)

// 警告图标
const WarningIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
)

// 添加更多常用图标
const HomeIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
)

const SearchIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
)

const MenuIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
)

const AddIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
)

const DeleteIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
)

const EditIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
)

const SaveIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V6h10v3z" />
    </svg>
)

const RefreshIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
)

const DownloadIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
)

const UploadIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
)

const InfoIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
)

const StarIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
)

const FavoriteIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
)

// 语言相关图标
const LanguageIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 1.56c.6 1.11 1.06 2.31 1.38 3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
    </svg>
)

// 颜色/主题相关图标
const PaletteIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3c-4.97 0-9 4.03-9 9 0 .83.67 1.5 1.5 1.5.83 0 1.5-.67 1.5-1.5 0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .83.67 1.5 1.5 1.5S12 12.83 12 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
        <circle cx="6.5" cy="11.5" r="1.5" />
        <circle cx="9.5" cy="7.5" r="1.5" />
        <circle cx="14.5" cy="7.5" r="1.5" />
        <circle cx="17.5" cy="11.5" r="1.5" />
    </svg>
)

// 复制图标
const CopyIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
)

//
// 图标映射表
const iconMap: Record<string, React.FC> = {
    // 翻译相关
    translate: TranslateIcon,
    check: CheckIcon,
    success: SuccessIcon,
    language: LanguageIcon,

    // 可见性
    eye: EyeIcon,
    "eye-off": EyeOffIcon,

    // 操作
    test: TestIcon,
    loading: LoadingIcon,
    close: CloseIcon,
    settings: SettingsIcon,
    link: LinkIcon,
    drag: DragIcon,
    help: HelpIcon,
    add: AddIcon,
    delete: DeleteIcon,
    edit: EditIcon,
    save: SaveIcon,
    refresh: RefreshIcon,
    copy: CopyIcon,

    // 导航
    home: HomeIcon,
    search: SearchIcon,
    menu: MenuIcon,

    // 箭头
    "arrow-down": ArrowDownIcon,
    "arrow-up": ArrowUpIcon,

    // 状态
    error: ErrorIcon,
    warning: WarningIcon,
    info: InfoIcon,

    // 文件操作
    download: DownloadIcon,
    upload: UploadIcon,

    // 装饰
    star: StarIcon,
    favorite: FavoriteIcon,
    palette: PaletteIcon
}

const Icon: React.FC<IconProps> = ({
    name,
    size = 24,
    color = "currentColor",
    className,
    style,
    onClick
}) => {
    const IconComponent = iconMap[name]

    if (!IconComponent) {
        console.warn(
            `Icon "${name}" not found. Available icons:`,
            Object.keys(iconMap)
        )
        return null
    }

    return (
        <SCxIconContainer
            size={size}
            clickable={!!onClick}
            className={className}
            style={{ color, ...style }}
            onClick={onClick}
        >
            <IconComponent />
        </SCxIconContainer>
    )
}

export default Icon

// 导出可用的图标名称，用于TypeScript类型检查
export type IconName = keyof typeof iconMap

// 导出所有图标组件，供直接使用
export {
    AddIcon,
    // 箭头
    ArrowDownIcon,
    ArrowUpIcon,
    CheckIcon,
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    // 文件操作
    DownloadIcon,
    DragIcon,
    EditIcon,
    // 状态
    ErrorIcon,
    // 可见性
    EyeIcon,
    EyeOffIcon,
    FavoriteIcon,
    HelpIcon,
    // 导航
    HomeIcon,
    InfoIcon,
    LanguageIcon,
    LinkIcon,
    LoadingIcon,
    MenuIcon,
    PaletteIcon,
    RefreshIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    // 装饰
    StarIcon,
    SuccessIcon,
    // 操作
    TestIcon,
    // 翻译相关
    TranslateIcon,
    UploadIcon,
    WarningIcon
}
