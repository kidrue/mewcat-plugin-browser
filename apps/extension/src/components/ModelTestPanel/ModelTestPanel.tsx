import React, { useCallback } from "react"

import { Button } from "@/components"
import { translateModelBatch } from "@/features/translation/modelTranslation"
import { AiRole } from "@/types"

import {
    SCxContainer,
    SCxDuration,
    SCxErrorText,
    SCxModelName,
    SCxProgressBar,
    SCxProgressFill,
    SCxProgressText,
    SCxResultItem,
    SCxResultLeft,
    SCxResultRight,
    SCxResultsContainer,
    SCxResultText,
    SCxStatusBadge,
    SCxSummary,
    SCxSummaryItem,
    SCxSummaryLabel,
    SCxSummaryValue
} from "./styles"
import type { ModelTestPanelProps, ModelTestResult, TestSummary } from "./types"

export const ModelTestPanel: React.FC<ModelTestPanelProps> = ({
    testText = "Hello, world!",
    targetLang = "zh-CN",
    modelList,
    onTestStart,
    onTestComplete
}) => {
    const [testing, setTesting] = React.useState(false)
    const [progress, setProgress] = React.useState(0)
    const [current, setCurrent] = React.useState(0)
    const [total, setTotal] = React.useState(0)
    const [results, setResults] = React.useState<ModelTestResult[]>([])

    const testAllModels = useCallback(
        async (
            text: string,
            onProgress: (
                result: ModelTestResult,
                currentIndex: number,
                totalCount: number
            ) => void
        ): Promise<ModelTestResult[]> => {
            if (modelList && modelList.length > 0) {
                const testResults: ModelTestResult[] = []
                for (let i = 0; i < modelList.length; i++) {
                    const model = modelList[i]
                    const startTime = Date.now()
                    let result: ModelTestResult
                    try {
                        const translatedText = await translateModelBatch(
                            model,
                            [{ role: "user", content: text }],
                            targetLang,
                            { aiRole: AiRole.DEFAULT }
                        )
                        result = {
                            model: model.params.modelName,
                            modelName: model.name,
                            success: true,
                            translatedText,
                            duration: Date.now() - startTime
                        }
                    } catch (error) {
                        result = {
                            model: model.params.modelName,
                            modelName: model.name,
                            success: false,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "未知错误",
                            duration: Date.now() - startTime
                        }
                    }
                    testResults.push(result)
                    onProgress(result, i + 1, modelList.length)
                }
                return testResults
            }

            return []
        },
        [modelList, targetLang]
    )

    const handleTest = useCallback(async () => {
        setTesting(true)
        setProgress(0)
        setCurrent(0)
        setTotal(0)
        setResults([])
        onTestStart?.()

        const testResults = await testAllModels(
            testText,
            (result, currentIndex, totalCount) => {
                setResults(prev => [...prev, result])
                setCurrent(currentIndex)
                setTotal(totalCount)
                setProgress((currentIndex / totalCount) * 100)
            }
        )

        setTesting(false)
        onTestComplete?.(testResults)
    }, [onTestComplete, onTestStart, testAllModels, testText])

    const generateTestSummary = useCallback(
        (results: ModelTestResult[]): TestSummary => {
            return {
                total: results.length,
                success: results.filter(r => r.success).length,
                failed: results.length - results.filter(r => r.success).length,
                averageDuration:
                    results.reduce((acc, r) => acc + (r.duration || 0), 0) /
                    results.length,
                fastestModel: results.reduce(
                    (fastest, current) => {
                        if (
                            !fastest ||
                            (current.duration &&
                                current.duration < fastest.duration)
                        ) {
                            return current
                        }
                        return fastest
                    },
                    null as ModelTestResult | null
                ),
                slowestModel: results.reduce(
                    (slowest, current) => {
                        if (
                            !slowest ||
                            (current.duration &&
                                current.duration > slowest.duration)
                        ) {
                            return current
                        }
                        return slowest
                    },
                    null as ModelTestResult | null
                )
            }
        },
        []
    )

    const summary = results.length > 0 ? generateTestSummary(results) : null

    return (
        <SCxContainer>
            <Button onClick={handleTest} disabled={testing} type="primary">
                {testing ? "测试中..." : "一键测试所有模型"}
            </Button>

            {testing && (
                <>
                    <SCxProgressBar>
                        <SCxProgressFill progress={progress} />
                    </SCxProgressBar>
                    <SCxProgressText>
                        正在测试: {current} / {total}
                    </SCxProgressText>
                </>
            )}
            {summary && (
                <SCxSummary>
                    <SCxSummaryItem>
                        <SCxSummaryLabel>总模型数</SCxSummaryLabel>
                        <SCxSummaryValue type="normal">
                            {summary.total}
                        </SCxSummaryValue>
                    </SCxSummaryItem>
                    <SCxSummaryItem>
                        <SCxSummaryLabel>成功</SCxSummaryLabel>
                        <SCxSummaryValue type="success">
                            {summary.success}
                        </SCxSummaryValue>
                    </SCxSummaryItem>
                    <SCxSummaryItem>
                        <SCxSummaryLabel>失败</SCxSummaryLabel>
                        <SCxSummaryValue type="error">
                            {summary.failed}
                        </SCxSummaryValue>
                    </SCxSummaryItem>
                    <SCxSummaryItem>
                        <SCxSummaryLabel>平均耗时</SCxSummaryLabel>
                        <SCxSummaryValue type="normal">
                            {summary.averageDuration.toFixed(0)}ms
                        </SCxSummaryValue>
                    </SCxSummaryItem>
                    {summary.fastestModel && (
                        <SCxSummaryItem>
                            <SCxSummaryLabel>最快模型</SCxSummaryLabel>
                            <SCxSummaryValue type="normal">
                                {summary.fastestModel.modelName}
                            </SCxSummaryValue>
                        </SCxSummaryItem>
                    )}
                </SCxSummary>
            )}

            {results.length > 0 && (
                <SCxResultsContainer>
                    {results.map(result => (
                        <SCxResultItem
                            key={result.model}
                            success={result.success}
                        >
                            <SCxResultLeft>
                                <SCxModelName>{result.modelName}</SCxModelName>
                                {result.success ? (
                                    <SCxResultText>
                                        {result.translatedText}
                                    </SCxResultText>
                                ) : (
                                    <SCxErrorText>{result.error}</SCxErrorText>
                                )}
                            </SCxResultLeft>
                            <SCxResultRight>
                                <SCxStatusBadge success={result.success}>
                                    {result.success ? "成功" : "失败"}
                                </SCxStatusBadge>
                                {result.duration !== undefined && (
                                    <SCxDuration>
                                        {result.duration}ms
                                    </SCxDuration>
                                )}
                            </SCxResultRight>
                        </SCxResultItem>
                    ))}
                </SCxResultsContainer>
            )}
        </SCxContainer>
    )
}
