# mewCat API 接口文档

生产环境地址为 `https://api.mewcat.kidrue.top`。所有 POST 业务接口使用 JWE + JWS 信封。workspace 客户端使用 `@mewcat/client`，独立接入可先在仓库根运行 `pnpm build:packages`，再使用浏览器 ESM 产物 `packages/mewcat-client/dist/mewcat.js`。手工实现或排障参阅 [加密协议 v1](protocol.md)。

## 快速接入

```js
import {
  TranslationClient,
  loadClientState,
  saveClientState,
} from './mewcat.js';

const serviceOrigin = 'https://api.mewcat.kidrue.top';
const saved = await loadClientState(serviceOrigin);
const client = await TranslationClient.connect({
  baseUrl: serviceOrigin,
  ...(saved ? { state: saved } : {}),
  // 建议设置为部署时记录的服务器签名公钥指纹。
  pinnedSigningThumbprint: '<RFC-7638-SHA-256-thumbprint>',
});

// 首次使用时自动注册当前设备身份。
if (!saved?.clientId) {
  await saveClientState(serviceOrigin, client.getState());
  await client.register('mewCat Chrome Extension');
  await saveClientState(serviceOrigin, client.getState());
}

const result = await client.translate({
  texts: ['Hello', 'Good morning'],
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
});
console.log(result.translations);

const usage = await client.usage();
console.log(usage);
```

客户端状态包含不可导出的 `CryptoKey`，必须使用 IndexedDB 的结构化克隆保存。不能用 JSON 或 `chrome.storage` 序列化。

## 接口总览

| 方法 | 路径 | 请求凭据 | 成功状态 | 用途 |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | 无 | `200` | 检查服务及数据库 |
| `GET` | `/v1/keys` | 无 | `200` | 获取服务器协议版本和公钥 |
| `POST` | `/v1/clients/register` | 新设备自签名信封 | `201` | 注册设备身份 |
| `POST` | `/v1/translate` | 有效设备信封 | `200` | 批量翻译文本 |
| `POST` | `/v1/chat/completions` | 有效设备信封 | `200` | 生成文本，供翻译和页面总结使用 |
| `POST` | `/v1/usage` | 有效设备信封 | `200` | 查询设备当日字符用量 |
| `POST` | `/v1/usage/details` | 有效设备信封 | `200` | 查询设备用量及设备与公网 IP 每日限额 |
| `POST` | `/v1/feedback` | 有效设备信封 | `201` | 通过服务器 SMTP 提交反馈 |
| `POST` | `/v1/activity` | 有效设备信封 | `200` | 上报用户授权变更和页面翻译事件 |
| `GET` | `/v1/activity/uninstall/:token` | 一次性路径令牌 | `204` | 接收浏览器卸载回执 |
| `POST` | `/v1/analytics/query` | 白名单设备信封 | `200` | 查询调用和画像统计 |
| `POST` | `/v1/analytics/activity` | 白名单设备信封 | `200` | 查询用户主动授权的翻译统计 |

POST 路径不接受查询参数。设备注册成功后，普通设备接口使用该设备的 `clientId`，管理员接口另需服务器白名单授权。

## 对话生成

调用 `client.chatCompletions(input)` 时，SDK 会使用已注册设备的签名和加密身份。例如，以下请求让服务生成一句话总结：

```js
const result = await client.chatCompletions({
  messages: [
    { role: 'system', content: '用简体中文总结正文，只输出一句话。' },
    { role: 'user', content: '这里是页面正文。' },
  ],
  temperature: 0.2,
  max_tokens: 256,
});
console.log(result.choices[0].message.content);
```

- `messages` 支持 `system`、`user` 和 `assistant` 的纯文本消息，1–20 条，合计最多 16,000 个 UTF-16 代码单元。业务 JSON 转成 UTF-8 后最多 54,000 字节，外层加密信封也需符合下文的大小限制。
- 可选 `temperature`、`top_p`、`max_tokens`、`stop` 和 `response_format`。`max_tokens` 不能超过服务端的 `MAX_OUTPUT_TOKENS`，`response_format.type` 支持 `text` 和 `json_object`。接口使用非流式响应，可省略 `stream` 或传 `false`。
- 上游地址、凭据和模型由服务端设置。业务请求不接受 `baseUrl`、`apiKey` 或 `model`，响应也不包含上游模型名称。
- 返回 `choices[0]` 中的 `message.content` 和 `finish_reason`，以及供应商提供的可选 `usage`。与翻译共用设备、IP、全站额度和并发限制，按所有消息的 UTF-16 长度占用字符额度。对话正文及输出不进入内容画像表。

## 公共约定

### 请求头

POST 请求必须包含：

```http
Content-Type: application/json
```

浏览器发送 `Origin` 时，该值必须出现在服务器的 `ALLOWED_ORIGINS` 配置中，否则返回 `403 ORIGIN_NOT_ALLOWED`。非浏览器客户端的 Origin 不能作为身份凭据。

### POST 外层请求

所有 POST 接口的 HTTP 请求体格式完全相同：

```json
{
  "envelope": "<compact JWE>"
}
```

`envelope` 长度为 100–100000 个字符，HTTP 请求体上限为 128 KiB。

JWE 解密后得到 compact JWS；JWS 验签后的通用请求负载为：

```json
{
  "v": 1,
  "method": "POST",
  "path": "/v1/translate",
  "timestamp": 1790123456789,
  "nonce": "22至64位base64url随机值",
  "data": {}
}
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `v` | integer | 固定为 `1` |
| `method` | string | 固定为 `POST` |
| `path` | string | 必须与实际请求路径完全相同 |
| `timestamp` | integer | UTC epoch 毫秒，服务端默认容差前后 5 分钟 |
| `nonce` | string | 每次请求唯一，22–64 位 base64url |
| `data` | object | 各接口的业务数据 |

除注册外，服务器会持久化 `(clientId, nonce)` 防止重放。

### POST 外层响应

HTTP 响应体仍是加密信封：

```json
{
  "envelope": "<compact JWE>"
}
```

解密并验签后的成功负载：

```json
{
  "v": 1,
  "path": "/v1/translate",
  "timestamp": 1790123457000,
  "nonce": "与请求相同的nonce",
  "ok": true,
  "data": {}
}
```

已完成身份校验的业务错误也会加密：

```json
{
  "v": 1,
  "path": "/v1/translate",
  "timestamp": 1790123457000,
  "nonce": "与请求相同的nonce",
  "ok": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "已达到当前时段的使用限额"
  }
}
```

入口限流、Origin 拒绝、无效信封和其他无法安全生成响应信封的错误以明文 JSON 返回。

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "密文、签名或请求有效期校验失败"
  }
}
```

客户端必须同时校验服务器签名、`path`、`nonce`、`timestamp` 与 HTTP 状态，不能只解密响应。

## `GET /health`

检查 HTTP 服务和数据库连接。

```sh
curl https://api.mewcat.kidrue.top/health
```

HTTP `200` 返回健康状态及本进程累计的调用留存写入失败次数。

```json
{ "status": "ok", "analyticsPersistenceFailures": 0 }
```

数据库不可用，HTTP `503`：

```json
{ "status": "unavailable" }
```

## `GET /v1/keys`

获取服务器签名和加密公钥。响应只包含公钥字段。

```sh
curl https://api.mewcat.kidrue.top/v1/keys
```

HTTP `200` 响应结构：

```json
{
  "version": 1,
  "keyId": "<server-key-id>",
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

`signingKey` 用于验证服务器 ES256 签名，`encryptionKey` 用于使用 `RSA-OAEP-256` 加密请求。建议通过可信渠道固定 `signingKey` 的 RFC 7638 SHA-256 指纹。

## `POST /v1/clients/register`

注册设备公钥，并证明客户端持有对应签名私钥。注册请求的 JWS `kid` 固定为 `registration`。服务端对每个来源 IP 设置每日新增注册限额。

加密前的 `data`：

```json
{
  "name": "mewCat Chrome Extension",
  "signingKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "<43位base64url>",
    "y": "<43位base64url>"
  },
  "encryptionKey": {
    "kty": "RSA",
    "e": "AQAB",
    "n": "<base64url>"
  }
}
```

| 字段 | 约束 |
| --- | --- |
| `name` | 去除首尾空白后 1–80 个字符 |
| `signingKey` | EC P-256 公钥，只允许 `kty`、`crv`、`x`、`y` |
| `encryptionKey` | RSA 2048/3072/4096 位公钥，指数固定为 65537 |

HTTP `201`，解密后的 `data`：

```json
{
  "clientId": "550e8400-e29b-41d4-a716-446655440000"
}
```

同一签名密钥和加密密钥可以恢复因网络中断而丢失的注册响应。加密密钥发生变化或客户端已撤销时不能恢复。

## `POST /v1/translate`

批量翻译文本。调用前必须完成注册。

加密前的 `data`：

```json
{
  "texts": ["Hello", "Good morning"],
  "sourceLanguage": "auto",
  "targetLanguage": "zh-CN"
}
```

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `texts` | 是 | 1–20 项；每项 1–5000 个 JavaScript UTF-16 字符单元；拒绝纯空白；合计不超过 5000 |
| `sourceLanguage` | 否 | 默认为 `auto`，或使用 `en`、`ja`、`zh-CN` 等语言标签 |
| `targetLanguage` | 是 | 语言标签，不能为 `auto` |
| `context` | 否 | 首尾去除空白后 1–2000 个 UTF-16 代码单元，单独计入字符额度 |

语言标签总长 2–35 位，由 2–8 个 ASCII 字母开头，后续可包含以 `-` 分隔的 1–8 位字母或数字。请求体只接受表中的字段。

HTTP `200`，解密后的 `data`：

```json
{
  "translations": ["你好", "早上好"]
}
```

`translations` 与 `texts` 数量和顺序一致。SDK 不会自动重试翻译，避免对可能已经产生费用的请求重复计费。

## `POST /v1/usage`

查询当前客户端在本 UTC 日的字符用量。

加密前的 `data` 必须是空对象：

```json
{}
```

HTTP `200`，解密后的 `data`：

```json
{
  "usedCharacters": 1250,
  "limitCharacters": 500000,
  "resetsAt": "2026-09-24T00:00:00.000Z"
}
```

| 字段 | 说明 |
| --- | --- |
| `usedCharacters` | 当日已预占的翻译和对话输入字符数，上游失败也计入 |
| `limitCharacters` | 当前客户端每日字符上限 |
| `resetsAt` | 当前 UTC 日额度过期时间，ISO 8601 |

## `POST /v1/usage/details`

扩展通过 SDK 的 `usageDetails()` 读取免费额度提示。请求仍为签名加密的空对象，响应沿用上表的用量字段，并返回 `ipLimitCharacters`，表示同一公网 IP 共同使用的每日字符上限。此接口只返回当前设备已用字符数。

## `POST /v1/feedback`

扩展在独立反馈页通过 `client.submitFeedback(input)` 提交。加密前的 `data` 使用下列字段。

```json
{
  "message": "网页翻译按钮可以更明显一些。",
  "replyEmail": "reader@example.com",
  "extensionVersion": "1.0.4"
}
```

- `message` 去除首尾空白后长 5–5000 个 UTF-16 代码单元。
- `replyEmail` 选填，去除首尾空白后最长 254 个字符。它只用于邮件 `Reply-To` 和正文中的联系信息，发件人和收件人由服务器配置。
- `extensionVersion` 必填，为最多四段的纯数字版本号，总长不超过 32 个字符。扩展从 Manifest 填入。

SMTP 接受固定收件人后返回 `201`，解密后的 `data` 为 `{ "accepted": true }`。界面应提示“反馈已提交”。最终投递取决于邮件服务商，也可能进入垃圾邮件箱。

通过参数校验的尝试占用独立反馈额度，默认每设备每整点小时 3 次、每个 IPv4 地址或 IPv6 /64 网络每整点小时 10 次、全站每 UTC 日 200 次。对应配置为 `FEEDBACK_CLIENT_REQUESTS_PER_HOUR`、`FEEDBACK_IP_REQUESTS_PER_HOUR` 和 `FEEDBACK_GLOBAL_REQUESTS_PER_DAY`。SMTP 失败仍占额度，反馈不扣翻译字符。

服务不持久化反馈正文和联系邮箱，不写入日志，也不排队或自动重试。SMTP 超时可能已经投递，手动再次提交可能产生重复邮件。正文和联系邮箱由用户提交给配置的 SMTP 服务商及接收邮箱，邮件按其配置保留。SMTP 配置与验收见 [部署与运维](deploy.md#反馈邮件)。

## `POST /v1/activity`

用户主动授权后，扩展通过 `client.deviceActivity(input)` 上报。`data` 按 `operation` 选择一种严格结构。

| `operation` | 其余字段 | 用途 |
| --- | --- | --- |
| `enable` | `revision`，`newInstall` 布尔值 | 启用统计，符合条件时记录首次授权安装，并签发卸载回执路径 |
| `disable` | `revision` | 撤回授权并删除该设备的活动数据 |
| `page` | `revision`，`eventId` UUID，`pageKey` 64 位小写十六进制摘要 | 上报一次顶层整页翻译成功事件 |

请求 `revision` 是 1–2147483646 的整数。授权变更使用递增版本，页面事件使用当前授权版本；服务端在删除活动数据后仍保留版本号，用于挡住迟到的旧授权和事件。事件重试使用同一个 `eventId` 和新的信封 nonce。

解密后的 `data` 为 `{ enabled, revision, uninstallPath }`。`revision` 反映服务端状态，初始值可为 `0`。`uninstallPath` 在签发回执时是相对路径，其他情况为 `null`。扩展用服务地址解析回执路径并设置浏览器卸载 URL。旧版本授权或未启用的页面事件可能返回 `200` 而不执行操作，调用端需要检查返回的 `enabled` 和 `revision`。

## `GET /v1/activity/uninstall/:token`

浏览器卸载扩展时访问一次性回执 URL。服务端只存令牌的哈希值。当前有效令牌提交后记录卸载、关闭活动上报并使令牌失效。格式无效、已失效及重复令牌的正常处理也统一返回空体 `204`。离线卸载可能漏报，此接口不接收签名信封。

## 管理员统计

使用 `client.queryAnalytics(input)` 调用 `/v1/analytics/query`，使用 `client.queryDeviceActivity(input)` 调用 `/v1/analytics/activity`。两个接口均要求已注册、未撤销且在 `ANALYTICS_ADMIN_CLIENT_IDS` 中的设备。查询操作、字段和统计口径见 [调用留存与设备翻译统计](analytics.md#管理员接口)。

## 状态码与错误码

| HTTP | 错误码 | 场景 |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | JSON、信封或业务参数格式错误，或 POST 带查询参数 |
| `401` | `UNAUTHORIZED` | 解密、签名、客户端身份、路径绑定或时间窗口校验失败 |
| `403` | `ORIGIN_NOT_ALLOWED` | 浏览器 Origin 不在允许列表 |
| `403` | `CLIENT_REVOKED` | 客户端已被管理员撤销 |
| `403` | `ANALYTICS_FORBIDDEN` | 设备未获得分析管理员权限 |
| `404` | `NOT_FOUND` | 接口不存在 |
| `404` | `ANALYTICS_DEVICE_NOT_FOUND` | 查询的设备不存在 |
| `409` | `CLIENT_EXISTS` | 相同签名密钥已绑定其他注册信息 |
| `409` | `REPLAY_DETECTED` | 重复使用已处理的 nonce |
| `413` | `INVALID_REQUEST` | HTTP 请求体超过 128 KiB |
| `429` | `RATE_LIMITED` | 入口、生成请求或管理员查询的分钟频率超限 |
| `429` | `QUOTA_EXCEEDED` | 翻译或对话的日额度不足，或注册、反馈超出各自额度 |
| `499` | `ANALYTICS_CANCELLED` | 服务器检测到管理员查询取消 |
| `500` | `INTERNAL_ERROR` | 未分类的服务端错误 |
| `502` | `UPSTREAM_UNAVAILABLE` | 无法连接翻译供应商或供应商拒绝请求 |
| `502` | `UPSTREAM_INVALID_RESPONSE` | 翻译供应商响应格式无效 |
| `502` | `FEEDBACK_SEND_FAILED` | SMTP 发信失败或未接受收件人 |
| `503` | `SERVER_BUSY` | 服务端加密或上游并发达到上限 |
| `503` | `UPSTREAM_UNAVAILABLE` | 翻译供应商触发限流 |
| `503` | `FEEDBACK_UNAVAILABLE` | SMTP 未配置完整 |
| `503` | `ANALYTICS_BUSY` | 管理员查询并发达上限，或调用查询结果过大 |
| `504` | `UPSTREAM_TIMEOUT` | 翻译供应商请求超时 |
| `504` | `FEEDBACK_TIMEOUT` | SMTP 超时，投递结果未知 |

HTTP 级校验失败可能返回框架生成的通用 `INVALID_REQUEST`。调用端应主要根据 `code` 分支，并向用户显示 `message`。

## 默认限额

部署者可以通过环境变量调整以下值；客户端不应把默认值当作永久契约。

| 限制 | 默认值 |
| --- | --- |
| 所有入口每 IP / 分钟 | 120 次 |
| 生成请求每设备 / 分钟 | 20 次 |
| 生成请求每 IP / 分钟 | 60 次 |
| 每客户端 / UTC 日 | 500000 字符 |
| 每 IP / UTC 日 | 500000 字符 |
| 全站 / UTC 日 | 不设置字符或请求次数上限 |
| 新增注册每 IP / UTC 日 | 10 台设备 |
| 上游并发 | 8 次 |
| 上游超时 | 30 秒 |

翻译和对话在调用供应商前一次性预占设备、IP 与全站预算。整条请求必须能放入剩余额度。预占成功后，即使供应商失败也保留计数。每日额度在 UTC 00:00（北京时间 08:00）重置。IPv6 按 /64 计算来源。

`GLOBAL_DAILY_CHARACTERS=0`、`GLOBAL_DAILY_REQUESTS=0` 分别关闭全站字符与翻译次数的日限额；设置正整数可重新启用。设备与 IP 的日限额必须为正整数。

## 客户端异常

SDK 的 `TranslationError` 提供以下属性：

```ts
class TranslationError extends Error {
  code: string;
  status: number;
}
```

连接阶段无法取得服务器公钥时使用 `KEYS_UNAVAILABLE`。未认证阶段收到明文 HTTP 错误时，SDK 使用 `REQUEST_REJECTED`；已经解密的业务错误保留服务端 `code`。

网络超时、协议签名不匹配、公钥指纹变化、响应关联校验失败等情况可能抛出普通 `Error`，调用端应将其视为不可自动重试的连接或安全错误。
