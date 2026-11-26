import type {
    AnalyticsCalls,
    AnalyticsDevices,
    AnalyticsOverview,
    DeviceActivityAnalytics
} from "@mewcat/client"

export type AuthorAnalyticsEntryProps = { author: string }

type OverviewData = Extract<DeviceActivityAnalytics, { operation: "overview" }>

export type DailyActivityProps = { days: OverviewData["days"] }

export type DeviceActivityOverviewProps = {
    data: OverviewData | null
    loading: boolean
    from: string
}

export type DeviceActivityProfileProps = { clientId: string }

export type DeviceIdProps = {
    clientId?: string | null
    truncated?: boolean
}

export type AnalysisStatusProps = {
    data: AnalyticsOverview["analysis"]
}

export type LanguagesProps = {
    items: AnalyticsOverview["languages"]
}

export type OverviewProps = { data: AnalyticsOverview }

export type ProfileProps = {
    clientId: string
    onClose: () => void
    onCalls: (id: string) => void
}

export interface RecordFilters {
    clientId: string
    route: string
    outcome: string
}

export type RecordFilterFormProps = {
    kind: "devices" | "calls"
    initial: RecordFilters
    onApply: (value: RecordFilters) => void
}

export type DevicesProps = {
    data: AnalyticsDevices
    onProfile: (id: string) => void
}

export type CallsProps = { data: AnalyticsCalls }
