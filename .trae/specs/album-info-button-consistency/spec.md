# 专辑信息与控制栏一致性优化 - Product Requirement Document

## Overview
- **Summary**: 将 album-info-vertical 和 musicDetailButton (ViewModeControlBar) 整合到同一个容器内，确保两者保持一致的宽度，提升用户体验和视觉统一性。
- **Purpose**: 解决当前布局中专辑信息和控制栏分离导致的宽度不一致问题，统一布局结构。
- **Target Users**: 所有使用音乐播放器的用户。

## Goals
- 将 ViewModeControlBar 集成到 AlbumInfoVertical 组件内部
- 确保两者使用一致的宽度约束
- 保持所有布局和功能正常工作
- 不破坏现有功能和界面

## Non-Goals (Out of Scope)
- 不改变 ViewModeControlBar 的功能逻辑
- 不修改其他布局模式
- 不改变现有 UI 样式设计
- 不修改除 desktop/mobile/square/strip 等布局的其他部分

## Background & Context
- 当前 AlbumInfoVertical 组件内部已经有 musicDetailButton 的 slot，但实际的 ViewModeControlBar 组件被放置在外部，导致宽度控制不统一
- 需要重新组织组件结构，使两者在同一容器内

## Functional Requirements
- **FR-1**: ViewModeControlBar 成为 AlbumInfoVertical 的子组件
- **FR-2**: AlbumInfoVertical 接收 ViewModeControlBar 所需的 props
- **FR-3**: 保持现有所有布局模式正常工作
- **FR-4**: album-info-vertical 和 ViewModeControlBar 使用相同宽度约束

## Non-Functional Requirements
- **NFR-1**: 保持现有响应式布局行为
- **NFR-2**: 不引入任何功能降级

## Constraints
- **Technical**: Vue 3, Composition API
- **Business**: 不破坏现有功能
- **Dependencies**: 现有的 AdaptiveLayout, AlbumInfoVertical, ViewModeControlBar 组件

## Assumptions
- 所有现有布局模式需要保持功能
- ViewModeControlBar 的功能无需修改

## Acceptance Criteria

### AC-1: 组件集成
- **Given**: 音乐播放器在任何显示模式
- **When**: 用户打开音乐详情页
- **Then**: ViewModeControlBar 显示在 AlbumInfoVertical 组件内部底部
- **Verification**: `programmatic`

### AC-2: 宽度一致性
- **Given**: 音乐播放器在任何布局模式
- **When**: 查看专辑信息和控制栏
- **Then**: 两者宽度完全一致
- **Verification**: `programmatic`

### AC-3: 所有布局模式功能正常
- **Given**: 所有 desktop/mobile/square/strip 布局
- **When**: 切换显示模式
- **Then**: 所有功能正常工作
- **Verification**: `programmatic`

### AC-4: 无样式保持
- **Given**: 现有的样式和布局
- **When**: 进行此修改后
- **Then**: 视觉上无任何样式变化
- **Verification**: `human-judgment`

## Open Questions
- 无
