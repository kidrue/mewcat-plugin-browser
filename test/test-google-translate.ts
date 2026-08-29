import assert from "node:assert/strict"

import {
    createGoogleTranslateForm,
    normalizeGoogleTranslateTimeout,
    parseGoogleTranslateResponse
} from "../src/background/lib/google-translate"
import { handleTranslateRequest } from "../src/background/messages/translate-request"
import { GOOGLE_TRANSLATE_MODEL_ID } from "../src/constants/translationServices"
import { defaultExtensionConfig } from "../src/state/constants"
import {
    createTranslationServiceStorageAdapter,
    getTranslationServiceOptions,
    normalizeTranslationServiceSelection,
    resolveTranslationServiceId
} from "../src/state/translationService"
import { GoogleTranslator } from "../src/translation/GoogleTranslator"
import { translateSelectedText } from "../src/translation/selectionTranslation"
import { hasAITranslationEnabled } from "../src/translation/translationService"
import { AiModel_Platform_Enum, AiRole, type BaseModel } from "../src/types"
import {
    RequestType,
    type UnifiedRequestBody,
    type UnifiedResponse
} from "../src/types/request"

const createModel = (
    id: string,
    options: { enabled?: boolean; apiKey?: string } = {}
): BaseModel => ({
    id,
    type: AiModel_Platform_Enum.OPENAI,
    enabled: options.enabled ?? true,
    name: id,
    params: {
        modelName: "gpt-test",
        apiKey: options.apiKey ?? "configured-api-key"
    }
})

assert.equal(
    defaultExtensionConfig.currentModel,
    GOOGLE_TRANSLATE_MODEL_ID,
    "A fresh installation must select Google Translate"
)

const configuredModel = createModel("configured-model")
assert.equal(
    resolveTranslationServiceId({
        currentModel: configuredModel.id,
        aiModelList: [configuredModel]
    }),
    configuredModel.id,
    "An existing usable model selection must be preserved"
)

const fallbackModel = createModel("fallback-model")
assert.equal(
    resolveTranslationServiceId({
        currentModel: "missing-model",
        aiModelList: [
            createModel("disabled-model", { enabled: false }),
            createModel("missing-key-model", { apiKey: " " }),
            fallbackModel
        ]
    }),
    fallbackModel.id,
    "The first usable configured model must win before Google fallback"
)

assert.equal(
    resolveTranslationServiceId({
        currentModel: "missing-model",
        aiModelList: [
            createModel("disabled-model", { enabled: false }),
            createModel("missing-key-model", { apiKey: "" })
        ]
    }),
    GOOGLE_TRANSLATE_MODEL_ID,
    "Users without a usable model must fall back to Google Translate"
)

assert.equal(
    resolveTranslationServiceId({
        currentModel: GOOGLE_TRANSLATE_MODEL_ID,
        aiModelList: [configuredModel]
    }),
    GOOGLE_TRANSLATE_MODEL_ID,
    "An explicit Google Translate selection must not be replaced by an AI model"
)

const staleConfig = {
    currentModel: "missing-model",
    aiModelList: [createModel("missing-key-model", { apiKey: "" })]
}
const normalizedConfig = normalizeTranslationServiceSelection(staleConfig)
assert.equal(normalizedConfig.currentModel, GOOGLE_TRANSLATE_MODEL_ID)
assert.equal(
    staleConfig.currentModel,
    "missing-model",
    "Normalizing stored configuration must not mutate the original value"
)

const persistedConfigs: (typeof defaultExtensionConfig)[] = []
const staleStoredConfig = {
    ...defaultExtensionConfig,
    currentModel: "missing-model",
    aiModelList: []
}
const migrationAdapter = createTranslationServiceStorageAdapter({
    getItem: async () => staleStoredConfig,
    setItem: async (_key, value) => {
        persistedConfigs.push(value)
    },
    removeItem: async () => {},
    subscribe: () => () => {}
})
const migratedConfig = await migrationAdapter.getItem(
    "extension-config",
    defaultExtensionConfig
)
assert.equal(migratedConfig.currentModel, GOOGLE_TRANSLATE_MODEL_ID)
assert.equal(persistedConfigs.length, 1)
assert.equal(
    persistedConfigs[0]?.currentModel,
    GOOGLE_TRANSLATE_MODEL_ID,
    "A normalized legacy selection must be persisted back to extension storage"
)

assert.deepEqual(
    getTranslationServiceOptions([
        configuredModel,
        createModel("disabled-model", { enabled: false }),
        createModel("missing-key-model", { apiKey: "" })
    ]),
    [
        { value: GOOGLE_TRANSLATE_MODEL_ID, label: "Google Translate" },
        { value: configuredModel.id, label: configuredModel.name }
    ],
    "Service selectors must show Google and only usable AI models"
)

let selectedTextTargetLanguage = ""
assert.equal(
    await translateSelectedText(
        {
            translateText: async (_messages, targetLanguage) => {
                selectedTextTargetLanguage = targetLanguage
                return "Bonjour"
            }
        },
        "Hello",
        { targetLanguage: "fr" }
    ),
    "Bonjour"
)
assert.equal(
    selectedTextTargetLanguage,
    "fr",
    "Selection translation must use the configured target language"
)

assert.equal(
    createGoogleTranslateForm({
        text: "Hello world",
        targetLanguage: "zh-CN"
    }).toString(),
    "client=gtx&sl=auto&tl=zh-CN&dt=t&q=Hello+world",
    "Google requests must use the selected target language and automatic source detection"
)

assert.equal(normalizeGoogleTranslateTimeout(), 30_000)
assert.equal(normalizeGoogleTranslateTimeout(0), 1)
assert.equal(
    normalizeGoogleTranslateTimeout(60_000),
    30_000,
    "Google requests must never run longer than 30 seconds"
)

const multiSegmentResponse = [
    [
        ["你好世界\n\n", "Hello world\n\n", null, null, 3],
        ["%%\n\n", "%%\n\n", null, null, 3],
        ["早上好", "Good morning", null, null, 3]
    ],
    null,
    "en"
]

assert.equal(
    parseGoogleTranslateResponse(multiSegmentResponse),
    "你好世界\n\n%%\n\n早上好",
    "All translated response fragments must be concatenated in their original order"
)

assert.throws(
    () => parseGoogleTranslateResponse([]),
    /Google 翻译返回了无法识别的响应/,
    "Malformed Google responses must surface a clear error"
)

const originalFetch = globalThis.fetch
try {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    globalThis.fetch = async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify(multiSegmentResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        })
    }

    const successResponse = await handleTranslateRequest({
        type: RequestType.GOOGLE_TRANSLATE,
        config: {
            text: "Hello world\n\n%%\n\nGood morning",
            targetLanguage: "zh-CN",
            timeout: 30_000
        }
    })

    assert.equal(successResponse.success, true)
    assert.equal(successResponse.content, "你好世界\n\n%%\n\n早上好")
    assert.equal(
        capturedUrl,
        "https://translate.googleapis.com/translate_a/single"
    )
    assert.equal(capturedInit?.method, "POST")
    assert.equal(
        new Headers(capturedInit?.headers).get("content-type"),
        "application/x-www-form-urlencoded;charset=UTF-8"
    )
    assert.equal(
        String(capturedInit?.body),
        "client=gtx&sl=auto&tl=zh-CN&dt=t&q=Hello+world%0A%0A%25%25%0A%0AGood+morning"
    )

    globalThis.fetch = async () => new Response("rate limited", { status: 429 })

    const rateLimitedResponse = await handleTranslateRequest({
        type: RequestType.GOOGLE_TRANSLATE,
        config: {
            text: "Hello",
            targetLanguage: "zh-CN"
        }
    })

    assert.equal(rateLimitedResponse.success, false)
    assert.match(
        rateLimitedResponse.error || "",
        /Google 翻译请求失败：HTTP 429/
    )

    globalThis.fetch = async () =>
        new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "application/json" }
        })

    const invalidJsonResponse = await handleTranslateRequest({
        type: RequestType.GOOGLE_TRANSLATE,
        config: {
            text: "Hello",
            targetLanguage: "zh-CN"
        }
    })

    assert.equal(invalidJsonResponse.success, false)
    assert.match(
        invalidJsonResponse.error || "",
        /Google 翻译返回了无法识别的响应/
    )

    globalThis.fetch = async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal
            if (!signal) {
                reject(new Error("Missing abort signal"))
                return
            }
            signal.addEventListener(
                "abort",
                () =>
                    reject(
                        signal.reason ||
                            new DOMException("Aborted", "AbortError")
                    ),
                { once: true }
            )
        })

    const pendingAbortResponse = handleTranslateRequest({
        type: RequestType.GOOGLE_TRANSLATE,
        config: {
            text: "Hello",
            targetLanguage: "zh-CN"
        }
    })
    const abortResponse = await handleTranslateRequest({
        type: RequestType.ABORT,
        config: null
    })
    const explicitlyAbortedResponse = await pendingAbortResponse

    assert.equal(abortResponse.success, true)
    assert.equal(explicitlyAbortedResponse.success, false)
    assert.match(
        explicitlyAbortedResponse.error || "",
        /Google 翻译请求已取消/,
        "Explicit cancellation must not be reported as a timeout"
    )

    const timeoutResponse = await handleTranslateRequest({
        type: RequestType.GOOGLE_TRANSLATE,
        config: {
            text: "Hello",
            targetLanguage: "zh-CN",
            timeout: 1
        }
    })

    assert.equal(timeoutResponse.success, false)
    assert.match(timeoutResponse.error || "", /Google 翻译请求超时/)
} finally {
    globalThis.fetch = originalFetch
}

const sentRequests: UnifiedRequestBody[] = []
const googleTranslator = new GoogleTranslator(
    async (request): Promise<UnifiedResponse> => {
        sentRequests.push(request)
        return { success: true, content: "你好世界" }
    }
)

assert.equal(googleTranslator.provider, GOOGLE_TRANSLATE_MODEL_ID)
assert.equal(
    await googleTranslator.translateText(
        [{ role: "user", content: "Hello world" }],
        "zh-CN"
    ),
    "你好世界"
)
assert.deepEqual(sentRequests[0], {
    type: RequestType.GOOGLE_TRANSLATE,
    config: {
        text: "Hello world",
        targetLanguage: "zh-CN",
        timeout: 30_000
    }
})

assert.equal(
    await googleTranslator.translateBatch(
        [
            { role: "user", content: "Hello world" },
            { role: "user", content: "Good morning" }
        ],
        "fr"
    ),
    "你好世界"
)
assert.deepEqual(sentRequests[1], {
    type: RequestType.GOOGLE_TRANSLATE,
    config: {
        text: "Hello world\n\n%%\n\nGood morning",
        targetLanguage: "fr",
        timeout: 30_000
    }
})

const failingTranslator = new GoogleTranslator(async () => ({
    success: false,
    error: "Google 翻译请求失败：HTTP 429"
}))
await assert.rejects(
    () =>
        failingTranslator.translateText(
            [{ role: "user", content: "Hello" }],
            "zh-CN"
        ),
    /Google 翻译请求失败：HTTP 429/
)

const googleRuntimeConfig = {
    currentModel: GOOGLE_TRANSLATE_MODEL_ID,
    aiModelList: [configuredModel],
    aiRole: AiRole.DEFAULT
}
assert.equal(
    hasAITranslationEnabled(googleRuntimeConfig),
    false,
    "Google selection must not enable AI-only context behavior"
)
assert.equal(
    resolveTranslationServiceId(googleRuntimeConfig),
    GOOGLE_TRANSLATE_MODEL_ID,
    "Google selection must stay on the traditional translation route"
)

console.log("Google Translate configuration and parser tests passed")
