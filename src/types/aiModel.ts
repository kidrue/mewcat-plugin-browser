export enum AiModel_Platform_Enum {
    HUOSHAN = "huoshan",
    BAILIAN = "bailian",
    ZHIPU = "ZHIPU",
    HUNYUAN = "HUNYUAN",
    DEEPSEEK = "DEEPSEEK",
    OPENAI = "OPENAI",
    MOONSHOT = "MOONSHOT",
    GEMINI = "GEMINI",
    DEEPL = "DEEPL",
    DEEPLX = "DEEPLX"
}

export interface BaseModel {
    /** 唯一标识符 */
    id: string
    /** 模型类型（必传） */
    type: AiModel_Platform_Enum
    /** 是否可用 */
    enabled: boolean
    /** 模型名称（必传） */
    name: string
    /** 模型能力声明；显式声明会覆盖内置推断 */
    capabilities?: {
        vision?: boolean
    }
    /** 模型配置 */
    params: {
        /** 实际发给 API 的模型标识符（如 gpt-3.5-turbo、deepseek-chat） */
        modelName: string
        /** 是否使用官方默认地址（true=官方且不可编辑 baseUrl，false=自定义可编辑 baseUrl） */
        isOfficial?: boolean
        /** 基础URL（可选） */
        baseUrl?: string
        /** 接入点 */
        endpoint?: string
        /** API密钥（必传） */
        apiKey: string
    }
}

export interface CommonMessage {
    /** 消息角色（必传） */
    role: "user" | "system"
    /** 消息内容（必传） */
    content: string
}

export type LLMModel =
    | MOONSHOT_LLM
    | GEMINI_LLM
    | DEEPSEEK_LLM
    | QWEN_LLM
    | HUNYUAN_LLM
    | OPENAI_LLM
    | ZHIPU_LLM
    | DOU_BAO_LLM

export enum GEMINI_LLM {
    Gemini_2_5_Pro = 100001,
    Gemini_2_5_Flash = 100003,
    Gemini_2_5_Flash_Lite = 100004,
    Gemini_3_Pro = 100006,
    Gemini_3_Flash = 100007
}

export enum DEEPSEEK_LLM {
    DEEPSEEK_CHAT = 200001,
    DEEPSEEK_REASONER = 200002
}

export enum QWEN_LLM {
    // ==================== 文本生成（Qwen3系列）====================
    QWEN3_MAX = 300001, // 旗舰文本模型，100万Token上下文，复杂任务首选
    QWEN3_PLUS = 300002, // 平衡效果与成本，131K上下文，多轮对话/创意写作
    QWEN3_TURBO = 300003, // 高性价比，60-100 Token/秒输出，基础翻译/问答
    QWEN3_LONG = 300004 // 超长文档模型，1000万Token上下文，合同审查/论文总结
}

export enum HUNYUAN_LLM {
    HY_2_0_THINK = 400001,
    HY_2_0_INSTRUCT = 400002,
    HUNYUAN_TRANSLATION = 400003,
    HUNYUAN_TRANSLATION_LITE = 400004
}

export enum OPENAI_LLM {
    GPT_5 = 500001,
    GPT_5_CHAT = 500002,
    GPT_5_MINI = 500003,
    GPT_5_NANO = 500004,
    GPT_5_2 = 500005,
    GPT_5_2_PRO = 500006
}

export enum MOONSHOT_LLM {
    KIMI_K2_0905_PREVIEW = 600001,
    KIMI_K2_0711_PREVIEW = 600002,
    KIMI_K2_TURBO_PREVIEW = 600003,
    KIMI_K2_THINKING = 600004,
    KIMI_K2_THINKING_TURBO = 600005,
    KIMI_K2_2_5 = 600006
}

export enum ZHIPU_LLM {
    GLM_4_PLUS = 700001,
    GLM_4_AIR_250414 = 700002,
    GLM_4_AIRX = 700003,
    GLM_4_LONG = 700004,
    GLM_4_FLASHX = 700005,
    GLM_4_FLASH_250414 = 700006,
    GLM_4V_PLUS_0111 = 700007,
    GLM_4V_FLASH = 700008
}

export enum DOU_BAO_LLM {
    DOUBAO_SEED_1_8_251228 = 800001,
    GLM_4_7_251222 = 800002,
    DOUBAO_SEED_CODE_PREVIEW_251028 = 800003,
    DOUBAO_SEED_1_6_LITE_251015 = 800004,
    DOUBAO_SEED_1_6_FLASH_250828 = 800005,
    DOUBAO_SEED_1_6_VISION_250815 = 800006
}

export type ModelOption = {
    /**
     * @generated from field: schema.LLMModel model = 1;
     */
    model: LLMModel

    /**
     * @generated from field: int32 try_cnt = 2;
     */
    tryCnt: number
}
