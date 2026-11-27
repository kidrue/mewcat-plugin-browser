import React, { useCallback, useEffect, useMemo, useState } from "react"
import styled from "styled-components"

import { OptionsPageIntro } from "@/components/OptionsPageLayout"
import OptionsSection from "@/components/OptionsSection"
import {
    Actions,
    Button,
    Card,
    CardLabel,
    Cards,
    CharacterUsage,
    Empty,
    ErrorMessage,
    format,
    Management,
    Table,
    TableWrap,
    Total
} from "@/components/UsageStats"
import { clearTokenUsage, readTokenUsage } from "@/features/token-usage"
import type {
    TokenUsageEntry,
    TokenUsageFeature,
    TokenUsageStore
} from "@/features/token-usage"

const Page = styled.div`
    display: grid;
    gap: var(--space-6);

    > * {
        min-width: 0;
        margin-bottom: 0;
    }
`
const Breakdown = styled.div`
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
`
const SourceSummary = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);

    > div + div {
        border-left: 1px solid var(--border-light);
        padding-left: var(--space-6);
    }

    strong {
        display: block;
        margin-bottom: var(--space-2);
        color: var(--text-primary);
        font-size: var(--font-size-base);
    }

    p {
        margin: 0;
        line-height: var(--line-height-relaxed);
    }

    @media (max-width: 760px) {
        grid-template-columns: 1fr;

        > div + div {
            border-left: 0;
            border-top: 1px solid var(--border-light);
            padding-left: 0;
            padding-top: var(--space-5);
        }
    }
`
const FEATURE_LABELS: Record<TokenUsageFeature, string> = {
    "page-translation": "网页翻译",
    "selection-translation": "划词翻译",
    "concept-explanation": "概念解释",
    "page-summary": "页面摘要",
    "image-translation": "图片翻译"
}

const dateOffset = (days: number) => {
    const value = new Date()
    value.setDate(value.getDate() - days)
    return value.toISOString().slice(0, 10)
}
const totalsSince = (entries: TokenUsageEntry[], days: number) =>
    entries
        .filter(entry => entry.date >= dateOffset(days - 1))
        .reduce(
            (sum, entry) => ({
                input: sum.input + entry.inputTokens,
                output: sum.output + entry.outputTokens,
                total: sum.total + entry.totalTokens
            }),
            { input: 0, output: 0, total: 0 }
        )

export const TokenUsage: React.FC = () => {
    const [store, setStore] = useState<TokenUsageStore>({
        version: 1,
        entries: []
    })
    const [loaded, setLoaded] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [clearError, setClearError] = useState(false)

    useEffect(() => {
        readTokenUsage()
            .then(setStore)
            .catch(() => setLoadError(true))
            .finally(() => setLoaded(true))
    }, [])

    const ranges = useMemo(
        () =>
            [
                ["今日", totalsSince(store.entries, 1)],
                ["近 7 天", totalsSince(store.entries, 7)],
                ["近 30 天", totalsSince(store.entries, 30)]
            ] as const,
        [store.entries]
    )
    const sourcePercentages = useMemo(() => {
        const totals = store.entries.reduce(
            (sum, entry) => {
                sum[entry.source] += entry.totalTokens
                return sum
            },
            { reported: 0, estimated: 0 }
        )
        const total = totals.reported + totals.estimated
        const percentage = (value: number) =>
            total === 0 ? "0.0%" : `${((value / total) * 100).toFixed(1)}%`
        return {
            reported: percentage(totals.reported),
            estimated: percentage(totals.estimated)
        }
    }, [store.entries])

    const clear = useCallback(async () => {
        setClearing(true)
        setClearError(false)
        try {
            await clearTokenUsage()
            setStore({ version: 1, entries: [] })
        } catch {
            setClearError(true)
        } finally {
            setConfirming(false)
            setClearing(false)
        }
    }, [])

    return (
        <Page>
            <OptionsPageIntro
                scene="archive"
                icon="ledger"
                title="用量统计"
                description="查看本机的翻译字符数和 Token 用量。浏览器仅保存用量汇总。"
            />
            <CharacterUsage />
            <Cards aria-label="Token 用量概览" aria-busy={!loaded}>
                {ranges.map(([label, counts]) => (
                    <Card key={label}>
                        <CardLabel>{label}</CardLabel>
                        <Total>
                            {loaded && !loadError ? format(counts.total) : "—"}
                            <small>tokens</small>
                        </Total>
                        <Breakdown>
                            {loaded && !loadError
                                ? `输入 ${format(counts.input)} · 输出 ${format(counts.output)}`
                                : loadError
                                  ? "统计暂不可用"
                                  : "正在读取本地统计…"}
                        </Breakdown>
                    </Card>
                ))}
            </Cards>
            <OptionsSection
                artwork="postcards"
                icon="mail"
                title="统计来源"
                description="优先采用 API 返回的用量；未提供时，使用本地估算。占比按当前保留记录的 token 总量计算。"
            >
                <SourceSummary aria-label="统计来源占比">
                    <div>
                        <strong>
                            API 返回{" "}
                            {loaded && !loadError
                                ? sourcePercentages.reported
                                : "—"}
                        </strong>
                        <p>来自模型服务返回的用量数据。</p>
                    </div>
                    <div>
                        <strong>
                            本地估算{" "}
                            {loaded && !loadError
                                ? sourcePercentages.estimated
                                : "—"}
                        </strong>
                        <p>根据输入与输出内容估算，可能与服务商账单不同。</p>
                    </div>
                </SourceSummary>
            </OptionsSection>
            <OptionsSection
                artwork="archive"
                icon="ledger"
                title="用量明细"
                description="保留近 30 天的记录，按日期、模型、功能和来源汇总。Google Translate、微软翻译、mewCat 免费翻译、DeepL 与 DeepLX 不计入 token 统计。"
            >
                {loadError ? (
                    <ErrorMessage role="alert">
                        无法读取本地统计，请重新打开此页重试。
                    </ErrorMessage>
                ) : !loaded ? (
                    <Empty role="status">正在读取本地统计…</Empty>
                ) : store.entries.length === 0 ? (
                    <Empty role="status">
                        暂无 token 用量记录
                        <p>使用生成式 AI 完成翻译后，可在这里查看用量。</p>
                    </Empty>
                ) : (
                    <TableWrap
                        role="region"
                        aria-label="Token 用量明细，可横向滚动"
                        tabIndex={0}
                    >
                        <Table>
                            <thead>
                                <tr>
                                    <th>日期 / 模型</th>
                                    <th>功能</th>
                                    <th>来源</th>
                                    <th>请求</th>
                                    <th>输入</th>
                                    <th>输出</th>
                                    <th>总计</th>
                                </tr>
                            </thead>
                            <tbody>
                                {store.entries
                                    .slice()
                                    .sort((a, b) =>
                                        b.date.localeCompare(a.date)
                                    )
                                    .map(entry => (
                                        <tr
                                            key={`${entry.date}:${entry.modelId}:${entry.feature}:${entry.source}`}
                                        >
                                            <td>
                                                {entry.date} · {entry.modelName}
                                            </td>
                                            <td>
                                                {FEATURE_LABELS[entry.feature]}
                                            </td>
                                            <td>
                                                {entry.source === "reported"
                                                    ? "API 返回"
                                                    : "本地估算"}
                                            </td>
                                            <td>
                                                {format(entry.requestCount)}
                                            </td>
                                            <td>{format(entry.inputTokens)}</td>
                                            <td>
                                                {format(entry.outputTokens)}
                                            </td>
                                            <td>{format(entry.totalTokens)}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </Table>
                    </TableWrap>
                )}
            </OptionsSection>
            <OptionsSection title="Token 数据管理" artwork="localData">
                <Management>
                    <p>
                        {confirming
                            ? "确认清空本机的 Token 用量记录？此操作无法撤销，后续调用将重新累计。"
                            : "Token 用量汇总保存在当前浏览器。"}
                    </p>
                    <Actions>
                        {confirming ? (
                            <>
                                <Button
                                    disabled={clearing}
                                    onClick={() => setConfirming(false)}
                                >
                                    取消
                                </Button>
                                <Button
                                    $danger
                                    disabled={clearing}
                                    onClick={() => void clear()}
                                >
                                    {clearing ? "正在清空…" : "确认清空"}
                                </Button>
                            </>
                        ) : (
                            <Button
                                disabled={!loaded || loadError}
                                onClick={() => setConfirming(true)}
                            >
                                清空统计
                            </Button>
                        )}
                    </Actions>
                </Management>
                {clearError && (
                    <ErrorMessage role="alert">
                        清空失败，统计仍然保留，请重试。
                    </ErrorMessage>
                )}
            </OptionsSection>
        </Page>
    )
}
