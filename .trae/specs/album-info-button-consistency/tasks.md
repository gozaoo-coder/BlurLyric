# 专辑信息与控制栏一致性优化 - The Implementation Plan (Decomposed and Prioritized Task List)

## [x] Task 1: 修改 AlbumInfoVertical.vue 组件，集成 ViewModeControlBar
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 AlbumInfoVertical.vue 中导入 ViewModeControlBar 组件
  - 添加必要的 props (activeMode, deviceType)
  - 添加 modeChange 事件处理
  - 将 ViewModeControlBar 放在现有 musicDetailButton 位置
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-1.1: ViewModeControlBar 组件在 AlbumInfoVertical 内部正确渲染
  - `programmatic` TR-1.2: 所有 props 和事件正确传递
  - `programmatic` TR-1.3: 样式保持原有样子
- **Notes**: 保持现有的 slot 功能，但同时支持直接集成 ViewModeControlBar

## [x] Task 2: 修改 AdaptiveLayout.vue 组件，移除外部 ViewModeControlBar
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 将 ViewModeControlBar 的 props 传递给 AlbumInfoVertical
  - 从外部移除 ViewModeControlBar 组件
  - 确保在所有布局模式 (albumOnly, albumAndLyric, albumAndMusicList, mobile) 下正确传递
- **Acceptance Criteria Addressed**: [AC-1, AC-3]
- **Test Requirements**:
  - `programmatic` TR-2.1: desktop albumOnly 模式正常
  - `programmatic` TR-2.2: desktop albumAndLyric 模式正常
  - `programmatic` TR-2.3: desktop albumAndMusicList 模式正常
  - `programmatic` TR-2.4: mobile 模式正常
- **Notes**: 保持其他布局模式 (lyricOnly, square, strip) 不变

## [x] Task 3: 测试所有布局和模式
- **Priority**: P1
- **Depends On**: Task 2
- **Description**: 
  - 验证所有布局模式功能正常
  - 确保样式保持一致
  - 验证宽度一致性
- **Acceptance Criteria Addressed**: [AC-2, AC-3, AC-4]
- **Test Requirements**:
  - `human-judgement` TR-3.1: 视觉上与之前版本无区别
  - `programmatic` TR-3.2: 所有功能保持正常工作
  - `programmatic` TR-3.3: 宽度完全一致
- **Notes**: 测试各种窗口大小和响应式布局
