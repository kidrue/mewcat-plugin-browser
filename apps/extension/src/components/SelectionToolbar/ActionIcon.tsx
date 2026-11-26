import type React from "react"

import type { ActionIconProps } from "./types"

export const ActionIcon: React.FC<ActionIconProps> = ({ name }) => {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {name === "copy" && (
                <>
                    <rect x="8" y="8" width="12" height="13" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </>
            )}
            {name === "check" && <path d="m5 12 4 4L19 6" />}
            {name === "pin" && (
                <path d="M16 9V4l1-1H7l1 1v5l-2 3v2h12v-2l-2-3ZM12 14v7" />
            )}
            {name === "close" && <path d="m6 6 12 12M6 18 18 6" />}
        </svg>
    )
}
