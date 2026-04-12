# Tasks

- [x] Task 1: 创建视口适配 composable `useViewportAdapter.js`
  - [x] SubTask 1.1: 定义设备类型枚举和判定规则（desktop/mobile/square/strip/unsupported）
  - [x] SubTask 1.2: 实现响应式的 `deviceType`、`displayMode`、`layoutConfig` 计算属性
  - [x] SubTask 1.3: 实现窗口 resize 监听（带 debounce），自动更新设备类型
  - [x] SubTask 1.4: 导出 displayMode 的切换方法（albumOnly/lyricOnly/albumAndLyric/albumAndMusicList）
  - [ ] SubTask 1.5: 编写单元测试验证设备类型判定逻辑

- [x] Task 2: 抽离播放进度条组件 `ProgressBar.vue`
  - [x] SubTask 2.1: 从 musicInfoPage.vue 中提取进度条 DOM 和样式
  - [x] SubTask 2.2: 定义 props（progress, currentTime, duration）和 emits（seekByProgress）
  - [x] SubTask 2.3: 迁移 progressBarReg 交互逻辑到组件内部
  - [ ] SubTask 2.4: 验证进度条在原位替换后功能不变

- [x] Task 3: 抽离播放控件组件 `PlaybackControls.vue`
  - [x] SubTask 3.1: 从 musicInfoPage.vue 中提取播放控件 DOM 和样式
  - [x] SubTask 3.2: 定义 props（playing, playMode）和 emits（play, pause, next, prev, cyclePlayMode）
  - [x] SubTask 3.3: 支持横板模式（占满宽度，含播放模式、暂停、上下首、音量）和紧凑模式
  - [ ] SubTask 3.4: 验证播放控件功能不变

- [x] Task 4: 抽离显示模式控制板组件 `ViewModeControlBar.vue`
  - [x] SubTask 4.1: 从 musicInfoPage.vue 中提取控制板 DOM 和样式（三个按钮：音乐列表、专辑信息、歌词）
  - [x] SubTask 4.2: 定义 props（activeMode, deviceType）和 emits（modeChange）
  - [x] SubTask 4.3: 实现桌面端双选状态支持（专辑信息+歌词/音乐列表）
  - [x] SubTask 4.4: 实现手机端单选状态（底部常驻）
  - [ ] SubTask 4.5: 验证控制板交互功能

- [x] Task 5: 抽离专辑信息（竖版）组件 `AlbumInfoVertical.vue`
  - [x] SubTask 5.1: 从 musicInfoPage.vue 中提取竖版专辑信息 DOM 和样式
  - [x] SubTask 5.2: 定义 props（track, progress）和 emits
  - [x] SubTask 5.3: 集成 PlaybackControls（横板）和 ProgressBar
  - [x] SubTask 5.4: 实现 cover_position_bind 动画绑定（与 cover 占位符联动）
  - [ ] SubTask 5.5: 验证竖版专辑信息功能与原有一致

- [x] Task 6: 创建专辑信息（横版）组件 `AlbumInfoHorizontal.vue`
  - [x] SubTask 6.1: 实现 flex 横向布局：方形专辑图 | 音乐名+艺人名-专辑名 | 详情按钮
  - [x] SubTask 6.2: 实现中间区域自动扩充、文本溢出省略号
  - [x] SubTask 6.3: 实现 cover 动画绑定（与竖版 cover 联动过渡）
  - [x] SubTask 6.4: 默认高度 48px，透明背景
  - [ ] SubTask 6.5: 验证横版组件在各设备类型下渲染正确

- [x] Task 7: 创建歌词展示占位组件 `LyricPlaceholder.vue`
  - [x] SubTask 7.1: 实现淡白色透明背景容器
  - [x] SubTask 7.2: 宽度匹配父容器，高度自适应
  - [x] SubTask 7.3: 预留歌词组件接入接口

- [x] Task 8: 创建音乐列表组件 `MusicListPanel.vue`
  - [x] SubTask 8.1: 实现虚拟列表渲染（复用 useVirtualList composable 逻辑）
  - [x] SubTask 8.2: 实现初始化定位：以当前 trackIndex 为中心显示
  - [x] SubTask 8.3: 实现列表项渲染：专辑图片、音乐名、专辑、艺人、时长、索引序号
  - [x] SubTask 8.4: 实现双击切歌（调用 player.switchTo）
  - [x] SubTask 8.5: 实现鼠标滚轮和 touch 事件滑动
  - [x] SubTask 8.6: 实现当前播放曲目高亮
  - [x] SubTask 8.7: 实现淡白色透明背景，宽度匹配视图

- [x] Task 9: 创建手机端音乐列表抽屉组件 `MusicListDrawer.vue`
  - [x] SubTask 9.1: 实现从底部滑入的抽屉动画（anime.js）
  - [x] SubTask 9.2: 实现可拖拽 bar（向上拉展开、向下拉关闭）
  - [x] SubTask 9.3: 实现关闭阈值判定（拖拽相对距离超过阈值后松手关闭）
  - [x] SubTask 9.4: 实现关闭按钮
  - [x] SubTask 9.5: 内部集成 MusicListPanel
  - [x] SubTask 9.6: 正确管理 touch/mouse 事件钩子的注册与注销

- [x] Task 10: 创建手机端可拖拽专辑信息组件 `DraggableAlbumInfo.vue`
  - [x] SubTask 10.1: 包装 AlbumInfoHorizontal，注册下滑关闭 musicInfoPage 的拖拽事件
  - [x] SubTask 10.2: 上滑不处理
  - [x] SubTask 10.3: 切换显示模式或设备类型时正确注销事件钩子
  - [x] SubTask 10.4: 使用 drag.js 工具实现拖拽

- [x] Task 11: 创建自适应布局编排组件 `AdaptiveLayout.vue`
  - [x] SubTask 11.1: 实现 desktop 布局（CSS Grid）：单栏/双栏切换
  - [x] SubTask 11.2: 实现 mobile 布局：单栏 + 底部控制板常驻
  - [x] SubTask 11.3: 实现 square 布局：三栏紧凑居中
  - [x] SubTask 11.4: 实现 strip 布局：仅横版专辑信息
  - [x] SubTask 11.5: 实现 unsupported 布局：显示"该布局未适应"
  - [x] SubTask 11.6: 实现布局切换时的过渡动画（opacity + transform）

- [x] Task 12: 重构 `musicInfoPage.vue` 为薄壳编排层
  - [x] SubTask 12.1: 移除内联 DOM，替换为 AdaptiveLayout + 子组件引用
  - [x] SubTask 12.2: 保留 musicInfoPagePosition 状态管理和 toTop/toBottom 动画
  - [x] SubTask 12.3: 保留 cover 的绝对定位和动画绑定（与子组件联动）
  - [x] SubTask 12.4: 保留底部控制栏（musicControlBar）逻辑
  - [x] SubTask 12.5: 集成 useViewportAdapter
  - [ ] SubTask 12.6: 验证所有原有功能（toTop/toBottom 动画、拖拽切歌、进度条）正常工作

- [ ] Task 13: 视觉风格一致性验证与调优
  - [ ] SubTask 13.1: 检查所有新组件的背景色、字重、圆角、阴影与原有设计一致
  - [ ] SubTask 13.2: 检查各设备类型下的视觉效果
  - [ ] SubTask 13.3: 修复视觉不一致问题

# Task Dependencies
- [Task 2] depends on nothing (可独立开始)
- [Task 3] depends on nothing (可独立开始)
- [Task 4] depends on nothing (可独立开始)
- [Task 5] depends on [Task 2, Task 3] (竖版专辑信息集成进度条和播放控件)
- [Task 6] depends on nothing (可独立开始)
- [Task 7] depends on nothing (可独立开始)
- [Task 8] depends on nothing (可独立开始)
- [Task 9] depends on [Task 8] (抽屉内集成音乐列表)
- [Task 10] depends on [Task 6] (包装横版专辑信息)
- [Task 11] depends on [Task 1, Task 5, Task 6, Task 7, Task 8] (布局编排依赖所有子组件)
- [Task 12] depends on [Task 11] (薄壳层依赖布局组件)
- [Task 13] depends on [Task 12] (最终验证依赖完整集成)

# Parallelizable Work
- Task 1, Task 2, Task 3, Task 4, Task 6, Task 7, Task 8 可并行开发
- Task 5 需等待 Task 2, Task 3
- Task 9 需等待 Task 8
- Task 10 需等待 Task 6
- Task 11 需等待所有子组件就绪
