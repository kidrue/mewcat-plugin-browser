import type { AnalyticsInput, AnalyticsResult } from "@mewcat/client"
import { useEffect, useState } from "react"

import { queryAnalytics } from "@/services/analytics"
import { analyticsFailure, type AnalyticsFailure } from "@/types/analytics"

export function useAnalyticsRequest(input: AnalyticsInput | null) {
    const key = input ? JSON.stringify(input) : null
    const [revision, setRevision] = useState(0)
    const [state, setState] = useState<{
        key: string | null
        data: AnalyticsResult | null
        error: AnalyticsFailure | null
        loading: boolean
    }>({ key: null, data: null, error: null, loading: false })
    useEffect(() => {
        if (!key) {
            setState({ key, data: null, error: null, loading: false })
            return
        }
        let active = true
        const controller = new AbortController()
        setState(previous => ({
            key,
            data: previous.key === key ? previous.data : null,
            error: null,
            loading: true
        }))
        const request = async () => {
            const response = await queryAnalytics(
                JSON.parse(key) as AnalyticsInput,
                controller.signal
            ).catch(analyticsFailure)
            if (!active) {
                return
            }
            setState(previous =>
                response.success === true
                    ? { key, data: response.data, error: null, loading: false }
                    : {
                          key,
                          data: [
                              "ANALYTICS_FORBIDDEN",
                              "CLIENT_REVOKED",
                              "UNAUTHORIZED"
                          ].includes(response.code)
                              ? null
                              : previous.data,
                          error: response,
                          loading: false
                      }
            )
        }
        void request()
        return () => {
            active = false
            controller.abort()
        }
    }, [key, revision])
    return {
        ...state,
        data: state.key === key ? state.data : null,
        error: state.key === key ? state.error : null,
        refresh: () => setRevision(value => value + 1)
    }
}
