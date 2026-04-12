# musicInfoPage 多设备适配视图 Spec

## Why
当前 `musicInfoPage.vue` 是一个约1000行的上帝组件，仅支持竖版专辑信息的固定展示，无法适配多种设备尺寸，无法切换展示歌词和音乐列表。需要将其解耦为独立组件，并实现多设备视图适配，以支持平板/电脑、手机、小方块、窄条等不同设备形态。

## What Changes
- 将 `musicInfoPage.vue` 拆分为多个独立子组件，遵循单一职责原则
- 新增专辑信息（横版）组件 `AlbumInfoHorizontal.vue`
- 新增音乐列表组件 `MusicListPanel.vue`（含虚拟列表）
- 新增歌词展示占位组件 `LyricPlaceholder.vue`
- 将已有的专辑信息（竖版）抽离为 `AlbumInfoVertical.vue`
- 将播放控件抽离为 `PlaybackControls.vue`
- 将进度条抽离为 `ProgressBar.vue`
- 将显示模式控制板抽离为 `ViewModeControlBar.vue`
- 新增视口适配 composable `useViewportAdapter.js`
- 新增布局编排组件 `AdaptiveLayout.vue`，负责根据设备类型切换布局
- 新增手机端音乐列表抽屉组件 `MusicListDrawer.vue`
- 新增手机端可拖拽专辑信息组件 `DraggableAlbumInfo.vue`
- 重构 `musicInfoPage.vue` 为薄壳编排层
- **BREAKING**: `musicInfoPage.vue` 的内部 DOM 结构和 CSS 类名将发生重大变更，依赖其内部结构的代码需适配

## Impact
- Affected specs: 无前置 spec 依赖
- Affected code:
  - `src/components/musicInfoPage.vue` — 主要重构目标
  - `src/components/musicInfoPageComponents/` — 新增多个子组件
  - `src/js/drag.js` — 可能需要扩展以支持抽屉拖拽
  - `src/module/musicPlayer/core/MusicPlayer.js` — 需确认 `switchTo` 方法供音乐列表调用
  - `src/components/tracks/utils/virtualList.js` — 复用虚拟列表逻辑

## 架构决策：布局实现方案

### 方案对比

| 维度 | 虚拟排版 (position: absolute) | 响应式布局 (grid/flex) | 混合方案 (推荐) |
|------|------|------|------|
| 动画能力 | ★★★★★ 位移/大小动画极自然 | ★★★ CSS transition 有限 | ★★★★ 关键元素用 absolute，布局骨架用 grid/flex |
| 布局维护 | ★★ 样式规划复杂，需手动计算 | ★★★★ 声明式布局，易维护 | ★★★★ 骨架声明式，细节可控 |
| 视窗监听 | ★★ 每次resize需重新计算所有位置 | ★★★★ 浏览器自动回流 | ★★★ 仅关键元素需监听 |
| 性能 | ★★★ 频繁JS计算 | ★★★★ 浏览器优化回流 | ★★★★ 仅少量元素JS计算 |
| 出错风险 | ★★ 高，一步小心布局崩溃 | ★★★★ 低 | ★★★ 低 |

### 推荐方案：混合方案
- **布局骨架**：使用 CSS Grid 进行设备级别的布局编排（如左右分栏、上下堆叠），利用 `grid-template-areas` 实现不同设备类型的布局切换
- **Cover 动画**：保持现有的 `position: absolute` + anime.js 方案，仅在 cover 图片元素上使用绝对定位
- **布局切换动画**：使用 CSS `transition` + anime.js 混合，Grid 区域切换时用 `opacity` + `transform` 过渡
- **视口适配**：通过 composable `useViewportAdapter` 检测设备类型，以响应式数据驱动布局切换

### 设备类型判定规则

| 设备类型 | 宽度条件 | 高度条件 | 说明 |
|---------|---------|---------|------|
| `desktop` | > 768px | 任意 | 平板/电脑 |
| `mobile` | ≤ 768px | > 150px | 手机（含fold竖屏） |
| `square` | ≤ 768px | 宽高比 0.8~1.2 且高度 > 150px | 小方块 |
| `strip` | ≤ 768px | 100px~150px | 窄条 |
| `unsupported` | 其他 | 其他 | 不适配 |

## ADDED Requirements

### Requirement: 视口适配系统
系统 SHALL 提供 `useViewportAdapter` composable，根据窗口尺寸自动判定设备类型，并暴露响应式的设备类型、显示模式、布局配置等数据。

#### Scenario: 窗口尺寸变化时自动切换设备类型
- **WHEN** 窗口宽度从 1024px 缩小到 500px
- **THEN** 设备类型从 `desktop` 切换为 `mobile`
- **AND** 布局自动切换为手机布局

#### Scenario: 窗口尺寸变为窄条
- **WHEN** 窗口宽度 ≤ 768px 且高度在 100px~150px 之间
- **THEN** 设备类型为 `strip`
- **AND** 仅显示专辑信息（横版）

### Requirement: 专辑信息（竖版）组件
系统 SHALL 提供 `AlbumInfoVertical.vue` 组件，包含专辑图、音乐名、艺人名、专辑名、Song详情操作按钮、播放控件（横板，占满宽度，含播放模式调节、暂停、上一首、下一首、音量调节）。

#### Scenario: 竖版专辑信息正常渲染
- **WHEN** 当前有播放曲目
- **THEN** 显示专辑封面图、音乐名、艺人名、专辑名
- **AND** 显示三个点详情操作按钮
- **AND** 显示横板播放控件

#### Scenario: Cover 位置绑定动画
- **WHEN** 页面从底部控制栏切换到全屏详情页
- **THEN** cover 图片通过 anime.js spring 动画平滑过渡到竖版占位符位置
- **AND** 窗口 resize 时 cover 位置自动更新

### Requirement: 专辑信息（横版）组件
系统 SHALL 提供 `AlbumInfoHorizontal.vue` 组件，透明背景，默认高度 48px，使用 flex 横向布局：左侧方形专辑图片 | 中间音乐名+艺人名-专辑名（自动扩充，溢出省略号） | 右侧详情按钮。

#### Scenario: 横版专辑信息正常渲染
- **WHEN** 当前有播放曲目
- **THEN** 从左到右显示：方形专辑图 | 音乐名（粗体）/ 艺人名-专辑名（细体） | 三个点按钮
- **AND** 中间区域自动扩充占满 flex 剩余空间
- **AND** 文本过长时显示省略号

#### Scenario: 横版专辑信息 Cover 动画
- **WHEN** 从竖版切换到横版显示
- **THEN** cover 图片通过 anime.js 动画平滑过渡到横版位置和尺寸

### Requirement: 显示模式控制板组件
系统 SHALL 提供 `ViewModeControlBar.vue` 组件，包含三个按钮：展开音乐列表、显示专辑信息、展示歌词。当前激活模式高亮显示。

#### Scenario: 切换显示模式
- **WHEN** 用户点击"展示歌词"按钮
- **THEN** 显示模式切换为歌词模式
- **AND** 对应按钮高亮

#### Scenario: 桌面端双栏模式下控制板行为
- **WHEN** 设备类型为 desktop 且已选择专辑信息模式
- **THEN** 用户可额外选择歌词或音乐列表作为右栏内容
- **AND** 控制板支持双选状态

### Requirement: 播放进度条组件
系统 SHALL 提供 `ProgressBar.vue` 组件，支持拖拽调节进度、hover 放大效果、显示当前时间和总时长。

#### Scenario: 拖拽调节进度
- **WHEN** 用户拖拽进度条
- **THEN** 实时更新播放进度
- **AND** 释放后跳转到对应位置

### Requirement: 音乐列表组件
系统 SHALL 提供 `MusicListPanel.vue` 组件，使用虚拟列表渲染，初始化时以当前 trackIndex 为中心显示，支持鼠标滚轮和 touch 事件滑动，显示专辑图片、音乐名、专辑、艺人、时长、索引序号，双击切歌。

#### Scenario: 音乐列表初始化定位
- **WHEN** 音乐列表首次渲染
- **THEN** 视口从上到下显示 [当前trackIndex-1, 当前trackIndex, 当前trackIndex+1, 当前trackIndex+2, ...]
- **AND** 当前播放曲目高亮显示

#### Scenario: 双击切歌
- **WHEN** 用户双击列表中的某首曲目
- **THEN** 调用 `player.switchTo(index)` 切换到该曲目

#### Scenario: 虚拟列表滚动
- **WHEN** 用户使用鼠标滚轮或 touch 事件滑动列表
- **THEN** 仅渲染可见区域的列表项
- **AND** 滚动流畅无卡顿

### Requirement: 歌词展示占位组件
系统 SHALL 提供 `LyricPlaceholder.vue` 组件，淡白色透明背景，宽度匹配视图大小，内部暂不实现歌词功能。

#### Scenario: 歌词占位组件渲染
- **WHEN** 显示模式为歌词模式
- **THEN** 显示淡白色透明背景的占位区域
- **AND** 宽度匹配父容器

### Requirement: 桌面/平板布局
系统 SHALL 在设备类型为 desktop 时提供以下布局模式：

#### Scenario: 仅显示专辑信息
- **WHEN** 显示模式为"仅专辑信息"
- **THEN** 从上到下显示：专辑图片、音乐名、专辑信息、进度条、播放控件（横板）、显示模式控制板
- **AND** 布局与现有模式相同

#### Scenario: 仅显示歌词
- **WHEN** 显示模式为"仅歌词"
- **THEN** 从上到下显示：专辑信息（横版）、歌词组件、进度条、播放控件、显示模式控制板

#### Scenario: 专辑信息 + 歌词双栏
- **WHEN** 显示模式为"专辑信息+歌词"
- **THEN** 左栏显示专辑信息（竖版），右栏显示歌词组件
- **AND** 专辑信息（竖版）整体左移，右栏占据剩余空间

#### Scenario: 专辑信息 + 音乐列表双栏
- **WHEN** 显示模式为"专辑信息+音乐列表"
- **THEN** 左栏显示专辑信息（竖版），右栏显示音乐列表
- **AND** 专辑信息（竖版）整体左移，右栏占据剩余空间

### Requirement: 手机布局
系统 SHALL 在设备类型为 mobile 时提供以下布局：

#### Scenario: 仅显示专辑信息（手机）
- **WHEN** 显示模式为"仅专辑信息"且设备类型为 mobile
- **THEN** 与现有竖版专辑信息布局相同
- **AND** 底部显示模式控制板常驻

#### Scenario: 显示歌词（手机）
- **WHEN** 显示模式为"歌词"且设备类型为 mobile
- **THEN** 顶部使用专辑信息（横版），中部歌词组件自动占最大高度，底部播放控件，底部显示模式控制板常驻
- **AND** 专辑信息（横版）注册为可拖拽组件，下滑关闭 musicInfoPage 视图，上滑不处理
- **AND** 切换显示模式或设备类型时正确注销拖拽事件钩子

#### Scenario: 展示音乐列表（手机）
- **WHEN** 用户点击"展开音乐列表"按钮且设备类型为 mobile
- **THEN** 从底部使用动画向上移入一个视图抽屉
- **AND** 抽屉包含可拖拽的 bar（可向上拉、向下拉）
- **AND** 拉到与初次滑动相对距离的某个像素值后松手关闭抽屉
- **AND** 抽屉包含关闭按钮
- **AND** 抽屉下方显示音乐列表（复用 MusicListPanel）

### Requirement: 小方块布局
系统 SHALL 在设备类型为 square 时提供紧凑布局。

#### Scenario: 小方块布局渲染
- **WHEN** 设备类型为 square
- **THEN** 分为上中下三栏，紧凑排列，包裹器位于视图中心
- **AND** 上栏：专辑信息（横版）
- **AND** 中栏：进度条
- **AND** 下栏：播放控件

### Requirement: 窄条布局
系统 SHALL 在设备类型为 strip 时提供极简布局。

#### Scenario: 窄条布局渲染
- **WHEN** 设备类型为 strip
- **THEN** 仅显示专辑信息（横版）
- **AND** 宽度使用手机的判断区间

### Requirement: 不支持的布局
系统 SHALL 在设备类型为 unsupported 时显示提示信息。

#### Scenario: 不支持的布局
- **WHEN** 设备类型为 unsupported
- **THEN** 显示"该布局未适应"文字

### Requirement: 视觉风格一致性
所有新组件 SHALL 保持与现有透明白色、字重表达视觉重心的设计风格一致。

#### Scenario: 视觉风格检查
- **WHEN** 任意设备类型和显示模式
- **THEN** 组件使用透明白色背景（rgba(255,255,255,0.x)）
- **AND** 字重层次与现有设计一致（标题900、副标题700、内容400）
- **AND** 圆角、阴影与现有组件保持一致

### Requirement: 动画性能
系统 SHALL 使用 anime.js 或自定义方法实现动画，保证性能。

#### Scenario: Cover 位置动画
- **WHEN** 切换显示模式导致 cover 位置变化
- **THEN** 使用 anime.js spring 动画平滑过渡
- **AND** 动画期间不产生布局抖动

#### Scenario: 手机端抽屉动画
- **WHEN** 手机端打开/关闭音乐列表抽屉
- **THEN** 使用 anime.js 实现平滑的滑入/滑出动画
- **AND** 支持手势跟随（拖拽时实时跟随手指）

## MODIFIED Requirements

### Requirement: musicInfoPage 组件结构
原 `musicInfoPage.vue` 从单一上帝组件重构为薄壳编排层，仅负责组合子组件和管理全局状态（如 musicInfoPagePosition）。

**修改内容**：
- 移除所有内联的播放控件、进度条、专辑信息等 DOM
- 改为引用子组件
- 保留 `musicInfoPagePosition` 状态管理和 `toTop`/`toBottom` 动画逻辑
- 保留 `cover` 的绝对定位和动画绑定

## REMOVED Requirements

### Requirement: 旧的内联布局
**Reason**: 所有布局逻辑从 `musicInfoPage.vue` 内联样式迁移到独立的子组件和 `AdaptiveLayout.vue`
**Migration**: 通过组件化拆分，旧的内联样式由子组件各自管理
