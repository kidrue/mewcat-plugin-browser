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
