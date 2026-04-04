# MusicInfoPage 高级重构 - 动画系统设计

## 1. 动画管理架构

### 1.1 核心原则
- 所有 anime.js 实例必须被追踪，以便在组件销毁/切换时统一取消
- 动画参数（easing、duration）通过常量集中管理
- spring 物理动画作为主要过渡方式（与现有风格一致）
- GPU 加速属性优先：transform, opacity

### 1.2 AnimationManager 设计

```javascript
// 位于 MusicInfoPageLayout 中
const AnimationManager = {
    _active: [],        // anime.js 实例数组
    _timeouts: [],      // setTimeout ID 数组
    
    track(animInstance) {
        if (animInstance) {
            this._active.push(animInstance)
        }
        return animInstance
    },
    
    trackTimeout(callback, delay) {
        const id = setTimeout(() => {
            const idx = this._timeouts.indexOf(id)
            if (idx > -1) this._timeouts.splice(idx, 1)
            callback()
        }, delay)
        this._timeouts.push(id)
        return id
    },
    
    cancelAll() {
        this._active.forEach(anim => {
            try { anim.pause() } catch {}
        })
        this._active = []
        
        this._timeouts.forEach(id => clearTimeout(id))
        this._timeouts = []
    }
}
```

### 1.3 动画常量定义

```javascript
const ANIM_CONST = {
    // Spring 参数 [mass, stiffness, damping, velocity]
    SPRING_GENTLE:   [1, 80, 14, 0],    // 通用spring
    SPRING_SNAPPY:   [1, 80, 15, 0],    // 快速响应
    SPRING_BOUNCE:   [1, 80, 12, 0],    // 带弹跳
    
    // 时长
    DURATION_FAST:   150,
    DURATION_NORMAL: 300,
    DURATION_SLOW:   500,
    
    // Easing
    EASE_OUT: 'easeOutQuad',
    EASE_IN_OUT: 'easeInOutCubic',
    LINEAR: 'linear',
    
    // 封面动画
    COVER_SPRING: (speed) => `spring(1, 80, 15, ${speed})`,
    POSITION_SPRING: (speed) => `spring(1, 80, 16, ${speed})`,
}
```

## 2. 各场景动画规格

### 2.1 页面位置切换 (toTop / toBottom)

**保留现有实现**，以下为完整规格:

#### toBottom (展开到底部控制栏)
```
触发: 在顶部状态下，封面下滑或速度向下 > 1.5

动画序列:
┌─────────────────────────────────────────────┐
│ 1. musicInfoPageRow                          │
│    translateY: current → -88px               │
│    easing: spring(1, 80, 16, speed)          │
│    背景变为: rgba(0,0,0,0.0625) + blur(30px) │
├─────────────────────────────────────────────┤
│ 2. musicControlBar (底部栏)                   │
│    opacity: 0 → 1                            │
│    easing: linear, duration: 300             │
│    delay: 300                                │
├─────────────────────────────────────────────┤
│ 3. mainContainer (主内容区)                    │
│    opacity: 1 → 0                            │
│    easing: linear, duration: 100             │
├─────────────────────────────────────────────┤
│ 4. cover (浮动封面)                           │
│    width: → 54px                             │
│    height: → 54px                            │
│    translateY: → 17px                       │
│    translateX: → 17px                       │
│    easing: spring(1, 80, 15, speed)         │
└─────────────────────────────────────────────┘
```

#### toTop (展开到全屏)
```
触发: 在底部状态下，控制栏上滑速度 > 1.5 或 offset < -100

动画序列:
┌─────────────────────────────────────────────┐
│ 1. musicInfoPageRow                          │
│    translateY: → -(windowHeight)px           │
│    easing: spring(1, 80, 16, speed)          │
│    complete: 设置 position = 'top'           │
├─────────────────────────────────────────────┤
│ 2. musicControlBar                           │
│    opacity: 1 → 0                            │
│    easing: linear, duration: 100             │
├─────────────────────────────────────────────┤
│ 3. musicDetailRender (文字滚动)              │
│    transformX: → 1                           │
│    easing: linear, duration: 100             │
├─────────────────────────────────────────────┤
│ 4. 延时 300ms 后                              │
│    背景: rgb(233,233,233), blur(0px)         │
├─────────────────────────────────────────────┤
│ 5. 延时 100ms 后                              │
│    mainContainer opacity: 0 → 1              │
├─────────────────────────────────────────────┤
│ 6. cover_position_bind(speed)                │
│    封面定位到 coverImagePlaceHolder 位置     │
│    spring 动画跟随                            │
└─────────────────────────────────────────────┘
```

### 2.2 Cover Position Bind（封面位置绑定）

**核心动画**: 连接 MiniControlBar 的迷你封面 和 AlbumInfoVertical 的封面占位符

```
状态机:
  bottom ──[toTop]──→ cover 跟随 placeholder (绝对定位)
       ←──[toBottom]─  cover 回到 mini 尺寸 (54x54 @ 17,17)

resize ──→ 重新计算 placeholder 位置 → cover spring 到新位置
```

```javascript
// 改进后的实现（同时支持新旧组件）
bindCoverPosition(speed = 0) {
    const placeholder = this.$refs.coverImagePlaceHolder
    if (!placeholder) return
    
    const rect = placeholder.getBoundingClientRect()
    
    this.trackAnimation(anime({
        targets: this.$refs.cover,
        easing: `spring(1, 80, 15, ${speed})`,
        width: rect.width,
        height: rect.height,
        translateY: (rect.top + 41) + 'px',  // 41px = controlBar padding-top
        translateX: rect.left + 'px'
    }))
}
```

**41px 的来源**: `musicControlBar` 的 `padding: 17px` + 内部结构偏移

### 2.3 模式切换动画

#### Desktop 单面板模式切换
```
album-only ──→ lyric-only

时间线:
  0ms:    当前面板 opacity: 1→0, scale: 1→0.95 (200ms easeOut)
  200ms:  切换VNode渲染
  220ms:  新面板 opacity: 0→1, scale: 0.95→1 (400ms spring)
```

#### Desktop 双栏展开
```
album-only ──→ album+lyric

时间线:
  0ms:    左栏宽度从 100% 过渡到目标宽度 (500ms spring)
  100ms:  右栏从 translateX(100%)滑入 (400ms spring)
          右栏 opacity: 0→1
```

### 2.4 音乐列表抽屉动画

#### Mobile Drawer 打开
```
0ms:    遮罩层 opacity: 0→1 (200ms easeOut)
0ms:    抽屉 translateY: 100%→0% (400ms spring(1,80,14,0))
```

#### Mobile Drawer 关闭（下拉关闭）
```
0ms:    抽屉从当前拖拽位置 translateY → 100% (300ms easeOutExpo)
0ms:    遮罩层 opacity: 1→0 (200ms easeOut, delay 100)
```

#### Mobile Drawer 回弹（未达阈值）
```
0ms:    抽屉从当前 drag 位置 spring 回到 translateY(0)
        easing: spring(1, 90, 14, 0)
```

### 2.5 控制栏拖拽反馈动画

**左右滑动切歌预览** (现有逻辑保留):
```
用户左/右滑动 controlBar:
  → detail 文字区域 translateX 跟随手指
  → 松手后:
      |offset| > 100 或 |speed| > 1 → 触发切歌
      否则 → spring(1, 80, 14, 0) 回弹到 translateX(0)
```

## 3. 性能保障措施

### 3.1 will-change 管理
```css
/* 仅在动画期间启用 */
.animating {
    will-change: transform, opacity;
}

/* 动画结束后移除 */
/* 通过 anime.js complete callback 移除 class */
```

### 3.2 层级管理 (z-index)
```
z-index 层级规划:
  0:   Background (模糊背景图)
  1:   主内容区 (mainContainer / panels)
  2:   浮动封面 (cover - 绝对定位)
  5:   底部控制栏 (musicControlBar)
  10:  进度条 (bar_ProgressBoxContainer)
  50:  遮罩层 (drawer overlay)
  51:  抽屉 (MusicListDrawer)
  100: MusicInfoPageRow 根容器
```

### 3.3 动画帧节流
- resize 事件触发 `cover_position_bind` 使用 debounce (16ms)
- 歌词滚动使用 requestAnimationFrame (已有实现)
- 拖拽事件使用 passive: true (drag.js 已处理)

## 4. 与子组件的动画接口

### 4.1 子组件可调用的动画方法

通过 provide 注入 `animationManager`:

```javascript
// 子组件中使用
inject: ['animationManager'],

methods: {
    myAnimate() {
        this.animationManager.track(anime({
            targets: this.$el,
            // ...
        }))
    }
}
```

### 4.2 全局动画取消时机

以下操作触发 `cancelAll()`:
1. 视图位置切换开始 (toTop / toTop 开始前)
2. 设备类型变更 (如窗口resize导致 desktop↔mobile)
3. 模式切换开始 (新动画序列启动前)
4. 组件 beforeUnmount

## 5. 特殊场景处理

### 5.1 快速连续操作

用户快速连续点击模式切换按钮时:
- 每次 cancelAll() 取消上一个未完成动画
- 新动画立即开始
- 使用 timestamp 标识防止过期回调执行 (沿用现有 `changePositionTimeStamps` 模式)

### 5.2 窗口 resize 中动画

resize 期间:
- 不触发模式切换动画
- 仅更新布局尺寸 (CSS自动处理grid/flex)
- `cover_position_bind` 使用 debounce
- 新设备类型检测使用 debounce (250ms)

### 5.3 低性能模式降级

可通过 config 注入降级策略:
```javascript
// 如果检测到低帧率 (<30fps)
if (isLowPerformance) {
    // 禁用 spring 动画，改用简单 transition
    ANIM_CONST.SPRING_GENTLE = 'easeOut(1, 0, 0)'
    // 减少歌词渲染范围
    // 降低背景模糊半径
}
```
