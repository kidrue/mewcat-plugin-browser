import { sendMessage } from "@/messaging"

export interface TextTranslationUsageEvent {
    serviceId: string
    serviceName: string
    characters: number
}

export interface TextTranslationUsageEntry extends TextTranslationUsageEvent {
    date: string
}

export type TextTranslationUsageRequest =
    | ({ type: "record" } & TextTranslationUsageEvent)
    | { type: "read" }
    | { type: "clear" }

interface PeriodTotals {
    today: number
    week: number
    month: number
}

interface ServiceUsage extends PeriodTotals {
    serviceId: string
    serviceName: string
}

const emptyTotals = (): PeriodTotals => ({ today: 0, week: 0, month: 0 })
const pad = (value: number) => String(value).padStart(2, "0")

export function localTextTranslationUsageDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export async function readTextTranslationUsage(): Promise<
    TextTranslationUsageEntry[]
> {
    const entries = await sendMessage("text-translation-usage", {
        type: "read"
    })
    if (!entries) {
        throw new Error("无法读取翻译字符统计")
    }
    return entries
}

export async function clearTextTranslationUsage(): Promise<void> {
    await sendMessage("text-translation-usage", { type: "clear" })
}

export async function recordTextTranslationUsage(
    event: TextTranslationUsageEvent
): Promise<void> {
    await sendMessage("text-translation-usage", { type: "record", ...event })
}

export function summarizeTextTranslationUsage(
    entries: TextTranslationUsageEntry[],
    now = new Date()
): { totals: PeriodTotals; services: ServiceUsage[] } {
    const today = localTextTranslationUsageDate(now)
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const weekStart = localTextTranslationUsageDate(monday)
    const monthStart = `${today.slice(0, 7)}-01`
    const totals = emptyTotals()
    const byService = new Map<string, { latest: string; usage: ServiceUsage }>()

    for (const { date, serviceId, serviceName, characters } of entries) {
        if (date > today || (date < weekStart && date < monthStart)) {
            continue
        }

        const service = byService.get(serviceId) ?? {
            latest: date,
            usage: { serviceId, serviceName, ...emptyTotals() }
        }
        if (date >= service.latest) {
            service.latest = date
            service.usage.serviceName = serviceName
        }
        byService.set(serviceId, service)
        if (date === today) {
            totals.today += characters
            service.usage.today += characters
        }
        if (date >= weekStart) {
            totals.week += characters
            service.usage.week += characters
        }
        if (date >= monthStart) {
            totals.month += characters
            service.usage.month += characters
        }
    }

    const services = Array.from(byService.values(), ({ usage }) => usage)
    services.sort(
        (a, b) =>
            b.month - a.month ||
            b.week - a.week ||
            b.today - a.today ||
            a.serviceName.localeCompare(b.serviceName)
    )
    return { totals, services }
}
