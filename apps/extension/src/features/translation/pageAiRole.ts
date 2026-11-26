import { AiRole, type ExtensionConfig } from "@/types/config"

export interface PageRoleContext {
    url?: string
    title?: string
    description?: string
}

type RoleSelectionConfig = Pick<ExtensionConfig, "aiRole" | "enableAutoAiRole">

const siteRoles: ReadonlyArray<readonly [AiRole, readonly string[]]> = [
    [AiRole.GITHUB_TRANSLATOR, ["github.com", "gitlab.com"]],
    [AiRole.TWITTER_TRANSLATOR, ["twitter.com", "x.com"]],
    [AiRole.REDDIT_TRANSLATOR, ["reddit.com"]],
    [AiRole.AO3_TRANSLATOR, ["archiveofourown.org"]],
    [AiRole.MEDICAL_TRANSLATOR, ["pubmed.ncbi.nlm.nih.gov", "medlineplus.gov"]],
    [
        AiRole.ACADEMIC_TRANSLATOR,
        ["arxiv.org", "nature.com", "sciencedirect.com", "scholar.google.com"]
    ],
    [AiRole.AI_TRANSLATOR, ["huggingface.co", "pytorch.org", "tensorflow.org"]],
    [AiRole.SECURITY_TRANSLATOR, ["nvd.nist.gov", "owasp.org", "cve.org"]],
    [
        AiRole.TECH_TRANSLATOR,
        ["developer.mozilla.org", "stackoverflow.com", "readthedocs.io"]
    ],
    [
        AiRole.NEWS_TRANSLATOR,
        ["bbc.com", "bbc.co.uk", "reuters.com", "apnews.com", "cnn.com"]
    ],
    [
        AiRole.ECOMMERCE_TRANSLATOR,
        [
            "amazon.com",
            "amazon.co.jp",
            "amazon.co.uk",
            "amazon.de",
            "ebay.com",
            "aliexpress.com"
        ]
    ],
    [AiRole.GAME_TRANSLATOR, ["store.steampowered.com", "ign.com"]],
    [AiRole.FINANCE_TRANSLATOR, ["finance.yahoo.com", "investopedia.com"]],
    [AiRole.ANIME_TRANSLATOR, ["myanimelist.net", "anilist.co"]],
    [
        AiRole.EDUCATION_TRANSLATOR,
        ["coursera.org", "edx.org", "khanacademy.org"]
    ],
    [AiRole.PHILOSOPHY_TRANSLATOR, ["plato.stanford.edu", "iep.utm.edu"]]
]

// 专门领域优先于宽泛领域；只选取内置角色，不把网页元数据拼入系统指令。
const topicRoles: ReadonlyArray<readonly [AiRole, RegExp]> = [
    [
        AiRole.SECURITY_TRANSLATOR,
        /\b(cybersecurity|vulnerability|vulnerabilities|cve-\d+|penetration testing)\b|网络安全|漏洞公告|渗透测试/i
    ],
    [
        AiRole.AI_TRANSLATOR,
        /\b(ai|machine learning|deep learning|neural networks?|large language models?|llm|generative ai)\b|人工智能|机器学习|深度学习|大语言模型/i
    ],
    [
        AiRole.MEDICAL_TRANSLATOR,
        /\b(medical|clinical|medicine|diagnosis|patient care)\b|医学|临床|诊疗|药理/i
    ],
    [
        AiRole.LEGAL_TRANSLATOR,
        /\b(legal|legislation|judicial|lawsuit)\b|法律|司法|诉讼/i
    ],
    [
        AiRole.PSYCHOLOGY_TRANSLATOR,
        /\b(psychology|psychological|psychotherapy)\b|心理学|认知心理|心理咨询/i
    ],
    [
        AiRole.PHILOSOPHY_TRANSLATOR,
        /\b(philosophy|philosophical|epistemology|metaphysics)\b|哲学|认识论|形而上学/i
    ],
    [
        AiRole.HISTORY_TRANSLATOR,
        /\b(history|historical|ancient civilizations?|archaeology)\b|历史|考古|古代文明/i
    ],
    [
        AiRole.SCIENCE_TRANSLATOR,
        /\b(physics|chemistry|biology|astronomy|quantum|geology)\b|物理|化学|生物学|天文学|自然科学/i
    ],
    [
        AiRole.ENGINEERING_TRANSLATOR,
        /\b(engineering|manufacturing|mechanical design|electrical circuits?)\b|工程技术|机械设计|制造工艺|电气工程/i
    ],
    [
        AiRole.SUBTITLE_TRANSLATOR,
        /\b(subtitles?|screenplay|film dialogue)\b|影视字幕|电影对白|剧本台词/i
    ],
    [
        AiRole.ANIME_TRANSLATOR,
        /\b(anime|manga|animation series)\b|动漫|动画番剧|漫画/i
    ],
    [
        AiRole.MARKETING_TRANSLATOR,
        /\b(marketing|advertising|copywriting|brand strategy)\b|营销|广告文案|品牌推广/i
    ],
    [
        AiRole.BUSINESS_TRANSLATOR,
        /\b(business|corporate|procurement|commercial negotiation)\b|商务|企业合作|商务邮件/i
    ],
    [
        AiRole.EDUCATION_TRANSLATOR,
        /\b(education|teaching|curriculum|textbook|pedagogy)\b|教育|教学|课程教材/i
    ],
    [
        AiRole.WEB3_TRANSLATOR,
        /\b(web3|blockchain|cryptocurrency|defi|smart contracts?)\b|区块链|加密货币|智能合约/i
    ],
    [
        AiRole.FINANCE_TRANSLATOR,
        /\b(finance|financial|investment|stock market)\b|金融|投资|证券/i
    ],
    [
        AiRole.GAME_TRANSLATOR,
        /\b(video games?|gaming|gameplay|walkthrough)\b|电子游戏|游戏攻略/i
    ],
    [
        AiRole.ECOMMERCE_TRANSLATOR,
        /\b(e-commerce|shopping|product specifications)\b|商品详情|购物|电商/i
    ],
    [
        AiRole.NEWS_TRANSLATOR,
        /\b(breaking news|news report|news headlines)\b|新闻报道|新闻资讯|时事新闻/i
    ],
    [
        AiRole.ACADEMIC_TRANSLATOR,
        /\b(research paper|academic|journal article|dissertation)\b|学术论文|研究论文|学位论文/i
    ],
    [
        AiRole.TECH_TRANSLATOR,
        /\b(api|javascript|typescript|programming|software|documentation)\b|技术文档|软件开发|编程/i
    ],
    [
        AiRole.FICTION_TRANSLATOR,
        /\b(fiction|novel|short story)\b|小说|文学创作/i
    ]
]

export function readPageRoleContext(): PageRoleContext {
    if (typeof document === "undefined") return {}
    return {
        url: document.location?.href,
        title: document.title,
        description: document.querySelector<HTMLMetaElement>(
            'meta[name="description"], meta[property="og:description"]'
        )?.content
    }
}

export function resolvePageAiRole(
    config: RoleSelectionConfig,
    context?: PageRoleContext
): AiRole {
    if (!config.enableAutoAiRole) return config.aiRole
    const page = context ?? readPageRoleContext()
    try {
        const url = new URL(page.url ?? "")
        if (url.protocol === "https:" || url.protocol === "http:") {
            const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
            const site = siteRoles.find(([, domains]) =>
                domains.some(
                    domain =>
                        hostname === domain || hostname.endsWith(`.${domain}`)
                )
            )
            if (site) return site[0]
        }
    } catch {
        // URL 缺失或无效时仍可通过元数据识别。
    }
    const metadata = `${page.title?.slice(0, 1000) ?? ""}\n${page.description?.slice(0, 2000) ?? ""}`
    return (
        topicRoles.find(([, pattern]) => pattern.test(metadata))?.[0] ??
        config.aiRole
    )
}
