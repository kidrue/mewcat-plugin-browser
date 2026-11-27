# Chrome Web Store 自动发布配置

扩展版本由 `apps/extension/package.json` 的 `version` 决定。[发布工作流](../../../.github/workflows/release-extension.yml)在 `main` 的相关路径更新后自动触发，也支持手动派发。Linux runner 检查和构建扩展，将固定产物保存到 draft GitHub Release，通过 Chrome Web Store API V2 上传同一份 ZIP 并提交审核。商店步骤成功后，工作流将 draft 转为正式 GitHub Release 并标记为 latest。商店上架仍须经过 Chrome Web Store 审核。

## 安全模型

本项目使用 GitHub OIDC + Google Cloud Workload Identity Federation 获取最长 15 分钟的短期访问令牌：

- 不创建或保存 Google Service Account JSON 私钥
- 不把访问令牌、Publisher ID 或 Extension ID 写入仓库文件
- OIDC 只允许指定 GitHub 仓库的 `main` 分支模拟 Service Account
- 工作流通过 `id-token: write` 取得 GitHub OIDC 凭证，交换 `chromewebstore` scope 的访问令牌，只传给 `apps/extension/scripts/chrome-web-store.cjs`。脚本不会输出令牌或请求头
- 第三方 GitHub Actions 固定到完整 commit SHA，不依赖可变 major tag
- `.env.local` 不参与 CI，禁止在其中保存生产发布凭据后再提交

`CWS_PUBLISHER_ID`、`CWS_EXTENSION_ID`、Service Account 邮箱和 Workload Identity Provider 资源名是标识符，不是认证密钥，统一保存为 GitHub Actions Variables。现有 `CRX_PRIVATE_KEY_B64` 仍必须保存为 GitHub Actions Secret。

## 前置条件

1. Chrome Web Store 中已经存在该扩展，并至少手动成功发布过一次当前可见性配置。
2. 商店的 Store listing 和 Privacy 信息已经填写完整。
3. 发布者 Google Account 已开启两步验证。
4. 本地已安装并登录 `gcloud`，且有权管理所选 Google Cloud 项目的 IAM。
5. 已安装并登录 GitHub CLI（`gh`），当前账号能读取目标仓库。

## 1. 创建并授权 Service Account

在 Google Cloud 项目中启用 Chrome Web Store、IAM、IAM Service Account Credentials、Security Token Service 和 Cloud Resource Manager API，然后创建专用 Service Account。该账号不需要项目级角色：

```bash
gcloud services enable \
  chromewebstore.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="PROJECT_ID"

gcloud iam service-accounts create mewcat-cws-publisher \
  --project="PROJECT_ID" \
  --display-name="mewCat Chrome Web Store publisher"
```

Service Account 邮箱形如：

```text
mewcat-cws-publisher@PROJECT_ID.iam.gserviceaccount.com
```

进入 Chrome Web Store Developer Dashboard 的 **Account** 页面，把该邮箱添加为发布 Service Account。Chrome Web Store 当前一个发布者只能关联一个 Service Account。

## 2. 配置 GitHub OIDC

先替换并设置以下变量：

```bash
PROJECT_ID="your-google-cloud-project-id"
GITHUB_REPOSITORY="owner/repository"
GITHUB_REPOSITORY_ID="$(gh api "repos/${GITHUB_REPOSITORY}" --jq '.id')"
GITHUB_OWNER_ID="$(gh api "repos/${GITHUB_REPOSITORY}" --jq '.owner.id')"
SERVICE_ACCOUNT="mewcat-cws-publisher@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github-actions"
PROVIDER_ID="mewcat-main"
```

这里使用 GitHub 不可变的数字 `repository_id` 和 `repository_owner_id` 做信任边界；仓库名称只用于查询数字 ID，不参与 OIDC 授权判断。请确认上面两个查询结果均为纯数字。

创建 Workload Identity Pool 和仅允许当前仓库 `main` 分支的 Provider：

```bash
gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --issuer-uri="https://token.actions.githubusercontent.com/" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id=='${GITHUB_REPOSITORY_ID}' && assertion.repository_owner_id=='${GITHUB_OWNER_ID}' && assertion.ref=='refs/heads/main'"
```

允许该仓库模拟 Service Account：

```bash
POOL_NAME="$(gcloud iam workload-identity-pools describe "${POOL_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format="value(name)")"

gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"
```

获取 Provider 完整资源名：

```bash
gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --format="value(name)"
```

IAM 配置可能需要几分钟才能生效。

开发者中心的登录与 `gcloud auth login` 相互独立。若找不到 Account 页面，先登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)，确认选中了拥有该扩展的发布者，再按 [服务账号官方说明](https://developer.chrome.com/docs/webstore/service-accounts) 查找服务账号绑定入口。新版界面可先查看左侧“发布者 → 设置”。服务账号绑定完成后，才能验证其读取商店状态和提交审核的权限。

## 3. 配置 GitHub Actions Variables

进入仓库 **Settings → Secrets and variables → Actions → Variables**，添加：

| Variable                         | 值                                                 |
| -------------------------------- | -------------------------------------------------- |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | 上一步输出的 Provider 完整资源名                   |
| `CWS_SERVICE_ACCOUNT`            | Service Account 邮箱                               |
| `CWS_PUBLISHER_ID`               | Developer Dashboard → Publisher → Settings 中的 ID |
| `CWS_EXTENSION_ID`               | Chrome Web Store 中现有扩展的 32 位 ID             |

这些值不需要发送给 Codex，也不要写进提交。GitHub Actions Secret 中继续保留现有的 `CRX_PRIVATE_KEY_B64`。

## 4. 配置 CRX 签名与 Sentry

- GitHub 工作流需要 `contents: write`。在仓库 **Settings → Actions → General → Workflow permissions** 检查其写入权限。
- Actions Secret `CRX_PRIVATE_KEY_B64` 保存现有 RSA 私钥的单行 base64 或完整 PEM。首次生成可用 `node apps/extension/scripts/gen-crx-key.cjs`。固定私钥用于保持 CRX 扩展 ID，使手动安装用户可以升级。妥善备份并保留 `.gitignore` 对本地 `key.pem` 的排除。
- Actions Variables 配置 `WXT_SENTRY_DSN`、`SENTRY_ORG`、`SENTRY_PROJECT`，Actions Secret 配置 `SENTRY_AUTH_TOKEN`。新版本构建检查四项值。生产构建保留运行时 DSN，将隐藏 Source Map 上传到 Sentry 后从构建目录清理，ZIP 和 CRX 仅包含运行时文件。`SENTRY_AUTH_TOKEN` 只用于构建。

## 发布与恢复

1. 提高 `apps/extension/package.json` 中的 `version`，提交并推送到 `main`。
2. Linux runner 安装锁定依赖，运行 workspace 测试、共享包构建、扩展检查和 `pnpm build:verify extension`。检查通过后判断该版本是否需要发布。
3. 新版本运行 `pnpm build:extension`，使用固定私钥签名 CRX，计算 `SHA256SUMS`。工作流先把 ZIP、CRX、校验文件组成的恢复包上传到 draft，再同步三个独立附件。
4. Chrome Web Store 脚本校验 ZIP 内版本、检查商店状态、上传 ZIP，等待包处理完成，然后使用 `DEFAULT_PUBLISH`。同版本已发布或在审核中会跳过上传，已暂存的同版本使用 `STAGED_PUBLISH`。商店警告、下架、存在其他待审版本或同版本被拒时，在商店后台核对状态。
5. 商店步骤成功后，工作流执行 `gh release edit`，取消 draft 和 prerelease 标记并设为 latest。在 Chrome Web Store Developer Dashboard 确认商店审核和上架状态。

失败时重新运行同一提交。工作流校验恢复包中 ZIP 和 CRX 的哈希，再复用原包；缺少恢复包的 draft 可以从同一提交重建。已完成的 GitHub Release 会跳过。工作流拒绝覆盖异提交的同版本 draft，以及已有同名 tag 但无 Release 的版本。无论成功或失败，工作流都会清理 runner 中的 `key.pem`、`.output/`、`release/` 和 `dist-assets/`。

如果后端生产开关已启用，且同一次推送会匹配扩展和后端两个发布工作流，只发扩展时可在完成本地 `pnpm check` 和构建验证后，为发布提交加 `[skip ci]`，再手动派发 `release-extension.yml` 到 `main`。手动发布仍执行第 2 步检查。

## 商店资料与隐私披露

商品说明、隐私实践和公开隐私政策链接在开发者后台维护。中文商品说明见[商店文案](chrome-web-store-listing-copy.md)。诊断上报包含错误堆栈和完整页面 URL（含查询参数及片段）。Replay 用于 Popup、Options 和侧边栏中的故障诊断，遮盖文字和输入并阻挡媒体。商店披露应涵盖相应的浏览历史与用户活动，并说明第三方 Sentry 的用途。“关于 → 使用统计”默认关闭，用户开启后的数据范围和保留时间见公开隐私政策。[隐私政策](../../../PRIVACY.md) · [Chrome Web Store 隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

## 本地验证

在 `apps/extension` 运行 `pnpm test:chrome-web-store`，可使用模拟响应验证商店脚本、打包及 Sentry 构建规则。站点规则的跨平台生成验证使用 `pnpm check:hotlink-rules`。

需要复验正式包上报时，在仓库根 `.env.local` 配置上述 Sentry 变量。从 `apps/extension` 运行 `pnpm build`，确认日志包含 `Sentry Source Map：uploaded`，并检查 ZIP 内的运行时 DSN、构建令牌和 Source Map 是否符合上面的构建约定。`pnpm sentry:smoke` 会发送合成错误，用输出的事件 ID 检查请求是否被接收。再用独立的 Chrome 测试配置加载 `.output/chrome-mv3`，在后台和本地测试网页的扩展环境中触发合成异常，按 `environment:production`、`release:mewcat@<version>` 和 `runtime_context` 检查 Sentry 事件入库与堆栈解析。HTTP 200 只确认接收端接受，入库和 Source Map 解析以 Sentry 后台所见为准。
