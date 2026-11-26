import type {
    DeviceActivityAnalytics,
    DeviceActivityQuery
} from "@mewcat/client"
import { useEffect, useState } from "react"

import { sendMessage } from "@/messaging"

export function useDeviceActivity(input: DeviceActivityQuery | null) {
    const key = input ? JSON.stringify(input) : null
    const [revision, setRevision] = useState(0)
    const [result, setResult] = useState<{
        key: string
        revision: number
        data: DeviceActivityAnalytics | null
    } | null>(null)
    useEffect(() => {
        if (!key) {
            return
        }
        let active = true
        let completed = false
        const query = JSON.parse(key) as DeviceActivityQuery
        const requestId = crypto.randomUUID()
        const load = async () => {
            const response = await sendMessage("device-activity-query", {
                requestId,
                query
            }).catch(() => null)
            completed = true
            if (active) {
                setResult({
                    key,
                    revision,
                    data:
                        response?.success &&
                        response.data.operation === query.operation
                            ? response.data
                            : null
                })
            }
        }
        void load()
        return () => {
            active = false
            if (!completed) {
                void sendMessage("analytics-cancel", { requestId }).catch(
                    () => {}
                )
            }
        }
    }, [key, revision])

    const current = result?.key === key && result.revision === revision
    return {
        data: current ? result.data : null,
        loading: key !== null && !current,
        refresh: () => setRevision(value => value + 1)
    }
}
