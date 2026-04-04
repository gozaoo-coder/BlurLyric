# MusicInfoPage 高级重构 - 组件接口规范与任务清单

## 1. 组件接口总览

### 1.1 Props 数据流来源

所有播放相关数据从 `MusicPlayer` 实例获取（通过 inject `player`）:

```javascript
// player 对象的可用数据
player.state.currentTrack     // { id, name, ar: [{name}], al: {id, name, picUrl} }
player.state.playing          // Boolean
player.state.currentTime      // Number (秒)
player.state.duration         // Number (秒)
player.state.currentTimeRound // Number (取整)
player.state.durationRound    // Number (取整)
player.state.currentIndex    // Number
player.playlist.getAll()      // Array<Track>
player.playlist.currentIndex  // Number
player.playMode               // String

// 可用方法
player.play() / player.pause()
player.next({isManual:true}) / player.prev({isManual:true})
player.switchTo(index)        // 切换到指定索引
player.loadAndPlay(index)     // 加载并播放
player.seekByProgress(ratio)  // 进度跳转
player.cyclePlayMode()        // 切换播放模式
```

### 1.2 共享 Inject 列表

| Key | 来源 | 类型 | 说明 |
|-----|------|------|------|
| `player` | App.vue | MusicPlayer | 播放器实例 |
| `config` | App.vue | Object | 全局配置 |
| `scrollState` | App.vue | Ref | 滚动状态 |
| `regResizeHandle` | App.vue | Function | 注册resize回调 |
| `deviceType` | Layout | Computed | 设备类型 |
| `viewMode` | Layout | Computed | 当前视图模式 |
| `pagePosition` | Layout | Computed | 页面位置 |
| `animationManager` | Layout | Object | 动画管理器 |

## 2. 各组件详细接口

### 2.1 AlbumInfoVertical.vue

```vue
<script>
export default {
    name: 'AlbumInfoVertical',
    
    props: {
        track: { type: Object, required: true },
        isPlaying: { type: Boolean, default: false },
        progress: { type: Number, default: 0 },
        currentTime: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        currentTimeRound: { type: Number, default: 0 },
        durationRound: { type: Number, default: 0 },
        playMode: { type: String, default: 'loopPlaylist' },
        maxColumnWidth: { type: String, default: 'min(50vh, 40vw)' },
        currentMode: { type: String, default: 'album-only' }
    },
    
    inject: ['animationManager', 'deviceType', 'baseMethods'],
    
    emits: [
        'play', 'prev', 'next', 'cycle-mode',
        'cover-drag-start',
        'mode-change',       // 委托 ModeControlPanel
        'seek'               // 委托 ProgressBar
    ],
    
    mounted() {
        this.$emit('bindRef', {
            path: 'coverImagePlaceHolder',
            element: this.$refs.coverImagePlaceHolder
        })
    }
}
</script>
```

**内部子组件组合**:
- `lazyLoadCoverImage` × 2 (封面 + 模糊层)
- `ProgressBar` (variant='full')
- `PlaybackControls` (variant='full')
- `ModeControlPanel` (variant='full')
- `textSpawn` × N (歌曲名、艺人名)

**提取自原文件**: [musicInfoPage.vue#L505-618](src/components/musicInfoPage.vue#L505-618)

---

### 2.2 AlbumInfoHorizontal.vue

```vue
<script>
export default {
    name: 'AlbumInfoHorizontal',
    
    props: {
        track: { type: Object, required: true },
        draggable: { type: Boolean, default: false },  // mobile lyric模式启用拖拽
        coverSize: { type: Number, default: 48 }
    },
    
    inject: ['animationManager'],
    
    emits: ['drag-down'],  // 下滑触发
    
    data() {
        return { dragHandler: null }
    },
    
    watch: {
        draggable(val) {
            if (val) this.enableDrag()
            else this.disableDrag()
        }
    },
    
    beforeUnmount() {
        this.disableDrag()
    },
    
    methods: {
        enableDrag() {
            if (this.dragHandler) return
            import('../js/drag').then(({ default: drag }) => {
                this.dragHandler = drag.create(
                    this.$el,
                    () => {},           // onClick
                    (info) => {},       // onMove  
                    (info) => {         // onEnd
                        if (info.offsetY > 80 || info.speedY > 1.2) {
                            this.$emit('drag-down')
                        }
                    }
                )
            })
        },
        
        disableDrag() {
            if (this.dragHandler) {
                this.dragHandler.destroy()
                this.dragHandler = null
            }
        }
    }
}
</script>
```

**模板结构**:
```html
<div class="h-album-info">
    <div class="cover" :style="{width: coverSize+'px', height: coverSize+'px'}">
        <lazyLoadCoverImage :id="track.al.id" />
    </div>
    <div class="info">
        <div class="name"><textSpawn :text="track.name" /></div>
        <div class="meta">
            <span v-for="(ar, i) in track.ar" :key="i">
                {{ ar.name }}{{ i < track.ar.length - 1 ? '/' : '' }}
            </span>
            <span v-if="track.al.id > -2"> - {{ track.al.name }}</span>
        </div>
    </div>
    <div class="actions">
        <button_circle><i class="bi bi-three-dots"></i></button_circle>
    </div>
</div>
```

---

### 2.3 PlaybackControls.vue

```vue
<script>
export default {
    name: 'PlaybackControls',
    
    props: {
        isPlaying: { type: Boolean, default: false },
        playMode: { type: String, default: 'loopPlaylist' },
        variant: { 
            type: String, 
            default: 'full',
            validator: v => ['full', 'mini', 'compact'].includes(v)
        }
    },
    
    components: {
        button_circle: () => import('./button_circle.vue'),
        buttom_icon_circleBackground: () => import('../base/buttom_icon_circleBackground.vue'),
        playModeSvg: () => import('./playModeSvg.vue')
    },
    
    emits: ['play', 'prev', 'next', 'cycle-mode']
}
</script>
```

**变体渲染差异**:

| 元素 | full | mini | compact |
|------|:----:|:----:|:-------:|
| 模式按钮 | ✅ button_circle | ✅ icon_bg | ❌ |
| 上一首 | ✅ button_circle | ✅ icon_bg | ✅ text |
| 播放/暂停 | ✅ 大号(1.5x) | ✅ 正常 | ✅ 正常 |
| 下一首 | ✅ button_circle | ✅ icon_bg | ✅ text |
| 音量 | ✅ button_circle | ✅ icon_bg | ❌ |
| 更多(⋮) | ❌ | ✅ icon_bg | ❌ |

**提取来源**: 
- full: [musicInfoPage.vue#L549-572](src/components/musicInfoPage.vue#L549-572)
- mini: [musicInfoPage.vue#L461-499](src/components/musicInfoPage.vue#L461-499)

---

### 2.4 ProgressBar.vue

```vue
<script>
import baseMethods from '../../js/baseMethods'

export default {
    name: 'ProgressBar',
    
    props: {
        progress: { type: Number, default: 0 },
        currentTime: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        currentTimeRound: { type: Number, default: 0 },
        durationRound: { type: Number, default: 0 },
        variant: {
            type: String,
            default: 'full',
            validator: v => ['full', 'thin', 'bar'].includes(v)
        }
    },
    
    inject: ['baseMethods'],
    
    emits: ['seek'],
    
    mounted() {
        this.initProgressBar()
    },
    
    beforeUnmount() {
        this.cancelReg?.()
    },
    
    methods: {
        initProgressBar() {
            const el = this.variant === 'bar' 
                ? this.$refs.barContainer 
                : this.$refs.mainContainer
                
            this.cancelReg = baseMethods.progressBarReg(
                el,
                () => this.progress,
                (info) => {
                    if (info.draging) {
                        this.$emit('seek', info.currentProgress)
                    }
                }
            )
        }
    }
}
</script>
```

**变体样式**:
- **full**: 带时间文字，高度 ~30px，hover放大效果 ([原#L531-547](src/components/musicInfoPage.vue#L531-547))
- **thin**: 3px高细线，仅进度填充 ([原#L423-427](src/components/musicInfoPage.vue#L423-427))
- **bar**: 控制栏内嵌样式

---

### 2.5 ModeControlPanel.vue

```vue
<script>
export default {
    name: 'ModeControlPanel',
    
    props: {
        currentMode: { type: String, required: true },
        availableModes: { type: Array, default: () => ['album-only', 'album+list', 'lyric-only'] },
        variant: { type: String, default: 'full' }  // 'full' | 'compact'
    },
    
    components: {
        suspendingBox: () => import('../base/suspendingBox.vue'),
        button_block: () => import('./button_block.vue')
    },
    
    emits: ['mode-change'],
    
    computed: {
        modes() {
            return [
                { key: 'album+list', icon: 'bi-music-note-list', label: '展示音乐列表' },
                { key: 'album-only', icon: 'bi-vinyl', label: '仅显示专辑信息' },
                { key: 'lyric-only', icon: 'bi-text-left', label: '展示歌词' }
            ].filter(m => this.availableModes.includes(m.key))
        }
    }
}
</script>
```

**提取来源**: [musicInfoPage.vue#L574-617](src/components/musicInfoPage.vue#L574-617)

---

### 2.6 MusicListDrawer.vue

```vue
<script>
import { useVirtualList } from '../tracks/utils/virtualList.js'
import lazyLoadCoverImage from '../base/lazyLoadCoverImage.vue'
import drag from '../../js/drag'

export default {
    name: 'MusicListDrawer',
    
    components: { lazyLoadCoverImage },
    
    props: {
        tracks: { type: Array, required: true },
        currentIndex: { type: Number, default: 0 },
        variant: { type: String, default: 'panel' },  // 'panel' | 'drawer'
        open: { type: Boolean, default: false }
    },
    
    inject: ['player', 'animationManager', 'baseMethods'],
    
    emits: ['select-track', 'close'],
    
    data() {
        return {
            scrollTop: 0,
            drawerTranslateY: 100,
            dragHandler: null,
            itemHeight: 64
        }
    },
    
    computed: {
        virtualList() {
            return useVirtualList({
                scrollTop: computed(() => this.scrollTop),
                containerHeight: computed(() => this.containerHeight || 500),
                itemHeight: this.itemHeight,
                itemGap: 0,
                bufferSize: 3,
                totalCount: computed(() => this.tracks.length)
            })
        },
        
        visibleItems() {
            return this.virtualList.visibleItems.value
                .map(({ index }) => ({
                    index,
                    track: this.tracks[index],
                    isCurrent: index === this.currentIndex,
                    ...this.formatTrack(this.tracks[index])
                }))
        },
        
        initialScrollOffset() {
            const targetIndex = Math.max(0, this.currentIndex - 1)
            return targetIndex * this.itemHeight
        }
    },
    
    mounted() {
        if (this.variant === 'drawer') {
            this.initDrawerDrag()
            this.$nextTick(() => {
                this.scrollTop = this.initialScrollOffset
                if (this.open) this.openDrawer()
            })
        } else {
            this.$nextTick(() => {
                this.scrollTop = this.initialScrollOffset
            })
        }
    },
    
    beforeUnmount() {
        this.destroyDrag()
    },
    
    watch: {
        open(val) {
            if (this.variant === 'drawer') {
                val ? this.openDrawer() : this.closeDrawer()
            }
        },
        currentIndex() {
            this.scrollToCurrent()
        }
    },
    
    methods: {
        formatTrack(track) {
            if (!track) return {}
            return {
                name: track.name || '',
                artistName: track.ar?.map(a => a.name).join('/') || '',
                albumName: track.al?.name || '',
                coverId: track.al?.id,
                duration: this.baseMethods?.formatTime_MMSS(track.dt ? track.dt/1000 : 0) || '',
                durationRaw: track.dt ? track.dt/1000 : 0
            }
        },
        
        onTrackClick(index) {
            this.$emit('select-track', { index })
        },
        
        onTrackDoubleClick(index) {
            this.player.switchTo(index)
            if (this.variant === 'drawer') {
                this.closeDrawer()
            }
        },
        
        scrollToCurrent() {
            const target = Math.max(0, (this.currentIndex - 1) * this.itemHeight)
            this.animateScroll(target)
        },
        
        animateScroll(target) {
            const anim = anime({
                targets: this,
                scrollTop: target,
                easing: 'spring(1, 80, 14, 0)',
                duration: 400
            })
            this.animationManager?.track(anim)
        },
        
        onWheel(e) {
            e.preventDefault()
            this.scrollTop += e.deltaY
            this.clampScroll()
        },
        
        clampScroll() {
            const maxScroll = this.virtualList.totalHeight.value - (this.containerHeight || 500)
            this.scrollTop = Math.max(0, Math.min(this.scrollTop, maxScroll))
        },
        
        initDrawerDrag() {
            this.dragHandler = drag.create(
                this.$refs.drawerHandle,
                () => {},
                (info) => {
                    this.drawerTranslateY = Math.max(0, info.offsetY)
                },
                (info) => {
                    if (info.offsetY > 120 || info.speedY > 1.5) {
                        this.$emit('close')
                    } else {
                        anime({
                            targets: this,
                            drawerTranslateY: 0,
                            easing: 'spring(1, 90, 14, 0)'
                        })
                    }
                }
            )
        },
        
        destroyDrag() {
            this.dragHandler?.destroy()
            this.dragHandler = null
        },
        
        openDrawer() {
            anime({
                targets: this,
                drawerTranslateY: [100, 0],
                easing: 'spring(1, 80, 14, 0)',
                duration: 400
            })
        },
        
        closeDrawer() {
            anime({
                targets: this,
                drawerTranslateY: [this.drawerTranslateY, 100],
                easing: 'easeOutExpo',
                duration: 300,
                complete: () => this.$emit('close')
            })
        }
    }
}
</script>
```

**列表项模板**:
```html
<div class="list-container" ref="listContainer"
     @wheel.stop="onWheel">
    <div class="list-spacer" 
         :style="{ height: virtualList.totalHeight.value + 'px' }">
        <div v-for="item in visibleItems" 
             :key="item.index"
             class="list-item"
             :class="{ current: item.isCurrent }"
             :style="virtualList.getItemStyle(item.index)"
             @click="onTrackClick(item.index)"
             @dblclick="onTrackDoubleClick(item.index)">
            <span class="index">{{ item.index + 1 }}</span>
            <div class="cover-thumb">
                <lazyLoadCoverImage :id="item.coverId" />
            </div>
            <div class="track-info">
                <div class="name">{{ item.name }}</div>
                <div class="meta">{{ item.artistName }} - {{ item.albumName }}</div>
            </div>
            <span class="duration">{{ item.duration }}</span>
        </div>
    </div>
</div>
```

---

### 2.7 LyricPanel.vue

基于现有 [lyric.vue](src/components/musicInfoPageComponents/lyric.vue) 重构:

**变更点**:
1. 新增 props 接口规范
2. 背景改为 `rgba(255,255,255,0.05)`
3. 移除对 inject `currentMusicInfo`/`audioState` 的依赖，改用 props
4. 保留逐字歌词和 anime.js 动画系统

```javascript
// 新增 Props
props: {
    audioDom: HTMLAudioElement,
    lyricData: Object,           // { type: 'lrc'|'yrc'|'none', content, tranContent? }
    visible: { type: Boolean, default: true },
    config: {
        type: Object,
        default: () => ({ usingwfwLyric: true, energySavingMode: false })
    }
}

// 移除 inject
// inject: ['currentMusicInfo', 'audioState']  ← 删除
// 改为从 props 获取数据
```

---

## 3. useViewAdapter.js 规范

```javascript
// src/components/musicInfoPageComponents/useViewAdapter.js

const BREAKPOINTS = {
    desktop: { minWidth: 768, minHeight: 500 },
    mobile:  { maxWidth: 480 },
    compact: { maxWidth: 480, ratioMin: 0.8, ratioMax: 1.3 },
    strip:   { maxHeight: 150, minHeight: 100, maxWidth: 480 }
}

const MODE_AVAILABILITY = {
    desktop: ['album-only', 'lyric-only', 'album+lyric', 'album+list'],
    mobile:  ['album-only', 'lyric-only'],
    compact: ['album-only'],
    strip:   ['album-only'],
    unsupported: []
}

export function useViewAdapter(options = {}) {
    const { onDeviceChange, onModeChange } = options
    
    let currentType = 'desktop'
    let currentMode = 'album-only'
    let resizeRemover = null
    const listeners = []
    
    function detect() {
        const w = window.innerWidth
        const h = window.innerHeight
        const ratio = w / h
        
        if (h >= 100 && h <= 150 && w < 480) return 'strip'
        if (w < 480 && ratio >= 0.8 && ratio <= 1.3) return 'compact'
        if (w < 480) return 'mobile'
        if (w >= 768 && h >= 500) return 'desktop'
        if (w >= 480) return 'desktop'
        return 'unsupported'
    }
    
    function update() {
        const newType = detect()
        if (newType !== currentType) {
            currentType = newType
            const modes = MODE_AVAILABILITY[currentType] || []
            if (!modes.includes(currentMode)) {
                currentMode = modes[0] || 'album-only'
            }
            listeners.forEach(fn => fn({ deviceType: currentType, viewMode: currentMode }))
            onDeviceChange?.(currentType, currentMode)
        }
    }
    
    function start() {
        update()
        let timer = null
        const onResize = () => {
            clearTimeout(timer)
            timer = setTimeout(update, 250)
        }
        window.addEventListener('resize', onResize)
        resizeRemover = () => window.removeEventListener('resize', onResize)
    }
    
    function stop() {
        resizeRemover?.()
        resizeRemover = null
    }
    
    function setMode(mode) {
        const allowed = MODE_AVAILABILITY[currentType] || []
        if (allowed.includes(mode)) {
            currentMode = mode
            listeners.forEach(fn => fn({ deviceType: currentType, viewMode: currentMode }))
            onModeChange?.(currentMode, mode)
        }
    }
    
    function onChange(fn) {
        listeners.push(fn)
        return () => {
            const idx = listeners.indexOf(fn)
            if (idx > -1) listeners.splice(idx, 1)
        }
    }
    
    return {
        get deviceType() { return currentType },
        get viewMode() { return currentMode },
        get availableModes() { return MODE_AVAILABILITY[currentType] || [] },
        get isMobile() { return currentType === 'mobile' },
        get isDesktop() { return currentType === 'desktop' },
        setViewMode: setMode,
        start,
        stop,
        onChange
    }
}
```

## 4. 实施任务清单

### Phase 1: 基础组件提取（无破坏性变更）

- [ ] **T1.1** 创建 `ProgressBar.vue` — 从 musicInfoPage.vue 提取进度条逻辑
- [ ] **T1.2** 创建 `PlaybackControls.vue` — 提取播放控件，实现3种变体
- [ ] **T1.3** 创建 `ModeControlPanel.vue` — 提取模式切换按钮组
- [ ] **T1.4** 创建 `useViewAdapter.js` — 设备检测模块

### Phase 2: 核心新组件开发

- [ ] **T2.1** 创建 `AlbumInfoVertical.vue` — 提取竖版专辑信息区域
- [ ] **T2.2** 创建 `AlbumInfoHorizontal.vue` — 新建横版专辑信息组件
- [ ] **T2.3** 创建 `MiniControlBar.vue` — 提取底部控制栏
- [ ] **T2.4** 创建 `MusicListDrawer.vue` — 新建音乐列表抽屉（含虚拟滚动）
- [ ] **T2.5** 重构 `LyricPanel.vue` — 从 lyric.vue 改造接口

### Phase 3: 布局编排器

- [ ] **T3.1** 创建 `MusicInfoPageLayout.vue` — 主编排器骨架
- [ ] **T3.2** 实现 Desktop 单面板布局模板
- [ ] **T3.3** 实现 Desktop 双栏布局模板
- [ ] **T3.4** 实现 Mobile 布局模板（含常驻底部栏）
- [ ] **T3.5** 实现 Compact 布局模板
- [ ] **T3.6** 实现 Strip 布局模板
- [ ] **T3.7** 实现 Unsupported 兜底布局

### Phase 4: 动画系统集成

- [ ] **T4.1** 实现 AnimationManager 并注入
- [ ] **T4.2** 迁移 toTop/toBottom 动画到 Layout
- [ ] **T4.3** 迁移 cover_position_bind 动画
- [ ] **T4.4** 实现模式切换过渡动画
- [ ] **T4.5** 实现双栏展开动画
- [ ] **T4.6** 实现 Drawer 打开/关闭/回弹动画
- [ ] **T4.7** 实现 AlbumInfoHorizontal 拖拽手势

### Phase 5: 集成与测试

- [ ] **T5.1** 改造 `musicInfoPage.vue` 为入口壳组件
- [ ] **T5.2** Desktop 端功能验证（所有模式切换）
- [ ] **T5.3** Mobile 端功能验证（含抽屉）
- [ ] **T5.4** Resize 响应验证（类型切换）
- [ ] **T5.5** 动画性能验证（无内存泄漏）
- [ ] **T5.6** 清理旧代码（landscape.vue等）

## 5. 风险与注意事项

### 5.1 向兼容性
- 所有新组件通过渐进方式引入，不直接删除旧代码
- 先完成提取，再替换引用，最后删除冗余
- 每个Phase完成后应可独立运行测试

### 5.2 性能风险点
- 虚拟列表的初始滚动定位需在 `$nextTick` 后执行
- 歌词组件已有 setInterval(100ms)，注意与动画帧同步
- Drawer 的 transform 动画避免触发重排

### 5.3 关键依赖
- `drag.js` 的 destroy 方法必须正确注销所有事件
- `regResizeHandle` 返回的 cancelReg 必须在适当时机调用
- `baseMethods.progressBarReg` 的 cancelReg 必须在 unmount 时调用

### 5.4 样式一致性
- 所有新增组件使用 `global_backgroundblur_light` 类保持背景模糊一致
- 颜色变量复用现有 CSS 变量 (`--color-toggle-actived`, `--Shadow-value-low`)
- 字重体系: 900(标题) / 700(副标题) / normal(正文)
