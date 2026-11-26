import React, { useEffect, useMemo, useState } from "react"
import styled from "styled-components"

import { OptionsPageIntro } from "@/components/OptionsPageLayout"
import OptionsSection from "@/components/OptionsSection"
import { skyCardArtwork } from "@/components/SkyArtwork"
import { clearTokenUsage, readTokenUsage } from "@/token-usage/storage"
import {
    clearTextTranslationUsage,
    readTextTranslationUsage,
    summarizeTextTranslationUsage,
    type TextTranslationUsageEntry
} from "@/token-usage/textTranslationUsage"
import type {
    TokenUsageEntry,
    TokenUsageFeature,
    TokenUsageStore
} from "@/token-usage/types"

const Page = styled.div`
    display: grid;
    gap: var(--space-6);

    > * {
        min-width: 0;
        margin-bottom: 0;
    }
`
const Button = styled.button<{ $danger?: boolean }>`
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid
        ${props =>
            props.$danger ? "var(--error-border)" : "var(--border-color)"};
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: ${props => (props.$danger ? "var(--error)" : "var(--text-primary)")};
    font: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: ${props =>
            props.$danger ? "var(--error-bg)" : "var(--primary-light)"};
    }

    &:focus-visible {
        outline: 2px solid var(--border-focus);
        outline-offset: 3px;
    }

    &:disabled {
        opacity: 0.6;
        cursor: wait;
    }
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
    min-width: 0;
    padding: var(--space-5);
    background: var(--bg-secondary);
    ${skyCardArtwork("usageLedger")}
    border: 1px solid var(--border-color);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xs);
`
const CardLabel = styled.h3`
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
`
const Total = styled.div`
    margin: var(--space-2) 0;
    font-family: var(--font-mono);
    font-size: clamp(24px, 2.8vw, 32px);
    color: var(--primary-color);
    overflow-wrap: anywhere;

    small {
        margin-left: var(--space-2);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        font-family: var(--font-family);
    }
`
const Breakdown = styled.div`
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
`
const TableWrap = styled.div`
    min-width: 0;
    overflow-x: auto;

    &:focus-visible {
        outline: 2px solid var(--border-focus);
        outline-offset: 4px;
        border-radius: var(--radius-sm);
    }
`
const Table = styled.table`
    width: 100%;
    min-width: 640px;
    border-collapse: collapse;
    thead {
        border: 1px solid var(--border-color);
    }
    th,
    td {
        padding: var(--space-3) var(--space-4);
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    th {
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
        background: var(--bg-primary);
        white-space: nowrap;
    }
    td:first-child {
        max-width: 280px;
        overflow-wrap: anywhere;
    }
    td:nth-child(2),
    td:nth-child(3) {
        white-space: nowrap;
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
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border-radius: var(--radius-lg);

    p {
        margin: var(--space-2) 0 0;
        font-size: var(--font-size-sm);
    }
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
const Management = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-4);

    p {
        flex: 1 1 240px;
        margin: 0;
        color: var(--text-secondary);
        line-height: var(--line-height-relaxed);
        font-size: var(--font-size-sm);
    }
`
const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
`
const ErrorMessage = styled.p`
    margin: var(--space-3) 0 0;
    color: var(--error);
    font-size: var(--font-size-sm);
`
const CharacterUsageContent = styled.div`
    display: grid;
    gap: var(--space-4);

    > * {
        min-width: 0;
    }
`
const CharacterTable = styled(Table)`
    min-width: 440px;

    caption {
        padding-bottom: var(--space-2);
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
        text-align: left;
    }

    th:first-child {
        text-align: left;
        font-family: var(--font-family);
    }

    tbody th {
        background: transparent;
        overflow-wrap: anywhere;
        white-space: normal;
    }

    td,
    thead th:not(:first-child) {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    tbody tr:last-child th {
        border-bottom: 0;
    }
`

const FEATURE_LABELS: Record<TokenUsageFeature, string> = {
    "page-translation": "网页翻译",
    "selection-translation": "划词翻译",
    "concept-explanation": "概念解释",
    "page-summary": "页面摘要",
    "image-translation": "图片翻译"
}

const format = (value: number) => value.toLocaleString("zh-CN")
const CHARACTER_PERIODS = [
    ["today", "今天"],
    ["week", "本周"],
    ["month", "本月"]
] as const

type CharacterUsageState =
    | { status: "loading" | "error" }
    | { status: "ready"; entries: TextTranslationUsageEntry[] }

async function loadCharacterUsage(): Promise<CharacterUsageState> {
    try {
        return { status: "ready", entries: await readTextTranslationUsage() }
    } catch {
        return { status: "error" }
    }
}

const CharacterUsage: React.FC = () => {
    const [usage, setUsage] = useState<CharacterUsageState>({
        status: "loading"
    })
    const [confirming, setConfirming] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [clearError, setClearError] = useState(false)

    useEffect(() => {
        let active = true
        void loadCharacterUsage().then(currentUsage => {
            if (active) {
                setUsage(currentUsage)
            }
        })
        return () => {
            active = false
        }
    }, [])

    const summary =
        usage.status === "ready"
            ? summarizeTextTranslationUsage(usage.entries)
            : null
    const latestDate =
        usage.status === "ready"
            ? usage.entries.reduce(
                  (latest, entry) =>
                      entry.date > latest ? entry.date : latest,
                  ""
              )
            : ""

    const clear = async () => {
        setClearing(true)
        setClearError(false)
        try {
            await clearTextTranslationUsage()
            setUsage({ status: "loading" })
            setUsage(await loadCharacterUsage())
        } catch {
            setClearError(true)
        } finally {
            setConfirming(false)
            setClearing(false)
        }
    }

    return (
        <OptionsSection
            title="翻译字符统计"
            artwork="analyticsTrends"
            description="按本机时间统计成功翻译的原文字符数，本周从周一开始。仅包含新版开始记录后的用量；缓存命中、图片翻译、页面摘要和概念解释不计入。"
        >
            <CharacterUsageContent>
                <Cards
                    role="group"
                    aria-label="翻译字符数概览"
                    aria-busy={usage.status === "loading"}
                >
                    {CHARACTER_PERIODS.map(([period, label]) => (
                        <Card key={period}>
                            <CardLabel as="h4">{label}</CardLabel>
                            <Total>
                                {summary ? format(summary.totals[period]) : "—"}{" "}
                                <small>字符</small>
                            </Total>
                        </Card>
                    ))}
                </Cards>
                {usage.status === "error" ? (
                    <ErrorMessage role="alert">
                        无法读取翻译字符统计，请重新打开此页重试。
                    </ErrorMessage>
                ) : usage.status === "loading" ? (
                    <Empty role="status">正在读取翻译字符统计…</Empty>
                ) : summary?.services.length ? (
                    <TableWrap
                        role="region"
                        aria-label="按服务统计翻译字符数，可横向滚动"
                        tabIndex={0}
                    >
                        <CharacterTable>
                            <caption>按服务统计 · 字符数</caption>
                            <thead>
                                <tr>
                                    <th scope="col">翻译服务</th>
                                    {CHARACTER_PERIODS.map(
                                        ([period, label]) => (
                                            <th key={period} scope="col">
                                                {label}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {summary.services.map(service => (
                                    <tr key={service.serviceId}>
                                        <th scope="row">
                                            {service.serviceName}
                                        </th>
                                        {CHARACTER_PERIODS.map(([period]) => (
                                            <td key={period}>
                                                {format(service[period])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </CharacterTable>
                    </TableWrap>
                ) : (
                    <Empty role="status">
                        {latestDate
                            ? "当前统计周期暂无记录"
                            : "暂无翻译字符记录"}
                    </Empty>
                )}
                <Management>
                    {confirming ? (
                        <p>确认清空本机的翻译字符记录？此操作无法撤销。</p>
                    ) : (
                        latestDate && (
                            <p>
                                最近记录{" "}
                                <time dateTime={latestDate}>{latestDate}</time>
                            </p>
                        )
                    )}
                    <Actions>
                        {confirming ? (
                            <>
                                <Button
                                    disabled={clearing}
                                    onClick={() => setConfirming(false)}
                                >
                                    取消清空字符统计
                                </Button>
                                <Button
                                    $danger
                                    disabled={clearing}
                                    onClick={() => void clear()}
                                >
                                    {clearing
                                        ? "正在清空字符统计…"
                                        : "确认清空字符统计"}
                                </Button>
                            </>
                        ) : (
                            <Button
                                disabled={
                                    usage.status !== "ready" || !latestDate
                                }
                                onClick={() => setConfirming(true)}
                            >
                                清空字符统计
                            </Button>
                        )}
                    </Actions>
                </Management>
                {clearError && (
                    <ErrorMessage role="alert">
                        字符统计清空失败，请重试。
                    </ErrorMessage>
                )}
            </CharacterUsageContent>
        </OptionsSection>
    )
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

    const clear = async () => {
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
    }

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
