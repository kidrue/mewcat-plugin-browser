import type { MicrosoftTranslateRequestConfig } from "@/types/request"

// cspell:ignore ttranslatev
const ORIGIN = "https://cn.bing.com"
const MAX_TEXT_LENGTH = 5000
const BATCH_SEPARATOR = "\n\n%%\n\n"
interface Credentials {
    key: string
    token: string
    ig: string
    iid: string
    expiresAt: number
}
let cachedCredentials: Credentials | undefined

const languageAliases: Record<string, string> = {
    "zh-CN": "zh-Hans",
    "zh-TW": "zh-Hant",
    "zh-HK": "zh-Hant",
    zh: "zh-Hans",
    no: "nb",
    sr: "sr-Cyrl",
    auto: "auto-detect"
}

async function getCredentials(signal: AbortSignal): Promise<Credentials> {
    if (cachedCredentials && cachedCredentials.expiresAt > Date.now()) {
        return cachedCredentials
    }
    const response = await fetch(`${ORIGIN}/translator`, {
        signal,
        credentials: "omit"
    })
    if (!response.ok) {
        throw new Error(`微软翻译鉴权失败：HTTP ${response.status}`)
    }
    const html = await response.text()
    const auth = html.match(/params_AbusePreventionHelper\s*=\s*(\[[^\]]+\])/)
    const ig = html.match(/IG:"([^"]+)"/)?.[1]
    const iid = html.match(/data-iid="(translator\.[^"]+)"/)?.[1]
    let params: unknown
    try {
        params = JSON.parse(auth?.[1] || "null")
    } catch {
        params = null
    }
    if (
        !Array.isArray(params) ||
        typeof params[0] !== "number" ||
        typeof params[1] !== "string" ||
        !params[1] ||
        !ig ||
        !iid
    ) {
        throw new Error("微软翻译鉴权响应无法识别，请稍后重试")
    }
    const lifetime =
        typeof params[2] === "number" && Number.isFinite(params[2])
            ? params[2]
            : 600_000
    signal.throwIfAborted()
    cachedCredentials = {
        key: String(params[0]),
        token: params[1],
        ig,
        iid,
        expiresAt:
            Date.now() + Math.max(0, Math.min(lifetime, 600_000) - 30_000)
    }
    return cachedCredentials
}

export async function requestMicrosoftTranslation(
    config: MicrosoftTranslateRequestConfig,
    signal: AbortSignal
): Promise<string> {
    let remaining = config.text
    let translated = ""
    // Keep all chunks under one controller so cancellation also stops queued chunks.
    while (remaining.length > MAX_TEXT_LENGTH) {
        signal.throwIfAborted()
        const batchBoundary = remaining.lastIndexOf(
            BATCH_SEPARATOR,
            MAX_TEXT_LENGTH
        )
        let end = MAX_TEXT_LENGTH
        let separator = ""
        if (batchBoundary >= 0) {
            end = batchBoundary
            separator = BATCH_SEPARATOR
        } else {
            const wordBoundary = Math.max(
                remaining.lastIndexOf("\n", end - 1),
                remaining.lastIndexOf(" ", end - 1)
            )
            if (wordBoundary > MAX_TEXT_LENGTH / 2) {
                end = wordBoundary
                separator = remaining[end]
            }
            if (/[\uD800-\uDBFF]/u.test(remaining[end - 1])) {
                end--
            }
        }
        translated += await requestMicrosoftChunk(
            { ...config, text: remaining.slice(0, end) },
            signal
        )
        translated += separator
        remaining = remaining.slice(end + separator.length)
    }
    signal.throwIfAborted()
    return (
        translated +
        (await requestMicrosoftChunk({ ...config, text: remaining }, signal))
    )
}

async function requestMicrosoftChunk(
    config: MicrosoftTranslateRequestConfig,
    signal: AbortSignal
): Promise<string> {
    if (!config.text) {
        return ""
    }
    for (let attempt = 0; attempt < 2; attempt++) {
        const auth = await getCredentials(signal)
        const query = new URLSearchParams({
            isVertical: "1",
            IG: auth.ig,
            IID: `${auth.iid}.1`
        })
        const response = await fetch(`${ORIGIN}/ttranslatev3?${query}`, {
            method: "POST",
            signal,
            credentials: "omit",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: new URLSearchParams({
                fromLang:
                    languageAliases[config.sourceLanguage || "auto"] ||
                    config.sourceLanguage ||
                    "auto-detect",
                to:
                    languageAliases[config.targetLanguage] ||
                    config.targetLanguage,
                text: config.text,
                token: auth.token,
                key: auth.key
            })
        })
        if (response.status === 401 || response.status === 403) {
            if (cachedCredentials === auth) {
                cachedCredentials = undefined
            }
            if (attempt === 0) {
                continue
            }
        }
        if (!response.ok) {
            throw new Error(`微软翻译请求失败：HTTP ${response.status}`)
        }
        let result: unknown
        try {
            result = await response.json()
        } catch {
            throw new Error("微软翻译返回了无法识别的响应")
        }
        // Bing may report authentication and throttling errors inside an HTTP 200 response.
        const status =
            result && typeof result === "object" && "statusCode" in result
                ? result.statusCode
                : undefined
        if (status === 401 || status === 403) {
            if (cachedCredentials === auth) {
                cachedCredentials = undefined
            }
            if (attempt === 0) {
                continue
            }
        }
        if (typeof status === "number" && status >= 400) {
            throw new Error(`微软翻译请求失败：HTTP ${status}`)
        }
        const text: unknown = Array.isArray(result)
            ? result[0]?.translations?.[0]?.text
            : undefined
        if (typeof text !== "string") {
            throw new Error("微软翻译返回了无法识别的响应")
        }
        return text
    }
    throw new Error("微软翻译鉴权失败，请稍后重试")
}
