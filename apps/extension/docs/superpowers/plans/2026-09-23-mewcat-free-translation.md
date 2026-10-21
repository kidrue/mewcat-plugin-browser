# mewCat Free Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 取消 `mewCat-service` 的邀请码授权，并让 Chrome 扩展通过自动设备注册使用开发者部署的免费 AI 翻译服务。

**Architecture:** 服务端保留加密设备注册接口，但按设备公钥直接创建或恢复 `clientId`；扩展仅在 background service worker 中加载本地 SDK、持久化不可导出密钥并透明注册。扩展翻译器负责遵守服务端 20 段/5000 UTF-16 字符限制并保持现有批次分隔协议，content script 只能通过现有类型化消息通道调用固定生产服务。

**Tech Stack:** Node.js 22、TypeScript、Fastify、Prisma 7、SQLite、JOSE/Web Crypto、WXT 0.21.4、Chrome MV3、React、Vitest、pnpm 10。

**Spec:** `docs/superpowers/specs/2026-09-23-mewcat-free-translation-design.md`

## Global Constraints

- 修改范围包含 `C:\project\mewCat-service` 与 `C:\project\chorme-translate` 两个独立 Git 仓库；每次提交只暂存对应任务文件，不包含用户已有改动。
- 服务端继续使用 `POST /v1/clients/register`、JWE + JWS、不可导出客户端私钥、设备撤销、nonce 防重放和现有额度模型。
- 生产 API origin 固定为 `https://api.mewcat.kidrue.top`。
- 当前生产签名公钥 RFC 7638 SHA-256 指纹固定为 `2PwINHNph8uVzKJ2nJqxQIKmtl3AJ_mvG9Pz5hYbV1A`；发布前必须与部署主机 `npm run admin -- keys` 输出再次核对。
- mewCat 单次翻译最多 20 段，输入合计最多 5000 个 JavaScript UTF-16 字符单元，任何分片不得拆开代理对。
- 扩展批次分隔符保持为 `\n\n%%\n\n`，默认翻译服务继续是 `google-translate`。
- SDK 必须作为扩展本地代码打包；不得加载远程脚本，不得把 `CryptoKey` 写入 `chrome.storage`，不得向网页或 content script 暴露密钥、SDK实例或任意请求 URL。
- SDK 和扩展不得自动重试翻译请求；上游失败可能已经产生费用。
- `src/` 修改完成后在扩展仓库执行 `pnpm format`，所有提交信息使用简体中文，Conventional Commits 类型和代码标识符保持原样。

## Review Focus

- 同一安装并发发起首次翻译时，只生成一组设备密钥，并让所有请求复用同一个注册结果；Task 4 的并发初始化测试锁定该行为。
- 服务端已经提交注册但响应丢失时，原密钥再次注册应恢复同一 `clientId`，不能创建第二设备；Task 1 和 Task 2 均覆盖恢复路径。
- 正好跨越 5000 UTF-16 单元的 emoji、批次分隔符和空白段落必须保持合法顺序；Task 5 的分片与重组测试覆盖这些输入。
- 用户取消与超时都表现为中止，但必须映射成不同提示并清理活动控制器；Task 4 的受控 fetch 测试覆盖两类信号。
- `QUOTA_EXCEEDED`、`CLIENT_REVOKED`、响应数量不符和服务器签名失败均不得触发自动重试或返回部分译文；Task 4 和 Task 5 的错误测试锁定该行为。

---

### Task 1: 移除邀请码数据模型并保留设备恢复能力

**Files:**
- Modify: `C:\project\mewCat-service\prisma\schema.prisma`
- Create: `C:\project\mewCat-service\prisma\migrations\20260923000000_remove_invitations\migration.sql`
- Modify: `C:\project\mewCat-service\src\store.ts`
- Modify: `C:\project\mewCat-service\tests\helpers.ts`
- Modify: `C:\project\mewCat-service\tests\store.test.ts`

**Interfaces:**
- Consumes: 现有 `Store.atomic()`、`Client.keyThumbprint` 和 `calculateJwkThumbprint()`。
- Produces: `Store.registerClient(name: string, signing: JWK, encryption: JWK): Promise<Client>`；相同签名/加密公钥返回已有客户端。

- [x] **Step 1: 将 Store 测试改成无邀请码注册并添加迁移保留测试**

在 `tests/store.test.ts` 中把辅助函数改为：

```ts
async function register() {
  return store.registerClient(
    '测试扩展',
    { kty: 'EC', crv: 'P-256', x: crypto.randomUUID(), y: 'test' },
    { kty: 'RSA', n: 'test', e: 'AQAB' },
  );
}
```

删除邀请码并发/过期用例，新增以下行为用例：

```ts
it('相同设备可恢复原 clientId，不能更换响应公钥或恢复已撤销身份', async () => {
  const signing = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' };
  const encryption = { kty: 'RSA', n: 'n', e: 'AQAB' };
  const registered = await store.registerClient('extension', signing, encryption);
  expect((await store.registerClient('extension', signing, encryption)).id).toBe(registered.id);
  expect(await store.db.client.count()).toBe(1);
  await expect(store.registerClient('extension', signing, { ...encryption, n: 'different' }))
    .rejects.toMatchObject({ code: 'CLIENT_EXISTS' });
  await store.revokeClient(registered.id);
  await expect(store.registerClient('extension', signing, encryption))
    .rejects.toMatchObject({ code: 'CLIENT_REVOKED' });
});
```

新增迁移用例：先只执行 `20260920000000_init/migration.sql`，插入带 `registrationTokenHash` 的客户端，再执行新迁移，断言原 `id`、公钥和 `revokedAt` 保留，并且 `Invitation` 表和 `registrationTokenHash` 列均不存在。

- [x] **Step 2: 运行 Store 测试并确认失败**

```powershell
Set-Location C:\project\mewCat-service
npx vitest run tests/store.test.ts
```

Expected: FAIL，错误包含 `registerClient` 参数不匹配、邀请码校验失败或新迁移文件不存在。

- [x] **Step 3: 更新 Prisma schema 和 SQLite 迁移**

将 `Client` 改为：

```prisma
model Client {
  id            String   @id @default(uuid())
  name          String
  signingKey    String
  encryptionKey String
  keyThumbprint String   @unique
  createdAt     DateTime @default(now())
  revokedAt     DateTime?
  nonces        Nonce[]
  requests      TranslationRequest[]
}
```

完全删除 `Invitation` model。新迁移内容：

```sql
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "signingKey" TEXT NOT NULL,
    "encryptionKey" TEXT NOT NULL,
    "keyThumbprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);
INSERT INTO "new_Client" ("id", "name", "signingKey", "encryptionKey", "keyThumbprint", "createdAt", "revokedAt")
SELECT "id", "name", "signingKey", "encryptionKey", "keyThumbprint", "createdAt", "revokedAt" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE UNIQUE INDEX "Client_keyThumbprint_key" ON "Client"("keyThumbprint");
DROP TABLE "Invitation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
```

- [x] **Step 4: 实现无邀请码的 `Store.registerClient()` 并更新迁移测试辅助器**

删除 `randomBytes`、`hashToken()` 和 `issueInvitation()`。注册核心逻辑为：

```ts
async registerClient(name: string, signing: JWK, encryption: JWK) {
  const keyThumbprint = await calculateJwkThumbprint(signing);
  try {
    return await this.atomic(async (tx) => {
      const existing = await tx.client.findUnique({ where: { keyThumbprint } });
      if (existing) {
        if (existing.revokedAt) throw new ApiError(403, 'CLIENT_REVOKED', '客户端已被停用');
        const stored = JSON.parse(existing.encryptionKey) as JWK;
        if (await calculateJwkThumbprint(stored) === await calculateJwkThumbprint(encryption)) return existing;
        throw new ApiError(409, 'CLIENT_EXISTS', '该设备密钥已注册，但响应公钥不匹配');
      }
      return tx.client.create({ data: { name, signingKey: JSON.stringify(signing), encryptionKey: JSON.stringify(encryption), keyThumbprint } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'CLIENT_EXISTS', '该设备密钥已注册');
    }
    throw error;
  }
}
```

更新 `tests/helpers.ts`，按目录名排序并依次执行所有 `prisma/migrations/*/migration.sql`，确保测试数据库包含完整迁移链。

- [x] **Step 5: 运行 Store 测试与 Prisma 生成**

```powershell
npm run db:generate
npx vitest run tests/store.test.ts
```

Expected: PASS，迁移用例证明旧客户端保留且邀请码结构消失。

- [x] **Step 6: 提交服务端数据模型改动**

```powershell
git add prisma/schema.prisma prisma/migrations/20260923000000_remove_invitations/migration.sql src/store.ts tests/helpers.ts tests/store.test.ts
git commit -m "refactor(auth): 移除邀请码数据模型"
```

### Task 2: 修改注册 API、浏览器 SDK 与协议测试

**Files:**
- Modify: `C:\project\mewCat-service\src\contracts.ts`
- Modify: `C:\project\mewCat-service\src\app.ts`
- Modify: `C:\project\mewCat-service\client\index.ts`
- Modify: `C:\project\mewCat-service\package.json`
- Modify: `C:\project\mewCat-service\tests\app.test.ts`
- Modify: `C:\project\mewCat-service\tests\client.test.ts`
- Modify: `C:\project\mewCat-service\tests\ingress.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Store.registerClient(name, signingKey, encryptionKey)`。
- Produces: `TranslationClient.register(name?: string): Promise<string>`；注册业务数据不含 `invitation`。

- [x] **Step 1: 先把 API 与 SDK 测试改为无邀请码调用**

在 `tests/app.test.ts` 的 `register()` helper 中发送：

```ts
{ name: 'Chrome Translate', signingKey: publicClient.signingKey, encryptionKey: publicClient.encryptionKey }
```

在 `tests/client.test.ts` 使用 `await client.register('chorme-translate')`。将响应丢失恢复用例改为使用同一个持久化 `state` 两次调用 `register()`，断言数据库只有一个客户端。添加严格对象测试：额外发送 `invitation` 字段得到 `400 INVALID_REQUEST`。在 `tests/ingress.test.ts` 明确断言 `REGISTRATIONS_PER_IP_PER_DAY` 仍限制公开注册。

- [x] **Step 2: 运行测试并确认失败**

```powershell
npx vitest run tests/app.test.ts tests/client.test.ts tests/ingress.test.ts
```

Expected: FAIL，注册 schema 仍要求 `invitation`，SDK 仍把第一个参数作为邀请码。

- [x] **Step 3: 修改注册 schema 与 Fastify route**

```ts
export const registrationSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  signingKey: signingPublicKeySchema,
  encryptionKey: encryptionPublicKeySchema,
});
```

注册 action 调用：

```ts
const client = await store.registerClient(data.name, data.signingKey, data.encryptionKey);
```

其余注册 IP 日限额和加密响应逻辑不变。

- [x] **Step 4: 修改浏览器 SDK 注册接口**

```ts
async register(name = 'chorme-translate'): Promise<string> {
  if (this.state.clientId) throw new Error('客户端已经注册');
  const keys = await publicKeys(this.state.identity, 'registration');
  const result = z.strictObject({ clientId: z.string().uuid() }).parse(
    await this.request('/v1/clients/register', {
      name,
      signingKey: keys.signingKey,
      encryptionKey: keys.encryptionKey,
    }, true),
  );
  this.state.clientId = result.clientId;
  return result.clientId;
}
```

- [x] **Step 5: 运行目标测试和 SDK 构建**

先将 `build:client` 改成生成可 vendoring 的压缩 ESM：

```json
"build:client": "esbuild client/browser.ts --bundle --minify --platform=browser --format=esm --target=chrome120 --outfile=dist/client/mewcat.js"
```

```powershell
npx vitest run tests/app.test.ts tests/client.test.ts tests/ingress.test.ts tests/protocol.test.ts
npm run typecheck
npm run build:client
```

Expected: 全部 PASS；生成的声明签名为 `register(name?: string): Promise<string>`。

- [x] **Step 6: 提交服务端协议改动**

```powershell
git add src/contracts.ts src/app.ts client/index.ts package.json tests/app.test.ts tests/client.test.ts tests/ingress.test.ts
git commit -m "feat(auth): 支持设备无邀请码注册"
```

### Task 3: 清理服务端管理命令并更新接口文档

**Files:**
- Modify: `C:\project\mewCat-service\scripts\admin.ts`
- Modify: `C:\project\mewCat-service\README.md`
- Modify: `C:\project\mewCat-service\docs\api.md`
- Modify: `C:\project\mewCat-service\docs\protocol.md`
- Modify: `C:\project\mewCat-service\docs\deploy-aliyun.md`
- Modify: `C:\project\mewCat-service\docs\github-actions-deploy.md`
- Modify: `C:\project\mewCat-service\docs\implementation-progress.md`
- Modify: `C:\project\mewCat-service\.env.example`

**Interfaces:**
- Consumes: Task 2 的无邀请码注册契约。
- Produces: 管理 CLI 仅包含 `keys | clients | revoke <clientId> | cleanup`；文档示例调用 `client.register('mewCat Chrome Extension')`。

- [x] **Step 1: 删除 CLI 的 `invite` 分支**

帮助文字改为：

```ts
console.log('命令：keys | clients | revoke <clientId> | cleanup');
```

允许命令集合改为 `['clients', 'revoke', 'cleanup']`，删除整个 `case 'invite'`。

- [x] **Step 2: 更新公开文档中的注册示例与安全说明**

文档统一使用：

```ts
if (!saved?.clientId) {
  await saveClientState(serviceOrigin, client.getState());
  await client.register('mewCat Chrome Extension');
  await saveClientState(serviceOrigin, client.getState());
}
```

删除邀请码生成、有效期、哈希存储和 `INVALID_INVITATION`；把防滥用描述改为“公开设备注册 + 注册 IP 日限额 + 设备/IP/全站翻译额度”。`.env.example` 保留 `REGISTRATIONS_PER_IP_PER_DAY=10`，注释说明它限制公开设备注册。

- [x] **Step 3: 扫描残留邀请码引用**

```powershell
rg -n "invitation|invite|邀请码|INVALID_INVITATION|registrationTokenHash|Invitation" src client scripts prisma README.md docs tests .env.example -g "!docs/superpowers/**"
```

Expected: 无输出。

- [x] **Step 4: 运行服务端完整验证**

```powershell
npm test
npm run typecheck
npm run build
npm run smoke
```

Expected: 全部退出码为 0，`dist/client/mewcat.js` 为最新无邀请码 SDK。

- [x] **Step 5: 提交服务端文档与 CLI 改动**

```powershell
git add scripts/admin.ts README.md docs/api.md docs/protocol.md docs/deploy-aliyun.md docs/github-actions-deploy.md docs/implementation-progress.md .env.example
git commit -m "docs(auth): 更新公开设备注册流程"
```

### Task 4: 在扩展 background 中封装并验证 SDK 生命周期

**Files:**
- Modify: `C:\project\chorme-translate\src\constants\translationServices.ts`
- Create: `C:\project\chorme-translate\src\vendor\mewcat.min.js`
- Create: `C:\project\chorme-translate\src\vendor\mewcat.min.d.ts`
- Create: `C:\project\chorme-translate\src\background\lib\mewcat-service.ts`
- Create: `C:\project\chorme-translate\test\mewcat-background-service.test.ts`
- Create: `C:\project\chorme-translate\.prettierignore`
- Modify: `C:\project\chorme-translate\eslint.config.mjs`

**Interfaces:**
- Consumes: Task 2 生成的 `C:\project\mewCat-service\dist\client\mewcat.js`。
- Produces: `createMewCatService(dependencies?): { translate(input: MewCatTranslateInput): Promise<string[]>; abortAll(): void }` 和进程级 `mewCatService` 单例。

- [x] **Step 1: 为自动注册、并发初始化、错误恢复和中止写失败测试**

测试使用注入的 SDK adapter，不加载真实网络 bundle。核心断言：

```ts
const service = createMewCatService({ sdk, fetchImpl });
const [first, second] = await Promise.all([
  service.translate({ texts: ['one'], targetLanguage: 'zh-CN' }),
  service.translate({ texts: ['two'], targetLanguage: 'zh-CN' }),
]);
expect(createIdentity).toHaveBeenCalledTimes(1);
expect(register).toHaveBeenCalledTimes(1);
expect(saveClientState).toHaveBeenNthCalledWith(1, MEWCAT_SERVICE_ORIGIN, stateWithoutClientId);
expect(saveClientState).toHaveBeenLastCalledWith(MEWCAT_SERVICE_ORIGIN, stateWithClientId);
expect(first).toEqual(['一']);
expect(second).toEqual(['二']);
```

再覆盖：已有 `clientId` 不注册；初始化失败后下一次调用可重试；`QUOTA_EXCEEDED` 只调用一次 translate；`abortAll()` 产生“mewCat 翻译请求已取消”；SDK超时产生“mewCat 翻译请求超时”；公钥指纹错误产生“mewCat 服务身份校验失败”。

- [x] **Step 2: 运行 background 服务测试并确认失败**

```powershell
Set-Location C:\project\chorme-translate
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-background-service.test.ts
```

Expected: FAIL，模块 `src/background/lib/mewcat-service.ts` 不存在。

- [x] **Step 3: 同步本地 SDK 产物与类型声明**

```powershell
Copy-Item -LiteralPath 'C:\project\mewCat-service\dist\client\mewcat.js' -Destination 'C:\project\chorme-translate\src\vendor\mewcat.min.js'
```

`src/vendor/mewcat.min.d.ts` 明确定义以下公开类型：

```ts
export interface MewCatClientState {
  identity: { signing: CryptoKeyPair; encryption: CryptoKeyPair };
  clientId?: string;
}

export interface MewCatTranslationClient {
  getState(): MewCatClientState;
  register(name?: string): Promise<string>;
  translate(input: {
    texts: string[];
    targetLanguage: string;
    sourceLanguage?: string;
  }): Promise<{ translations: string[] }>;
}

export class TranslationError extends Error {
  readonly code: string;
  readonly status: number;
}

export const TranslationClient: {
  connect(options: {
    baseUrl: string;
    state?: MewCatClientState;
    fetcher?: typeof fetch;
    pinnedSigningThumbprint?: string;
    timeoutMs?: number;
  }): Promise<MewCatTranslationClient>;
};

export function loadClientState(serviceOrigin: string): Promise<MewCatClientState | undefined>;
export function saveClientState(serviceOrigin: string, state: MewCatClientState): Promise<void>;
```

`.prettierignore` 添加 `src/vendor/mewcat.min.js`；`eslint.config.mjs` 的 `ignores` 添加 `"**/vendor/*.min.js"`。cspell 已通过 `**/*.min.js` 忽略生成产物。业务代码从 `@/vendor/mewcat.min.js` 导入 SDK，避免格式化或 lint 改写生成文件。

- [x] **Step 4: 添加固定服务常量和 SDK 生命周期管理器**

`src/constants/translationServices.ts` 添加：

```ts
export const MEWCAT_TRANSLATE_MODEL_ID = 'mewcat-translate';
export const MEWCAT_SERVICE_ORIGIN = 'https://api.mewcat.kidrue.top';
export const MEWCAT_SIGNING_THUMBPRINT = '2PwINHNph8uVzKJ2nJqxQIKmtl3AJ_mvG9Pz5hYbV1A';
export const MEWCAT_TRANSLATE_TIMEOUT_MS = 45_000;
```

`mewcat-service.ts` 使用一个 `initializationPromise` 串行化身份恢复和注册。创建新身份后先保存 `client.getState()`，注册成功后再次保存。失败时在 `finally` 中仅清除仍指向当前 Promise 的缓存，允许下次用户操作重试。

为 SDK 注入受控 fetcher：每次 fetch 创建 `AbortController` 并加入 `activeControllers`，使用 `AbortSignal.any([init.signal, controller.signal])` 合并 SDK超时与用户取消信号，`finally` 删除 controller。`abortAll()` 先把 controller 加入 `manuallyAborted` WeakSet 再调用 `abort()`，错误映射据此区分“已取消”和“请求超时”。

错误映射表：

```ts
const ERROR_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED: '今日免费翻译额度已用完',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  CLIENT_REVOKED: '当前设备已被停用',
  SERVER_BUSY: '免费翻译服务繁忙，请稍后重试',
  UPSTREAM_UNAVAILABLE: '免费翻译服务暂时不可用',
  UPSTREAM_INVALID_RESPONSE: '免费翻译服务返回了无效结果',
  UPSTREAM_TIMEOUT: '免费翻译服务响应超时',
  KEYS_UNAVAILABLE: '无法连接免费翻译服务',
};
```

普通 `Error` 若包含固定指纹或签名校验失败信息，统一返回“mewCat 服务身份校验失败”，不得回退接受响应。

- [x] **Step 5: 运行 background 服务测试**

```powershell
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-background-service.test.ts
```

Expected: PASS，所有失败场景的 translate 调用次数均为 1。

- [x] **Step 6: 格式化并提交 SDK 生命周期模块**

```powershell
pnpm format
git add .prettierignore eslint.config.mjs src/constants/translationServices.ts src/vendor/mewcat.min.js src/vendor/mewcat.min.d.ts src/background/lib/mewcat-service.ts test/mewcat-background-service.test.ts
git commit -m "feat(translation): 集成免费翻译客户端"
```

### Task 5: 实现请求协议、Unicode 安全分片与批次重组

**Files:**
- Modify: `C:\project\chorme-translate\src\types\request.ts`
- Modify: `C:\project\chorme-translate\src\background\messages\translate-request.ts`
- Create: `C:\project\chorme-translate\src\translation\MewCatTranslator.ts`
- Create: `C:\project\chorme-translate\test\mewcat-translate.test.ts`
- Modify: `C:\project\chorme-translate\package.json`

**Interfaces:**
- Consumes: Task 4 的 `mewCatService.translate()` 与 `abortAll()`。
- Produces: `RequestType.MEWCAT_TRANSLATE`、`MewCatTranslateRequestConfig`、`MewCatTranslator implements TranslatorInterface`。

- [x] **Step 1: 写请求路由、边界分片、空白保留和错误响应测试**

测试 sender 捕获每次请求的 `config.texts` 并逐项原样返回。边界输入：

```ts
const longSegment = 'a'.repeat(4999) + '😀' + 'b'.repeat(5000);
const messages = [
  { role: 'user', content: `${longSegment}\n\n%%\n\n   \n\n%%\n\ntail` },
];
```

断言每个请求最多 20 项、合计 `<= 5000`；没有请求项以高代理结尾或低代理开头；空白段不发送但原样保留；最终文本严格等于输入。再模拟少返回一个 translation，断言抛出“mewCat 翻译返回数量不匹配”，且不返回部分结果。

background 路由测试断言 `MEWCAT_TRANSLATE` 返回 `{ translations: ['你好'] }`；`ABORT` 同时调用 Task 4 的 `abortAll()`。

- [x] **Step 2: 运行翻译器测试并确认失败**

```powershell
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-translate.test.ts
```

Expected: FAIL，`MewCatTranslator` 和 `RequestType.MEWCAT_TRANSLATE` 不存在。

- [x] **Step 3: 扩展类型化请求协议和 background handler**

`src/types/request.ts` 添加：

```ts
MEWCAT_TRANSLATE = 'mewcat_translate',

export interface MewCatTranslateRequestConfig {
  texts: string[];
  targetLanguage: string;
  sourceLanguage?: string;
}
```

在 `UnifiedRequestBody` 添加对应联合成员。`translate-request.ts` 的 switch 添加：

```ts
case RequestType.MEWCAT_TRANSLATE:
  return sendSuccess({ translations: await mewCatService.translate(body.config) });
```

`handleAbortRequest()` 在中止现有 controller 后调用 `mewCatService.abortAll()`。

- [x] **Step 4: 实现 `MewCatTranslator` 的计划/执行分离**

```ts
const BATCH_SEPARATOR = '\n\n%%\n\n';
const MAX_ITEMS = 20;
const MAX_CHARACTERS = 5000;

interface TranslationPiece {
  segmentIndex: number;
  text: string;
}

export function createMewCatBatches(segments: string[]): TranslationPiece[][];
```

分片算法逐段处理：空白段不产生请求项；非空段按 `text.length` 分片，在边界字符为高代理时向前移动一个 UTF-16 单元。按顺序把 piece 装入批次，添加后不得超过 `MAX_ITEMS` 或 `MAX_CHARACTERS`。

执行阶段为每个 segment 创建字符串数组；空白段直接放回原文；每个批次请求后先验证 `translations.length === pieces.length`，再按 `segmentIndex` 追加。`translateText()` 使用 `messages.map(content).join('\n')` 作为单段并以空字符串连接分片；`translateBatch()` 将所有 message 内容按 `BATCH_SEPARATOR` 展开成逻辑段，并用同一分隔符连接最终结果。

响应验证：

```ts
if (!response.success) throw new Error(response.error || 'mewCat 翻译请求失败');
const translations = (response.content as { translations?: unknown })?.translations;
if (!Array.isArray(translations) || !translations.every(item => typeof item === 'string')) {
  throw new Error('mewCat 翻译返回了无法识别的响应');
}
```

- [x] **Step 5: 运行翻译器与现有免费服务回归测试**

```powershell
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-translate.test.ts test/microsoft-translate.test.ts
pnpm test:google
```

Expected: 全部 PASS。

- [x] **Step 6: 把 mewCat 测试加入常规门禁并提交**

将脚本改为：

```json
"test:microsoft": "vitest run --config test/vitest.image-translation.config.ts test/microsoft-translate.test.ts test/mewcat-background-service.test.ts test/mewcat-translate.test.ts"
```

先运行 `pnpm format`。由于 `package.json` 已存在用户改动，使用 `git add -p package.json` 只暂存本任务脚本 hunk：

```powershell
git add src/types/request.ts src/background/messages/translate-request.ts src/translation/MewCatTranslator.ts test/mewcat-translate.test.ts
git add -p package.json
git commit -m "feat(translation): 支持免费服务分片翻译"
```

### Task 6: 接入服务选择、运行时路由与配置修复

**Files:**
- Modify: `C:\project\chorme-translate\src\state\translationService.ts`
- Modify: `C:\project\chorme-translate\src\translation\translationService.ts`
- Modify: `C:\project\chorme-translate\test\mewcat-translate.test.ts`
- Modify: `C:\project\chorme-translate\test\translation-service.test.ts`
- Modify: `C:\project\chorme-translate\src\options\TokenUsage.tsx`

**Interfaces:**
- Consumes: Task 5 的 `MewCatTranslator` 和 `MEWCAT_TRANSLATE_MODEL_ID`。
- Produces: `resolveTranslationServiceId()`、`getTranslationServiceOptions()`、`translateText()` 和 `translateBatch()` 对内置 mewCat 服务的完整支持。

- [x] **Step 1: 添加服务选择和路由失败测试**

在 `test/mewcat-translate.test.ts` 添加：

```ts
const config = {
  currentModel: 'mewcat-translate',
  aiModelList: [],
  aiRole: AiRole.DEFAULT,
};

expect(resolveTranslationServiceId(config)).toBe('mewcat-translate');
expect(getTranslationServiceOptions([])).toContainEqual({
  value: 'mewcat-translate',
  label: 'mewCat AI 翻译（免费）',
});
```

通过注入 `mewcatRequestSender` 断言 `translateText()` 与 `translateBatch()` 都发出 `RequestType.MEWCAT_TRANSLATE`，且不调用 model gateway。`translation-service.test.ts` 增加断言：选择 mewCat 时概念解释仍回退到第一个可用生成式模型，`hasAITranslationEnabled()` 返回 `false`。

- [x] **Step 2: 运行服务选择测试并确认失败**

```powershell
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-translate.test.ts test/translation-service.test.ts
```

Expected: FAIL，当前配置修复回退到 Google，运行时也没有 mewCat 分支。

- [x] **Step 3: 扩展内置服务识别与选项**

`resolveTranslationServiceId()` 将三个内置 ID 视为有效选择；`getTranslationServiceOptions()` 在 Microsoft 之后加入：

```ts
{
  value: MEWCAT_TRANSLATE_MODEL_ID,
  label: 'mewCat AI 翻译（免费）',
}
```

`getSelectedModel()` 对三个内置 ID 均返回 `undefined`，避免误入 Google fallback。

- [x] **Step 4: 添加运行时翻译路由和依赖注入**

`TranslationServiceDependencies` 添加：

```ts
mewcatRequestSender?: TranslateRequestSender;
```

在 Google fallback 之前增加 mewCat 分支：

```ts
if (resolveTranslationServiceId(config) === MEWCAT_TRANSLATE_MODEL_ID) {
  return new MewCatTranslator(dependencies.mewcatRequestSender)
    .translateText(messages, targetLanguage);
}
```

`translateBatch()` 使用对应的 `translateBatch()`。`hasAITranslationEnabled()` 继续只根据生成式 `BaseModel` 返回 true。更新 `TokenUsage.tsx` 说明文字，把 mewCat 免费翻译列入“不计入 AI token 统计”的服务。

- [x] **Step 5: 运行服务层测试、格式化和类型检查**

```powershell
pnpm format
pnpm exec vitest run --config test/vitest.image-translation.config.ts test/mewcat-translate.test.ts test/translation-service.test.ts test/microsoft-translate.test.ts
pnpm typecheck
```

Expected: 全部 PASS。

- [x] **Step 6: 提交服务选择与路由改动**

```powershell
git add src/state/translationService.ts src/translation/translationService.ts src/options/TokenUsage.tsx test/mewcat-translate.test.ts test/translation-service.test.ts
git commit -m "feat(translation): 接入 mewCat 免费翻译服务"
```

### Task 7: 完成跨仓库验证、部署检查与文档同步

**Files:**
- Modify: `C:\project\chorme-translate\README.md`
- Modify: `C:\project\chorme-translate\docs\superpowers\plans\2026-09-23-mewcat-free-translation.md`（仅勾选执行状态，不改变设计）

**Interfaces:**
- Consumes: Tasks 1–6 的完整服务端与扩展实现。
- Produces: 可部署的服务端、可发布的扩展构建和与实现一致的项目文档。

- [x] **Step 1: 更新扩展文档中的服务列表和默认配置说明**

README 说明 mewCat 是内置免费文本翻译服务：首次使用自动创建设备身份；身份保存在 IndexedDB；生产 endpoint 固定；不需要 API Key 或邀请码；默认服务仍为 Google；该服务不支持图片翻译、摘要和概念解释。

- [ ] **Step 2: 校验生产公钥指纹与 CORS 部署配置**

执行结果（2026-09-23）：公开 `/v1/keys` 的签名指纹与固定值一致；正式扩展 Origin 的公钥请求和注册预检均返回 `403`。需先将生产 `ALLOWED_ORIGINS` 更新为 `chrome-extension://dbginmjacelgagkfhjkhcbajnaalolfp` 并部署本次服务端版本，因此本步骤保持未完成。

在部署主机使用现有密钥文件只读计算 `signingKey` 指纹，不重新生成密钥：

```sh
cd /opt/mewCat-service
docker compose run --rm migrate node --input-type=module -e "import { calculateJwkThumbprint } from 'jose'; import { loadKeys } from './dist/src/keys.js'; const keys = await loadKeys(process.env.KEYS_FILE); console.log(await calculateJwkThumbprint(keys.publicKeys.signingKey));"
```

确认输出严格等于：

```text
2PwINHNph8uVzKJ2nJqxQIKmtl3AJ_mvG9Pz5hYbV1A
```

确认生产 `.env` 的 `ALLOWED_ORIGINS` 包含正式 `chrome-extension://dbginmjacelgagkfhjkhcbajnaalolfp`；本地开发 origin 只加入开发环境，不扩大生产白名单。若指纹不同，停止扩展发布，先查明服务器密钥是否轮换，并通过代码评审更新固定常量。

- [x] **Step 3: 运行服务端完整门禁**

```powershell
Set-Location C:\project\mewCat-service
npm test
npm run typecheck
npm run build
npm run smoke
```

Expected: 全部退出码为 0。

- [x] **Step 4: 运行扩展完整门禁和生产构建**

```powershell
Set-Location C:\project\chorme-translate
pnpm format
pnpm check
pnpm build
```

Expected: 全部退出码为 0；生产 ZIP成功生成；构建输出不包含远程脚本引用、邀请码字符串或服务端私钥。

- [x] **Step 5: 检查两个仓库的差异边界**

```powershell
git -C C:\project\mewCat-service status --short
git -C C:\project\mewCat-service log -4 --oneline
git -C C:\project\chorme-translate status --short
git -C C:\project\chorme-translate log -5 --oneline
```

Expected: 服务端仅包含本计划提交；扩展原有 `package.json`、`.codex/config.toml`、`.codex/hooks.json` 用户改动仍被保留且未被意外提交。若 `package.json` 的测试脚本 hunk已作为 Task 5 提交，其他既有 hunk仍留在工作区。

- [x] **Step 6: 提交扩展文档更新**

```powershell
git add README.md docs/superpowers/plans/2026-09-23-mewcat-free-translation.md
git commit -m "docs(translation): 记录免费翻译服务接入"
```

- [ ] **Step 7: 执行人工验收**

待生产服务完成部署与 CORS 更新后执行。

1. 新安装选择“mewCat AI 翻译（免费）”，第一次翻译无需邀请码并成功返回。
2. 同时触发页面翻译和划词翻译，不出现重复设备或注册冲突。
3. 重启浏览器后继续翻译，服务端 `admin clients` 中仍是同一 `clientId`。
4. 翻译包含 emoji、超过 5000 字符和多个段落的页面，译文顺序正确且无乱码。
5. 断网、达到额度、撤销设备和点击停止时显示对应安全错误，不自动重试。
6. Google、Microsoft 和用户配置的 LLM/DeepL 服务仍能正常选择与翻译。
