# mewCat 免费翻译服务设计

## 背景与目标

`mewCat-service` 已提供面向 Chrome 扩展的加密翻译 API，但当前客户端首次使用前必须提交一次性邀请码。此次改动取消邀请码授权，让扩展安装后可以自动注册设备，并在现有翻译服务选择器中直接使用开发者部署的免费 AI 翻译服务。

目标如下：

- 用户无需申请、输入或保存邀请码。
- 保留设备身份、签名验证、响应加密、防重放、设备撤销和用量统计。
- 接入现有沉浸式翻译与划词翻译链路，不改变 DOM 译文还原协议。
- 服务端继续通过 IP、设备、全站额度和上游并发限制控制费用。
- 不在本次范围内增加用量展示、图片翻译或概念解释能力。

## 可行性与约束

方案符合 Chrome MV3 与 CSP。浏览器 SDK 作为扩展本地代码打包，运行于 background service worker；设备私钥由 Web Crypto 生成，以不可导出的 `CryptoKey` 形式保存在 IndexedDB，不写入 `chrome.storage`，也不暴露给 content script 或网页。

生产 API 使用 `https://api.mewcat.kidrue.top`。扩展已有 `<all_urls>` host permission，无需新增网络权限。服务端必须在 `ALLOWED_ORIGINS` 中配置正式扩展 ID；本地联调时另行配置开发扩展 ID。发布构建应固定服务端签名公钥的 RFC 7638 SHA-256 指纹，该公开指纹从部署时执行 `admin keys` 的可信输出取得并写入扩展常量，不能在首次联网时自行信任并保存。

取消邀请码意味着攻击者可以创建新设备身份，因此设备日额度不能单独承担费用保护。注册 IP 日限额、IP 分钟与日限额、全站日限额、上游并发限制和供应商账户预算必须继续启用。设备额度仍用于限制单个正常安装并提供用量查询。

## 方案选择

采用“显式注册接口、扩展透明调用”的方案：保留 `POST /v1/clients/register`，但注册数据不再包含 `invitation`。扩展首次请求翻译时自动调用该接口，此后复用保存的 `clientId`。

不将注册合并进翻译接口，因为身份创建、响应接收公钥和翻译计费具有不同的失败与重试语义。也不取消设备注册，否则将失去设备撤销、设备额度、稳定响应加密身份和持久化防重放能力。

浏览器 SDK 暂不发布为独立 npm 包。服务端构建浏览器单文件 SDK，扩展仓库保存该本地产物及类型声明，以避免发布时依赖同级仓库或远程脚本。SDK 更新必须先在服务端完成测试和构建，再同步到扩展。

## 服务端设计

### 注册协议

`POST /v1/clients/register` 的加密前业务数据改为：

```json
{
  "name": "mewCat Chrome Extension",
  "signingKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "<base64url>",
    "y": "<base64url>"
  },
  "encryptionKey": {
    "kty": "RSA",
    "e": "AQAB",
    "n": "<base64url>"
  }
}
```

注册请求仍使用 `registration` 作为 JWS `kid`。服务端使用请求携带的签名公钥验证私钥持有证明，并使用加密公钥加密注册响应。

新设备按签名公钥指纹创建 `Client`。相同签名公钥和相同加密公钥再次注册时返回原 `clientId`，用于恢复“数据库已提交但客户端未收到响应”的情况。相同签名公钥搭配不同加密公钥仍返回 `CLIENT_EXISTS`；已撤销设备返回 `CLIENT_REVOKED`，不能通过重复注册恢复。

### 数据库迁移

新增 Prisma 迁移：

- 从 `Client` 删除 `registrationTokenHash` 及其唯一索引。
- 删除 `Invitation` 表。
- 保留全部 `Client` 主键、公钥、撤销状态、nonce、额度桶和翻译统计。

SQLite 迁移通过新表复制方式保留已有客户端数据。部署顺序为先迁移并发布服务端，再发布扩展。已有已注册客户端可继续翻译；依赖旧邀请码参数但尚未注册的旧客户端必须升级。

### 管理与配置

- 删除 `Store.issueInvitation()` 和邀请码校验逻辑。
- 从管理 CLI 删除 `invite` 命令及相关帮助文字。
- 保留 `REGISTRATIONS_PER_IP_PER_DAY`，其含义改为公开设备注册的 IP 日限额。
- 清理任务不再处理邀请码记录。
- API、协议、README、部署文档和环境变量说明同步更新。

## 扩展设计

### 服务标识与选择

新增内置服务 ID `mewcat-translate`，显示名称为“mewCat AI 翻译（免费）”。它与 `google-translate`、`microsoft-translate` 一样属于内置翻译服务，不加入 `BaseModel` 或 `aiModelList`，也不参与 AI token 统计、图片翻译、文章摘要和概念解释。

`resolveTranslationServiceId()`、服务选择器和配置修复逻辑识别该 ID。默认服务仍为 Google Translate，不自动改变现有用户选择。

### Background 客户端管理

background 新增单一职责的 mewCat 服务模块，负责：

1. 从 IndexedDB 读取生产 API origin 对应的 `ClientState`。
2. 使用固定 API origin 和签名公钥指纹连接服务端。
3. 在创建新身份后、发起注册前先保存状态。
4. 无 `clientId` 时自动调用 `register("mewCat Chrome Extension")`。
5. 注册成功后再次保存包含 `clientId` 的状态。
6. 首次并发请求共享同一个初始化 Promise，避免同一安装重复生成身份或重复注册。
7. 初始化失败后清除内存中的失败 Promise，允许下一次用户操作重试，但不自动重试翻译请求。

客户端只在 background 中使用。content script 通过现有受类型约束的内部消息通道请求翻译，不获取 SDK实例、密钥或任意 URL 请求能力。

### 翻译请求与分片

新增 `MEWCAT_TRANSLATE` 请求类型及对应 background handler 分支。请求字段仅包含文本、源语言、目标语言和超时，不允许网页指定 API origin、模型或凭据。

`MewCatTranslator` 实现现有 `TranslatorInterface`：

- `translateText()` 将消息正文合并为普通文本。
- `translateBatch()` 保持现有 `\n\n%%\n\n` 批次分隔契约。
- 发送前按分隔符识别逻辑段落，并按服务端“最多 20 项、合计最多 5000 UTF-16 字符单元”打包。
- 单段超过 5000 时按 Unicode 安全边界拆分，不拆开代理对；同一段的多个译文片段直接拼接。
- 不同逻辑段的译文用原批次分隔符重新连接，保证 `ImmersiveTranslator` 的结果映射不变。
- 多个服务端批次按顺序执行。SDK 不自动重试任何可能已产生上游费用的翻译请求。

扩展现有默认每次最大文本长度为 1024，但实现仍必须独立遵守服务端 5000 字符上限，以覆盖用户自定义配置和直接调用。

### 取消请求

SDK连接时注入受控 `fetcher`。每次网络操作关联 background 管理的 `AbortController`，并与 SDK超时信号组合。收到现有 `ABORT` 请求时中止活动中的 mewCat 请求，返回“请求已取消”；超时返回“请求超时”。中止不会自动重发请求。

### 错误映射

服务端错误按 `TranslationError.code` 映射为用户可理解的中文信息：

- `QUOTA_EXCEEDED`：今日免费额度已用完。
- `RATE_LIMITED`：请求过于频繁，请稍后重试。
- `CLIENT_REVOKED`：当前设备已被停用。
- `SERVER_BUSY`：服务繁忙，请稍后重试。
- `UPSTREAM_*`：翻译服务暂时不可用。
- `KEYS_UNAVAILABLE`、网络错误或超时：无法连接免费翻译服务。
- 公钥指纹、签名、nonce、path 或响应时间校验失败：服务身份或响应校验失败，不降级接受未验证结果。

错误信息不得包含密钥、密文、原文、内部 URL 或服务端堆栈。

## 数据流

```text
content script
  -> translationService 选择 mewcat-translate
  -> MewCatTranslator 规范化并分片
  -> 内部 translate-request 消息
  -> background mewCat 服务模块
  -> IndexedDB 恢复/创建设备身份
  -> 首次自动 POST /v1/clients/register
  -> POST /v1/translate
  -> 验证并解密响应
  -> 合并译文并保留批次分隔符
  -> content script 渲染普通文本
```

## 测试与验收

服务端测试覆盖：

- 无邀请码注册成功。
- 并发注册和注册响应丢失后恢复同一 `clientId`。
- 相同签名密钥更换加密密钥被拒绝。
- 已撤销设备不能重新注册。
- 注册 IP 日限额仍生效。
- Prisma 迁移保留已有客户端及关联数据。
- 请求/响应加密、防重放、设备/IP/全站限额继续通过。
- SDK构建后的注册签名与类型不再包含邀请码。

扩展测试覆盖：

- 服务选择、配置修复和默认服务不变。
- 首次请求自动注册，后续请求复用状态。
- 并发首次请求仅创建一个身份并执行一次有效注册。
- 注册响应丢失后复用原身份恢复。
- 20 项与 5000 字符边界、长文本代理对安全分片和结果顺序。
- 批次分隔符保持不变。
- 限额、撤销、网络、安全校验、超时和取消错误映射。
- content script 无法指定服务地址或读取设备密钥。

完成后执行：

```text
# C:\project\mewCat-service
npm test
npm run typecheck
npm run build

# C:\project\chorme-translate
pnpm format
pnpm check
pnpm build
```

验收标准是：新安装扩展选择“mewCat AI 翻译（免费）”后，无需邀请码即可完成首次翻译；浏览器重启后继续使用原设备身份；已有其他翻译服务行为不变；额度、安全校验和中止场景均给出明确结果。
