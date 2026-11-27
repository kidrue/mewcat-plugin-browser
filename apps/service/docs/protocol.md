# 加密协议 v1

本文定义 `v1` POST 接口的签名加密格式。workspace 客户端可使用 `@mewcat/client`，独立接入可运行 `pnpm build:packages` 生成 `packages/mewcat-client/dist/mewcat.js`。业务路径、载荷和状态码见 [API](api.md)。

## 密钥

每个安装生成两组独立密钥。ECDSA P-256 用于 ES256 签名，RSA-OAEP 2048 位用于解密响应。服务器同样使用独立的签名与加密密钥。签名公钥 JWK 只包含 `kty`、`crv`、`x`、`y`，加密公钥 JWK 只包含 `kty`、`n`、`e`。RSA 支持 2048、3072 或 4096 位，指数固定为 65537。SDK 创建不可导出的私钥，使用 IndexedDB 结构化克隆持久化。

`GET /v1/keys` 通过 HTTPS 返回 `{ version: 1, keyId, signingKey, encryptionKey }`。从可信渠道取得 `signingKey` 的 RFC 7638 SHA-256 指纹并配置到客户端，可在连接时验证服务身份。

## 请求封装

1. 用 UTF-8 编码请求 JSON `{ v: 1, method: "POST", path, timestamp, nonce, data }`。`path` 与实际请求路径完全相同，最长 100 个字符，不带查询参数。`timestamp` 是 UTC epoch 毫秒的非负安全整数。每次调用生成新的随机 `nonce`，格式为 22–64 个 base64url 字符。SDK 使用 `crypto.randomUUID()`。
2. 使用设备签名私钥生成 compact JWS，protected header 为 `{ alg: "ES256", typ: "mewcat+jws", kid: clientId }`。注册时 `kid` 固定为 `registration`。
3. 使用服务器加密公钥加密完整 JWS 字符串，生成 compact JWE。protected header 为 `{ alg: "RSA-OAEP-256", enc: "A256GCM", typ: "mewcat+jwe", cty: "mewcat+jws", kid: serverKeyId }`。每次加密使用 JOSE 新生成的内容加密密钥和 IV。
4. 以 `Content-Type: application/json` 发送 HTTP POST，外层对象为 `{ envelope: compactJwe }`。信封长度为 100–100000 个字符，请求体不超过 128 KiB。

服务器解密后从 JWS 的 `kid` 查找已注册公钥，再验证签名和载荷。服务器根据 `CLOCK_SKEW_MS` 校验时间，默认允许前后 5 分钟。已注册设备的 `(clientId, nonce)` 受数据库唯一约束，记录至少保留至 `timestamp + CLOCK_SKEW_MS + 1000`。撤销的设备无法使用业务接口。

## 注册

`data` 为 `{ name, signingKey, encryptionKey }`。服务器用其中的 `signingKey` 验签，证明申请者持有相应私钥。HTTP `201` 的响应 `data` 为 `{ clientId }`。注册不写入已注册设备的 nonce 表。

同一签名公钥只能注册一次。首次注册无已分配 clientId，响应外层 JWE 的 kid 固定为 `registration`。为恢复丢失的注册响应，同一签名身份和同一加密公钥可取回已有 clientId，不产生新设备或新额度；加密公钥变更或身份已撤销时无法恢复。

## 响应封装

成功负载为 `{ v: 1, path, timestamp, nonce, ok: true, data }`。

加密错误负载为 `{ v: 1, path, timestamp, nonce, ok: false, error: { code, message } }`。

服务器以 ES256 签名，再使用客户端 RSA 公钥加密。格式同请求，JWS `kid` 为 `serverKeyId`，JWE `kid` 为 `clientId`（注册为 `registration`）。HTTP 响应为 `{ envelope }`，HTTP 状态码保留业务语义。

客户端先解密、校验服务器签名和 `keyId`，再检查 `nonce`、`path`、`timestamp`、HTTP 状态和业务结构。SDK 要求响应时间与本地时间相差不超过 5 分钟，且不得比请求时间早超过 5 分钟。入口限流、CORS 拒绝和无法完成身份校验时仅返回明文错误 `{ error: { code, message } }`。任何成功结果都必须经过解密和验签。

## 信任边界

线上调用仍需 HTTPS。持有服务器公钥的客户端都可以提交注册请求，服务通过注册限流、签名、可撤销的设备身份和配额控制使用。Origin 白名单用于限制浏览器来源，权限由签名设备身份和服务端授权决定。公开的健康、公钥和浏览器卸载回执接口见 [API](api.md)。
