import React from "react"

import { Author } from "./styles"
import type { AuthorAnalyticsEntryProps } from "./types"

export const AuthorAnalyticsEntry: React.FC<AuthorAnalyticsEntryProps> = ({
    author
}) => {
    return (
        <Author
            type="button"
            onClick={() => {
                location.hash = "analytics"
            }}
        >
            {author}
        </Author>
    )
}
