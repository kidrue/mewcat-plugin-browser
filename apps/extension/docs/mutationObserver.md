# MutationObserver 动态内容监听与翻译架构 - 实现提示词

## 任务概述
实现一个高性能的 MutationObserver 架构，用于监听网页 DOM 变化并触发动态翻译。该架构需要支持：
- 无限滚动内容的实时翻译
- SPA 路由切换时的内容更新
- 字幕、图片等特殊内容的动态翻译
- 高性能防抖和过滤机制
- 防止翻译结果再次触发翻译的死循环

---

## 核心架构要求

### 1. 多层次 MutationObserver 系统

实现三个层次的监听器：

#### A. 全局主监听器（Primary Observer）
```javascript
// 监听整个页面的DOM变化
const primaryObserver = new MutationObserver(async (mutations) => {
  // 处理逻辑见下文
});

// 观察配置
primaryObserver.observe(document.body, {
  childList: true,      // 监听子节点添加/删除
  subtree: true,        // 监听所有后代节点
  characterData: false  // 主监听器不监听文本变化（性能优化）
});

// 如果body还未加载，也监听documentElement
if (document.documentElement) {
  primaryObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}
```

#### B. 容器监听器（Container Observer）
```javascript
// 为特定动态容器创建独立监听器
const containerObservers = new Map();

function observeContainer(selector) {
  const container = document.querySelector(selector);
  if (!container || containerObservers.has(container)) return;

  const observer = new MutationObserver((mutations) => {
    handleContainerMutations(mutations, container);
  });

  observer.observe(container, {
    childList: true,
    subtree: true
  });

  containerObservers.set(container, observer);
}

// 监听常见的动态容器
const dynamicContainers = [
  '[role="feed"]',           // Twitter/Facebook feeds
  '[data-testid="timeline"]',// Timeline容器
  '.infinite-scroll',        // 无限滚动容器
  '#main-content'            // 主要内容区域
];

dynamicContainers.forEach(observeContainer);
```

#### C. 特殊元素监听器（Specialized Observers）

**图片监听器：**
```javascript
// 监听图片src变化（懒加载）
function observeImage(img) {
  const imageObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'src' &&
          mutation.oldValue !== img.src) {
        translateImage(img);
      }
    });
  });

  imageObserver.observe(img, {
    attributes: true,
    attributeFilter: ['src', 'height', 'style'],
    attributeOldValue: true  // 记录旧值以比较
  });
}
```

**字幕监听器：**
```javascript
// 监听字幕文本变化
function observeSubtitle(subtitleContainer) {
  const subtitleObserver = new MutationObserver((mutations) => {
    const newText = subtitleContainer.textContent;
    if (newText !== lastSubtitle) {
      translateSubtitle(newText);
      lastSubtitle = newText;
    }
  });

  subtitleObserver.observe(subtitleContainer, {
    childList: true,
    subtree: true,
    characterData: true  // 监听文本节点变化
  });
}
```

**主题/样式监听器：**
```javascript
// 监听主题切换（需要重新翻译以适配样式）
const themeObserver = new MutationObserver(() => {
  // 延迟50ms执行，避免频繁触发
  setTimeout(() => refreshTranslation(), 50);
});

themeObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'data-theme', 'style'],
  subtree: false  // 只监听body自身，不监听子节点
});
```

---

### 2. 配置系统

定义完整的配置对象：

```javascript
const mutationConfig = {
  // 基础配置
  enabled: true,                    // 是否启用MutationObserver
  enableUrlChange: true,            // 是否检测URL变化
  checkSelfUpdate: true,            // 是否检查自我更新（防止翻译结果再次触发）

  // 性能配置
  buildTimeout: 100,                // 构建翻译容器的防抖延迟（毫秒）
  consumeTimeout: 100,              // 文本变化处理的防抖延迟（毫秒）
  mutationChangeDelay: 10,          // mutation变化的最小间隔（毫秒）

  // 限制配置
  repeatTranslateNum: 3,            // 同一节点最多翻译次数（防止死循环）

  // 过滤选择器（5层过滤系统）
  // Layer 1: 限定容器（只监听这些容器内的变化）
  mutationObserverLimitTargetSelectors: [
    // 示例：
    // '#main-content',
    // '[role="main"]'
  ],

  // Layer 2: 排除选择器（最高优先级，这些元素的变化直接忽略）
  mutationExcludeSelectors: [
    '.no-translate',              // 标记为不翻译的元素
    '[data-no-translate]',        // 数据属性标记
    'script',                     // 脚本标签
    'style',                      // 样式标签
    'noscript',                   // noscript标签
    'svg',                        // SVG元素
    '.translation-result',        // 已翻译的结果（防止死循环）
    '[class*="immersive"]',       // 翻译插件添加的元素
  ],

  // Layer 3: 排除包含指定元素的容器
  mutationExcludeContainsSelectors: [
    '.ad-container',              // 包含广告的容器
    '[data-ad]',                  // 广告标记
  ],

  // Layer 4: 跳过动态标记的选择器
  skipDynamicMarkSelectors: [
    '.skip-translate',
    '[data-skip]',
  ],

  // 特殊容器（需要特殊处理的容器）
  mutationObserverContainerSelectors: [
    '[role="feed"]',
    '[data-testid="timeline"]',
    '.infinite-scroll-container',
  ],

  // URL黑名单（这些URL不启用MutationObserver）
  mutationBlockUrls: [
    '*.larkoffice.com',
    '*.larksuite.com',
    'docs.google.com',
  ],
};
```

---

### 3. 核心处理逻辑

#### A. 主 Mutation 处理函数

```javascript
const primaryObserver = new MutationObserver(async (mutations) => {
  // ===== 前置检查 =====

  // 检查1: 是否应该跳过（页面隐藏、暂停翻译等）
  if (shouldSkipTranslation()) return;

  // 检查2: 页面状态检查
  if (!config.enableSiteAutoTranslate &&
      currentTranslateState !== 'original') {
    stopTranslation();
    return;
  }

  // 检查3: URL变化检测
  if (config.enableUrlChange && hasUrlChanged()) {
    return; // 由路由处理器处理
  }

  // ===== 遍历所有 mutations =====
  for (const mutation of mutations) {
    const target = mutation.target;

    // 跳过注释节点
    if (target.nodeType === Node.COMMENT_NODE) continue;

    // ===== 5层过滤系统 =====

    // Layer 1: 限定容器检查
    if (config.mutationObserverLimitTargetSelectors.length > 0) {
      if (!matchesAnySelector(target, config.mutationObserverLimitTargetSelectors)) {
        continue;
      }
    }

    // Layer 2: 排除选择器检查（最高优先级）
    if (config.mutationExcludeSelectors.length > 0) {
      if (matchesAnySelector(target, config.mutationExcludeSelectors)) {
        continue;
      }
    }

    // Layer 3: 自我更新检查（防止翻译结果再次触发）
    if (config.checkSelfUpdate && isSelfUpdate(mutation)) {
      continue;
    }

    // Layer 4: 节点标记检查
    if (!isSkipMarked(target) &&
        !isAlreadyTranslated(target) &&
        target.nodeName !== 'BODY' &&
        !matchesAnySelector(target, config.skipDynamicMarkSelectors) &&
        !target.timer) {
      continue;
    }

    // Layer 5: 节点类型和结构检查
    const addedNodes = Array.from(mutation.addedNodes || []);
    const validNodes = addedNodes.filter(node => {
      if (node.nodeType === Node.COMMENT_NODE) return false;
      if (node.immersive) return false; // 翻译插件标记
      if (matchesAnySelector(node, config.mutationExcludeSelectors)) return false;
      return target.contains(node);
    });

    if (validNodes.length === 0) continue;

    // ===== 处理不同类型的 mutation =====

    // 处理 characterData（文本变化）
    if (mutation.type === 'characterData') {
      handleCharacterDataChange(target);
      continue;
    }

    // 处理 childList（子节点变化）
    if (mutation.addedNodes.length > 0) {
      handleChildListChange(target, validNodes);
    }
  }
});
```

#### B. 防抖翻译触发器

```javascript
// 节点防抖状态存储
const nodeTimers = new WeakMap();
const nodeTranslateCount = new WeakMap();

// 构建翻译容器（带防抖）
function scheduleTranslation(node, forceTranslate = true) {
  const timeout = config.buildTimeout || 100;

  // 清除节点标记
  clearNodeMarks(node);
  node.paragraphs = [];

  // 清除之前的定时器
  const existingTimer = nodeTimers.get(node);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // 设置新的防抖定时器
  const timer = setTimeout(() => {
    executeTranslation(node, forceTranslate);
    nodeTimers.delete(node);
  }, timeout);

  nodeTimers.set(node, timer);
}

// 文本变化处理（带防抖和重复检查）
function handleTextChange(node) {
  // 检查排除条件
  for (const selector of config.mutationExcludeContainsSelectors) {
    if (node.querySelector(selector)) return;
  }

  const timeout = config.consumeTimeout || 100;

  // 清除之前的定时器
  const existingTimer = nodeTimers.get(node);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // 设置新的防抖定时器
  const timer = setTimeout(() => {
    // 清理标记
    clearNodeMarks(node);

    // 执行翻译
    translateNode(node, { force: true });

    nodeTimers.delete(node);
  }, timeout);

  nodeTimers.set(node, timer);
}
```

#### C. 重复翻译限制

```javascript
function handleChildListChange(target, validNodes) {
  // 增加翻译计数
  let count = nodeTranslateCount.get(target) || 0;
  count++;
  nodeTranslateCount.set(target, count);

  // 检查是否超过重复翻译限制
  if (config.repeatTranslateNum > 0 &&
      count > config.repeatTranslateNum) {
    console.warn(`Node translated ${count} times, skipping to prevent infinite loop`);
    return;
  }

  // 检查内容是否真的变化了
  if (target.formatHtml) {
    const hasReplacement = validNodes.length > 0 &&
                          mutation.removedNodes.length > 0;

    if (hasReplacement) {
      // 比较新旧内容（去除空白字符）
      const currentText = target.textContent?.replace(/\s+/g, '');
      const removedText = Array.from(mutation.removedNodes)
        .map(n => n.textContent?.replace(/\s+/g, ''))
        .join('');

      if (currentText === removedText) {
        // 内容未变化，可能只是DOM重构，跳过
        return;
      }
    }

    // 单节点添加且无删除，可能是样式更新
    const isSingleAddition = validNodes.length === 1 &&
                            mutation.removedNodes.length === 0;
    if (isSingleAddition) return;
  }

  // 记录当前长度（用于后续characterData检测）
  target.recordLength = target.innerHTML.length;

  // 触发翻译
  scheduleTranslation(target);
}
```

#### D. characterData 处理

```javascript
function handleCharacterDataChange(target) {
  const parent = target.parentElement;
  if (!parent) return;

  // 检查排除条件
  if (matchesAnySelector(parent, config.mutationExcludeContainsSelectors)) {
    return;
  }

  // 检查是否真的有长度变化
  if (parent.recordLength &&
      parent.recordLength !== parent.innerHTML.length) {
    handleTextChange(parent);
  }
}
```

---

### 4. 自我更新检测（防止死循环）

```javascript
function isSelfUpdate(mutation) {
  const target = mutation.target;

  // 检查是否有翻译插件的标记
  if (target.immersive || target.classList?.contains('immersive')) {
    return true;
  }

  // 检查是否是格式化HTML的更新
  if (target.formatHtml) {
    // 检查addedNodes和removedNodes
    const addedNodes = Array.from(mutation.addedNodes || []);
    const removedNodes = Array.from(mutation.removedNodes || []);

    // 如果只是DOM重构（内容相同）
    if (addedNodes.length > 0 && removedNodes.length > 0) {
      const currentText = target.textContent?.replace(/\s+/g, '');
      const removedText = removedNodes
        .map(n => n.textContent?.replace(/\s+/g, ''))
        .join('');

      if (currentText === removedText) {
        return true; // 内容未变，是自我更新
      }
    }
  }

  // 检查是否包含翻译结果标记
  const hasTranslationMark = Array.from(mutation.addedNodes || []).some(node => {
    return node.nodeType === Node.ELEMENT_NODE &&
           (node.classList?.contains('translation') ||
            node.dataset?.translation ||
            node.querySelector?.('[data-translation]'));
  });

  return hasTranslationMark;
}
```

---

### 5. 节点标记系统

```javascript
// 标记管理器
const NodeMarker = {
  MARK_CLASS: 'immersive-translated',
  SKIP_CLASS: 'immersive-skip',

  // 标记节点已翻译
  mark(node, translationId) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    node.classList.add(this.MARK_CLASS);
    node.dataset.translationId = translationId;
    node.dataset.translatedAt = Date.now();
  },

  // 检查是否已标记
  isMarked(node, translationId) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (!node.classList.contains(this.MARK_CLASS)) return false;
    return !translationId || node.dataset.translationId === translationId;
  },

  // 标记跳过
  markSkip(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    node.classList.add(this.SKIP_CLASS);
  },

  // 检查是否跳过
  isSkipMarked(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.classList.contains(this.SKIP_CLASS);
  },

  // 清除标记
  clearMark(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    node.classList.remove(this.MARK_CLASS);
    delete node.dataset.translationId;
    delete node.dataset.translatedAt;
  },

  // 清除到父节点的所有标记
  clearToParentMark(node, parent) {
    let current = node;
    while (current && current !== parent) {
      this.clearMark(current);
      current = current.parentElement;
    }
  }
};
```

---

### 6. URL 变化检测

```javascript
let lastUrl = location.href;
let lastPathname = location.pathname;

function hasUrlChanged() {
  const currentUrl = location.href;
  const currentPathname = location.pathname;

  if (currentUrl !== lastUrl || currentPathname !== lastPathname) {
    lastUrl = currentUrl;
    lastPathname = currentPathname;
    return true;
  }

  return false;
}

// 监听 popstate（浏览器前进后退）
window.addEventListener('popstate', () => {
  if (hasUrlChanged()) {
    // 重新初始化翻译
    reinitializeTranslation();
  }
});

// 拦截 pushState 和 replaceState（SPA路由）
const originalPushState = history.pushState;
history.pushState = function(...args) {
  const result = originalPushState.apply(this, args);
  if (hasUrlChanged()) {
    reinitializeTranslation();
  }
  return result;
};

const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  const result = originalReplaceState.apply(this, args);
  if (hasUrlChanged()) {
    reinitializeTranslation();
  }
  return result;
};
```

---

### 7. 工具函数

```javascript
// 选择器匹配
function matchesAnySelector(element, selectors) {
  if (!element || !element.matches) return false;
  return selectors.some(selector => {
    try {
      return element.matches(selector) ||
             element.closest(selector);
    } catch (e) {
      console.warn('Invalid selector:', selector);
      return false;
    }
  });
}

// 检查是否应该跳过翻译
function shouldSkipTranslation() {
  // 页面隐藏
  if (document.hidden) return true;

  // 翻译已暂停
  if (translationPaused) return true;

  // URL在黑名单中
  if (isUrlBlocked(location.href, config.mutationBlockUrls)) {
    return true;
  }

  return false;
}

// URL黑名单检查（支持通配符）
function isUrlBlocked(url, blocklist) {
  return blocklist.some(pattern => {
    // 转换通配符为正则
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );
    return regex.test(url);
  });
}

// 清除节点标记
function clearNodeMarks(node) {
  if (!node) return;
  NodeMarker.clearMark(node);

  // 清除子节点标记
  const markedChildren = node.querySelectorAll(`.${NodeMarker.MARK_CLASS}`);
  markedChildren.forEach(child => NodeMarker.clearMark(child));
}
```

---

### 8. 生命周期管理

```javascript
class MutationTranslationManager {
  constructor(config) {
    this.config = config;
    this.observers = new Map();
    this.isActive = false;
  }

  // 启动监听
  start() {
    if (this.isActive) return;

    // 启动主监听器
    this.startPrimaryObserver();

    // 启动容器监听器
    this.startContainerObservers();

    // 启动特殊监听器
    this.startSpecializedObservers();

    this.isActive = true;
    console.log('MutationObserver translation system started');
  }

  // 停止监听
  stop() {
    if (!this.isActive) return;

    // 断开所有监听器
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();

    // 清除所有定时器
    this.clearAllTimers();

    this.isActive = false;
    console.log('MutationObserver translation system stopped');
  }

  // 重启监听
  restart() {
    this.stop();
    setTimeout(() => this.start(), 100);
  }

  // 清除所有定时器
  clearAllTimers() {
    // nodeTimers 是 WeakMap，无法直接清除
    // 需要在各个节点上清除
    document.querySelectorAll('*').forEach(node => {
      const timer = nodeTimers.get(node);
      if (timer) {
        clearTimeout(timer);
        nodeTimers.delete(node);
      }
    });
  }

  startPrimaryObserver() {
    // 实现见上文
  }

  startContainerObservers() {
    // 实现见上文
  }

  startSpecializedObservers() {
    // 图片观察器
    document.querySelectorAll('img').forEach(img => {
      observeImage(img);
    });

    // 字幕观察器
    const subtitleSelectors = [
      '.subtitle',
      '[class*="caption"]',
      '[role="textbox"][aria-live]'
    ];

    subtitleSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        observeSubtitle(element);
      });
    });
  }
}

// 使用示例
const manager = new MutationTranslationManager(mutationConfig);
manager.start();
```

---

## 性能优化清单

### 1. 防抖优化
- ✅ 使用 `setTimeout` 延迟100ms执行翻译
- ✅ 清除之前的定时器，避免重复执行
- ✅ 可配置的 `buildTimeout` 和 `consumeTimeout`

### 2. 过滤优化
- ✅ 5层过滤系统，逐层筛选
- ✅ 使用 `attributeFilter` 只监听必要的属性
- ✅ `subtree: false` 用于不需要深度监听的场景

### 3. 增量处理
- ✅ 只处理 `addedNodes`，不重新翻译整页
- ✅ 使用节点标记避免重复翻译
- ✅ 内容变化检测，跳过DOM重构

### 4. 重复限制
- ✅ `repeatTranslateNum` 限制同一节点翻译次数
- ✅ `recordLength` 检测真实内容变化
- ✅ 自我更新检测，防止死循环

### 5. 内存管理
- ✅ 使用 `WeakMap` 存储节点状态（自动垃圾回收）
- ✅ 及时清除定时器
- ✅ 断开不需要的观察器

---

## 测试用例

```javascript
// 测试1: 无限滚动
async function testInfiniteScroll() {
  const feed = document.querySelector('[role="feed"]');
  const newPost = document.createElement('div');
  newPost.textContent = 'New post content';
  feed.appendChild(newPost);

  await sleep(150); // 等待防抖
  assert(newPost.classList.contains('immersive-translated'));
}

// 测试2: 防止死循环
async function testNoInfiniteLoop() {
  const container = document.createElement('div');
  container.textContent = 'Test';
  document.body.appendChild(container);

  const initialCount = nodeTranslateCount.get(container) || 0;

  // 手动触发10次mutation
  for (let i = 0; i < 10; i++) {
    container.appendChild(document.createElement('span'));
    await sleep(150);
  }

  const finalCount = nodeTranslateCount.get(container) || 0;
  assert(finalCount <= mutationConfig.repeatTranslateNum);
}

// 测试3: 过滤器
function testFilters() {
  const excluded = document.createElement('div');
  excluded.className = 'no-translate';
  excluded.textContent = 'Should not translate';
  document.body.appendChild(excluded);

  assert(!excluded.classList.contains('immersive-translated'));
}

// 测试4: URL变化
async function testUrlChange() {
  history.pushState({}, '', '/new-page');
  await sleep(100);

  assert(hasUrlChanged());
  assert(reinitializeCalled);
}
```

---

## 调试工具

```javascript
// 添加调试模式
const DEBUG = true;

function debugLog(category, message, data) {
  if (!DEBUG) return;

  const styles = {
    mutation: 'color: #4CAF50',
    filter: 'color: #FF9800',
    translate: 'color: #2196F3',
    performance: 'color: #9C27B0'
  };

  console.log(
    `%c[${category.toUpperCase()}] ${message}`,
    styles[category] || '',
    data || ''
  );
}

// 性能监控
const performanceMonitor = {
  mutations: 0,
  filtered: 0,
  translated: 0,
  avgProcessTime: 0,

  recordMutation() {
    this.mutations++;
  },

  recordFiltered() {
    this.filtered++;
  },

  recordTranslation(time) {
    this.translated++;
    this.avgProcessTime =
      (this.avgProcessTime * (this.translated - 1) + time) / this.translated;
  },

  report() {
    console.table({
      'Total Mutations': this.mutations,
      'Filtered Out': this.filtered,
      'Translated': this.translated,
      'Filter Rate': `${(this.filtered / this.mutations * 100).toFixed(2)}%`,
      'Avg Process Time': `${this.avgProcessTime.toFixed(2)}ms`
    });
  }
};

// 每30秒输出报告
setInterval(() => performanceMonitor.report(), 30000);
```

---

## 完整实现示例

```javascript
(function() {
  'use strict';

  // ===== 配置 =====
  const mutationConfig = { /* 见上文 */ };

  // ===== 全局状态 =====
  const nodeTimers = new WeakMap();
  const nodeTranslateCount = new WeakMap();
  let translationId = Date.now();

  // ===== 工具函数 =====
  // (见上文)

  // ===== 主逻辑 =====
  const primaryObserver = new MutationObserver(async (mutations) => {
    // (见上文完整实现)
  });

  // ===== 启动 =====
  function init() {
    if (!mutationConfig.enabled) return;

    if (document.body) {
      primaryObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    if (document.documentElement) {
      primaryObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    console.log('MutationObserver initialized');
  }

  // DOM加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

---

## 关键注意事项

1. **必须使用 WeakMap**：存储节点状态时使用 WeakMap，避免内存泄漏
2. **及时清除定时器**：防抖时必须清除旧定时器
3. **attributeFilter 优化**：监听属性时明确指定 attributeFilter
4. **自我更新检测**：防止翻译结果再次触发翻译的死循环
5. **增量翻译**：只翻译新增节点，不重新翻译整页
6. **URL变化处理**：拦截 pushState/replaceState 和 popstate
7. **性能监控**：在开发环境记录过滤率和处理时间
8. **优雅降级**：在不支持的浏览器上禁用MutationObserver

---

## 实现后验证

完成实现后，请验证以下功能：

- [ ] 无限滚动内容能自动翻译
- [ ] SPA路由切换时正确处理
- [ ] 不会出现翻译死循环
- [ ] 同一节点不会被重复翻译超过限制次数
- [ ] 过滤器正确排除不需要翻译的内容
- [ ] 防抖机制正常工作（100ms内多次变化只触发一次翻译）
- [ ] 图片懒加载时能正确翻译
- [ ] 字幕变化时实时翻译
- [ ] 主题切换时翻译样式正确更新
- [ ] 性能良好（CPU使用率<5%，内存稳定）

---

此提示词已包含完整的架构设计、代码示例和实现细节，可直接用于指导 Claude Code 实现一模一样的 MutationObserver 动态翻译系统。
