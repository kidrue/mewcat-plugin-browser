export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ) {
        super(message)
        this.name = "ApiError"
    }
}

export function publicError(error: unknown): ApiError {
    return error instanceof ApiError
        ? error
        : new ApiError(500, "INTERNAL_ERROR", "服务暂时不可用")
}
