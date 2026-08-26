/**
 * @type {import('prettier').Options}
 */
export default {
    printWidth: 80,
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 4,
    trailingComma: "none",
    arrowParens: "avoid",
    plugins: ["@ianvs/prettier-plugin-sort-imports"],
    importOrder: [
        "<BUILTIN_MODULES>", // Node.js built-in modules
        "<THIRD_PARTY_MODULES>", // Imports not matched by other special words or groups.
        "", // Empty line
        "^#imports$",
        "",
        "^@/(.*)$",
        "",
        "^[./]",
        "~/(.*)$"
    ]
    // // 忽略所有 .md 文件
    // overrides: [
    //     {
    //         files: "**/*.md" // 匹配所有目录下的 .md 文件
    //     }
    // ]
}
