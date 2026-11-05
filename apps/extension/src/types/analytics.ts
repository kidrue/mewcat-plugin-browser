import type { AnalyticsInput, AnalyticsResult } from "@mewcat/client"

export interface AnalyticsQueryMessage {
    requestId: string
    query: AnalyticsInput
}

export const ANALYTICS_ERRORS: Record<string, string> = {
    ANALYTICS_FORBIDDEN: "当前设备尚未获得管理员权限",
    CLIENT_REVOKED: "当前设备已被停用，请联系管理员",
    UNAUTHORIZED: "设备身份校验失败，请重新检查",
    ANALYTICS_DEVICE_NOT_FOUND: "设备不存在或已被删除",
    ANALYTICS_UNAVAILABLE: "分析接口尚未上线，请稍后重试",
    ANALYTICS_BUSY: "分析查询繁忙，请稍后重试",
    ANALYTICS_CANCELLED: "分析查询已取消",
    RATE_LIMITED: "查询过于频繁，请稍后重试",
    INVALID_REQUEST: "查询条件不正确，请检查日期或设备 ID",
    NETWORK_FAILURE: "无法读取分析数据，请检查网络后重试"
}
export type AnalyticsFailure = { success: false; code: string; message: string }
export type AnalyticsResponse =
    | { success: true; data: AnalyticsResult }
    | AnalyticsFailure
export type AnalyticsIdentityResponse =
    | { success: true; data: { clientId: string; serviceOrigin: string } }
    | AnalyticsFailure
export function analyticsFailure(error: unknown): AnalyticsFailure {
    const candidate = (error && typeof error === "object" ? error : {}) as {
        code?: string
        status?: number
    }
    let code = "NETWORK_FAILURE"
    if (candidate.code && Object.hasOwn(ANALYTICS_ERRORS, candidate.code)) {
        code = candidate.code
    }
    if (candidate.status === 404 && candidate.code === "REQUEST_REJECTED") {
        code = "ANALYTICS_UNAVAILABLE"
    }
    return { success: false, code, message: ANALYTICS_ERRORS[code] }
}
