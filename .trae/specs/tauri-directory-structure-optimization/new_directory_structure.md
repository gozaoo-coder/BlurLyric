# 新的 Tauri 目录结构设计

## 设计原则
1. **模块化**：按照功能模块划分目录
2. **清晰性**：目录结构清晰易懂
3. **可扩展性**：支持未来功能扩展
4. **遵循 Rust 最佳实践**：符合 Rust 项目的标准目录结构

## 新的目录结构

```
src-tauri/src/
├── main.rs                 # 应用入口点
├── lib.rs                  # 库入口点
├── api/                    # API 相关模块
│   ├── mod.rs
│   └── http_proxy.rs       # HTTP 代理功能
├── cache/                  # 缓存相关模块
│   ├── mod.rs
│   ├── music_library_cache.rs
│   └── resource_cache.rs
├── commands/               # Tauri IPC 命令
│   ├── mod.rs
│   ├── cache_commands.rs
│   ├── directory_commands.rs
│   ├── image_commands.rs
│   ├── music_commands.rs
│   └── window_commands.rs
├── common/                 # 通用功能
│   ├── mod.rs
│   ├── constants.rs
│   └── utils.rs
├── image/                  # 图像处理模块
│   ├── mod.rs
│   ├── image_processor.rs
│   ├── gpu_image_processor.rs
│   └── shaders/            # 着色器文件
│       └── resize.wgsl
├── models/                 # 数据模型
│   ├── mod.rs
│   ├── album.rs
│   ├── artist.rs
│   ├── legacy.rs
│   └── track.rs
├── monitoring/             # 监控相关模块
│   ├── mod.rs
│   └── performance_monitor.rs
├── scanner/                # 音乐扫描模块
│   ├── mod.rs
│   └── incremental_scanner.rs
├── services/               # 服务模块
│   ├── mod.rs
│   ├── deduplication.rs
│   ├── persistence.rs
│   └── scanner.rs
├── state/                  # 应用状态
│   ├── mod.rs
│   └── app_state.rs
├── trace/                  # 追踪系统
│   ├── mod.rs
│   └── trace.rs
└── utils/                  # 工具函数
    ├── mod.rs
    └── music_deduplicator.rs
```

## 目录说明

1. **api/**：包含 HTTP 代理等 API 相关功能
2. **cache/**：包含音乐库缓存和资源缓存功能
3. **commands/**：包含所有 Tauri IPC 命令
4. **common/**：包含通用常量和工具函数
5. **image/**：包含图像处理相关功能，包括 CPU 和 GPU 处理
6. **models/**：包含数据模型定义
7. **monitoring/**：包含性能监控功能
8. **scanner/**：包含音乐扫描相关功能
9. **services/**：包含各种服务功能
10. **state/**：包含应用状态管理
11. **trace/**：包含追踪系统
12. **utils/**：包含各种工具函数

## 移动文件列表

| 原文件 | 目标目录 |
|--------|----------|
| http_proxy.rs | api/ |
| image_processor.rs | image/ |
| gpu_image_processor.rs | image/ |
| music_library_cache.rs | cache/ |
| resource_cache.rs | cache/ |
| incremental_scanner.rs | scanner/ |
| performance_monitor.rs | monitoring/ |
| music_deduplicator.rs | utils/ |
| trace.rs | trace/ |

## 模块依赖关系

- **api** 依赖 **common**
- **cache** 依赖 **common** 和 **models**
- **commands** 依赖几乎所有其他模块
- **image** 依赖 **common**
- **scanner** 依赖 **models** 和 **services**
- **services** 依赖 **models**
- **trace** 依赖 **common**
- **utils** 依赖 **common**

## 优势

1. **模块化**：每个模块职责明确，边界清晰
2. **可维护性**：代码组织更加清晰，便于维护
3. **可扩展性**：新功能可以轻松添加到相应的目录中
4. **可读性**：开发人员可以快速找到所需的代码
5. **符合 Rust 最佳实践**：遵循 Rust 项目的标准目录结构