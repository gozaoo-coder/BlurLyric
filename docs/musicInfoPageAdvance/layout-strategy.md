# MusicInfoPage 高级重构 - 布局策略详解

## 1. Desktop/Tablet 布局 (width >= 768px, height >= 500px)

### 1.1 容器结构

```
┌──────────────────────────────────────────────────────┐
│                 MusicInfoPageRow                      │
│  position: absolute; height: 100%; width: 100%        │
│  transform: translateY(-88px) [bottom状态]            │
└──────────────────────────────────────────────────────┘
```

### 1.2 单面板模式

#### album-only 模式（与现有效果一致）
```
┌─────────────────────────────────────┐
│         Background (模糊背景)         │
│  ┌─────────────────────────────┐    │
│  │     [==== 拖动条 ====]      │    │  ← tapBar
│  ├─────────────────────────────┤    │
│  │                             │    │
│  │       [封面图]               │    │  ← AlbumInfoVertical
│  │                             │    │     居中显示
│  │       歌曲名                 │    │
│  │    艺人名 - 专辑名           │    │
│  │                             │    │
│  │   ══════════════════        │    │  ← ProgressBar
│  │    01:23        04:56       │    │
│  │                             │    │
│  │  [🔀][◀][▶][▶▶][🔊]        │    │  ← PlaybackControls(full)
│  │                             │    │
│  │  [📋][💿✅][📝]             │    │  ← ModeControlPanel
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**CSS实现**:
```css
.desktop-layout {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}
.desktop-layout .album-only {
    width: var(--maxColumnWidth); /* min(50vh, 40vw) */
    max-width: 76vw;
}
```

#### lyric-only 模式
```
┌──────────────────────────────────────────┐
│  [封面48px| 歌曲名..................|⋮]  │  ← AlbumInfoHorizontal
│  |        艺人名 - 专辑名.............|   │
├──────────────────────────────────────────┤
│                                          │
│          ┌──────────────────┐           │
│          │                  │           │
│          │   歌词内容区域    │           │  ← LyricPanel
│          │   (自适应高度)    │           │     淡白透明背景
│          │                  │           │
│          └──────────────────┘           │
│                                          │
│   ═════════════════════════════════     │  ← ProgressBar(full)
│        01:23                04:56       │
│                                          │
│     [🔀] [◀] [▶] [▶▶] [🔊]             │  ← PlaybackControls(full)
│                                          │
│        [📋] [💿] [📝✅]                  │  ← ModeControlPanel
└──────────────────────────────────────────┘
```

### 1.3 双面板组合模式

#### album+lyric 模式
```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │              │  │                    │   │
│  │   [封面图]    │  │                    │   │
│  │              │  │   歌词内容区域       │   │
│  │   歌曲名      │  │   (LyricPanel)      │   │
│  │  艺人-专辑   │  │                    │   │
│  │              │  │                    │   │
│  │  进度条      │  │                    │   │
│  │  播放控件    │  │                    │   │
│  │  模式按钮    │  │                    │   │
│  └──────────────┘  └────────────────────┘   │
│   左栏(固定宽度)      右栏(弹性填充)          │
└──────────────────────────────────────────────┘
```

**CSS Grid 实现**:
```css
.desktop-layout.album-lyric-split {
    display: grid;
    grid-template-columns: min(50vh, 40vw) 1fr;
    gap: 0;
    height: 100%;
    padding: 0 2em;
    box-sizing: border-box;
}
.left-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.right-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
```

#### album+list 模式
```
结构与 album+lyric 相同，但右栏替换为 MusicListDrawer(panel模式)
```

## 2. Mobile 布局 (width < 480px)

### 2.1 整体结构

```
┌─────────────────────┐
│                     │
│   [主视图区域]       │  ← 根据模式切换内容
│   (全屏高度)         │
│                     │
├─────────────────────┤
│  [MiniControlBar]   │  ← 底部控制栏常驻(88px)
│  [进度条 3px]        │
├─────────────────────┤
│ [📋] [💿✅] [📝]    │  ← ModeControlPanel 常驻底部
└─────────────────────┘
```

### 2.2 album-only 模式（mobile）
```
┌─────────────────────┐
│                     │
│      [封面图]        │  ← 与现有完全一致
│      歌曲名          │
│    艺人名 - 专辑名    │
│                     │
│    ═════════════    │
│   01:23    04:56    │
│                     │
│ [◀] [▶] [▶▶] [🔀]  │
│                     │
│ [📋] [💿✅] [📝]   │  ← 此按钮组在竖版内
└─────────────────────┘
├─────────────────────┤
│ [封面] 曲目信息...[控件]|  ← MiniControlBar
├─────────────────────┤
│ [📋] [💿] [📝]      │  ← 底部常驻ModeControlPanel
└─────────────────────┘
```

> **注意**: mobile下有两套ModeControlPanel：
> - 竖版专辑内部的一套（完整图标+悬浮提示）
> - 底部常驻的一套（紧凑版，仅图标）
> 两套保持同步状态

### 2.3 lyric-only 模式（mobile）

```
┌─────────────────────┐
│[封面|歌名.........|⋮]|  ← AlbumInfoHorizontal (可拖拽!)
│ |艺人-专辑..........| │     下滑 → 关闭歌词视图
├─────────────────────┤
│                     │
│                     │
│   ┌───────────────┐ │
│   │               │ │
│   │  歌词内容区域  │ │  ← LyricPanel (最大高度)
│   │  (自动填充)    │ │
│   │               │ │
│   └───────────────┘ │
│                     │
│   ════════════════  │  ← ProgressBar
│    01:23   04:56    │
│                     │
│   [◀] [▶] [▶▶]     │  ← PlaybackControls
│                     │
├─────────────────────┤
│ [封面] 曲目信息...   │  ← MiniControlBar (常驻)
├─────────────────────┤
│ [📋] [💿] [📝✅]   │  ← ModeControlPanel (常驻)
└─────────────────────┘
```

**AlbumInfoHorizontal 拖拽行为规格**:
```javascript
// 仅在 lyric-only + mobile 模式下启用
onAlbumHorizontalDrag() {
    // drag.js 绑定到 AlbumInfoHorizontal 根元素
    
    onMove(info) {
        // 实时更新位置（可选：微位移反馈）
    }
    
    onEnd(info) {
        if (info.offsetY > 80 || info.speedY > 1.2) {
            // 向下滑动足够距离/速度 → 切换回 album-only
            this.setViewMode('album-only')
            // 触发关闭动画
        }
        // 向上滑动 → 忽略（不响应）
    }
}

// 组件 beforeUnmount 时:
beforeDestroy() {
    this.dragHandler?.destroy()  // 注销拖拽事件
}
```

### 2.4 音乐列表抽屉（mobile）

点击"展示音乐列表"按钮后触发:

```
         正常状态                    抽屉打开
┌──────────────┐            ┌──────────────┐
│              │            │  ════════   │  ← 遮罩层(半透明黑)
│  主视图内容   │            ├──────────────┤
│              │            │ [=== 拖动条 ===]│  ← drawer handle
│              │            │ [✕]          │  ← 关闭按钮
│              │            ├──────────────┤
│              │            │ # │封面│歌曲名  │
│              │            │ 3 │[img]│...   │  ← 虚拟列表
│              │            │ 4 │[img]│●当前 │
│              │            │ 5 │[img]│...   │
└──────────────┘            └──────────────┘
```

**抽屉动画流程**:
1. 点击按钮 → 遮罩淡入 + 抽屉从 bottom translate Y(100%→0)
2. 用户拖拽 handle:
   - 跟随手指移动
   - 松手时判断: 
     - 下拉超过阈值(120px)或速度>1.5 → 关闭
     - 否则 → spring 回弹
3. 点击遮罩/关闭按钮 → 关闭动画
4. 双击列表项 → 切歌 + 关闭抽屉

## 3. Compact 布局（窄 + 近方形）

**条件**: width < 480 AND 0.8 <= aspectRatio <= 1.3

```
┌─────────────────────────┐
│                         │
│  [封面48|歌名......|⋮]  │  ← Row1: AlbumInfoHorizontal
│  |艺人-专辑..........|  │     居中，限制max-width
├─────────────────────────┤
│   ══════════════════    │  ← Row2: ProgressBar(full)
│    01:23      04:56     │
├─────────────────────────┤
│   [🔀][◀][▶][▶▶]       │  ← Row3: PlaybackControls(compact)
│                         │
│     居中于视图中心       │
│     整体紧凑排列         │
└─────────────────────────┘
```

**CSS**:
```css
.compact-layout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: 12px;
    padding: 16px;
}
.compact-layout > * {
    width: 100%;
    max-width: 300px; /* 限制过宽时的展示 */
}
```

## 4. Strip 布局（窄条形）

**条件**: 100px <= height <= 150px AND width < 480px

```
┌─────────────────────────────────────┐
│ [封面36px|歌曲名...............|⋮] │  ← AlbumInfoHorizontal
│ |艺人名-专辑名...................| │     高度自适应缩小
└─────────────────────────────────────┘
```

仅显示横版专辑信息，无控件、无进度条、无模式切换。

## 5. Unsupported 布局

```
┌─────────────────────────┐
│                         │
│                         │
│   "该布局未适应"          │  ← 居中提示文字
│                         │
│   推荐调整窗口大小        │
│                         │
└─────────────────────────┘
```

## 6. 视图切换动画策略

### 6.1 模式切换动画 (desktop)

使用 **fade + scale** 过渡:

```javascript
// 从 album-only 切换到 lyric-only
anime({
    targets: currentPanel,
    opacity: [1, 0],
    scale: [1, 0.95],
    easing: 'easeOutQuad',
    duration: 200,
    complete: () => {
        // 切换组件渲染
        anime({
            targets: newPanel,
            opacity: [0, 1],
            scale: [0.95, 1],
            easing: 'spring(1, 80, 14, 0)',
            duration: 400
        })
    }
})
```

### 6.2 双栏展开动画 (desktop)

从单栏切到双栏时:

```javascript
// 左栏（已有）→ 左移并轻微缩放
anime({
    targets: leftPanel,
    translateX: [0, 0],  // 保持位置
    width: ['100%', 'var(--left-panel-width)'],
    easing: 'spring(1, 80, 12, 0)',
    duration: 500
})

// 右栏（新）→ 从右侧滑入
anime({
    targets: rightPanel,
    translateX: ['100%', '0%'],
    opacity: [0, 1],
    easing: 'spring(1, 80, 12, 0)',
    duration: 500,
    delay: 100  // 稍滞后
})
```

### 6.3 保留的位置切换动画 (toTop/toBottom)

**完整保留现有逻辑**，包括:
- `cover_position_bind` 的 spring 动画
- `musicControlBar` 的显隐过渡
- `mainContainer` 的淡入淡出
- 背景滤镜变化

**关键改进点**: cover_position_bind 需要同时支持 Vertical 和 Horizontal 组件的封面定位：

```javascript
// 改进后的 cover_position_bind
let cover_position_bind = (speed) => {
    const placeholder = this.$refs.coverImagePlaceHolder?.getBoundingClientRect()
    if (!placeholder) return
    
    this.trackAnimation(anime({
        targets: this.$refs.cover,
        easing: `spring(1, 80, 15, ${speed})`,
        width: placeholder.width,
        height: placeholder.height,
        translateY: (placeholder.top + 41) + 'px',  // 41 = controlBar padding
        translateX: placeholder.left + 'px'
    }))
}
```

此方法在以下时机调用:
- `toTop()` 完成后（定位到竖版封面位置）
- window resize 时（通过 `regResizeHandle`）
