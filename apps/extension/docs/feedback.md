# 意见反馈

popup 底部和“设置 → 关于”中的“意见反馈”打开独立的 `feedback.html`。重复打开时优先激活已有反馈页，以保留尚未提交的内容。表单包含必填反馈内容和可选联系邮箱，失败不清空输入，提交期间阻止重复发送。

用户只提交主动填写的内容；background 从 Manifest 附带扩展版本。不会自动附带当前网页地址、页面正文、翻译内容或日志，不支持附件。反馈页不启用 Sentry Replay，表单额外标记为阻止回放；反馈消息不进入通用错误上报包装器。

后台仅接受当前扩展反馈页发来的 `submit-feedback` 消息，再通过现有设备身份及加密 SDK 调用 `https://api.mewcat.kidrue.top/v1/feedback`。反馈与翻译共用注册身份、分别管理取消信号。用户无需配置翻译模型或提供邮箱密码。网络失败及发送超时不自动重试，超时时提示无法确认是否送达。错误提示只匹配预定义的反馈错误码；未知错误码（包括对象原型属性名）统一返回通用提示，不透出内部异常。

收件地址 `kidrue.me@gmail.com` 由服务器决定；发信账号和 SMTP 密码仅在 `C:/project/mewCat-service` 对应部署环境中配置。后端未完成 SMTP 配置时，反馈会显示暂不可用；表单提交成功表示 SMTP 已接受邮件，不保证邮件已进入收件箱。

后端配置、接口、限流及数据处理详见服务仓库 `docs/feedback.md`。需先部署兼容旧客户端的后端并完成真实收件验收，再升级扩展。扩展入口及发送路径没有新增权限，没有远程脚本。

验证命令：`pnpm test:feedback`、`pnpm check`、`pnpm build`。服务仓库执行 `npm run typecheck`、`npm test`、`npm run build`。新增 SDK 来源为服务仓库 `npm run build:client` 生成的 `dist/client/mewcat.js`，同步到 `src/vendor/mewcat.min.js` 时一并更新类型声明。

`pnpm test:feedback` 同时覆盖反馈表单、后台来源与参数校验、共享服务的身份初始化、取消隔离、超时和错误提示；这些共享服务用例也保护翻译请求的原有行为。

## 开发环境排查

`pnpm dev` 仅启动扩展开发服务。反馈与免费翻译目前都连接 `src/constants/translationServices.ts` 中的 `MEWCAT_SERVICE_ORIGIN`，默认是线上 `https://api.mewcat.kidrue.top`；在本机服务仓库填写 SMTP 配置不会改变线上服务的配置。

如果线上 `POST /v1/feedback` 返回 `404 / NOT_FOUND`，说明当前部署尚未提供反馈接口，请先部署服务仓库中包含该接口的版本。扩展将此状态显示为“反馈服务暂不可用”，不再误报网络故障。接口可用后仍需在对应服务器配置 SMTP，并重建服务容器以加载新的环境变量。可用无有效加密信封的空请求检查路由是否存在；它会被拒绝，不会发送邮件，已部署的接口应返回 `400 / INVALID_REQUEST` 而非 404。
