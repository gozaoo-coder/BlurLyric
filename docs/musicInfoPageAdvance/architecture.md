# MusicInfoPage 高级重构 - 架构设计文档

## 1. 整体架构

### 1.1 组件层级关系

```
musicInfoPage.vue (入口壳)
└── MusicInfoPageLayout (布局编排器)
    ├── useViewAdapter (视图适配Hook)
    │   ├── 设备类型检测
    │   ├── 视图模式状态管理
    │   └── 断点监听
    ├── BackgroundComponent (背景层)
    ├── [动态渲染区域 - 根据设备类型和模式]
    │   ├── === Desktop 双栏模式 ===
    │   │   ├── LeftPanel: AlbumInfoVertical
    │   │   └── RightPanel: LyricPanel | MusicListDrawer
    │   ├── === Desktop 单栏模式 ===
    │   │   └── FullPanel: AlbumInfoVertical | LyricPanel
    │   ├── === Mobile 模式 ===
    │   │   ├── TopArea: AlbumInfoVertical | LyricPanel(+AlbumInfoHorizontal header)
    │   │   └── BottomBar: ModeControlPanel (常驻)
    │   ├── === Compact 模式 ===
    │   │   ├── Row1: AlbumInfoHorizontal
    │   │   ├── Row2: ProgressBar
    │   │   └── Row3: PlaybackControls
    │   └── === Strip 模式 ── AlbumInfoHorizontal only
    ├── MiniControlBar (底部控制栏，非mobile时显示)
    └── 动画过渡层 (anime.js managed)
```

### 1.2 数据流

```
                    ┌─────────────┐
                    │  MusicPlayer │ (inject: player)
                    │  (全局单例)   │
                    └──────┬──────┘
                           │ provide/inject
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     MusicInfoPageLayout  各子组件    各子组件
     (状态编排中心)       (props)      (events up)
```

**通信方式**：
- **向下**: props（track数据、播放状态、配置）
- **向上**: $emit（用户操作：播放/暂停/切歌/模式切换）
- **横向**: provide/inject（共享player引用、config、scrollState）

## 2. 核心编排器 - MusicInfoPageLayout

### 2.1 职责
- 设备类型检测与视图模式管理
- 根据当前 `(deviceType, viewMode)` 选择渲染哪个布局模板
- 管理动画生命周期（统一trackAnimation/trackTimeout）
- 管理 drag 事件注册/注销
- 协调 cover_position_bind 动画

### 2.2 核心状态

```javascript
data() {
    return {
        deviceType: 'desktop',     // 'desktop' | 'mobile' | 'compact' | 'strip' | 'unsupported'
        viewMode: 'album-only',    // 'album-only' | 'lyric-only' | 'album+lyric' | 'album+list'
        pagePosition: 'bottom',    // 'top' | 'bottom' | 'toTop' | 'toBottom' (保留现有位置切换)
        
        activeAnimations: [],      // anime.js 实例追踪
        activeTimeouts: [],        // setTimeout 追踪
        eventListenerRemovers: [], // 事件清理函数队列
        
        drawerOpen: false,         // 音乐列表抽屉开关(mobile用)
        drawerDragInfo: null,      // 抽屉拖拽状态
    }
}
```

### 2.3 inject/provide

```javascript
inject: ['player', 'regResizeHandle', 'config', 'scrollState'],
provide() {
    return {
        deviceType: computed(() => this.deviceType),
        viewMode: computed(() => this.viewMode),
        pagePosition: computed(() => this.pagePosition),
        animationManager: {
            trackAnimation: this.trackAnimation.bind(this),
            trackTimeout: this.trackTimeout.bind(this),
            cancelAll: this.cancelAllAnimationsAndTimeouts.bind(this)
        }
    }
}
```

## 3. 子组件详细规格

### 3.1 AlbumInfoVertical（竖版专辑信息）

**来源**: 从原 `musicInfoPage.vue` 的 `mainContainer > musicDetail` 区域提取

**Props**:
| Prop | 类型 | 说明 |
|------|------|------|
| `track` | Object | 当前播放曲目 {id, name, ar[], al:{id,name,picUrl}} |
| `isPlaying` | Boolean | 是否正在播放 |
| `progress` | Number | 0-1 播放进度 |
| `currentTime` | Number | 当前时间(秒) |
| `duration` | Number | 总时长(秒) |
| `maxColumnWidth` | String | CSS max-width 值 |
| `coverDomRef` | Function | 回调：暴露coverImagePlaceHolder DOM ref |

**Events**:
| Event | Payload | 说明 |
|-------|---------|------|
| `play` | - | 点击播放/暂停 |
| `prev` | - | 上一首 |
| `next` | - | 下一首 |
| `cycle-mode` | - | 切换播放模式 |
| `cover-drag-start` | - | 封面拖拽开始（用于位置切换） |

**内部结构**:
```
┌─────────────────────┐
│   [封面图(方形)]     │  ← coverImagePlaceHolder (ref暴露)
│                      │
│   歌曲名             │  ← textSpawn
│   艺人名 - 专辑名    │
│                      │
│   ══════════════    │  ← ProgressBar 组件
│   01:23    04:56    │
│                      │
│ [◀] [▶/⏸] [▶▶] [🔀] [🔊] │  ← PlaybackControls
│                      │
│ [📋] [💿] [📝]      │  ← ModeControlPanel
└─────────────────────┘
```

**关键实现点**:
- `adjustedMaxColumnWidth()` 方法移入此组件内部
- 封面图使用 `lazyLoadCoverImage` + blur效果（复用现有）
- 进度条使用提取后的 `ProgressBar` 组件
- 播放控件使用提取后的 `PlaybackControls` 组件

### 3.2 AlbumInfoHorizontal（横版专辑信息）

**新增组件**

**尺寸**: 固定高度 48px, 宽度 100%

**Props**: 与 Vertical 版相同的 track 相关 props（不含进度条和控件）

**内部结构** (flex row):
```
|[封面48x48]| [歌曲名....................] [⋮]|
|  (方形)    | [艺人名 - 专辑名 ..........]      |
```

**样式要点**:
```css
.container {
    display: flex;
    align-items: center;
    height: 48px;
    width: 100%;
    gap: 12px;
    padding: 0 16px;
    background: rgba(255,255,255,0.06); /* 淡白透明 */
}
.cover {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
}
.info {
    flex: 1;
    min-width: 0; /* 关键：允许flex子项收缩 */
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.info .name {
    font-weight: 900;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.info .meta {
    font-size: 12px;
    color: rgba(0,0,0,0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.actions {
    flex-shrink: 0;
}
```

**特殊行为**:
- 在 mobile 的 lyric-only 模式下，此组件作为**可拖拽手柄**
  - 监听 touch/mouse down → move → up
  - 仅响应向下滑动（offsetY > 阈值）触发关闭歌词视图
  - 向上滑动忽略
  - 必须在组件销毁时注销所有事件监听

### 3.3 PlaybackControls（播放控件）

**从原组件提取并通用化**

**Props**:
| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isPlaying` | Boolean | false | 播放状态 |
| `playMode` | String | 'loopPlaylist' | 当前播放模式 |
| `variant` | String | 'full' | 'full'(竖版完整) / 'mini'(底部迷你) / 'compact'(紧凑) |

**Events**: `play`, `prev`, `next`, `cycle-mode`, `volume-change`

**变体说明**:

**full 变体** (竖版专辑内使用):
```
[模式] [上一首] [▶大] [下一首] [音量]
```
- 圆形按钮 (button_circle)
- 播放按钮放大 1.5x

**mini 变体** (底部控制栏使用):
```
[上一首] [▶] [下一首] [模式] [音量] [⋮]
```
- 较小的圆形按钮 (buttom_icon_circleBackground)
- 在 ≤560px 时隐藏非播放按钮

**compact 变体** (小方块模式使用):
```
[|◀] [▶] [▶|] [🔀]
```
- 极简排列

### 3.4 ProgressBar（进度条）

**从原组件提取**

**Props**:
| Prop | 类型 | 说明 |
|------|------|------|
| `progress` | Number | 0-1 当前进度 |
| `currentTime` | Number | 当前秒数 |
| `duration` | Number | 总秒数 |
| `variant` | String | 'full'(带时间文字) / 'thin'(细线,3px高) / 'bar'(控制栏内) |

**Events**: `seek` (payload: { progress: Number })

**实现**:
- 复用 `baseMethods.progressBarReg()` 的逻辑
- 支持鼠标点击跳转、拖拽
- 支持touch事件

### 3.5 ModeControlPanel（模式控制板）

**从原组件的 suspendingBox 按钮组提取**

**Props**:
| Prop | 类型 | 说明 |
|------|------|------|
| `currentMode` | String | 当前激活的模式 |
| `availableModes` | Array | 可用的模式列表 |
| `variant` | String | 'full'(图标+文字悬浮提示) / 'compact'(仅图标) |

**Events**: `mode-change` (payload: { mode: String })

**可用模式按钮**:
1. 📋 音乐列表 (`album+list` 或 mobile drawer)
2. 💿 仅专辑信息 (`album-only`)
3. 📝 展示歌词 (`lyric-only` 或 `album+lyric`)

### 3.6 MusicListDrawer（音乐列表抽屉）

**新增核心组件**

**两种形态**:

#### Desktop 右侧面板形态
- 作为右侧面板直接嵌入双栏布局
- 宽度自适应剩余空间
- 使用虚拟滚动列表

#### Mobile 底部抽屉形态
- 从底部滑入的抽屉视图
- 带可拖动的 bar/handle
- 向上拉展开，向下拉关闭（超过阈值后松手触发）
- 有关闭按钮
- 背景遮罩层（点击关闭）

**Props**:
| Prop | 类型 | 说明 |
|------|------|------|
| `tracks` | Array | 播放列表所有曲目 |
| `currentIndex` | Number | 当前播放索引 |
| `variant` | String | 'panel'(桌面右侧) / 'drawer'(移动端底部抽屉) |
| `open` | Boolean | 抽屉开关状态（仅drawer模式需要） |

**Events**:
| Event | Payload | 说明 |
|-------|---------|------|
| `select-track` | `{ index: Number }` | 选中某首歌（双击或点击） |
| `close` | - | 关闭抽屉 |

**内部结构**:
```
┌──────────────────────────────┐
│ [=== 拖动条 / 关闭按钮 ===]  │  ← drawer handle (仅drawer模式)
├──────────────────────────────┤
│ #  │ 封面  │ 歌曲名          │
│ 3  │ [img] │ Artist - Album  │  ← 虚拟列表项
│ 4  │ [img] │ Current Track ◄ │  ← 当前项高亮
│ 5  │ [img] │ Next Track      │
│ ...│       │                 │
└──────────────────────────────┘
```

**虚拟列表规格**:
- 复用 `useVirtualList` from `tracks/utils/virtualList.js`
- itemHeight: ~64px（含封面缩略图32x32 + 信息）
- 初始滚动定位: 以 currentIndex 为中心
  - 初始可见序列: `[currentIndex-1, currentIndex, currentIndex+1, currentIndex+2, ...]`
- 支持鼠标滚轮滚动
- 支持touch滑动（惯性滚动）
- 双击切歌 → 调用 `player.switchTo(index)` 或 `player.loadAndPlay(index)`
- 每项显示: 序号、封面缩略图、歌曲名、艺人-专辑、时长

**列表项数据结构**:
```javascript
{
    index: Number,        // 列表序号
    track: Object,        // 完整track对象
    isCurrent: Boolean,   // 是否为当前播放
    coverId: Number,      // 封面ID（用于lazyLoadCoverImage）
    name: String,         // 歌曲名
    artistName: String,   // 艺人名（拼接后）
    albumName: String,    // 专辑名
    duration: String,     // "03:45"格式
    durationRaw: Number   // 秒数
}
```

**Drawer 动画规格** (anime.js):
```javascript
// 打开
anime({
    targets: drawerRef,
    translateY: ['100%', '0%'],
    easing: 'spring(1, 80, 14, 0)',
    duration: 400
})

// 关闭（下拉关闭）
anime({
    targets: drawerRef,
    translateY: [currentY, '100%'],  // 从当前位置滑出
    easing: 'easeOutExpo',
    duration: 300
})
```

**拖拽行为** (复用 drag.js):
- handle 区域绑定 drag
- onMove: 实时更新 translateY
- onEnd: 
  - 如果 offsetY > 120px (或速度 > 1.5): 触发 close
  - 否则: spring 回弹到原位

### 3.7 LyricPanel（歌词面板）

**从现有 lyric.vue 重构**

**变更点**:
- 新增 props 接口规范
- 背景改为淡白色透明 `rgba(255,255,255,0.05)`
- 宽度自适应父容器
- 与新架构的事件系统对接

**Props**:
| Prop | 类型 | 说明 |
|------|------|------|
| `audioDom` | HTMLAudioElement | 音频DOM（用于获取currentTime） |
| `lyricData` | Object | 解析后的歌词对象 |
| `visible` | Boolean | 是否可见（用于性能优化） |

**保留**:
- 逐字歌词功能
- anime.js 行动画
- 滚动定位算法

### 3.8 MiniControlBar（底部迷你控制栏）

**从原 `musicControlBar` 区域提取**

**Props**: 与 AlbumInfoHorizontal 类似的 track props + PlaybackControls 的控制props

**特殊功能**:
- 左右滑动切歌（复用现有drag逻辑）
- 上滑展开全屏（toTop）
- 显示当前/前后曲目信息

## 4. useViewAdapter（视图适配器）

**新增 composable/js模块**

### 4.1 职责
- 监听 window resize
- 计算当前设备类型
- 提供断点常量
- 根据设备类型返回可用模式列表

### 4.2 断点定义

```javascript
const BREAKPOINTS = {
    desktop: { minWidth: 768, minHeight: 500 },
    tablet:  { minWidth: 480, maxWidth: 768 },
    mobile:  { maxWidth: 480 },
    
    compact: { 
        maxWidth: 480,
        aspectRatioMin: 0.8,   // 接近方形
        aspectRatioMax: 1.3
    },
    strip: {
        maxHeight: 150,
        minHeight: 100,
        maxWidth: 480
    }
}
```

### 4.2 检测逻辑

```javascript
function detectDeviceType(width, height) {
    const ratio = width / height
    
    // Strip: 极矮
    if (height >= 100 && height <= 150 && width < 480) return 'strip'
    
    // Compact: 近方形且窄
    if (width < 480 && ratio >= 0.8 && ratio <= 1.3) return 'compact'
    
    // Mobile: 窄屏
    if (width < 480) return 'mobile'
    
    // Desktop/Tablet: 足够宽
    if (width >= 768 && height >= 500) return 'desktop'
    
    // 兜底
    if (width >= 480) return 'desktop'
    
    return 'unsupported'
}
```

### 4.3 API

```javascript
// 返回值
{
    deviceType: String,          // 当前设备类型
    viewMode: String,            // 当前视图模式
    availableModes: Array,       // 该设备支持的模式列表
    setViewMode: Function,       // 切换模式
    isMobile: Boolean,           // 便捷判断
    isDesktop: Boolean,
    containerStyle: Object,      // 推荐的容器CSS变量
}
```
