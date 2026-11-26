# 作者设备白名单与显示标记实施计划

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan.

**Goal:** 保留生产原管理员设备，追加用户指定 UUID；当前两个作者设备的 ID 旁显示 `kidrue`。

**Architecture:** 生产环境 `ANALYTICS_ADMIN_CLIENT_IDS` 在原有值上追加、去重，经既有部署流程应用；仅做配置变更，不切换业务逻辑。扩展使用只读作者设备显示映射和公共 ID 组件，不参与权限校验，不改变加密协议。

**Tech Stack:** React、TypeScript、Vitest、GitHub Actions production environment。

**Spec:** 用户已确认：新 UUID 为 `76aa2488-3241-4f38-b0a6-4f5df933417b`；保留原白名单，当前白名单的设备均显示作者 `kidrue`；复制内容保持原 UUID。

## Global Constraints

- 仅追加指定设备；不移除任何已授权设备，不公开任何密钥。
- 标签只显示，不决定权限；不修改既有协议、后端身份校验或设备身份存储。
- 本机 ID、设备列表、调用记录及详情统一显示标签，未映射 ID 不标记。
- 保留工作区未发布的缓存修复；此任务不自动发布新的扩展版本。
- 生产配置应用按已有部署流程；若部署失败如实记录，不宣称生效。

## Tasks

- [x] 读取 production 环境原白名单，追加并去重新 UUID；同步根 `.env.local` 的对应配置。
- [x] 对已验证的线上提交重跑既有部署流程，跟进状态，不带入未授权的服务端代码。
- [x] 先写 ID 标记、非作者 ID、截断与复制的失败测试，再实现公共设备 ID 组件并接入四处 UI。
- [x] 格式化、相关测试、扩展完整检查与构建验证；记录线上及本地状态。

## Review Focus

- 原设备保留，UUID 追加幂等，生产与本地配置一致。
- 用户指定新 ID 与原作者 ID 都有标签，普通设备名称为 kidrue 不能冒充作者标记。
- UUID 显示及复制值不受标签影响，未认证记录不显示标签。
- 旧扩展协议仍能读取后端结果；本次不修改服务端代码或响应。

## 执行记录

- production 环境变量追加前为 1 个 ID，追加后 2 个，原设备保留；`ANALYTICS_ADMIN_CLEAR` 未设置（默认 false）。
- 重跑生产部署 `41963162952` attempt 2，仍使用原线上提交 `a79a83f14e60a2baf7052c8d2a30113762f3140f`；2026-11-05 11:54:58 UTC 部署成功，容器 Healthy，公开健康接口 HTTP 200。
- 新增公共 `DeviceId` 组件，界面展示不参与授权、查询参数或身份更新。
- Analytics 前后台 12 项测试及扩展完整检查通过；只读审查未发现需修复问题。
- `pnpm format`、`pnpm --filter @mewcat/extension check`、`pnpm build:verify extension` 均退出码 0。部署日志确认原 ID 和新 ID 均进入本次生产配置。
- 白名单已在线生效；界面标签尚未提交或发布为新的扩展版本。
