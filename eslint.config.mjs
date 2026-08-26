import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            "react-hooks": reactHooks
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "no-console": "off",
            "no-undef": "off",
            "no-unreachable": "error",
            "@typescript-eslint/no-empty-interface": "warn",
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": "allow-with-description"
                }
            ],
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    prefer: "type-imports", // 优先使用 import type
                    disallowTypeAnnotations: false,
                    fixStyle: "separate-type-imports" // 自动修复时分离类型导入
                }
            ],
            // 核心：禁止 else if 结构（触发警告）
            "no-restricted-syntax": [
                "warn",
                {
                    selector: "IfStatement[alternate.type='IfStatement']", // 匹配 else if 语法节点
                    message: "禁止使用 else if，建议拆分为独立的 if 语句" // 自定义警告提示语
                }
            ],
            // 强化：if 块内有 return 时，禁用 else if（强制用独立 if）
            "no-else-return": ["warn", { allowElseIf: false }], // allowElseIf: false 彻底禁用 else if
            // 可选：强制 if 加花括号（避免单行 if 语法歧义）
            curly: ["warn", "all"]
        },
        ignores: [
            "**/node_modules/**",
            ".plasmo/**/*",
            "**/dist/**",
            "**/build/**/*",
            "**/assets/**",
            "**/*.config.js",
            "**/*.config.mjs",
            "**/scripts/**",
            "**/test/**"
        ]
    }
]
