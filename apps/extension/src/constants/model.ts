import { AiModel_Platform_Enum } from "@/types"

/** 支持“思考能力”请求参数的平台。 */
export const THINKING_CAPABLE_PLATFORMS = new Set<AiModel_Platform_Enum>([
    AiModel_Platform_Enum.DEEPSEEK,
    AiModel_Platform_Enum.MOONSHOT,
    AiModel_Platform_Enum.BAILIAN,
    AiModel_Platform_Enum.HUOSHAN,
    AiModel_Platform_Enum.GEMINI,
    AiModel_Platform_Enum.ZHIPU,
    AiModel_Platform_Enum.HUNYUAN
])
