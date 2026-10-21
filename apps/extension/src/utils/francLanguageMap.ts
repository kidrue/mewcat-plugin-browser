/**
 * Mapping from franc's ISO 639-3 language codes to i18n common codes
 * franc returns 3-letter ISO 639-3 codes, we need to map them to 2-letter ISO 639-1 codes
 * used in our translation system
 */
export const francToI18nMap = new Map<string, string>([
    // Chinese variants
    ["cmn", "zh"], // Mandarin Chinese (Simplified)

    // Major European languages
    ["eng", "en"], // English
    ["fra", "fr"], // French
    ["deu", "de"], // German
    ["spa", "es"], // Spanish
    ["por", "pt"], // Portuguese
    ["ita", "it"], // Italian
    ["rus", "ru"], // Russian
    ["nld", "nl"], // Dutch
    ["pol", "pl"], // Polish
    ["ukr", "uk"], // Ukrainian
    ["ces", "cs"], // Czech
    ["swe", "sv"], // Swedish
    ["dan", "da"], // Danish
    ["nor", "no"], // Norwegian
    ["fin", "fi"], // Finnish
    ["ell", "el"], // Greek
    ["heb", "he"], // Hebrew
    ["ron", "ro"], // Romanian
    ["hun", "hu"], // Hungarian
    ["bul", "bg"], // Bulgarian
    ["slk", "sk"], // Slovak
    ["slv", "sl"], // Slovenian
    ["hrv", "hr"], // Croatian
    ["srp", "sr"], // Serbian
    ["lit", "lt"], // Lithuanian
    ["lav", "lv"], // Latvian
    ["est", "et"], // Estonian
    ["tur", "tr"], // Turkish

    // Asian languages
    ["jpn", "ja"], // Japanese
    ["kor", "ko"], // Korean
    ["tha", "th"], // Thai
    ["vie", "vi"], // Vietnamese
    ["ind", "id"], // Indonesian
    ["msa", "ms"], // Malay
    ["hin", "hi"], // Hindi
    ["ben", "bn"], // Bengali
    ["tam", "ta"], // Tamil
    ["tel", "te"], // Telugu
    ["mar", "mr"], // Marathi
    ["guj", "gu"], // Gujarati
    ["urd", "ur"], // Urdu

    // Middle Eastern and African languages
    ["ara", "ar"], // Arabic
    ["fas", "fa"], // Persian/Farsi
    ["swa", "sw"], // Swahili
    ["afr", "af"] // Afrikaans
])

/**
 * Convert franc language code to i18n common code
 * @param francCode - The 3-letter ISO 639-3 code returned by franc
 * @returns The corresponding i18n common code or 'en' as fallback
 */
export function francToI18n(francCode: string): string {
    return francToI18nMap.get(francCode) || "en"
}

/**
 * 简体中文常用字符集（部分）
 */
const SIMPLIFIED_CHARS = new Set([
    "个",
    "这",
    "那",
    "们",
    "会",
    "说",
    "过",
    "来",
    "对",
    "时",
    "间",
    "问",
    "题",
    "现",
    "在",
    "还",
    "没",
    "有",
    "也",
    "就",
    "已",
    "经",
    "只",
    "能",
    "而",
    "且",
    "又",
    "或",
    "者",
    "但",
    "是",
    "如",
    "果",
    "因",
    "为",
    "所",
    "以",
    "关",
    "于",
    "从",
    "到",
    "让",
    "使",
    "得",
    "给",
    "把",
    "被",
    "向",
    "往",
    "去",
    "回",
    "开",
    "始",
    "结",
    "束",
    "进",
    "行",
    "发",
    "展",
    "变",
    "化",
    "成",
    "长",
    "提",
    "高",
    "改",
    "善",
    "解",
    "决",
    "处",
    "理",
    "管",
    "控",
    "制",
    "建",
    "设",
    "构",
    "造",
    "创",
    "新",
    "产",
    "生",
    "出",
    "现",
    "实",
    "际",
    "理",
    "论",
    "方",
    "式",
    "法",
    "则",
    "规",
    "律",
    "标",
    "准",
    "要",
    "求",
    "条",
    "件",
    "环",
    "境",
    "情",
    "况",
    "状",
    "态",
    "程",
    "度",
    "水",
    "平",
    "质",
    "量",
    "数",
    "据",
    "信",
    "息",
    "内",
    "容",
    "形",
    "式",
    "结",
    "构",
    "功",
    "能",
    "作",
    "用",
    "影",
    "响",
    "效",
    "果",
    "价",
    "值",
    "意",
    "义",
    "目",
    "的",
    "任",
    "务",
    "责",
    "任",
    "权",
    "利",
    "益",
    "损",
    "失",
    "风",
    "险",
    "机",
    "会",
    "选",
    "择",
    "决",
    "定",
    "计",
    "划",
    "安",
    "排",
    "组",
    "织",
    "协",
    "调",
    "配",
    "合",
    "支",
    "持",
    "帮",
    "助",
    "服",
    "务",
    "保",
    "证",
    "确",
    "保",
    "维",
    "护",
    "修",
    "复",
    "完",
    "善",
    "优",
    "化",
    "升",
    "级",
    "更",
    "新",
    "替",
    "换",
    "增",
    "加",
    "减",
    "少",
    "扩",
    "大",
    "缩",
    "小"
])

/**
 * 繁体中文常用字符集（部分）
 */
const TRADITIONAL_CHARS = new Set([
    "個",
    "這",
    "那",
    "們",
    "會",
    "說",
    "過",
    "來",
    "對",
    "時",
    "間",
    "問",
    "題",
    "現",
    "在",
    "還",
    "沒",
    "有",
    "也",
    "就",
    "已",
    "經",
    "只",
    "能",
    "而",
    "且",
    "又",
    "或",
    "者",
    "但",
    "是",
    "如",
    "果",
    "因",
    "為",
    "所",
    "以",
    "關",
    "於",
    "從",
    "到",
    "讓",
    "使",
    "得",
    "給",
    "把",
    "被",
    "向",
    "往",
    "去",
    "回",
    "開",
    "始",
    "結",
    "束",
    "進",
    "行",
    "發",
    "展",
    "變",
    "化",
    "成",
    "長",
    "提",
    "高",
    "改",
    "善",
    "解",
    "決",
    "處",
    "理",
    "管",
    "控",
    "制",
    "建",
    "設",
    "構",
    "造",
    "創",
    "新",
    "產",
    "生",
    "出",
    "現",
    "實",
    "際",
    "理",
    "論",
    "方",
    "式",
    "法",
    "則",
    "規",
    "律",
    "標",
    "準",
    "要",
    "求",
    "條",
    "件",
    "環",
    "境",
    "情",
    "況",
    "狀",
    "態",
    "程",
    "度",
    "水",
    "平",
    "質",
    "量",
    "數",
    "據",
    "信",
    "息",
    "內",
    "容",
    "形",
    "式",
    "結",
    "構",
    "功",
    "能",
    "作",
    "用",
    "影",
    "響",
    "效",
    "果",
    "價",
    "值",
    "意",
    "義",
    "目",
    "的",
    "任",
    "務",
    "責",
    "任",
    "權",
    "利",
    "益",
    "損",
    "失",
    "風",
    "險",
    "機",
    "會",
    "選",
    "擇",
    "決",
    "定",
    "計",
    "劃",
    "安",
    "排",
    "組",
    "織",
    "協",
    "調",
    "配",
    "合",
    "支",
    "持",
    "幫",
    "助",
    "服",
    "務",
    "保",
    "證",
    "確",
    "保",
    "維",
    "護",
    "修",
    "復",
    "完",
    "善",
    "優",
    "化",
    "升",
    "級",
    "更",
    "新",
    "替",
    "換",
    "增",
    "加",
    "減",
    "少",
    "擴",
    "大",
    "縮",
    "小"
])

/**
 * 检测文本是简体中文还是繁体中文
 * @param text - 要检测的中文文本
 * @returns 'zh-CN' for simplified Chinese, 'zh-TW' for traditional Chinese, null if unclear
 */
export function detectChineseVariant(text: string): "zh-CN" | "zh-TW" | null {
    if (!text || typeof text !== "string") {
        return null
    }

    // 移除标点符号和数字，只保留中文字符
    const chineseChars = text.match(/[\u4e00-\u9fff]/g)
    if (!chineseChars || chineseChars.length < 3) {
        return null
    }

    let simplifiedCount = 0
    let traditionalCount = 0

    // 统计简体字和繁体字的出现次数
    for (const char of chineseChars) {
        if (SIMPLIFIED_CHARS.has(char)) {
            simplifiedCount++
        }
        if (TRADITIONAL_CHARS.has(char)) {
            traditionalCount++
        }
    }

    // 如果简体字或繁体字的比例超过20%，则认为是对应的变体
    const threshold = Math.max(chineseChars.length * 0.2, 2)

    if (simplifiedCount >= threshold && simplifiedCount > traditionalCount) {
        return "zh-CN"
    }
    if (traditionalCount >= threshold && traditionalCount > simplifiedCount) {
        return "zh-TW"
    }

    // 如果无法确定，默认返回简体中文
    return "zh-CN"
}

/**
 * 增强版语言检测，包含中文简繁体识别
 * @param francCode - franc返回的语言代码
 * @param originalText - 原始文本，用于中文简繁体检测
 * @returns 精确的语言代码
 */
export function getEnhancedLanguageCode(
    francCode: string,
    originalText?: string
): string {
    const baseCode = francToI18n(francCode)

    // 如果检测到中文且提供了原文，进行简繁体识别
    if ((baseCode === "zh-CN" || francCode === "cmn") && originalText) {
        const chineseVariant = detectChineseVariant(originalText)
        return chineseVariant || baseCode
    }

    return baseCode
}
