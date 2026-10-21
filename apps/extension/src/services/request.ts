// 请求配置中的过渡选项类型
interface TransitionalOptions {
    silentJSONParsing: boolean
    forcedJSONParsing: boolean
    clarifyTimeoutError: boolean
}

// 请求头类型
interface RequestHeaders {
    Accept: string
    "Content-Type": string
    Authorization: string
    [key: string]: string // 允许其他自定义头
}

// 完整配置类型
interface RequestConfig {
    transitional: TransitionalOptions
    adapter: string[]
    timeout: number
    xsrfCookieName: string
    xsrfHeaderName: string
    maxContentLength: number
    maxBodyLength: number
    headers: RequestHeaders
    method: "post" | "get" | string
    url: string
    data: string
    allowAbsoluteUrls: boolean
}

// 响应头类型
interface ResponseHeaders {
    "content-length": string
    "content-type": string
    [key: string]: string // 允许其他响应头
}

// 成功时的结构体
interface ResponseSuccessResponse<T> {
    code: "success"
    data: T
}

// 报错时的结构体
interface ResponseErrorResponse<T, E = undefined> {
    code: Exclude<string, "success">
    msg: string
    data: T
    detail?: E
}

// T = null, data某些接口不需要data。data值为null。
export type Response<T = null, E = undefined> =
    | ResponseSuccessResponse<T>
    | ResponseErrorResponse<T, E>

export interface HttpResponse<T> {
    data: Response<T>
    status: number
    statusText: string
    headers: ResponseHeaders
    config: RequestConfig
    request: Record<string, unknown>
}

export interface ErrorResponse {
    code: number
    message: string
    details?: Record<string, string>
}
