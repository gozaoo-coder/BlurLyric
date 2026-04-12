# 修复计划：元素存在但视觉上不可见（颜色对比度问题）

## 问题根因（已从截图+DevTools 确认）

### 现象
- ✅ DOM 完整渲染：DevTools 显示 `mainContainer > AlbumInfoVertical > coverImagePlaceHolder, musicInfo, progressBox...` 全部存在
- ✅ `opacity: 1` 已正确设置
- ✅ `viewportType = 'desktop'` 正确
- ❌ 但视觉上几乎看不到内容——只有封面图可见，文字和控件"消失"

### 真正原因：**白色文字 + 无背景 = 零对比度**

**因果链**：

```
Fix 1B 移除了 CSS { opacity: 0 }
    ↓
mainContainerStyle 无条件返回 opacity: 1
    ↓
mainContainer 在页面加载时立即可见
    ↓
但此时 musicInfoPagePosition === 'bottom'（初始状态）
    ↓
background.vue 的 v-if="(musicInfoPagePosition != 'bottom')" 为 false
    ↓
模糊背景不渲染 → 背景是透明/浅灰色
    ↓
.mainContainer { color: rgb(255,255,255) } 白色文字
    ↓
白色文字 + 浅色背景 = 几乎不可见 ❌
```

**原始设计的正确流程**：
1. 初始状态 `position='bottom'` → CSS `opacity: 0` 隐藏 mainContainer ✅
2. 用户上滑 → `toTop()` 触发 → position 变为 `'toTop'`/`'top'`
3. anime.js 动画将 mainContainer opacity 从 0 → 1
4. 同时 background.vue 的 v-if 条件满足 → 模糊背景渲染
5. 白色文字在深色模糊背景上清晰可见 ✅

## 修复方案

### 唯一改动：恢复 `mainContainerStyle` 中基于位置的 opacity 控制

**文件**: [musicInfoPage.vue](src/components/musicInfoPage.vue) 第 103-109 行

将：
```javascript
mainContainerStyle() {
    return {
        'fontSize': this.UIScale(),
        'pointer-events': (this.musicInfoPagePosition == 'top') ? 'auto' : 'none',
        opacity: this.viewportType === 'unsupported' ? 0.5 : 1
    }
},
```

改为：
```javascript
mainContainerStyle() {
    const isBottom = this.musicInfoPagePosition === 'bottom'
    return {
        'fontSize': this.UIScale(),
        'pointer-events': (!isBottom) ? 'auto' : 'none',
        'opacity': isBottom ? 0 : (this.viewportType === 'unsupported' ? 0.5 : 1)
    }
},
```

**效果**：
- `position === 'bottom'` 时：`opacity: 0; pointer-events: none` — 完全隐藏（与原始行为一致）
- `position === 'top'/'toTop'/'toBottom'` 时：`opacity: 1; pointer-events: auto` — 可见且可交互
- 此时 background.vue 已渲染（因为 `position !== 'bottom'`），提供正确的模糊背景

## 验证标准

刷新后：
1. **初始状态**：只显示底部栏（封面+进度条+控件），主内容区隐藏 ← 与重构前一致
2. **在底部栏区域上滑**：触发 toTop() 动画，主内容区淡入显示，有模糊背景
3. **主内容区完整显示**：封面、音乐名、艺人名、进度条、播放按钮、模式切换按钮全部清晰可见
