import React, { useCallback, useEffect, useState } from "react"

import OptionsSection from "@/components/OptionsSection"
import {
    clearTextTranslationUsage,
    summarizeTextTranslationUsage
} from "@/features/token-usage"

import { CHARACTER_PERIODS } from "./constants"
import { loadCharacterUsage } from "./storage"
import {
    Actions,
    Button,
    Card,
    CardLabel,
    Cards,
    CharacterTable,
    CharacterUsageContent,
    Empty,
    ErrorMessage,
    format,
    Management,
    TableWrap,
    Total
} from "./styles"
import type { CharacterUsageState } from "./types"

export const CharacterUsage: React.FC = () => {
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

    const clear = useCallback(async () => {
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
    }, [])

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
