# mewCat API 接口文档

本文面向 Chrome 扩展及其他受信任客户端，描述当前 `v1` HTTP API。生产环境地址：

```text
https://api.mewcat.kidrue.top
```

除健康检查与服务器公钥外，所有业务请求和响应都使用 JWE + JWS 加密信封。业务 JSON 不能直接提交到 POST 接口。推荐使用项目构建出的 `dist/client/mewcat.js`；需要自行实现协议时，再参阅[加密协议 v1](protocol.md)。

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

| 方法 | 路径 | 是否使用加密信封 | 成功状态 | 说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | 否 | `200` | 检查服务及数据库状态 |
| `GET` | `/v1/keys` | 否 | `200` | 获取服务器协议版本和公钥 |
| `POST` | `/v1/clients/register` | 是 | `201` | 注册客户端设备身份 |
| `POST` | `/v1/translate` | 是 | `200` | 批量翻译文本 |
| `POST` | `/v1/usage` | 是 | `200` | 查询当前客户端当日字符用量 |
| `POST` | `/v1/feedback` | 是 | `201` | 通过服务器 SMTP 发送意见反馈 |

服务只接受以上路径。POST 路径不接受查询参数。

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
| `timestamp` | integer | UTC epoch 毫秒，允许服务器时间前后 5 分钟 |
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

在无法确定客户端身份时，错误以明文 JSON 返回：

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

正常响应，HTTP `200`：

```json
{ "status": "ok" }
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

注册设备公钥，并证明客户端持有对应签名私钥。注册请求的 JWS `kid` 固定为 `registration`。服务端通过每 IP 每日注册限额控制滥用。

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

语言标签由 2–8 个 ASCII 字母开头，后续可包含以 `-` 分隔的 1–8 位字母或数字。请求是严格对象，额外传入 `model`、`messages`、API Key 等字段会被拒绝。

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
  "limitCharacters": 20000,
  "resetsAt": "2026-09-24T00:00:00.000Z"
}
```

| 字段 | 说明 |
| --- | --- |
| `usedCharacters` | 当日已预占的翻译输入字符数，上游失败也计入 |
| `limitCharacters` | 当前客户端每日字符上限 |
| `resetsAt` | 当前 UTC 日额度过期时间，ISO 8601 |

## 状态码与错误码

| HTTP | 错误码 | 场景 |
| --- | --- | --- |
| `400` | `INVALID_REQUEST` | JSON、信封或业务参数格式错误，或 POST 带查询参数 |
| `401` | `UNAUTHORIZED` | 解密、签名、客户端身份、路径绑定或时间窗口校验失败 |
| `403` | `ORIGIN_NOT_ALLOWED` | 浏览器 Origin 不在允许列表 |
| `403` | `CLIENT_REVOKED` | 客户端已被管理员撤销 |
| `404` | `NOT_FOUND` | 接口不存在 |
| `409` | `CLIENT_EXISTS` | 相同签名密钥已绑定其他注册信息 |
| `409` | `REPLAY_DETECTED` | 重复使用已处理的 nonce |
| `413` | `INVALID_REQUEST` | HTTP 请求体超过 128 KiB |
| `429` | `RATE_LIMITED` | 入口请求频率超限 |
| `429` | `QUOTA_EXCEEDED` | 客户端、IP 或全站翻译额度超限 |
| `500` | `INTERNAL_ERROR` | 未分类的服务端错误 |
| `502` | `UPSTREAM_UNAVAILABLE` | 无法连接翻译供应商或供应商拒绝请求 |
| `502` | `UPSTREAM_INVALID_RESPONSE` | 翻译供应商响应格式无效 |
| `503` | `SERVER_BUSY` | 服务端加密或上游并发达到上限 |
| `503` | `UPSTREAM_UNAVAILABLE` | 翻译供应商触发限流 |
| `504` | `UPSTREAM_TIMEOUT` | 翻译供应商请求超时 |

HTTP 级校验失败可能返回框架生成的通用 `INVALID_REQUEST`。调用端应主要根据 `code` 分支，并向用户显示 `message`。

## 默认限额

部署者可以通过环境变量调整以下值；客户端不应把默认值当作永久契约。

| 限制 | 默认值 |
| --- | --- |
| 所有入口每 IP / 分钟 | 120 次 |
| 翻译每客户端 / 分钟 | 20 次 |
| 翻译每 IP / 分钟 | 60 次 |
| 每客户端 / UTC 日 | 20000 字符 |
| 每 IP / UTC 日 | 100000 字符 |
| 全站 / UTC 日 | 1000000 字符、10000 次翻译 |
| 注册每 IP / UTC 日 | 10 次已通过签名验证的尝试 |
| 上游并发 | 8 次 |
| 上游超时 | 30 秒 |

翻译额度在调用供应商前预占。请求失败时不会退回额度，因为供应商可能已经开始计费。

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
