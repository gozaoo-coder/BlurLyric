# MusicInfoPage 高级重构 - 总体规格说明

## 1. 项目背景

当前 `musicInfoPage.vue` 是一个约620行的单体组件，承担了以下所有职责：

- 竖版专辑信息展示（封面、歌曲名、艺人、进度条、播放控件）
- 底部迷你控制栏（横版信息条）
- 视图位置切换动画（top/bottom）
- 拖拽手势处理
- 模式切换按钮（音乐列表/专辑信息/歌词）
- UIMode 响应式检测（mobile/tablet/desktop）
- 动画生命周期管理

**核心问题**：组件职责过重，无法支持多设备适配视图，无法灵活组合展示面板。

## 2. 重构目标

### 2.1 功能目标

- 实现多设备视图自适应（桌面/平板、手机、小方块、窄条）
- 支持多种展示模式组合（仅专辑、仅歌词、专辑+歌词、专辑+列表）
- 新增横版专辑信息组件
- 新增音乐列表抽屉（虚拟滚动）
- 保持现有视觉效果和交互动画

### 2.2 架构目标

- 组件化：每个功能单元独立为可复用组件
- 低耦合：子组件通过 props/inject/events 通信
- 高内聚：每个组件单一职责
- 动画系统统一管理
- 响应式布局策略清晰

## 3. 设备视图类型定义

| 类型              | 判定条件                                      | 支持的模式         |
| --------------- | ----------------------------------------- | ------------- |
| **desktop**     | width >= 768px AND height >= 500px        | 单面板 / 双面板组合   |
| **mobile**      | width < 480px                             | 单面板 + 底部控制栏常驻 |
| **compact**     | width < 480px AND aspectRatio near 1:1    | 三行紧凑布局        |
| **strip**       | height in \[100, 150]px AND width < 480px | 仅横版专辑信息       |
| **unsupported** | 其他极端情况                                    | 显示"该布局未适应"    |

## 4. 展示模式定义

| 模式标识          | 描述                   | desktop支持 | mobile支持 |
| ------------- | -------------------- | :-------: | :------: |
| `album-only`  | 仅显示竖版专辑信息            |     ✅     |     ✅    |
| `lyric-only`  | 横版专辑 + 歌词 + 进度条 + 控件 |     ✅     |     ✅    |
| `album+lyric` | 左竖版专辑 + 右歌词          |     ✅     |     ❌    |
| `album+list`  | 左竖版专辑 + 右列表(抽屉)      |     ✅     |  ❌(使用抽屉) |

## 5. 技术选型

| 技术                            | 用途    | 说明                  |
| ----------------------------- | ----- | ------------------- |
| Vue 3 Options API             | 组件框架  | 与项目一致               |
| anime.js                      | 动画引擎  | 已在项目中使用，spring物理动画  |
| CSS Grid + Flexbox            | 主布局   | 响应式基础布局             |
| position:absolute + transform | 动画过渡层 | GPU加速，适合位移动画        |
| 虚拟滚动 (useVirtualList)         | 音乐列表  | 复用已有 virtualList.js |
| drag.js                       | 拖拽手势  | 复用已有拖拽系统            |

## 6. 布局策略选择

**采用混合布局策略**：

- **静态结构层**：CSS Grid/Flexbox 构建各设备类型的骨架布局
- **动态过渡层**：anime.js + transform 实现视图切换/展开/收起动画
- **理由**：
  - 纯 absolute 定位虽然动画友好，但响应式计算复杂且易出错
  - 纯 flex/grid 虽然DOM调整频繁，但现代浏览器已高度优化
  - 混合方案：布局用CSS管结构，动画用transform管过渡，兼顾可维护性和性能

## 7. 文件结构规划

```
src/components/musicInfoPageComponents/
├── background.vue              # [保留] 动态模糊背景
├── contain.vue                 # [保留] 容器包装器
├── playModeSvg.vue             # [保留] 播放模式图标
├── button_block.vue            # [保留] 方形按钮
├── button_circle.vue           # [保留] 圆形按钮
├── lyric.vue                   # [重构] 歌词展示
├── lyric-line-wordbyword.vue   # [保留] 逐字歌词
├── landscape.vue               # [删除或重写] 旧横版布局
│
├── AlbumInfoVertical.vue       # [新增] 竖版专辑信息（从原组件提取）
├── AlbumInfoHorizontal.vue     # [新增] 横版专辑信息（48px紧凑条）
├── PlaybackControls.vue        # [新增] 播放控件栏（提取+通用化）
├── ProgressBar.vue             # [新增] 进度条组件（提取）
├── ModeControlPanel.vue        # [新增] 模式切换控制板
├── MusicListDrawer.vue         # [新增] 音乐列表抽屉（含虚拟列表）
├── MiniControlBar.vue          # [新增] 底部迷你控制栏（提取）
├── MusicInfoPageLayout.vue     # [新增] 主布局编排器（替代原musicInfoPage.vue的核心逻辑）
└── useViewAdapter.js           # [新增] 设备检测+视图适配 composable

src/components/
└── musicInfoPage.vue           # [大幅简化] 仅作为入口壳组件
```

