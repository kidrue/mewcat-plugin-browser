import React from "react"
import styled from "styled-components"

import { Button } from "@/components"
import { UniversalTranslator } from "@/translation/UniversalTranslator"
import { AiRole, type BaseModel } from "@/types"

const SCxContainer = styled.div`
    width: 100%;
`

const SCxProgressBar = styled.div`
    width: 100%;
    height: 4px;
    background: var(--gray-200);
    border-radius: var(--radius-sm);
    margin-top: var(--space-3);
    overflow: hidden;
`

const SCxProgressFill = styled.div<{ progress: number }>`
    height: 100%;
    width: ${props => props.progress}%;
    background: var(--primary-color);
    border-radius: var(--radius-full);
    transition: width var(--transition-base);
`

const SCxProgressText = styled.div`
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: center;
`

const SCxSummary = styled.div`
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-4);
`

const SCxSummaryItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
`

const SCxSummaryLabel = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-weight: var(--font-weight-normal);
`

const SCxSummaryValue = styled.span<{ type?: "success" | "error" | "normal" }>`
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: ${props => {
        if (props.type === "success") {
            return "var(--success)"
        }
        if (props.type === "error") {
            return "var(--error)"
        }
        return "var(--text-primary)"
    }};
`

const SCxResultsContainer = styled.div`
    margin-top: var(--space-4);
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);

    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: var(--gray-100);
        border-radius: var(--radius-sm);
    }

    &::-webkit-scrollbar-thumb {
        background: var(--gray-300);
        border-radius: var(--radius-sm);

        &:hover {
            background: var(--gray-400);
        }
    }
`

const SCxResultItem = styled.div<{ success: boolean }>`
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: ${props =>
        props.success ? "var(--success-bg)" : "var(--error-bg)"};
    transition: all var(--transition-fast);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: ${props =>
            props.success ? "var(--success-bg)" : "var(--error-bg)"};
        filter: brightness(0.98);
    }
`

const SCxResultLeft = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
`

const SCxModelName = styled.span`
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
`

const SCxResultText = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`

const SCxErrorText = styled.span`
    font-size: var(--font-size-xs);
    color: var(--error);
`

const SCxResultRight = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
    flex-shrink: 0;
`

const SCxStatusBadge = styled.span<{ success: boolean }>`
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: ${props => (props.success ? "var(--success)" : "var(--error)")};
    color: var(--text-inverse);
    line-height: 1;
`

const SCxDuration = styled.span`
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
`

interface ModelTestPanelProps {
    testText?: string
    targetLang?: string
    modelList?: BaseModel[]
    onTestStart?: () => void
    onTestComplete?: (results: ModelTestResult[]) => void
}

/**
 * 测试报告摘要
 */
export interface TestSummary {
    total: number
    success: number
    failed: number
    averageDuration: number
    fastestModel?: ModelTestResult
    slowestModel?: ModelTestResult
}
/**
 * 模型测试结果
 */
export interface ModelTestResult {
    model: string
    modelName: string
    success: boolean
    translatedText?: string
    error?: string
    duration?: number
}

const ModelTestPanel: React.FC<ModelTestPanelProps> = ({
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

    const testAllModels = async (
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

                const isOfficial = model.params.isOfficial !== false
                const baseUrl = isOfficial ? undefined : model.params.baseUrl

                const translator = new UniversalTranslator(model.type, {
                    apiKey: model.params.apiKey,
                    baseUrl,
                    model: model.params.modelName,
                    aiRole: AiRole.DEFAULT,
                    endpoint: model.params.endpoint
                })
                const testMessage = [
                    {
                        role: "user" as const,
                        content: "Hello, world!"
                    }
                ]
                try {
                    const translatedText = await translator.translateBatch(
                        testMessage,
                        "zh-CN"
                    )
                    const duration = Date.now() - startTime

                    setResults(prev => [
                        ...prev,
                        {
                            model: model.params.modelName,
                            modelName: model.name,
                            success: true,
                            translatedText,
                            duration
                        }
                    ])
                } catch (error) {
                    const duration = Date.now() - startTime
                    setResults(prev => [
                        ...prev,
                        {
                            model: model.params.modelName,
                            modelName: model.name,
                            success: false,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "未知错误",
                            duration
                        }
                    ])
                }
            }
        }

        return []
    }

    const handleTest = async () => {
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
    }

    const generateTestSummary = (results: ModelTestResult[]): TestSummary => {
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
    }

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

export default ModelTestPanel
