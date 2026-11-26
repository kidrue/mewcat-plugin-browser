import type React from "react"

import {
    AddIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    CheckIcon,
    CloseIcon,
    CopyIcon,
    DeleteIcon,
    DownloadIcon,
    DragIcon,
    EditIcon,
    ErrorIcon,
    EyeIcon,
    EyeOffIcon,
    FavoriteIcon,
    HelpIcon,
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
    StarIcon,
    SuccessIcon,
    TestIcon,
    TranslateIcon,
    UploadIcon,
    WarningIcon
} from "./Glyphs"

//
// 图标映射表
export const iconMap: Record<string, React.FC> = {
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
