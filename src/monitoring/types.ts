export type RuntimeContext =
    | "background"
    | "content"
    | "popup"
    | "options"
    | "sidepanel"

export interface RuntimeConfigInput {
    dsn: string
    isProduction: boolean
    runtimeContext: RuntimeContext
    enableReplay: boolean
    version: string
}

export interface CaptureContext {
    feature: string
    operation: string
    pageUrl?: string
}
