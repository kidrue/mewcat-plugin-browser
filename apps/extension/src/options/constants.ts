import { AiModel_Platform_Enum } from "@/types"

interface ApiKeyFieldConfig {
    label: string
    required: boolean
    placeholder: string
    helperText: string
    helperLink?: { text: string; url: string }
}

interface AiModelUiConfig {
    type: AiModel_Platform_Enum
    title: string
    description: string
    items: ["apiKey"]
    fields: { apiKey: ApiKeyFieldConfig }
}

const provider = (
    type: AiModel_Platform_Enum,
    title: string,
    description: string,
    placeholder: string,
    helperText: string,
    helperLink?: ApiKeyFieldConfig["helperLink"]
): AiModelUiConfig => ({
    type,
    title,
    description,
    items: ["apiKey"],
    fields: {
        apiKey: {
            label: `${title} API Key`,
            required: true,
            placeholder,
            helperText,
            helperLink
        }
    }
})

export const AI_MODEL_UI_LIST: AiModelUiConfig[] = [
    provider(
        AiModel_Platform_Enum.HUOSHAN,
        "火山引擎",
        "使用火山引擎 AI 模型进行翻译",
        "请输入火山引擎 API Key",
        "填写后会自动获取当前账号可用的模型",
        { text: "获取 API Key", url: "https://console.volcengine.com/ark" }
    ),
    provider(
        AiModel_Platform_Enum.BAILIAN,
        "阿里百炼",
        "使用阿里百炼 AI 进行翻译",
        "请输入阿里百炼 API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://dashscope.console.aliyun.com/apiKey"
        }
    ),
    provider(
        AiModel_Platform_Enum.ZHIPU,
        "智谱",
        "使用智谱 AI 进行翻译",
        "请输入智谱 API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://open.bigmodel.cn/usercenter/apikeys"
        }
    ),
    provider(
        AiModel_Platform_Enum.HUNYUAN,
        "腾讯混元",
        "使用腾讯混元 AI 进行翻译",
        "请输入腾讯混元 API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://cloud.tencent.com/document/product/1729/101848"
        }
    ),
    provider(
        AiModel_Platform_Enum.DEEPSEEK,
        "DeepSeek",
        "使用 DeepSeek AI 进行翻译",
        "请输入 DeepSeek API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://platform.deepseek.com/api_keys"
        }
    ),
    provider(
        AiModel_Platform_Enum.OPENAI,
        "ChatGPT（OpenAI）",
        "使用 OpenAI 模型进行翻译",
        "请输入 OpenAI API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://platform.openai.com/api-keys"
        }
    ),
    provider(
        AiModel_Platform_Enum.MOONSHOT,
        "Moonshot（月之暗面）",
        "使用 Moonshot AI 进行翻译",
        "请输入 Moonshot API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://platform.moonshot.cn/console/api-keys"
        }
    ),
    provider(
        AiModel_Platform_Enum.GEMINI,
        "Gemini",
        "使用 Gemini 进行翻译",
        "请输入 Gemini API Key",
        "填写后会自动获取当前账号可用的模型",
        {
            text: "获取 API Key",
            url: "https://aistudio.google.com/app/apikey"
        }
    ),
    provider(
        AiModel_Platform_Enum.DEEPL,
        "DeepL",
        "使用 DeepL 固定翻译接口",
        "请输入 DeepL API Key",
        "DeepL 不需要选择模型",
        { text: "获取 API Key", url: "https://www.deepl.com/pro-api" }
    ),
    provider(
        AiModel_Platform_Enum.DEEPLX,
        "DeepLX",
        "使用 DeepLX 固定翻译接口",
        "请输入 DeepLX API Key",
        "DeepLX 不需要选择模型"
    )
]
