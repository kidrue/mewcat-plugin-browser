import { useEffect, useRef, useState } from "react"

import {
    summarizeCurrentPage,
    type SummaryActionResult
} from "@/reading/summaryActions"

import Button from "../Button"
import FeatureAvailability from "../FeatureAvailability"

export default function SummaryPageButton({
    available
}: {
    available: boolean
}) {
    const [pending, setPending] = useState(false)
    const [result, setResult] = useState<SummaryActionResult>()
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    return (
        <div style={{ padding: "8px 0" }}>
            <Button
                htmlType="button"
                type="secondary"
                fullWidth
                disabled={!available || pending}
                onClick={async () => {
                    setPending(true)
                    setResult(undefined)
                    const next = await summarizeCurrentPage()
                    if (mounted.current) {
                        setResult(next)
                        setPending(false)
                    }
                }}
            >
                {pending ? "正在总结…" : "总结本页"}
            </Button>
            {!available && <FeatureAvailability available={false} />}
            {result && <p role="status">{result.message}</p>}
            {result?.needsConfiguration && (
                <FeatureAvailability available={false} />
            )}
        </div>
    )
}
