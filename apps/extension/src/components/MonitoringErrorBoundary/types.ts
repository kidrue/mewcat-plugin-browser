import type { ReactNode } from "react"
import type { FallbackProps } from "react-error-boundary"

import type { captureExtensionException } from "@/services/monitoring"

export interface MonitoringErrorBoundaryProps {
    children: ReactNode
    feature: string
    operation: string
    fallbackRender?: (props: FallbackProps) => ReactNode
    capture?: typeof captureExtensionException
}
