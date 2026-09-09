import React, { useEffect, useMemo, useState } from "react"
import styled from "styled-components"

import { clearTokenUsage, readTokenUsage } from "@/token-usage/storage"
import type {
    TokenUsageEntry,
    TokenUsageFeature,
    TokenUsageStore
} from "@/token-usage/types"

const Page = styled.section`
    display: grid;
    gap: var(--space-6);
`
const Header = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    border-bottom: 1px solid var(--rule-strong);
    padding-bottom: var(--space-4);
`
const Title = styled.h2`
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
`
const Description = styled.p`
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
`
const Button = styled.button<{ $danger?: boolean }>`
    padding: var(--space-2) var(--space-4);
    border: 1px solid
        ${props =>
            props.$danger ? "var(--primary-color)" : "var(--border-color)"};
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: ${props =>
        props.$danger ? "var(--primary-color)" : "var(--text-primary)"};
    cursor: pointer;
`
const Cards = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    @media (max-width: 760px) {
        grid-template-columns: 1fr;
    }
`
const Card = styled.article`
    padding: var(--space-5);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
`
const CardLabel = styled.div`
    color: var(--text-secondary);
`
const Total = styled.div`
    margin: var(--space-2) 0;
    font-family: var(--font-mono);
    font-size: 28px;
    color: var(--primary-color);
`
const Breakdown = styled.div`
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
`
const TableWrap = styled.div`
    overflow-x: auto;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
`
const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    th,
    td {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    th {
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
    }
    td:nth-last-child(-n + 4),
    th:nth-last-child(-n + 4) {
        text-align: right;
        font-family: var(--font-mono);
    }
    tr:last-child td {
        border-bottom: 0;
    }
`
const Empty = styled.div`
    padding: var(--space-10);
    text-align: center;
    color: var(--text-tertiary);
    border: 1px dashed var(--border-color);
`
const SourceSummary = styled.div`
    display: flex;
    gap: var(--space-5);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
`

const FEATURE_LABELS: Record<TokenUsageFeature, string> = {
    "page-translation": "网页翻译",
    "selection-translation": "划词翻译",
    "concept-explanation": "概念解释",
    "page-summary": "页面摘要",
    "image-translation": "图片翻译"
}

const format = (value: number) => value.toLocaleString("zh-CN")
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

    useEffect(() => {
        readTokenUsage()
            .then(setStore)
            .catch(() => setStore({ version: 1, entries: [] }))
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

    const clear = async () => {
        try {
            await clearTokenUsage()
            setStore({ version: 1, entries: [] })
        } finally {
            setConfirming(false)
        }
    }

    return (
        <Page>
            <Header>
                <div>
                    <Title>用量统计</Title>
                    <Description>
                        仅在本地记录聚合 token，不保存请求或翻译内容。
                    </Description>
                </div>
                {confirming ? (
                    <Button $danger onClick={() => void clear()}>
                        确认清空
                    </Button>
                ) : (
                    <Button onClick={() => setConfirming(true)}>
                        清空统计
                    </Button>
                )}
            </Header>
            <Cards>
                {ranges.map(([label, counts]) => (
                    <Card key={label}>
                        <CardLabel>{label}</CardLabel>
                        <Total>{format(counts.total)}</Total>
                        <Breakdown>
                            输入 {format(counts.input)} · 输出{" "}
                            {format(counts.output)}
                        </Breakdown>
                    </Card>
                ))}
            </Cards>
            <SourceSummary aria-label="统计来源占比">
                <span>API 返回 {sourcePercentages.reported}</span>
                <span>本地估算 {sourcePercentages.estimated}</span>
            </SourceSummary>
            {loaded && store.entries.length === 0 ? (
                <Empty>暂无 token 用量记录</Empty>
            ) : (
                <TableWrap>
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
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map(entry => (
                                    <tr
                                        key={`${entry.date}:${entry.modelId}:${entry.feature}:${entry.source}`}
                                    >
                                        <td>
                                            {entry.date} · {entry.modelName}
                                        </td>
                                        <td>{FEATURE_LABELS[entry.feature]}</td>
                                        <td>
                                            {entry.source === "reported"
                                                ? "API 返回"
                                                : "本地估算"}
                                        </td>
                                        <td>{format(entry.requestCount)}</td>
                                        <td>{format(entry.inputTokens)}</td>
                                        <td>{format(entry.outputTokens)}</td>
                                        <td>{format(entry.totalTokens)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </Table>
                </TableWrap>
            )}
        </Page>
    )
}
