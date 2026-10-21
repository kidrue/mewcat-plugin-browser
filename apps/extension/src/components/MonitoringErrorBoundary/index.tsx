import type { ReactNode } from "react"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"

import { ErrorFallback } from "@/components/ErrorFallback"
import { captureExtensionException } from "@/monitoring"

interface MonitoringErrorBoundaryProps {
    children: ReactNode
    feature: string
    operation: string
    fallbackRender?: (props: FallbackProps) => ReactNode
    capture?: typeof captureExtensionException
}

export function MonitoringErrorBoundary({
    children,
    feature,
    operation,
    fallbackRender = ErrorFallback,
    capture = captureExtensionException
}: MonitoringErrorBoundaryProps) {
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
