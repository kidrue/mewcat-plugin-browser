# 加密协议 v1

仅实现客户端无需手工处理协议，使用 `dist/client/mewcat.js`。此文用于其他客户端接入与排障。

## 密钥

每个安装生成两组独立密钥：ECDSA P-256 用于 ES256 签名，RSA-OAEP 2048 位用于解密响应。服务器同样使用独立的签名与加密密钥。所有公钥以 JWK 表示；接受 RSA 2048/3072/4096 位，指数固定 65537；注册拒绝私钥字段。

`GET /v1/keys` 返回 `{ version: 1, keyId, signingKey, encryptionKey }`。通过 HTTPS 获取，建议固定 signingKey 的 RFC 7638 SHA-256 thumbprint。服务端私钥不会返回。

## 请求封装

1. JSON 编码完整请求：`{ v: 1, method: "POST", path, timestamp, nonce, data }`。timestamp 为 UTC epoch 毫秒；nonce 使用 `crypto.randomUUID()` 或至少 128 位随机 base64url 字符串，每次调用生成新值。
2. 使用客户端签名私钥生成 compact JWS，protected header 为 `{ alg: "ES256", typ: "mewcat+jws", kid: clientId }`。注册时 kid 固定为 `registration`。
3. 使用服务器加密公钥加密完整 JWS 字符串，生成 compact JWE。protected header 为 `{ alg: "RSA-OAEP-256", enc: "A256GCM", typ: "mewcat+jwe", cty: "mewcat+jws", kid: serverKeyId }`。JOSE 随机生成 AES key 和 IV，不重复使用。
4. HTTP POST JSON：`{ envelope: compactJwe }`，Content-Type 为 `application/json`。path 必须与实际路径相同，不带 query。

服务器强制算法白名单，先解密和验签，再校验方法、路径与前后 5 分钟容差。业务调用的 `(clientId, nonce)` 有数据库唯一约束；保存到 `timestamp + CLOCK_SKEW_MS + 1000`，避免未来时间戳在仍有效时被清理。

## 注册

data 为 `{ name, signingKey, encryptionKey }`。服务器用 data 中 signingKey 验签，证明申请者持有相应私钥。成功响应 data 为 `{ clientId }`。

同一签名公钥只能注册一次。首次注册无已分配 clientId，响应外层 JWE 的 kid 固定为 `registration`。为恢复丢失的注册响应，同一签名身份和同一加密公钥可取回已有 clientId，不产生新设备或新额度；加密公钥变更或身份已撤销时无法恢复。

## 响应封装

成功负载：`{ v: 1, path, timestamp, nonce, ok: true, data }`。

失败负载：`{ v: 1, path, timestamp, nonce, ok: false, error: { code, message } }`。

服务器以 ES256 签名，再使用客户端 RSA 公钥加密。格式同请求，签名 kid 为 serverKeyId，加密 kid 为 clientId（注册为 registration）。HTTP 响应为 `{ envelope }`，HTTP 状态码保留原有语义。

客户端先解密、校验服务器签名和 keyId，再验证 nonce、path、timestamp、HTTP 状态和业务 schema，拒绝响应交换。身份不明、CORS 拒绝、入口限流等阶段无法安全选择响应接收方，仅返回明文错误；客户端从不接受未签名成功结果。

## 信任边界

应用层加密之外仍要求 HTTPS。知道服务器公钥的任何人都能提交注册请求，因此服务端通过注册限流、可撤销客户端身份、签名和使用额度控制费用。合法设备或被控制的扩展仍能用完自身配额，公开客户端没有绝对不可伪造的身份。服务端不根据 Origin 或共享应用密钥授予额度。
