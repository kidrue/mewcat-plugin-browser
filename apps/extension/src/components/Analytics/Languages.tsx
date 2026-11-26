import React from "react"

import { Distribution, fmt, Mono, Muted, relative } from "./styles"
import type { LanguagesProps } from "./types"

export const Languages: React.FC<LanguagesProps> = ({ items }) => {
    const max = items.reduce(
        (sum, item) => sum + BigInt(item.requests),
        BigInt(0)
    )
    return (
        <Distribution>
            {items.length ? (
                items.map(item => (
                    <div key={item.languagePair.join(":")}>
                        <div className="label">
                            <span>{item.languagePair.join(" → ")}</span>
                            <Mono>{fmt(item.requests)}</Mono>
                        </div>
                        <div className="track">
                            <div
                                className="bar"
                                style={{
                                    width: `${relative(item.requests, max)}%`
                                }}
                            />
                        </div>
                    </div>
                ))
            ) : (
                <Muted>暂无语言样本</Muted>
            )}
        </Distribution>
    )
}
