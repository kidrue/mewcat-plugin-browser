# Chrome Web Store 自动发布配置

项目在 `package.json.version` 升级并推送到 `main` 后，会先执行全量检查和构建，把固定产物保存到 draft GitHub Release，再通过 Chrome Web Store API V2 上传同一份 ZIP、提交审核；商店提交成功后将 draft 转为 GitHub pre-release，商店审核通过后自动发布扩展。

## 安全模型

本项目使用 GitHub OIDC + Google Cloud Workload Identity Federation 获取最长 15 分钟的短期访问令牌：

- 不创建或保存 Google Service Account JSON 私钥
- 不把访问令牌、Publisher ID 或 Extension ID 写入仓库文件
- OIDC 只允许指定 GitHub 仓库的 `main` 分支模拟 Service Account
- 工作流只把短期令牌传给 `scripts/chrome-web-store.cjs`，脚本不会输出令牌或请求头
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

## 3. 配置 GitHub Actions Variables

进入仓库 **Settings → Secrets and variables → Actions → Variables**，添加：

| Variable                         | 值                                                 |
| -------------------------------- | -------------------------------------------------- |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | 上一步输出的 Provider 完整资源名                   |
| `CWS_SERVICE_ACCOUNT`            | Service Account 邮箱                               |
| `CWS_PUBLISHER_ID`               | Developer Dashboard → Publisher → Settings 中的 ID |
| `CWS_EXTENSION_ID`               | Chrome Web Store 中现有扩展的 32 位 ID             |

这些值不需要发送给 Codex，也不要写进提交。GitHub Actions Secret 中继续保留现有的 `CRX_PRIVATE_KEY_B64`。

## 发布流程

1. 修改 `package.json` 的 `version`，版本必须高于商店当前版本。
2. 提交并推送到 `main`。
3. GitHub Actions 执行 `pnpm check`、构建 ZIP/CRX，生成 `SHA256SUMS`，并把三者组成的单一 recovery bundle 保存到 draft GitHub Release。
4. 工作流把 ZIP、CRX 和校验文件同步为独立 Release assets；同步失败可从 recovery bundle 重试。
5. OIDC 换取短期 Chrome Web Store access token。
6. `scripts/chrome-web-store.cjs` 校验 ZIP 内版本、检查当前商店状态、上传 ZIP、等待异步处理结束并使用 `DEFAULT_PUBLISH` 提交审核；提交成功后将 draft 转为 GitHub pre-release，商店审核通过后自动发布扩展。

若工作流中途失败，重新运行同一提交即可：工作流会从 draft Release 下载 recovery bundle、校验哈希并恢复原始 ZIP/CRX，确保商店与 GitHub Release 始终使用同一份产物。若 draft 创建时连 recovery bundle 都未上传成功，自动化会清理这个尚不可能触发过商店发布的不完整 draft，再从同一提交重建。脚本发现相同版本已提交或已发布时会跳过重复上传；后续提交若仍使用同一版本，工作流会拒绝覆盖并要求先升级 `package.json.version`。

## 本地测试

自动测试不会访问 Chrome Web Store，也不需要任何凭据：

```bash
pnpm test:chrome-web-store
```

不要在本地命令历史中直接粘贴长期访问令牌。若必须手工诊断，应通过 `gcloud auth print-access-token` 生成短期令牌，并在完成后清理当前终端环境变量。
