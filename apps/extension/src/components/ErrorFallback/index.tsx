export const ErrorFallback: React.FunctionComponent<{
    error: Error
    resetErrorBoundary: () => void
}> = ({ error, resetErrorBoundary }) => (
    <div
        style={{
            color: "red",
            padding: 20,
            border: "1px solid red",
            borderRadius: "var(--radius-lg)"
        }}
    >
        <h2>❌ 出错了</h2>
        <p>{error.message}</p>
        <button
            style={{ borderRadius: "var(--radius-md)" }}
            onClick={resetErrorBoundary}
        >
            🔄 重试
        </button>
    </div>
)
