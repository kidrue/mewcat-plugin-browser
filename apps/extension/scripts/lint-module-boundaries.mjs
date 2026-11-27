import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url))
const projectRoot = resolve(sourceRoot, "..")
const aliasRoots = new Map([
    ["@/", sourceRoot],
    ["~/", sourceRoot],
    ["@@/", projectRoot],
    ["~~/", projectRoot]
])
const moduleLayers = new Set(["components", "features"])
const applicationLayers = new Set([
    "background",
    "contents",
    "entrypoints",
    "pages"
])

export const moduleBoundaries = {
    meta: {
        type: "problem",
        schema: [],
        messages: {
            entry: "跨模块请通过公开入口 @/{{layer}}/{{module}} 导入。",
            internal: "模块内部请直接导入实现文件，避免经由自己的 index.ts。",
            application:
                "业务模块应通过依赖注入或服务层访问 {{layer}} 的能力。",
            utility: "公共工具不得依赖具体业务模块，请将业务逻辑移到所属模块。"
        }
    },
    create(context) {
        const [fromLayer, fromModule] = relative(
            sourceRoot,
            context.filename
        ).split(sep)

        function check(source) {
            const specifier =
                source?.type === "TemplateLiteral" &&
                source.expressions.length === 0
                    ? source.quasis[0].value.cooked
                    : source?.value
            if (typeof specifier !== "string") {
                return
            }

            const alias = /^(?:@@?|~~?)\//.exec(specifier)?.[0]
            if (!alias && !/^\.\.?(?:\/|$)/.test(specifier)) {
                return
            }

            const target = alias
                ? resolve(aliasRoots.get(alias), specifier.slice(alias.length))
                : resolve(dirname(context.filename), specifier)
            const [layer, module, ...members] = relative(
                sourceRoot,
                target
            ).split(sep)

            if (fromLayer === "features" && applicationLayers.has(layer)) {
                context.report({
                    node: source,
                    messageId: "application",
                    data: { layer }
                })
            }
            if (fromLayer === "utils" && layer === "features") {
                context.report({ node: source, messageId: "utility" })
            }
            if (!moduleLayers.has(layer) || !module || module === "index.ts") {
                return
            }

            const ownModule = layer === fromLayer && module === fromModule
            const entry =
                members.length === 0 ||
                (members.length === 1 &&
                    /^index(?:\.[cm]?[jt]sx?)?$/.test(members[0]))
            if (ownModule && entry) {
                context.report({ node: source, messageId: "internal" })
            }
            if (!ownModule && !entry) {
                context.report({
                    node: source,
                    messageId: "entry",
                    data: { layer, module }
                })
            }
        }

        const checkSource = node => check(node.source)

        return {
            ImportDeclaration: checkSource,
            ExportNamedDeclaration: checkSource,
            ExportAllDeclaration: checkSource,
            ImportExpression: checkSource,
            TSImportType: node => check(node.argument?.literal ?? node.source)
        }
    }
}
