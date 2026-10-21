/**
 * 测试 Options 和 Popup 之间的状态同步
 *
 * 测试步骤：
 * 1. 打开 Options 页面
 * 2. 修改 currentModel 配置
 * 3. 打开 Popup 页面
 * 4. 验证 currentModel 已更新
 *
 * 实现原理：
 * - configAtom 是只读本地视图，updateConfigAtom 只提交修改字段
 * - 后台 update-config 消息处理器统一排队，读取最新配置再合并保存
 * - chromeStorageAdapter.subscribe 监听 Chrome Storage 变化
 * - 当 Options 更新配置时，由后台执行 storage.set
 * - storage.set 会触发 chrome.storage.onChanged 事件
 * - Popup 中的 configAtom 会收到更新通知并重新渲染
 * - 读取、订阅和规范化不再回写整份配置，避免旧页面覆盖新设置
 */

// 手动测试步骤：
// 1. pnpm dev
// 2. 打开浏览器扩展程序页面
// 3. 加载扩展
// 4. 打开 Options 页面（右键扩展图标 -> 选项）
// 5. 修改"当前翻译模型"
// 6. 打开 Popup 页面（点击扩展图标）
// 7. 验证"当前翻译模型"已同步更新
// 8. 修改划词触发方式，切换到此前已打开的网页，再返回设置页检查值未回退

// 自动化回归及详细根因：docs/config-persistence-race-fix.md

export {}
