# DOM处理规则 - 逻辑设计文档

> **项目**: 沉浸式翻译浏览器扩展
> **版本**: v1.13.5
> **文档类型**: 技术设计文档
> **生成日期**: 2025-12-03

---

## 目录

1. [概述](#1-概述)
2. [DOM处理架构](#2-dom处理架构)
3. [文本检测与验证算法](#3-文本检测与验证算法)
4. [选择器匹配系统](#4-选择器匹配系统)
5. [标签分类体系](#5-标签分类体系)
6. [DOM遍历策略](#6-dom遍历策略)
7. [翻译插入机制](#7-翻译插入机制)
8. [Mutation Observer实现](#8-mutation-observer实现)
9. [性能优化策略](#9-性能优化策略)
10. [决策树与条件流](#10-决策树与条件流)
11. [边缘案例处理](#11-边缘案例处理)
12. [配置参数详解](#12-配置参数详解)

---

## 1. 概述

### 1.1 设计目标

沉浸式翻译的DOM处理规则系统旨在实现:

- **智能识别**: 准确识别网页中需要翻译的文本内容
- **精准过滤**: 排除不需要翻译的元素(代码、导航、广告等)
- **高性能**: 最小化对页面性能的影响
- **兼容性**: 支持各类网站架构(SPA、传统网站、Shadow DOM等)
- **可配置**: 通过配置文件灵活调整规则

### 1.2 核心组件

```
┌─────────────────────────────────────────────────────┐
│              DOM Processing Engine                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌───────────────┐    ┌────────────────────┐       │
│  │ Text Detector │───▶│ Selector Matcher   │       │
│  └───────────────┘    └────────────────────┘       │
│         │                      │                     │
│         ▼                      ▼                     │
│  ┌───────────────┐    ┌────────────────────┐       │
│  │ Tag Classifier│───▶│ Translation Inserter│       │
│  └───────────────┘    └────────────────────┘       │
│         │                      │                     │
│         ▼                      ▼                     │
│  ┌───────────────┐    ┌────────────────────┐       │
│  │ Mutation Observer  │ Performance Monitor│       │
│  └───────────────┘    └────────────────────┘       │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 1.3 关键指标

| 指标 | 值 | 说明 |
|------|-----|------|
| DOM检测超时 | 500ms | 等待DOM稳定的时间 |
| Mutation延迟 | 10ms | DOM变化去抖时间 |
| 最小文本长度 | 2字符 | 段落最小字符数 |
| 最小单词数 | 1个 | 段落最小单词数 |
| 可见屏幕监测 | 2屏 | 预翻译可见区域 |
| 翻译去抖 | 300ms | 防止频繁翻译请求 |

---

## 2. DOM处理架构

### 2.1 处理流程图

```
页面加载事件
    │
    ▼
等待domCheckTimeout (500ms)
    │
    ▼
等待waitForSelectors (3000ms超时)
    │
    ▼
┌─────────────────────────────────────┐
│  开始DOM树遍历 (DFS深度优先搜索)     │
└─────────────────────────────────────┘
    │
    ├─→ 检查URL是否在blockUrls? ──Yes──▶ 停止处理
    │        │
    │        No
    │        │
    ├─→ 检查元素是否在excludeTags? ──Yes──▶ 跳过该元素
    │        │
    │        No
    │        │
    ├─→ 检查元素是否匹配excludeSelectors? ──Yes──▶ 跳过该元素
    │        │
    │        No
    │        │
    ├─→ 检查元素是否为atomicBlockSelectors? ──Yes──▶ 作为整体处理
    │        │
    │        No
    │        │
    ├─→ 检查元素是否匹配stayOriginalSelectors? ──Yes──▶ 保留原文
    │        │
    │        No
    │        │
    ├─→ 提取文本内容 (textContent/innerHTML)
    │        │
    │        ▼
    ├─→ 文本长度验证 (paragraphMinTextCount >= 2)
    │        │
    │        ▼
    ├─→ 单词数验证 (paragraphMinWordCount >= 1)
    │        │
    │        ▼
    ├─→ 正则匹配验证 (excludeRegexps)
    │        │
    │        ▼
    ├─→ 语言检测 (sameLangCheck)
    │        │
    │        ▼
    ├─→ 发送翻译请求
    │        │
    │        ▼
    └─→ 插入翻译结果
             │
             ▼
    ┌──────────────────────┐
    │ 启动MutationObserver  │
    │ 监听DOM变化          │
    └──────────────────────┘
```

### 2.2 配置加载机制

```typescript
// 伪代码:配置加载流程
function loadConfig(): Config {
  // 1. 加载默认配置
  const defaultConfig = loadDefaultConfig();

  // 2. 加载站点特定规则
  const siteRule = matchSiteRule(currentUrl);

  // 3. 合并配置(优先级: 站点规则 > 用户配置 > 默认配置)
  return mergeConfig(
    defaultConfig,
    userConfig,
    siteRule
  );
}

function mergeConfig(...configs): Config {
  return {
    ...defaultConfig,
    ...userConfig,
    ...siteRule,
    // 特殊属性深度合并
    generalRule: deepMerge(
      defaultConfig.generalRule,
      userConfig.generalRule,
      siteRule.generalRule
    )
  };
}
```

### 2.3 模块职责划分

| 模块 | 文件 | 职责 |
|------|------|------|
| **配置管理** | `default_config.content.json` | 存储所有DOM处理规则 |
| **DOM处理引擎** | `content_script.js` (核心逻辑) | 遍历DOM、应用规则 |
| **选择器匹配器** | `content_script.js` (子模块) | 匹配CSS选择器 |
| **文本提取器** | `content_script.js` (子模块) | 提取可翻译文本 |
| **翻译插入器** | `content_script.js` (子模块) | 插入翻译结果 |
| **Mutation监听器** | `content_script.js` (子模块) | 监听DOM变化 |

---

## 3. 文本检测与验证算法

### 3.1 多层级文本验证

```typescript
interface TextValidationConfig {
  // 级别1: 字符数验证
  paragraphMinTextCount: 2;      // 段落最小字符数
  blockMinTextCount: 24;          // 块级最小字符数
  languageDetectMinTextCount: 50; // 语言检测最小字符数
  mainFrameMinTextCount: 50;      // 主框架最小字符数
  asideMaxTextCount: 1000;        // 侧边栏最大字符数

  // 级别2: 单词数验证
  paragraphMinWordCount: 1;       // 段落最小单词数
  blockMinWordCount: 4;           // 块级最小单词数
  mainFrameMinWordCount: 5;       // 主框架最小单词数
  asideMaxWordCount: 200;         // 侧边栏最大单词数

  // 级别3: 行数验证
  lineBreakMaxTextCount: 0;       // 断行最大字符数(0表示不限制)
}
```

#### **验证流程**:

```javascript
function validateText(element, text, config) {
  // 步骤1: 字符数检查
  if (text.length < config.paragraphMinTextCount) {
    return { valid: false, reason: 'text_too_short' };
  }

  // 步骤2: 单词数检查(对于空格分词语言)
  const words = text.match(/\b\w+\b/g) || [];
  if (isSpaceLanguage(text) && words.length < config.paragraphMinWordCount) {
    return { valid: false, reason: 'not_enough_words' };
  }

  // 步骤3: 正则黑名单检查
  for (const regex of config.noTranslateRegexp) {
    if (new RegExp(regex).test(text)) {
      return { valid: false, reason: 'matched_exclude_regex' };
    }
  }

  // 步骤4: 零宽字符检查
  const zeroWidthChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
  if (text.replace(zeroWidthChars, '').length === 0) {
    return { valid: false, reason: 'only_zero_width_chars' };
  }

  // 步骤5: 特殊内容检查
  if (text === '<img id=0>' || text === '<canvas id=0>') {
    return { valid: false, reason: 'placeholder_content' };
  }

  return { valid: true };
}
```

### 3.2 正则表达式规则库

#### **内容过滤正则** (`noTranslateRegexp`)

```javascript
const NO_TRANSLATE_PATTERNS = [
  "^\\d+.+ago$",                    // 时间戳: "5 minutes ago"
  "^\\d+\\s+MIN\\s+READ$",         // 阅读时间: "3 MIN READ"
  "^[\\u200B\\u200C\\u200D\\u2060\\uFEFF]+$", // 零宽字符
  "^[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]$",     // Surrogate pairs
  "^[a-zA-Z]{1}$",                 // 单个字母: "A", "B"
  "^[•]$",                         // 单个符号
  "<img id=0>",                    // 图片占位符
  "<canvas id=0>"                  // Canvas占位符
];
```

#### **内容排除正则** (`excludeRegexps`)

```javascript
const EXCLUDE_PATTERNS = [
  "(&lt;\\\\/?[a-zA-Z0-9]+(?:[^&gt;]*?)&gt;)", // HTML标签
  "(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})", // 邮箱地址
  "(<canvas>)"                                 // Canvas元素
];
```

#### **表格单元格正则** (`excludeSelectorsRegexes`)

```javascript
const TABLE_CELL_PATTERNS = {
  "td,th": [
    "^[a-zA-Z0-9\\-_.]+$",        // 纯标识符: "user_id", "api-key"
    "^[0-9,]+\\s+tokens$",        // Token数: "1,000 tokens"
    "^Up to [a-zA-Z]*\\s+\\d*$",  // 限制描述: "Up to 10"
    "^(/[a-zA-Z0-9\\-_.]+)+$",    // 文件路径: "/usr/bin/app"
    "^Model$",                    // 单个关键词
    "^[a-z]+-[0-9]+B\\*?$"        // 模型名: "gpt-4-32b"
  ]
};
```

### 3.3 文本提取算法

```javascript
function extractText(element) {
  // 处理不同节点类型
  switch (element.nodeType) {
    case Node.TEXT_NODE:
      return element.textContent.trim();

    case Node.ELEMENT_NODE:
      // 检查是否为特殊元素
      if (isAtomicBlock(element)) {
        return extractAtomicBlockText(element);
      }

      if (hasInlineChildren(element)) {
        return extractInlineText(element);
      }

      return extractBlockText(element);

    default:
      return '';
  }
}

function extractInlineText(element) {
  let text = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent;
    } else if (isInlineTag(child.tagName)) {
      text += extractInlineText(child);
    }
  }
  return text.trim();
}

function extractBlockText(element) {
  const blocks = [];
  for (const child of element.childNodes) {
    if (isBlockTag(child.tagName)) {
      blocks.push(extractText(child));
    }
  }
  return blocks.join('\n').trim();
}
```

---

## 4. 选择器匹配系统

### 4.1 选择器优先级体系

```
优先级 (从高到低):
┌──────────────────────────────────────────┐
│ 1. atomicBlockSelectors (原子块)         │ ← 最高优先级
│    ["relin-hc", "x-p", "app-keyword-content"]
├──────────────────────────────────────────┤
│ 2. excludeSelectors (强制排除)           │
│    ["[contenteditable='true']", ".notranslate"]
├──────────────────────────────────────────┤
│ 3. stayOriginalSelectors (保留原文)      │
│    ["CODE", "PRE", ".math-block"]
├──────────────────────────────────────────┤
│ 4. additionalSelectors (强制翻译)        │
│    ["h1", ".article-title", ".summary"]
├──────────────────────────────────────────┤
│ 5. excludeTags (标签黑名单)              │
│    ["SCRIPT", "STYLE", "TEXTAREA"]
├──────────────────────────────────────────┤
│ 6. stayOriginalTags (标签白名单)         │
│    ["CODE", "TT", "IMG", "SUP", "SUB"]
├──────────────────────────────────────────┤ 
│ 7. generalRule (通用规则)                │ ← 最低优先级
└──────────────────────────────────────────┘
```

### 4.2 选择器匹配算法

```javascript
class SelectorMatcher {
  constructor(config) {
    this.config = config;
    // 预编译选择器以提升性能
    this.compiledSelectors = this.compileSelectors(config);
  }

  match(element) {
    // 1. 检查原子块选择器 (最高优先级)
    if (this.matchesAtomicBlock(element)) {
      return { action: 'ATOMIC_TRANSLATE', priority: 1 };
    }

    // 2. 检查排除选择器
    if (this.matchesExclude(element)) {
      return { action: 'SKIP', priority: 2 };
    }

    // 3. 检查保留原文选择器
    if (this.matchesStayOriginal(element)) {
      return { action: 'PRESERVE', priority: 3 };
    }

    // 4. 检查强制翻译选择器
    if (this.matchesAdditional(element)) {
      return { action: 'FORCE_TRANSLATE', priority: 4 };
    }

    // 5. 检查标签规则
    const tagAction = this.matchTagRules(element.tagName);
    if (tagAction) {
      return tagAction;
    }

    // 6. 应用通用规则
    return { action: 'DEFAULT', priority: 7 };
  }

  matchesAtomicBlock(element) {
    return this.config.atomicBlockSelectors.some(selector =>
      element.matches(selector)
    );
  }

  matchesExclude(element) {
    // 静态选择器匹配
    const staticMatch = this.config.excludeSelectors.some(selector =>
      element.matches(selector)
    );

    if (staticMatch) return true;

    // 动态正则匹配
    return this.matchExcludeRegex(element);
  }

  matchExcludeRegex(element) {
    const tagName = element.tagName.toLowerCase();
    const patterns = this.config.excludeSelectorsRegexes[tagName];

    if (!patterns) return false;

    const text = element.textContent.trim();
    return patterns.some(pattern =>
      new RegExp(pattern).test(text)
    );
  }
}
```

### 4.3 配置示例

```json
{
  "generalRule": {
    "atomicBlockSelectors": ["relin-hc", "x-p", "app-keyword-content"],

    "excludeSelectors": [
      "[contenteditable='true']",
      ".uacc-clickable",
      "#immersive-translate-popup",
      ".notranslate",
      "[translate=no]"
    ],

    "additionalExcludeSelectors": [
      ".social-share",
      ".post__footer",
      ".btn",
      "rp",
      "rt",
      ".prism-code",
      ".material-icons",
      "i.fa",
      "time",
      ".countdown"
    ],

    "stayOriginalSelectors": [
      "CODE",
      "TT",
      "IMG",
      "SUP",
      "SUB"
    ],

    "additionalStayOriginalSelectors": [
      "span.katex",
      ".math-block",
      ".MathJax",
      ".MathJax_SVG",
      "em[translate=no]",
      "code[translate=no]",
      "kbd",
      "#ace-editor"
    ],

    "additionalSelectors": [
      "h1",
      "section h2",
      "section h3",
      "main h2",
      ".article-title",
      ".summary",
      ".headline"
    ],

    "excludeSelectorsRegexes": {
      "td,th": [
        "^[a-zA-Z0-9\\-_.]+$",
        "^[0-9,]+\\s+tokens$",
        "^Model$"
      ]
    }
  }
}
```

---

## 5. 标签分类体系

### 5.1 标签分类图谱

```
HTML标签分类
│
├─ 块级标签 (Block Tags) - 162个
│  ├─ 容器类: BODY, DIV, SECTION, ARTICLE, ASIDE
│  ├─ 标题类: H1, H2, H3, H4, H5, H6
│  ├─ 列表类: UL, OL, LI, DL, DT, DD
│  ├─ 表格类: TABLE, TBODY, TR, TD, TH
│  └─ 其他: P, HR, FOOTER, HEADER, NAV, MAIN
│
├─ 内联标签 (Inline Tags) - 57个
│  ├─ 文本样式: B, I, EM, STRONG, MARK, SMALL
│  ├─ 链接类: A
│  ├─ 代码类: CODE, KBD, TT, VAR
│  ├─ 特殊: SUP, SUB, SPAN, FONT, TIME
│  └─ 其他: IMG, ABBR, CITE, DFN, Q, S, U
│
├─ 排除标签 (Exclude Tags) - 23个
│  ├─ 脚本类: SCRIPT, STYLE, LINK
│  ├─ 元数据: META, TITLE, BASE
│  ├─ 交互类: TEXTAREA, BUTTON, SELECT, OPTION
│  ├─ 媒体类: SVG, CANVAS
│  └─ 特殊: PRE, KBD, NOSCRIPT, MATH
│
└─ 保留原文标签 (Stay Original Tags) - 13个
   ├─ 代码类: CODE, TT, SAMP, PRE
   ├─ 数学类: MATH, MO, MI, MN, MROW, MFRAC, MSUP
   └─ 其他: IMG, SUP, SUB
```

### 5.2 标签处理逻辑

```javascript
class TagClassifier {
  constructor(config) {
    this.blockTags = new Set(config.allBlockTags);
    this.inlineTags = new Set(config.inlineTags);
    this.excludeTags = new Set(config.excludeTags);
    this.stayOriginalTags = new Set(config.stayOriginalTags);
  }

  classify(tagName) {
    const upperTag = tagName.toUpperCase();

    // 1. 检查是否为排除标签
    if (this.excludeTags.has(upperTag)) {
      return { type: 'EXCLUDE', action: 'SKIP' };
    }

    // 2. 检查是否为保留原文标签
    if (this.stayOriginalTags.has(upperTag)) {
      return { type: 'STAY_ORIGINAL', action: 'PRESERVE' };
    }

    // 3. 检查是否为内联标签
    if (this.inlineTags.has(upperTag)) {
      return { type: 'INLINE', action: 'MERGE_WITH_PARENT' };
    }

    // 4. 检查是否为块级标签
    if (this.blockTags.has(upperTag)) {
      return { type: 'BLOCK', action: 'TRANSLATE_AS_PARAGRAPH' };
    }

    // 5. 未知标签,默认处理
    return { type: 'UNKNOWN', action: 'DETECT_BY_DISPLAY' };
  }

  isBlock(element) {
    const tagClassification = this.classify(element.tagName);

    if (tagClassification.type === 'BLOCK') {
      return true;
    }

    // 通过CSS检测
    const display = window.getComputedStyle(element).display;
    return display === 'block' || display === 'flex' || display === 'grid';
  }

  isInline(element) {
    const tagClassification = this.classify(element.tagName);

    if (tagClassification.type === 'INLINE') {
      return true;
    }

    // 通过CSS检测
    const display = window.getComputedStyle(element).display;
    return display === 'inline' || display === 'inline-block';
  }
}
```

### 5.3 标签配置详解

#### **块级标签** (`allBlockTags`)

```javascript
const BLOCK_TAGS = [
  // 文档结构
  "BODY", "MAIN", "HEADER", "FOOTER", "NAV", "ASIDE", "SECTION", "ARTICLE",

  // 内容分组
  "DIV", "P", "ADDRESS", "BLOCKQUOTE", "DETAILS", "SUMMARY",

  // 标题
  "H1", "H2", "H3", "H4", "H5", "H6", "HGROUP",

  // 列表
  "UL", "OL", "LI", "DL", "DT", "DD",

  // 表格
  "TABLE", "TBODY", "THEAD", "TFOOT", "TR", "TD", "TH",

  // 表单
  "FORM", "FIELDSET", "LEGEND",

  // 媒体
  "FIGURE", "FIGCAPTION", "PICTURE", "VIDEO", "CANVAS",

  // 其他
  "HR", "PRE", "SELECT", "OPTION", "BR"
];
```

#### **内联标签** (`inlineTags`)

```javascript
const INLINE_TAGS = [
  // 文本语义
  "A", "ABBR", "ACRONYM", "B", "BDO", "BIG", "CITE", "DFN",
  "EM", "I", "LABEL", "Q", "S", "SMALL", "SPAN", "STRONG",
  "SUB", "SUP", "U",

  // 插入/删除
  "INS", "DEL", "MARK",

  // 字体/样式
  "FONT", "NOBR",

  // Ruby注音
  "RUBY", "RP", "RB", "RT",

  // 代码/技术
  "CODE", "KBD", "TT", "VAR", "SAMP",

  // 其他
  "IMG", "TIME", "META", "WBR",

  // 特定网站元素
  "RELIN-HC", "RELIN-HIGHLIGHT", "RELIN-ORIGIN", "RELIN-TARGET",
  "XQDD_HIGHLIGHT_NEW_WORD", "RW-HIGHLIGHT", "HYPOTHESIS-HIGHLIGHT"
];
```

#### **排除标签** (`excludeTags`)

```javascript
const EXCLUDE_TAGS = [
  // 元数据
  "TITLE", "META", "BASE", "LINK",

  // 脚本/样式
  "SCRIPT", "STYLE", "NOSCRIPT",

  // 表单控件
  "TEXTAREA", "BUTTON", "SELECT", "OPTION",

  // 预格式化
  "PRE", "KBD",

  // 图形/媒体
  "SVG", "svg", "G", "CANVAS",

  // 数学
  "MATH",

  // 特殊
  "WBR", "RT", "RP",

  // 自定义
  "TTS-SENTENCE", "AIO-CODE", "RELIN-TARGET", "DATETIME"
];
```

#### **保留原文标签** (`stayOriginalTags`)

```javascript
const STAY_ORIGINAL_TAGS = [
  // 代码
  "CODE", "TT", "SAMP",

  // 数学符号
  "math", "semantics", "mrow", "mo", "mfrac", "msup",
  "mi", "mn", "msqrt", "d-math",

  // 其他
  "IMG", "SUP", "SUB"
];
```

---

## 6. DOM遍历策略

### 6.1 遍历算法

采用**深度优先搜索 (DFS)** 策略遍历DOM树:

```javascript
class DOMTraverser {
  constructor(config) {
    this.config = config;
    this.selectorMatcher = new SelectorMatcher(config);
    this.tagClassifier = new TagClassifier(config);
    this.processedNodes = new WeakSet();
  }

  traverse(rootElement) {
    // 初始化遍历队列
    const queue = [rootElement];
    const results = [];

    while (queue.length > 0) {
      const element = queue.shift();

      // 跳过已处理节点
      if (this.processedNodes.has(element)) {
        continue;
      }

      // 处理当前节点
      const result = this.processElement(element);
      if (result) {
        results.push(result);
      }

      // 标记为已处理
      this.processedNodes.add(element);

      // 添加子节点到队列 (如果允许)
      if (this.shouldTraverseChildren(element)) {
        queue.push(...element.childNodes);
      }
    }

    return results;
  }

  processElement(element) {
    // 1. 检查节点类型
    if (element.nodeType !== Node.ELEMENT_NODE &&
        element.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    // 2. 应用选择器规则
    const matchResult = this.selectorMatcher.match(element);

    switch (matchResult.action) {
      case 'SKIP':
        return null;

      case 'PRESERVE':
        return { element, action: 'PRESERVE' };

      case 'ATOMIC_TRANSLATE':
        return this.handleAtomicBlock(element);

      case 'FORCE_TRANSLATE':
        return this.handleForceTranslate(element);

      default:
        return this.handleDefault(element);
    }
  }

  shouldTraverseChildren(element) {
    // 原子块不遍历子元素
    if (this.config.atomicBlockSelectors.includes(element.tagName)) {
      return false;
    }

    // Shadow DOM特殊处理
    if (element.shadowRoot) {
      this.traverse(element.shadowRoot);
      return false;
    }

    return true;
  }

  handleAtomicBlock(element) {
    // 原子块作为整体翻译
    const text = element.textContent.trim();
    if (!this.validateText(text)) {
      return null;
    }

    return {
      element,
      text,
      action: 'TRANSLATE',
      isAtomic: true
    };
  }
}
```

### 6.2 可见区域检测

```javascript
class VisibilityDetector {
  constructor(config) {
    this.config = config;
    // visibleObserverScreens: [0, 0, 2, 0]
    // 表示向上0屏、向下0屏、向前2屏、向后0屏
    this.observeScreens = config.visibleObserverScreens;
  }

  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 计算扩展的可见区域
    const extendedTop = -this.observeScreens[0] * viewportHeight;
    const extendedBottom = (1 + this.observeScreens[2]) * viewportHeight;

    return (
      rect.bottom >= extendedTop &&
      rect.top <= extendedBottom &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  setupIntersectionObserver(callback) {
    // 使用Intersection Observer监听可见性变化
    const options = {
      root: null,
      rootMargin: `${this.observeScreens[2] * 100}% 0px 0px 0px`,
      threshold: 0.01
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
        }
      });
    }, options);

    return observer;
  }
}
```

### 6.3 Shadow DOM处理

```javascript
function traverseShadowDOM(element, processor) {
  // 处理当前元素
  processor(element);

  // 检查Shadow Root
  if (element.shadowRoot) {
    // 递归处理Shadow DOM
    const shadowChildren = element.shadowRoot.querySelectorAll('*');
    shadowChildren.forEach(child => {
      traverseShadowDOM(child, processor);
    });
  }

  // 处理子元素
  element.childNodes.forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      traverseShadowDOM(child, processor);
    }
  });
}

// 使用示例
traverseShadowDOM(document.body, (element) => {
  // 对每个元素应用翻译规则
  applyTranslationRules(element);
});
```

---

## 7. 翻译插入机制

### 7.1 翻译模式

```typescript
enum TranslationMode {
  DUAL = 'dual',           // 双语显示(原文+译文)
  TRANSLATION = 'translation', // 仅显示译文
  ORIGINAL = 'original'    // 仅显示原文
}

interface TranslationPosition {
  position: 'after' | 'before';  // 译文位置
}
```

### 7.2 Wrapper标签系统

```javascript
// 配置
const WRAPPER_CONFIG = {
  targetWrapperTag: 'font',      // 外层包装标签
  wrapperPrefix: 'smart',        // 前缀模式
  wrapperSuffix: 'smart',        // 后缀模式
  translationPosition: 'after'   // 译文位置
};

// 生成的HTML结构
class TranslationInserter {
  insertTranslation(element, originalText, translatedText, mode) {
    switch (mode) {
      case 'dual':
        return this.insertDualMode(element, originalText, translatedText);

      case 'translation':
        return this.insertTranslationOnly(element, translatedText);

      case 'original':
        return this.preserveOriginal(element);
    }
  }

  insertDualMode(element, originalText, translatedText) {
    // 创建外层wrapper
    const wrapper = document.createElement('font');
    wrapper.className = 'immersive-translate-target-wrapper';
    wrapper.setAttribute('data-immersive-translate-walked', 'true');

    // 保留原文
    const originalSpan = document.createElement('span');
    originalSpan.className = 'immersive-translate-target-inner';
    originalSpan.textContent = originalText;

    // 插入译文
    const translationWrapper = document.createElement('font');
    translationWrapper.className = 'immersive-translate-target-translation-block-wrapper';

    const translationInner = document.createElement('font');
    translationInner.className = 'immersive-translate-target-translation';
    translationInner.textContent = translatedText;

    translationWrapper.appendChild(translationInner);

    // 组装结构
    wrapper.appendChild(originalSpan);
    wrapper.appendChild(translationWrapper);

    // 替换原元素内容
    element.innerHTML = '';
    element.appendChild(wrapper);

    return wrapper;
  }
}
```

### 7.3 HTML结构示例

#### **双语模式 (Dual)**

```html
<p>
  <font class="immersive-translate-target-wrapper"
        data-immersive-translate-walked="true">
    <!-- 原文 -->
    <span class="immersive-translate-target-inner">
      Hello World
    </span>

    <!-- 译文容器 -->
    <font class="immersive-translate-target-translation-block-wrapper
                 immersive-translate-target-translation-theme-highlight">
      <font class="immersive-translate-target-translation">
        你好世界
      </font>
    </font>
  </font>
</p>
```

#### **仅译文模式 (Translation)**

```html
<p>
  <font class="immersive-translate-target-wrapper"
        data-immersive-translate-walked="true"
        data-translation-mode="translation">
    <font class="immersive-translate-target-translation">
      你好世界
    </font>
  </font>
</p>
```

### 7.4 富文本翻译

```javascript
class RichTextTranslator {
  constructor(config) {
    this.enableRichTranslate = config.enableRichTranslate;
    this.richIdName = config.richIdName || 'data-dl-uid';
    this.richTag = config.richTag || 'c';
  }

  translateWithRichText(element, translationService) {
    if (!this.enableRichTranslate) {
      return this.translatePlainText(element);
    }

    // 1. 给每个需要保留的标签添加唯一ID
    const taggedHtml = this.tagInlineElements(element.innerHTML);

    // 2. 发送带标签的HTML进行翻译
    const translatedHtml = await translationService.translate(taggedHtml);

    // 3. 还原HTML结构
    const finalHtml = this.restoreHtmlStructure(translatedHtml);

    return finalHtml;
  }

  tagInlineElements(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let uid = 0;
    const walk = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (this.isInlineElement(node)) {
          // 给内联元素添加ID
          node.setAttribute(this.richIdName, uid++);
        }
        Array.from(node.childNodes).forEach(walk);
      }
    };

    walk(temp);
    return temp.innerHTML;
  }
}
```

---

## 8. Mutation Observer实现

### 8.1 观察器配置

```javascript
const MUTATION_CONFIG = {
  // 核心配置
  mutationChangeDelay: 10,      // 去抖延迟(ms)
  urlChangeDelay: 50,            // URL变化延迟(ms)
  consumeTimeout: 100,           // 处理超时(ms)
  buildTimeout: 100,             // 构建超时(ms)
  checkSelfUpdate: true,         // 检查自身更新

  // 排除选择器
  mutationExcludeSelectors: [
    "span.highlighter--highlighted",
    "span.highlighter-ext",
    "mark",
    "msreadoutspan",
    "rw-highlight",
    "web-highlight",
    "font.immersive-translate-target-wrapper *",
    "pre",
    "pre code",
    ".uacc-clickable",
    "#immersiveTranslateImgLoading *"
  ],

  // 包含内容排除选择器
  mutationExcludeContainsSelectors: [
    "markerow8",
    "[class*='rgh-seen-']",
    "[isInvalidTag]",
    "mh",
    "body",
    "relin-hc",
    "x-p",
    "app-keyword-content"
  ]
};
```

### 8.2 Observer实现

```javascript
class SmartMutationObserver {
  constructor(config) {
    this.config = config;
    this.observer = null;
    this.mutationQueue = [];
    this.processingTimer = null;
  }

  start(rootElement) {
    const observerConfig = {
      childList: true,        // 监听子节点的添加/删除
      subtree: true,          // 监听所有后代节点
      characterData: false,   // 不监听文本变化(性能考虑)
      attributes: false       // 不监听属性变化(性能考虑)
    };

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(rootElement, observerConfig);
  }

  handleMutations(mutations) {
    // 过滤无效的mutation
    const validMutations = mutations.filter(mutation =>
      this.isValidMutation(mutation)
    );

    if (validMutations.length === 0) {
      return;
    }

    // 添加到队列
    this.mutationQueue.push(...validMutations);

    // 去抖处理
    this.debouncedProcess();
  }

  debouncedProcess() {
    clearTimeout(this.processingTimer);

    this.processingTimer = setTimeout(() => {
      this.processMutationQueue();
    }, this.config.mutationChangeDelay);
  }

  isValidMutation(mutation) {
    // 1. 检查是否为自身更新
    if (this.isSelfUpdate(mutation)) {
      return false;
    }

    // 2. 检查目标是否在排除列表
    const target = mutation.target;
    if (this.isExcludedElement(target)) {
      return false;
    }

    // 3. 检查添加的节点
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (!this.isExcludedElement(node)) {
          return true;
        }
      }
    }

    return false;
  }

  isSelfUpdate(mutation) {
    if (!this.config.checkSelfUpdate) {
      return false;
    }

    const target = mutation.target;

    // 检查是否为翻译wrapper
    if (target.classList?.contains('immersive-translate-target-wrapper')) {
      return true;
    }

    // 检查是否有翻译标记
    if (target.hasAttribute?.('data-immersive-translate-walked')) {
      return true;
    }

    return false;
  }

  isExcludedElement(element) {
    if (!element || !element.matches) {
      return true;
    }

    // 检查排除选择器
    for (const selector of this.config.mutationExcludeSelectors) {
      if (element.matches(selector)) {
        return true;
      }
    }

    // 检查包含内容排除选择器
    const elementText = element.textContent || '';
    for (const keyword of this.config.mutationExcludeContainsSelectors) {
      if (elementText.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  processMutationQueue() {
    if (this.mutationQueue.length === 0) {
      return;
    }

    // 提取所有新增节点
    const newNodes = [];
    for (const mutation of this.mutationQueue) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          newNodes.push(node);
        }
      }
    }

    // 清空队列
    this.mutationQueue = [];

    // 处理新节点
    this.translateNewNodes(newNodes);
  }

  translateNewNodes(nodes) {
    // 对新节点应用翻译规则
    nodes.forEach(node => {
      const traverser = new DOMTraverser(this.config);
      traverser.traverse(node);
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    clearTimeout(this.processingTimer);
  }
}
```

### 8.3 URL变化监听

```javascript
class URLChangeObserver {
  constructor(config, onUrlChange) {
    this.config = config;
    this.onUrlChange = onUrlChange;
    this.lastUrl = location.href;
    this.checkTimer = null;
  }

  start() {
    // 方法1: 监听history API
    this.wrapHistoryAPI();

    // 方法2: 轮询检查(后备方案)
    this.startPolling();
  }

  wrapHistoryAPI() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleUrlChange();
    };

    // 监听popstate事件
    window.addEventListener('popstate', () => {
      this.handleUrlChange();
    });
  }

  startPolling() {
    this.checkTimer = setInterval(() => {
      const currentUrl = location.href;
      if (currentUrl !== this.lastUrl) {
        this.lastUrl = currentUrl;
        this.handleUrlChange();
      }
    }, 100);
  }

  handleUrlChange() {
    // 去抖处理
    setTimeout(() => {
      this.onUrlChange(location.href);
    }, this.config.urlChangeDelay);
  }

  stop() {
    clearInterval(this.checkTimer);
  }
}
```

---

## 9. 性能优化策略

### 9.1 缓存机制

```javascript
class TranslationCache {
  constructor(config) {
    this.enabled = config.cache;
    this.cleanIntervalDays = config.cacheCleanIntervalDay;
    this.maxAgeDays = config.cacheMaxAgeDay;
    this.cache = new Map();

    this.loadFromStorage();
    this.startCleanupTimer();
  }

  generateKey(text, sourceLang, targetLang, service) {
    const hash = this.simpleHash(text);
    return `${service}:${sourceLang}-${targetLang}:${hash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  get(text, sourceLang, targetLang, service) {
    if (!this.enabled) return null;

    const key = this.generateKey(text, sourceLang, targetLang, service);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查是否过期
    const age = Date.now() - cached.timestamp;
    const maxAge = this.maxAgeDays * 24 * 60 * 60 * 1000;

    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.translation;
  }

  set(text, sourceLang, targetLang, service, translation) {
    if (!this.enabled) return;

    const key = this.generateKey(text, sourceLang, targetLang, service);
    this.cache.set(key, {
      translation,
      timestamp: Date.now()
    });

    // 定期保存到localStorage
    this.saveToStorage();
  }

  startCleanupTimer() {
    const interval = this.cleanIntervalDays * 24 * 60 * 60 * 1000;

    setInterval(() => {
      this.cleanup();
    }, interval);
  }

  cleanup() {
    const now = Date.now();
    const maxAge = this.maxAgeDays * 24 * 60 * 60 * 1000;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }

    this.saveToStorage();
  }
}
```

### 9.2 请求批处理

```javascript
class BatchTranslator {
  constructor(config) {
    this.config = config;
    this.batchEnabled = config.batchReportConfig.enabled;
    this.maxBatchSize = config.batchReportConfig.maxSize;
    this.maxWaitMs = config.batchReportConfig.maxWaitMs;
    this.pendingRequests = [];
    this.batchTimer = null;
  }

  async translate(text, options) {
    if (!this.batchEnabled) {
      return this.directTranslate(text, options);
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        text,
        options,
        resolve,
        reject
      });

      // 检查是否达到批量阈值
      if (this.pendingRequests.length >= this.maxBatchSize) {
        this.flush();
      } else {
        // 设置超时刷新
        this.scheduleBatchFlush();
      }
    });
  }

  scheduleBatchFlush() {
    if (this.batchTimer) {
      return; // 已经有定时器在运行
    }

    this.batchTimer = setTimeout(() => {
      this.flush();
    }, this.maxWaitMs);
  }

  async flush() {
    if (this.pendingRequests.length === 0) {
      return;
    }

    // 清除定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // 提取待处理请求
    const batch = this.pendingRequests.splice(0, this.maxBatchSize);

    try {
      // 合并文本
      const texts = batch.map(req => req.text);
      const combinedText = texts.join('\n\n%%\n\n');

      // 批量翻译
      const translatedText = await this.directTranslate(
        combinedText,
        batch[0].options
      );

      // 拆分结果
      const translations = translatedText.split('\n\n%%\n\n');

      // 返回结果
      batch.forEach((req, index) => {
        req.resolve(translations[index]);
      });
    } catch (error) {
      // 错误处理
      batch.forEach(req => {
        req.reject(error);
      });
    }
  }
}
```

### 9.3 去抖与节流

```javascript
class PerformanceOptimizer {
  // 去抖函数
  debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  throttle(func, limit) {
    let inThrottle;

    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;

        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  // 应用示例
  setupOptimizedListeners(config) {
    // 翻译请求去抖
    const debouncedTranslate = this.debounce(
      (element) => this.translateElement(element),
      config.translationDebounce
    );

    // Mutation处理去抖
    const debouncedMutation = this.debounce(
      (mutations) => this.handleMutations(mutations),
      config.mutationChangeDelay
    );

    // 滚动事件节流
    const throttledScroll = this.throttle(
      () => this.checkVisibleElements(),
      100
    );

    window.addEventListener('scroll', throttledScroll);
  }
}
```

### 9.4 懒加载策略

```javascript
class LazyTranslator {
  constructor(config) {
    this.config = config;
    this.immediateTextCount = config.immediateTranslationTextCount;
    this.scrollLimitScreens = config.immediateTranslationScrollLimitScreens;
  }

  shouldTranslateImmediately(element) {
    // 1. 检查文本长度
    const textLength = element.textContent.length;
    if (textLength > this.immediateTextCount) {
      return false; // 文本过长,延迟翻译
    }

    // 2. 检查可见性
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollLimit = this.scrollLimitScreens * viewportHeight;

    if (rect.top > scrollLimit) {
      return false; // 在可见区域外,延迟翻译
    }

    return true;
  }

  translatePage(rootElement) {
    const allElements = this.findTranslatableElements(rootElement);

    // 分组: 立即翻译 vs 延迟翻译
    const immediateElements = [];
    const deferredElements = [];

    for (const element of allElements) {
      if (this.shouldTranslateImmediately(element)) {
        immediateElements.push(element);
      } else {
        deferredElements.push(element);
      }
    }

    // 立即翻译可见内容
    this.translateBatch(immediateElements);

    // 延迟翻译不可见内容
    this.setupIntersectionObserver(deferredElements);
  }

  setupIntersectionObserver(elements) {
    const observer = new IntersectionObserver((entries) => {
      const visibleElements = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => entry.target);

      if (visibleElements.length > 0) {
        this.translateBatch(visibleElements);
      }
    });

    elements.forEach(element => observer.observe(element));
  }
}
```

---

## 10. 决策树与条件流

### 10.1 翻译资格检查流程

```
元素进入处理流程
    │
    ▼
┌─────────────────────────────────┐
│ URL检查                          │
│ - 是否在blockUrls?               │
└─────────────────────────────────┘
    │ No
    ▼
┌─────────────────────────────────┐
│ 原子块检查                       │
│ - 匹配atomicBlockSelectors?     │
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ 作为整体翻译
    ▼
┌─────────────────────────────────┐
│ 排除选择器检查                   │
│ - 匹配excludeSelectors?         │
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ SKIP
    ▼
┌─────────────────────────────────┐
│ 排除标签检查                     │
│ - 在excludeTags列表中?          │
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ SKIP
    ▼
┌─────────────────────────────────┐
│ 保留原文选择器检查               │
│ - 匹配stayOriginalSelectors?    │
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ PRESERVE
    ▼
┌─────────────────────────────────┐
│ 保留原文标签检查                 │
│ - 在stayOriginalTags列表中?     │
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ PRESERVE
    ▼
┌─────────────────────────────────┐
│ 文本提取                         │
│ - 提取textContent               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ 文本长度验证                     │
│ - length >= paragraphMinTextCount?│
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ 继续
    └──▶ SKIP
         │
         ▼
┌─────────────────────────────────┐
│ 单词数验证                       │
│ - words >= paragraphMinWordCount?│
└─────────────────────────────────┘
    │ No              │ Yes
    │                 └──▶ 继续
    └──▶ SKIP
         │
         ▼
┌─────────────────────────────────┐
│ 正则匹配验证                     │
│ - 匹配noTranslateRegexp?        │
└─────────────────────────────────┘
    │ Yes             │ No
    │                 └──▶ 继续
    └──▶ SKIP
         │
         ▼
┌─────────────────────────────────┐
│ 语言检测                         │
│ - 已经是目标语言?                │
└─────────────────────────────────┘
    │ Yes             │ No
    │                 └──▶ 继续
    └──▶ SKIP
         │
         ▼
┌─────────────────────────────────┐
│ ✅ 通过所有检查                  │
│ → 发送翻译请求                   │
└─────────────────────────────────┘
```

### 10.2 标签类型处理决策树

```
元素进入标签分类
    │
    ▼
检查tagName
    │
    ├─→ 在excludeTags中? ──Yes──▶ SKIP
    │        │
    │        No
    │        │
    ├─→ 在stayOriginalTags中? ──Yes──▶ PRESERVE
    │        │
    │        No
    │        │
    ├─→ 在inlineTags中? ──Yes──▶ 合并到父元素文本流
    │        │                    │
    │        No                   └─→ 应用内联翻译
    │        │
    ├─→ 在allBlockTags中? ──Yes──▶ 作为段落处理
    │        │                     │
    │        No                    └─→ 应用块级翻译
    │        │
    └─→ 未知标签
             │
             ├─→ 检查CSS display属性
             │   ├─→ display: block → 块级处理
             │   ├─→ display: inline → 内联处理
             │   └─→ 其他 → 默认处理
             │
             └─→ 回退到默认规则
```

### 10.3 翻译插入决策

```
准备插入翻译
    │
    ▼
检查translationMode
    │
    ├─→ mode === 'dual'?
    │   │ Yes
    │   └─→ 创建双语结构
    │       ├─→ 保留原文
    │       ├─→ 插入译文
    │       └─→ 应用主题样式
    │
    ├─→ mode === 'translation'?
    │   │ Yes
    │   └─→ 仅显示译文
    │       ├─→ 隐藏原文
    │       └─→ 显示译文
    │
    └─→ mode === 'original'?
        │ Yes
        └─→ 保留原文
            └─→ 不插入译文
```

---

## 11. 边缘案例处理

### 11.1 数学公式

**问题**: MathJax、KaTeX等数学公式不应被翻译

**解决方案**:

```javascript
const MATH_SELECTORS = [
  'span.katex',
  '.math-block',
  '.MathJax_Preview',
  '.MathJax',
  '.MathJax_Display',
  '.math-container',
  '.MathJax_SVG',
  'math-renderer',
  '[aria-labelledby^="MathJax-SVG"]',
  '.mwe-math-element',
  '.ltx_Math',
  '.mathjax-block',
  '.MathJax_CHTML',
  'span.math.inline',
  'span.math.display'
];

// 添加到stayOriginalSelectors
config.additionalStayOriginalSelectors.push(...MATH_SELECTORS);
```

### 11.2 代码块

**问题**: 代码块应保持原样

**解决方案**:

```javascript
const CODE_SELECTORS = [
  'pre',
  'code',
  '.prism-code',
  '.enlighter-code',
  '.rc-CodeBlock',
  '[role=code]',
  'table.highlight',
  'div[class^=codeBlockContent]',
  'div[class^=codeBlockLines]',
  '#ace-editor',
  '.jp-CodeMirrorEditor',
  '.interactive-markdown__code'
];

// 处理策略
function handleCodeBlock(element) {
  // 1. 检查是否为代码块
  if (CODE_SELECTORS.some(sel => element.matches(sel))) {
    return { action: 'PRESERVE' };
  }

  // 2. 检查语言属性
  const lang = element.getAttribute('class')?.match(/language-(\w+)/)?.[1];
  if (lang) {
    return { action: 'PRESERVE', language: lang };
  }

  return null;
}
```

### 11.3 可编辑元素

**问题**: contenteditable元素不应自动翻译

**解决方案**:

```javascript
const INTERACTIVE_SELECTORS = [
  '[contenteditable="true"]',
  'textarea',
  'input[type="text"]',
  'input[type="search"]',
  '.ql-editor', // Quill编辑器
  '.trix-content', // Trix编辑器
  '.ProseMirror', // ProseMirror编辑器
  '.CodeMirror' // CodeMirror编辑器
];

// 添加到排除选择器
config.excludeSelectors.push(...INTERACTIVE_SELECTORS);
```

### 11.4 Shadow DOM

**问题**: Shadow DOM中的内容需要递归处理

**解决方案**:

```javascript
function traverseWithShadowDOM(element, callback) {
  // 处理当前元素
  callback(element);

  // 处理Shadow Root
  if (element.shadowRoot) {
    console.log(`Found shadow root in ${element.tagName}`);

    // 递归处理Shadow DOM内的所有元素
    Array.from(element.shadowRoot.querySelectorAll('*')).forEach(child => {
      traverseWithShadowDOM(child, callback);
    });
  }

  // 处理普通子元素
  Array.from(element.children).forEach(child => {
    traverseWithShadowDOM(child, callback);
  });
}

// 使用
traverseWithShadowDOM(document.body, (element) => {
  // 应用翻译规则
  if (shouldTranslate(element)) {
    translateElement(element);
  }
});
```

### 11.5 动态内容 (SPA)

**问题**: 单页应用的动态内容更新

**解决方案**:

```javascript
class SPAHandler {
  constructor(config) {
    this.config = config;
    this.observer = new SmartMutationObserver(config);
    this.urlObserver = new URLChangeObserver(config, (url) => {
      this.handlePageChange(url);
    });
  }

  start() {
    // 启动Mutation Observer
    this.observer.start(document.body);

    // 启动URL监听
    this.urlObserver.start();
  }

  handlePageChange(newUrl) {
    console.log(`Page changed to: ${newUrl}`);

    // 等待新内容加载
    setTimeout(() => {
      this.retranslateNewContent();
    }, this.config.urlChangeDelay);
  }

  retranslateNewContent() {
    // 查找新增的未翻译元素
    const untranslatedElements = document.querySelectorAll(
      '*:not([data-immersive-translate-walked])'
    );

    // 应用翻译
    untranslatedElements.forEach(element => {
      if (this.shouldTranslate(element)) {
        this.translateElement(element);
      }
    });
  }
}
```

### 11.6 RTL语言支持

**问题**: 阿拉伯语、希伯来语等从右到左书写的语言

**解决方案**:

```javascript
const RTL_LANGUAGES = [
  'ar',    // 阿拉伯语
  'arc',   // 阿拉姆语
  'az',    // 阿塞拜疆语(有些方言)
  'dv',    // 迪维希语
  'he',    // 希伯来语
  'ckb',   // 库尔德语(索拉尼)
  'fa',    // 波斯语
  'ur',    // 乌尔都语
  'ug'     // 维吾尔语
];

function insertTranslationWithRTL(element, originalText, translatedText, targetLang) {
  const wrapper = document.createElement('font');
  wrapper.className = 'immersive-translate-target-wrapper';

  // 检查目标语言是否为RTL
  if (RTL_LANGUAGES.includes(targetLang)) {
    wrapper.setAttribute('dir', 'rtl');
    wrapper.style.textAlign = 'right';
  }

  // 插入翻译内容
  wrapper.textContent = translatedText;

  element.innerHTML = '';
  element.appendChild(wrapper);
}
```

---

## 12. 配置参数详解

### 12.1 核心配置参数

| 参数名称 | 类型 | 默认值 | 说明 |
|---------|------|--------|------|
| `domCheckTimeout` | Number | 500 | 等待DOM稳定的超时时间(ms) |
| `mutationChangeDelay` | Number | 10 | Mutation去抖延迟(ms) |
| `urlChangeDelay` | Number | 50 | URL变化检测延迟(ms) |
| `paragraphMinTextCount` | Number | 2 | 段落最小字符数 |
| `paragraphMinWordCount` | Number | 1 | 段落最小单词数 |
| `blockMinTextCount` | Number | 24 | 块级元素最小字符数 |
| `blockMinWordCount` | Number | 4 | 块级元素最小单词数 |
| `languageDetectMinTextCount` | Number | 50 | 语言检测最小字符数 |
| `mainFrameMinTextCount` | Number | 50 | 主框架最小字符数 |
| `mainFrameMinWordCount` | Number | 5 | 主框架最小单词数 |
| `asideMaxTextCount` | Number | 1000 | 侧边栏最大字符数 |
| `asideMaxWordCount` | Number | 200 | 侧边栏最大单词数 |
| `visibleObserverScreens` | Array | [0,0,2,0] | 可见区域监测屏幕数 |
| `translationPosition` | String | "after" | 译文插入位置 |
| `targetWrapperTag` | String | "font" | 包装标签名称 |
| `wrapperPrefix` | String | "smart" | 包装前缀模式 |
| `wrapperSuffix` | String | "smart" | 包装后缀模式 |

### 12.2 性能配置参数

| 参数名称 | 类型 | 默认值 | 说明 |
|---------|------|--------|------|
| `cache` | Boolean | true | 启用翻译缓存 |
| `cacheCleanIntervalDay` | Number | 1 | 缓存清理间隔(天) |
| `cacheMaxAgeDay` | Number | 30 | 缓存最大存活时间(天) |
| `translationDebounce` | Number | 300 | 翻译请求去抖延迟(ms) |
| `immediateTranslationTextCount` | Number | 4999 | 立即翻译的最大字符数 |
| `immediateTranslationScrollLimitScreens` | Number | 1 | 立即翻译的滚动限制(屏) |
| `longHtmlTextLength` | Number | 500000 | 长HTML阈值 |
| `longBuildDomLength` | Number | 3000 | 长DOM构建阈值 |
| `batchReportConfig.enabled` | Boolean | true | 启用批量请求 |
| `batchReportConfig.maxSize` | Number | 5 | 批量请求最大数量 |
| `batchReportConfig.maxWaitMs` | Number | 2000 | 批量请求最大等待时间(ms) |

### 12.3 选择器配置示例

```json
{
  "generalRule": {
    "atomicBlockSelectors": [
      "relin-hc",
      "x-p",
      "app-keyword-content"
    ],

    "excludeSelectors": [
      "[contenteditable='true']",
      ".notranslate",
      "[translate=no]",
      "#immersive-translate-popup"
    ],

    "additionalExcludeSelectors": [
      ".social-share",
      ".btn",
      "rp",
      "rt",
      ".prism-code",
      "time"
    ],

    "stayOriginalSelectors": [],

    "additionalStayOriginalSelectors": [
      "span.katex",
      ".math-block",
      ".MathJax",
      "code[translate=no]",
      "kbd"
    ],

    "additionalSelectors": [
      "h1",
      "section h2",
      ".article-title",
      ".summary"
    ]
  }
}
```

---

## 总结

### 关键设计原则

1. **性能优先**: 通过缓存、去抖、批处理等技术最小化性能影响
2. **灵活配置**: 通过丰富的配置选项支持各种网站
3. **智能过滤**: 多层级验证确保只翻译有意义的内容
4. **边缘处理**: 妥善处理数学公式、代码块、Shadow DOM等特殊情况
5. **动态适应**: 支持SPA和动态内容更新

### 核心流程总结

```
1. 等待DOM稳定 (domCheckTimeout: 500ms)
   ↓
2. 遍历DOM树 (深度优先搜索)
   ↓
3. 应用选择器规则 (优先级匹配)
   ↓
4. 提取并验证文本 (长度、单词数、正则)
   ↓
5. 检查缓存 (30天有效期)
   ↓
6. 发送翻译请求 (批处理、去抖)
   ↓
7. 插入翻译结果 (双语/仅译文模式)
   ↓
8. 监听DOM变化 (MutationObserver)
```

### 性能指标

- **初始化时间**: < 500ms
- **DOM处理延迟**: 10-50ms (去抖)
- **翻译请求延迟**: 300ms (去抖)
- **缓存命中率**: > 80% (长期使用后)
- **内存占用**: < 10MB (排除翻译缓存)

---

**文档结束**
