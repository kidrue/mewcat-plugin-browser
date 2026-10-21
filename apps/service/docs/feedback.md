# 意见反馈邮件

扩展的 popup 和“关于”入口打开独立反馈页，用户无需配置翻译模型或登录邮箱。反馈使用现有设备身份和 JWE + JWS 协议提交，不接受裸 JSON，也不允许客户端指定收件人。SDK 提供 `client.submitFeedback(input, options?)`。

## 接口

`POST /v1/feedback`，加密信封中的 `data`：

```json
{
  "message": "网页翻译按钮可以更明显一些。",
  "replyEmail": "reader@example.com",
  "extensionVersion": "1.0.4"
}
```

`message` 去除首尾空白后长度为 5–5000；`replyEmail` 是选填的有效邮箱；`extensionVersion` 为最多四段的数字版本号。扩展后台从 Manifest 填充版本，用户表单不指定版本号。

SMTP 接受固定收件人后，返回 HTTP 201，解密结果为 `{ "ok": true, "data": { "accepted": true } }`，并包含现有协议要求的版本、路径、时间及 nonce。SMTP 接受不保证邮件出现在收件箱，也可能进入垃圾邮件。UI 提示“反馈已提交”，不宣称收件箱已收信。

错误遵循现有加密响应：400 `INVALID_REQUEST`、429 `QUOTA_EXCEEDED`、503 `FEEDBACK_UNAVAILABLE`、502 `FEEDBACK_SEND_FAILED`、504 `FEEDBACK_TIMEOUT`；无效身份、停用设备、重放及来源白名单限制沿用原协议。

## SMTP 配置

在服务器 `.env` 中配置 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS` 和 `SMTP_FROM`。`SMTP_FROM` 是 SMTP 服务商允许使用的发信邮箱。`FEEDBACK_TO` 默认是 `kidrue.me@gmail.com`，只由服务器设置，HTTP 请求无法覆盖。

自动部署时，`SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`FEEDBACK_TO` 统一保存在 GitHub 的 `production` Environment Secrets，部署时安全同步到服务器 `.env`。修改 Secrets 后需重新部署；本机 `.env.local` 不提交到代码仓库。

端口 587 默认使用 STARTTLS；端口 465 自动启用隐式 TLS。可显式设置 `SMTP_SECURE=true`。所有连接均要求 TLS，并校验证书。连接、问候及读写超时分别为 10 秒。SMTP 凭据未完整配置时，不建立 SMTP 连接，仅反馈接口不可用，原有翻译服务仍正常启动。

通用 SMTP 的发信账号可以与收件邮箱不同。如果服务商使用授权码或应用专用密码，应将它配置为 `SMTP_PASS`，不提交到 Git，也不要写入扩展构建变量。现有 Compose 通过 `env_file: .env` 加载这些配置，无需修改容器权限。

邮件使用纯文本，标题为“【译趣喵反馈】v版本号”，包含反馈内容、联系邮箱、版本和提交时间；联系邮箱只作为 `Reply-To`，不作为发件地址、抄送或额外收件人。

## 限流与数据处理

默认每设备每整点小时 3 次、每个 IP 网络每整点小时 10 次、全局每天 UTC 200 次，可用以下变量调整：

- `FEEDBACK_CLIENT_REQUESTS_PER_HOUR`
- `FEEDBACK_IP_REQUESTS_PER_HOUR`
- `FEEDBACK_GLOBAL_REQUESTS_PER_DAY`

计数复用 SQLite 原子限流桶并使用独立的 `feedback:` 前缀，不消耗翻译字符额度。计数针对通过参数校验的提交尝试；SMTP 失败仍保留计数。没有新数据库表、邮件队列或自动重试；相同 nonce 的重放不会再发送邮件。超时属于结果不确定，手动再次提交可能形成重复邮件。

服务不持久化反馈正文或联系邮箱，也不将其或 SMTP 凭据写入日志。用户主动填写的内容会交给配置的 SMTP 服务商，并发到接收邮箱，邮件在服务商和邮箱内的保存遵循其设置。

## 验证与上线

`npm test` 包含真实加密 API、设备/IP/全局限流、重放与停用设备校验，以及本地 SMTP 的 STARTTLS、固定收件人和 Reply-To 集成测试。本地 SMTP 测试不使用生产账号、不投递真实邮箱；只在测试传输器内允许本地自签名证书。

先完成后端构建和部署，配置 SMTP 并确认实际收件，再发布扩展。后端 SDK 为新增方法，不改变协议版本、公钥、旧翻译接口或客户端身份格式。生产验收时检查收件箱及垃圾邮件，并确认翻译服务仍可用。
