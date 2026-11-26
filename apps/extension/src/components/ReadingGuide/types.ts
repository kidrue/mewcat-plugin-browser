export type ReadingGuideProps = {
    targetLanguage: string
    onTargetLanguageChange: (language: string) => void | Promise<unknown>
    helpOnly?: boolean
}
