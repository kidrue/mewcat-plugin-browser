import type React from "react"
import { useEffect, useState } from "react"

import Button from "@/components/Button"
import { sendMessage } from "@/messaging"
import type { MewCatUsageResponse } from "@/types/mewcatUsage"

import { resetTime } from "./constants"
import { Quota } from "./styles"
import { format } from "./utils"

export const MewCatQuota: React.FC = () => {
    const [request, setRequest] = useState(0)
    const [result, setResult] = useState<{
        request: number
        response: MewCatUsageResponse
    } | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            let response: MewCatUsageResponse
            try {
                response = await sendMessage("mewcat-usage", undefined)
            } catch {
                response = { success: false }
            }
            if (active) {
                setResult({ request, response })
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [request])

    const response = result?.request === request ? result.response : null
    const details = response?.success ? response.data : null

    return (
        <Quota aria-label="mewCat 每日免费额度">
            <div role="status">
                {details ? (
                    <>
                        <p>
                            每台设备每天 {format(details.limitCharacters)}{" "}
                            字符， 同一公网 IP 每天共享{" "}
                            {format(details.ipLimitCharacters)} 字符。
                        </p>
                        <p>
                            本设备已用 {format(details.usedCharacters)} 字符 ·
                            本设备剩余{" "}
                            {format(
                                Math.max(
                                    0,
                                    details.limitCharacters -
                                        details.usedCharacters
                                )
                            )}{" "}
                            字符
                        </p>
                        <p>
                            翻译与页面总结共用额度，每天北京时间{" "}
                            {resetTime.format(new Date(details.resetsAt))}{" "}
                            重置。
                        </p>
                    </>
                ) : (
                    <p>
                        {response
                            ? "暂时无法读取 mewCat 免费额度。"
                            : "正在读取 mewCat 免费额度…"}
                    </p>
                )}
            </div>
            {response && (
                <Button
                    type="secondary"
                    size="sm"
                    onClick={() => setRequest(value => value + 1)}
                >
                    {details ? "刷新额度" : "重试"}
                </Button>
            )}
        </Quota>
    )
}
