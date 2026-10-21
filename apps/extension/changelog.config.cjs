module.exports = {
    alias: { fd: "docs: fix typos" },
    messages: {
        type: "Select the type of change that you're committing:",
        customScope: "Select the scope this component affects:",
        subject: "Write a short, imperative mood description of the change:\n",
        body: "Provide a longer description of the change:\n ",
        breaking: "List any breaking changes:\n",
        footer: "Issues this commit closes, e.g #123:",
        confirmCommit: "The packages that this commit has affected\n"
    },
    types: {
        feat: {
            emoji: "✨",
            value: "feat",
            description: "A new feature"
        },
        fix: {
            emoji: "🐞",
            value: "fix",
            description: "A bug fix"
        },
        refactor: {
            emoji: "🛠",
            value: "refactor",
            description: "A code change that neither fixes a bug nor adds a feature"
        },
        docs: {
            emoji: "📚",
            value: "docs",
            description: "Documentation only changes"
        },
        test: {
            emoji: "🏁",
            value: "test",
            description: "Add missing tests or correcting existing tests"
        },
        ci: {
            emoji: "🔨",
            value: "ci",
            description: "Changes about build configuration"
        },
        chore: {
            emoji: "🗯",
            value: "chore",
            description: "Changes that don't modify src or test files. Such as updating build tasks, package manager"
        },
        style: {
            emoji: "💅",
            value: "style",
            description: "Code Style, Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)"
        },
        perf: {
            description: "A code change that improves performance",
            emoji: "⚡️",
            value: "perf"
        }
    }
}
