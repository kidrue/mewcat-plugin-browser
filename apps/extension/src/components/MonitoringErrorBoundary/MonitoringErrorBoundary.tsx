import type React from "react"
import { ErrorBoundary } from "react-error-boundary"

import { ErrorFallback } from "@/components/ErrorFallback"
import { captureExtensionException } from "@/services/monitoring"

import type { MonitoringErrorBoundaryProps } from "./types"

export const MonitoringErrorBoundary: React.FC<
    MonitoringErrorBoundaryProps
> = ({
    children,
    feature,
    operation,
    fallbackRender = ErrorFallback,
    capture = captureExtensionException
}) => {
    return (
        <ErrorBoundary
            fallbackRender={fallbackRender}
            onError={error =>
                capture(error, { feature, operation, pageUrl: location.href })
            }
        >
            {children}
        </ErrorBoundary>
    )
}
