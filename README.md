# BlurLyric 3.0
<p>全新的使用tauri框架的美观多功能播放器！</p>

## 开发/构建办法
- 1.克隆项目，并配置好rust、nodejs环境
- 2.在项目根目录使用命令
```
npm install
```
完成初始化
```
npm run tauri dev
```
进行开发
```
npm run tauri build
```
生成可执行文件

## 特性 (持续更新中)
- 1.✅ 使用vue、tauri等框架带来的轻量级播放器。
- 2.❌ 支持本地音乐播放、网易云账号、webdev云盘关联等等。
- 3.❌ 支持本地音乐tag补全。
- 4.✅ 丝滑流畅动效体验。
- 5.❌ 多设备、尺寸适配。
- 6.❌ 串流播放。

## 核心模块文档

### 架构设计
- [项目概述](docs/01-项目概述.md)
- [系统架构](docs/02-系统架构.md)
- [接口规范](docs/05-接口规范.md)

### 核心模块
- **[网络仓库设计与实现](docs/10-网络仓库设计与实现.md)** - 多数据源统一管理、Trace来源追踪
- **[网络媒体设计与实现](docs/11-网络媒体设计与实现.md)** - 资源管理、引用计数、缓存机制

### 重构规划
- [音乐播放模块重构规划](docs/09-音乐播放模块重构规划.md)
- [Rust后端优化方案](docs/rust后端优化方案/00-总览与执行路线图.md)

### 特别感谢以下项目为我们提供灵感、参考设计和功能代码：
- [Binaryify/NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
- [qier222/YesPlayMusic](https://github.com/qier222/YesPlayMusic)
- [LyricEase](https://apps.microsoft.com/store/detail/lyricease/9N1MKDF0F4GT?hl=zh-cn&gl=CN)
- [Apple Music](https://www.apple.com/apple-music/)
- [Spotify](https://www.spotify.com/)



当前项目为个人新框架新语言练手项目，更新慢/bug多请见谅！


## [License](https://github.com/gozaoo/BlurLyric-3.0/blob/v3.0.0-alpha/License)
 
