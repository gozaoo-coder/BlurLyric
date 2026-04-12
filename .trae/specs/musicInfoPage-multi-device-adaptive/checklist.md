# Checklist

## 视口适配系统
- [x] `useViewportAdapter.js` 正确判定 desktop/mobile/square/strip/unsupported 设备类型
- [x] 窗口 resize 时设备类型自动更新（带 debounce）
- [x] displayMode 切换方法正常工作（albumOnly/lyricOnly/albumAndLyric/albumAndMusicList）
- [ ] 单元测试覆盖设备类型判定逻辑

## 子组件抽离
- [x] `ProgressBar.vue` 进度条拖拽、hover 放大、时间显示功能与原有一致
- [x] `PlaybackControls.vue` 播放/暂停/上下首/播放模式/音量按钮功能正常
- [x] `ViewModeControlBar.vue` 三个模式切换按钮交互正常，当前模式高亮
- [x] `AlbumInfoVertical.vue` 竖版专辑信息渲染与原有一致，cover 动画绑定正常

## 新组件
- [x] `AlbumInfoHorizontal.vue` flex 横向布局正确，文本溢出显示省略号，默认高度 48px
- [x] `AlbumInfoHorizontal.vue` cover 动画与竖版 cover 联动过渡正常
- [x] `LyricPlaceholder.vue` 淡白色透明背景，宽度匹配父容器
- [x] `MusicListPanel.vue` 虚拟列表渲染正常，初始化以当前 trackIndex 为中心
- [x] `MusicListPanel.vue` 双击切歌调用 player.switchTo 正确
- [x] `MusicListPanel.vue` 鼠标滚轮和 touch 滑动流畅
- [x] `MusicListPanel.vue` 当前播放曲目高亮显示
- [x] `MusicListDrawer.vue` 从底部滑入/滑出动画流畅
- [x] `MusicListDrawer.vue` 拖拽 bar 向上拉展开、向下拉关闭正常
- [x] `MusicListDrawer.vue` 关闭阈值判定正确
- [x] `MusicListDrawer.vue` 关闭按钮功能正常
- [x] `MusicListDrawer.vue` 事件钩子在组件卸载时正确注销
- [x] `DraggableAlbumInfo.vue` 下滑关闭 musicInfoPage 正常
- [x] `DraggableAlbumInfo.vue` 上滑不触发任何操作
- [x] `DraggableAlbumInfo.vue` 切换显示模式/设备类型时事件钩子正确注销

## 布局适配
- [x] Desktop 单栏-仅专辑信息：与现有布局一致
- [x] Desktop 单栏-仅歌词：横版专辑信息 + 歌词 + 进度条 + 控件 + 控制板
- [x] Desktop 双栏-专辑信息+歌词：左栏竖版专辑信息，右栏歌词
- [x] Desktop 双栏-专辑信息+音乐列表：左栏竖版专辑信息，右栏音乐列表
- [x] Mobile 仅专辑信息：与现有竖版一致，底部控制板常驻
- [x] Mobile 歌词模式：横版专辑信息（可拖拽）+ 歌词 + 控件 + 控制板
- [x] Mobile 音乐列表：底部抽屉滑入，含拖拽 bar 和关闭按钮
- [x] Square 布局：上栏横版专辑信息 + 中栏进度条 + 下栏播放控件，居中紧凑
- [x] Strip 布局：仅横版专辑信息
- [x] Unsupported 布局：显示"该布局未适应"

## 重构验证
- [x] `musicInfoPage.vue` 已重构为薄壳编排层，无内联播放控件/进度条/专辑信息 DOM
- [x] toTop/toBottom 动画正常工作
- [x] 底部控制栏（musicControlBar）拖拽切歌功能正常
- [x] cover 绝对定位和动画绑定与子组件联动正常

## 视觉风格
- [x] 所有新组件背景色使用透明白色（rgba(255,255,255,0.x)）
- [x] 字重层次与现有设计一致（标题900、副标题700、内容400）
- [x] 圆角、阴影与现有组件保持一致
- [x] 各设备类型下视觉效果优良，空间匹配合理

## 动画性能
- [x] Cover 位置切换使用 anime.js spring 动画，无布局抖动
- [x] 手机端抽屉动画流畅，支持手势跟随
- [x] 布局切换过渡动画（opacity + transform）无闪烁
