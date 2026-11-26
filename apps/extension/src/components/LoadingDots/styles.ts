import styled from "styled-components"

import { RUNNING_CAT_CSS } from "@/utils/runningCat"

export const SCxLoadingContainer = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    vertical-align: middle;
    line-height: 0;

    ${RUNNING_CAT_CSS.replace(/\.mewcat-running-cat/g, "&")}
`
