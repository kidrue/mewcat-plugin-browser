import type { BaseModel } from "@/types"

export interface ModelTestPanelProps {
    testText?: string
    targetLang?: string
    modelList?: BaseModel[]
    onTestStart?: () => void
    onTestComplete?: (results: ModelTestResult[]) => void
}

// 测试报告摘要
export interface TestSummary {
    total: number
    success: number
    failed: number
    averageDuration: number
    fastestModel?: ModelTestResult
    slowestModel?: ModelTestResult
}

// 模型测试结果
export interface ModelTestResult {
    model: string
    modelName: string
    success: boolean
    translatedText?: string
    error?: string
    duration?: number
}
