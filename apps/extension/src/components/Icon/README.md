# SVG图标系统

这是一个完整的SVG图标组件系统，所有图标都支持颜色跟随和无限缩放。

## 特性

- ✅ **SVG格式**: 无限缩放，清晰度完美
- ✅ **颜色跟随**: 自动跟随`color`属性或`currentColor`变化
- ✅ **TypeScript类型检查**: 防止图标名称拼写错误
- ✅ **交互支持**: 支持点击事件和hover效果
- ✅ **主题兼容**: 完全符合项目主题色彩系统
- ✅ **易于使用**: 简单的API，灵活的配置

## 基本使用

```tsx
import Icon from "../components/Icon"

// 基本使用
<Icon name="translate" />

// 自定义大小和颜色
<Icon name="check" size={24} color="#4caf50" />

// 可点击图标
<Icon name="close" onClick={() => handleClose()} />

// 内联样式
<Icon name="loading" style={{ marginRight: 8 }} />

// 使用CSS变量
<Icon name="success" color="var(--success-color)" />
```

## 可用图标

### 翻译相关

- `translate` - 翻译图标
- `check` - 勾选图标
- `success` - 成功状态图标
- `language` - 语言图标

### 可见性控制

- `eye` - 显示图标
- `eye-off` - 隐藏图标

### 操作相关

- `test` - 测试图标
- `loading` - 加载动画图标
- `close` - 关闭图标
- `settings` - 设置图标
- `link` - 链接图标
- `drag` - 拖拽图标
- `help` - 帮助图标
- `add` - 添加图标
- `delete` - 删除图标
- `edit` - 编辑图标
- `save` - 保存图标
- `refresh` - 刷新图标
- `copy` - 复制图标

### 导航相关

- `home` - 首页图标
- `search` - 搜索图标
- `menu` - 菜单图标

### 箭头

- `arrow-down` - 向下箭头
- `arrow-up` - 向上箭头

### 状态指示

- `error` - 错误图标
- `warning` - 警告图标
- `info` - 信息图标

### 文件操作

- `download` - 下载图标
- `upload` - 上传图标

### 装饰性

- `star` - 星星图标
- `favorite` - 收藏图标
- `palette` - 调色板图标

## API文档

### Icon Props

| 属性        | 类型               | 默认值           | 说明                                  |
| ----------- | ------------------ | ---------------- | ------------------------------------- |
| `name`      | `IconName`         | -                | 图标名称（必填）                      |
| `size`      | `number \| string` | `24`             | 图标大小，数字为px，字符串支持CSS单位 |
| `color`     | `string`           | `"currentColor"` | 图标颜色，支持CSS颜色值和变量         |
| `className` | `string`           | -                | CSS类名                               |
| `style`     | `CSSProperties`    | -                | 内联样式                              |
| `onClick`   | `() => void`       | -                | 点击事件处理函数                      |

### 类型定义

```tsx
// 所有可用图标名称的类型
type IconName = "translate" | "check" | "success" | ... // 等等

// 组件Props类型
interface IconProps {
    name: IconName
    size?: number | string
    color?: string
    className?: string
    style?: React.CSSProperties
    onClick?: () => void
}
```

## 颜色跟随示例

### 使用currentColor（默认）

```tsx
<div style={{ color: "#ff0000" }}>
    <Icon name="heart" /> {/* 图标将是红色 */}
</div>
```

### 使用CSS变量

```tsx
<Icon name="success" color="var(--success-color)" />
<Icon name="error" color="var(--error-color)" />
<Icon name="warning" color="var(--warning-color)" />
```

### 动态颜色

```tsx
const [isActive, setIsActive] = useState(false)

<Icon
    name="favorite"
    color={isActive ? "var(--error-color)" : "var(--text-disabled)"}
    onClick={() => setIsActive(!isActive)}
/>
```

## 在主题中使用

图标自动兼容项目的主题色彩系统：

```tsx
// 使用主题色
<Icon name="settings" color="var(--primary-color)" />

// 使用状态色
<Icon name="success" color="var(--success-color)" />
<Icon name="error" color="var(--error-color)" />
<Icon name="warning" color="var(--warning-color)" />

// 使用文本色
<Icon name="info" color="var(--text-primary)" />
<Icon name="help" color="var(--text-secondary)" />
```

## 交互效果

### 可点击图标

```tsx
<Icon
    name="close"
    onClick={() => handleClose()}
    style={{ cursor: "pointer" }}
/>
```

### Hover效果

```tsx
import styled from "styled-components"

const ClickableIcon = styled(Icon)`
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        transform: scale(1.1);
        color: var(--primary-color);
    }
`
```

## 自定义大小

### 像素值

```tsx
<Icon name="translate" size={16} />  {/* 16px */}
<Icon name="translate" size={24} />  {/* 24px */}
<Icon name="translate" size={32} />  {/* 32px */}
```

### CSS单位

```tsx
<Icon name="translate" size="1rem" />    {/* 1rem */}
<Icon name="translate" size="1.5em" />   {/* 1.5em */}
<Icon name="translate" size="100%" />    {/* 100% */}
```

## 添加新图标

1. 在 `Icon/index.tsx` 中添加新的图标组件：

```tsx
const NewIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="你的SVG路径" />
    </svg>
)
```

2. 更新图标映射表：

```tsx
const iconMap: Record<string, React.FC> = {
    // ... 其他图标
    "new-icon": NewIcon
}
```

3. 导出新图标：

```tsx
export {
    // ... 其他图标
    NewIcon
}
```

## 注意事项

1. **SVG优化**: 确保SVG使用`viewBox`而不是固定的width/height
2. **颜色属性**: SVG路径应使用`fill="currentColor"`或不设置fill属性
3. **尺寸兼容**: 所有图标应使用24x24的viewBox以保持一致性
4. **性能考虑**: 图标组件会被React复用，无需担心性能问题

## 故障排除

### 图标不显示

- 检查图标名称是否正确
- 确认图标已在iconMap中注册

### 颜色不跟随

- 确保SVG使用`fill="currentColor"`
- 检查是否有内联的fill属性覆盖

### 大小不正确

- 确认SVG使用`viewBox`
- 检查是否有CSS样式冲突

## 更新日志

- **v1.0.0**: 初始版本，包含基础图标集合
- **v1.1.0**: 添加状态图标和文件操作图标
- **v1.2.0**: 完善TypeScript类型定义
