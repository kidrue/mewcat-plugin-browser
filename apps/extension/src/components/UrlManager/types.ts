export interface UrlManagerProps {
    urls: string[]
    onUrlsChange: (urls: string[]) => void
    placeholder?: string
    emptyText?: string
    className?: string
}
