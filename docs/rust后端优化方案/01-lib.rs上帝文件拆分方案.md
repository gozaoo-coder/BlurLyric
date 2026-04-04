# lib.rs 上帝文件拆分方案

## 1. 问题概述

### 1.1 当前状态

| 指标 | 当前值 | 推荐值 | 超出倍数 |
|------|--------|--------|----------|
| 总行数 | 1779 行 | 500 行 | 3.5x |
| 数据结构 | 4 个 | - | - |
| 全局静态变量 | 10 个 | - | - |
| 函数总数 | 54 个 | - | - |
| Tauri 命令 | 24 个 | - | - |

### 1.2 代码分布分析

```
lib.rs (1779 行)
├── 导入与模块声明 (L1-55) ............ 55 行
├── 全局状态定义 (L56-72) .............. 17 行
├── 工具函数 (L74-270) ................ 197 行
│   ├── get_or_create_artist (L74-87)
│   ├── get_or_create_album (L89-102)
│   ├── get_cache_image_path (L171-180)
│   ├── get_cache_dir (L183-191)
│   ├── read_image_from_cache (L194-198)
│   ├── get_album_cover_data (L201-220)
│   ├── resize_image (L222-232)
│   ├── sanitize_filename (L236-263)
│   └── next_id (L266-270)
├── 数据模型定义 (L104-168, L137-147) ... 75 行
│   ├── Song 结构体 (L104-134) .......... 31 行
│   ├── TrackSourceInfo (L137-147) ..... 11 行
│   ├── Artist 结构体 (L149-154) ....... 6 行
│   └── Album 结构体 (L163-168) ........ 6 行
├── 文件判断 (L272-278) .................. 7 行
├── 音乐查询命令 (L280-481) ........... 202 行
│   ├── get_all_my_albums (L281-285)
│   ├── get_all_my_artists (L288-292)
│   ├── get_music_list (L296-306)
│   ├── deduplicate_songs (L309-335)
│   ├── generate_fingerprint (L338-350)
│   ├── normalize_for_dedup (L353-367)
│   ├── merge_songs (L370-402)
│   ├── calculate_song_quality_score (L405-443)
│   ├── get_artist_by_id (L446-453)
│   ├── get_album_by_id (L456-463)
│   ├── get_artists_songs_by_id (L466-472)
│   └── get_albums_songs_by_id (L475-481)
├── 扫描与解析服务 (L484-714) .......... 231 行
│   ├── scan_music_files (L484-501)
│   ├── split_artist_names (L503-516)
│   └── parse_music_file (L519-709) ..... 191 行
├── 缓存刷新命令 (L716-768) ............. 53 行
│   └── refresh_music_cache (L717-768)
├── Song 序列化 (L771-825) .............. 55 行
│   └── impl Song { to_json }
├── ID 生成器冗余 (L827-843) ........... 17 行
│   ├── next_song_id (L827-831)
│   ├── next_artist_id (L833-837)
│   └── next_album_id (L839-843)
├── 音质评分 (L846-885) ................ 40 行
│   └── calculate_quality_score
├── 用户目录命令 (L887-899) ............ 13 行
│   ├── add_users_music_dir (L889-894)
│   └── get_users_music_dir (L897-899)
├── 应用初始化与持久化 (L901-1332) .... 432 行
│   ├── init_application (L903-947)
│   ├── load_from_persistent_cache (L950-971)
│   ├── rebuild_memory_cache_from_persistent (L974-1153) ... 180 行
│   ├── save_to_persistent_cache (L1156-1170)
│   ├── build_persistent_cache_from_memory (L1173-1263) ... 91 行
│   └── perform_background_incremental_scan (L1266-1332) .. 67 行
├── 图片相关命令 (L1334-1463) ......... 130 行
│   ├── get_low_quality_album_cover (L1335-1379)
│   ├── get_album_cover (L1382-1416)
│   └── get_music_file (L1419-1463)
├── 目录管理命令 (L1465-1557) ........... 93 行
│   ├── get_all_music_dirs (L1466-1475)
│   ├── remove_music_dirs (L1478-1492)
│   ├── save_music_dirs_to_disk (L1495-1517)
│   ├── load_music_dirs_from_disk (L1520-1547)
│   └── add_music_dirs (L1550-1557)
├── 缓存数据结构 (L1559-1567) ........... 9 行
│   └── CacheSizeInfo
├── 缓存管理命令 (L1569-1673) ......... 105 行
│   ├── get_cache_size_info (L1570-1611)
│   ├── clear_image_cache (L1615-1639)
│   └── reset_all_data (L1642-1673)
└── 窗口控制命令 (L1675-1706) .......... 32 行
    ├── close_app (L1677-1679)
    ├── minimize_window (L1682-1684)
    ├── toggle_maximize (L1687-1693)
    └── toggle_always_on_top (L1696-1706)
```

---

## 2. 目标模块架构

### 2.1 拆分后的目录结构

```
src-tauri/src/
├── lib.rs                          (~200 行，精简后的入口)
├── main.rs                         (保持不变)
│
├── models/
│   ├── mod.rs                      (模块导出)
│   └── legacy.rs                   (~200 行，数据模型)
│
├── state/
│   ├── mod.rs                      (模块导出)
│   └── app_state.rs                (~150 行，全局状态)
│
├── common/
│   ├── mod.rs                      (模块导出)
│   └── utils.rs                    (~100 行，工具函数)
│
├── services/
│   ├── mod.rs                      (模块导出)
│   ├── scanner.rs                  (~250 行，扫描解析服务)
│   ├── deduplication.rs            (~120 行，去重服务)
│   └── persistence.rs              (~200 行，持久化服务)
│
└── commands/
    ├── mod.rs                      (模块导出)
    ├── music_commands.rs           (~200 行，音乐查询命令)
    ├── directory_commands.rs       (~150 行，目录管理命令)
    ├── image_commands.rs           (~180 行，图片处理命令)
    ├── cache_commands.rs           (~130 行，缓存管理命令)
    └── window_commands.rs          (~60 行，窗口控制命令)
```

### 2.2 模块依赖关系图

```
                    ┌─────────────┐
                    │   lib.rs    │ (入口 + run())
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┬──────────────┐
            ▼              ▼              ▼              ▼
    ┌──────────────┐ ┌───────────┐ ┌──────────────┐ ┌──────────────┐
    │  commands/*  │ │ services/ │ │   models/    │ │   state/     │
    │  (Tauri命令) │ │ (业务逻辑)│ │  (数据结构)  │ │ (全局状态)   │
    └──────┬───────┘ └─────┬─────┘ └──────┬───────┘ └──────┬───────┘
           │                │               │                │
           │         ┌──────┴──────┐        │                │
           │         ▼             ▼        │                │
           │  ┌──────────┐  ┌──────────┐    │                │
           │  │ scanner  │  │deduplica-│    │                │
           │  │          │  │tion      │    │                │
           │  └────┬─────┘  └────┬─────┘    │                │
           │       │              │          │                │
           │       └──────┬───────┘          │                │
           │              ▼                  │                │
           │       ┌──────────┐             │                │
           │       │ common/  │◄────────────┘                │
           │       │  utils   │                              │
           │       └──────────┘                              │
           │                                                  │
           └──────────────────┬───────────────────────────────┘
                              ▼
                     ┌────────────────┐
                     │ state/app_state│ (所有模块共享状态)
                     └────────────────┘
```

**依赖说明：**
- `commands/` 依赖 `services/`、`state/`、`models/`、`common/`
- `services/` 依赖 `state/`、`models/`、`common/`
- `state/` 是基础层，被所有上层模块依赖
- `models/` 是纯数据定义，无外部依赖（除 serde）
- `common/` 是纯工具函数，无状态依赖

---

## 3. 各模块详细拆分规范

### 3.A 数据模型模块 → `models/legacy.rs`

**目标文件**: `src-tauri/src/models/legacy.rs`
**预估行数**: ~200 行
**职责**: 定义所有核心数据结构及其序列化方法

#### 移动内容清单

| 源位置 | 内容 | 目标位置 |
|--------|------|----------|
| L104-134 | `Song` 结构体定义 | `models/legacy.rs` |
| L136-147 | `TrackSourceInfo` 结构体定义 | `models/legacy.rs` |
| L149-154 | `Artist` 结构体定义 | `models/legacy.rs` |
| L156-161 | `impl Artist { get_songs }` | `models/legacy.rs` |
| L163-168 | `Album` 结构体定义 | `models/legacy.rs` |
| L771-825 | `impl Song { to_json }` | `models/legacy.rs` |
| L1559-1567 | `CacheSizeInfo` 结构体定义 | `models/legacy.rs` |

#### 关键接口定义

```rust
// src-tauri/src/models/legacy.rs

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::path::PathBuf;
use crate::state::app_state::{ARTIST_SONGS_MAP};

/// 音轨来源信息（简化版，用于前端传输）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackSourceInfo {
    pub id: u32,
    pub path: String,
    pub format: String,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub duration: Option<f64>,
    pub quality_score: u32,
    pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artist {
    pub id: u32,
    pub name: String,
    pub alias: Vec<String>,
}

impl Artist {
    /// 获取该艺术家的所有歌曲
    pub fn get_songs(&self) -> Vec<Song> {
        let map = ARTIST_SONGS_MAP.lock().unwrap();
        map.get(&self.id).unwrap_or(&vec![]).clone()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Album {
    pub id: u32,
    pub name: String,
    pub pic_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Song {
    pub name: String,
    pub id: u32,
    pub ar: Vec<Artist>,
    pub lyric: String,
    pub al: Album,
    pub src: PathBuf,
    pub track_number: u16,
    // 音频元数据字段
    pub duration: Option<f64>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub comment: Option<String>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub other_tags: Option<std::collections::HashMap<String, String>>,
    // 去重合并相关字段（旧格式，向后兼容）
    pub sources: Vec<TrackSourceInfo>,
    pub primary_source_index: usize,
    // Trace 来源追踪字段
    #[serde(default)]
    pub traces: Vec<crate::trace::Trace>,
    #[serde(default)]
    pub primary_trace_index: usize,
}

impl Song {
    /// 将 Song 序列化为 JSON 对象（用于前端传输）
    pub fn to_json(&self) -> JsonValue {
        json!({
            "name": self.name,
            "id": self.id,
            "ar": self.ar.iter().map(|ar| {
                json!({ "id": ar.id, "name": ar.name, "alias": ar.alias })
            }).collect::<Vec<JsonValue>>(),
            "lyric": self.lyric,
            "al": { "id": self.al.id, "name": self.al.name, "picUrl": self.al.pic_url },
            "src": self.src.display().to_string(),
            "trackNumber": self.track_number,
            "duration": self.duration,
            "genre": self.genre,
            "year": self.year,
            "comment": self.comment,
            "composer": self.composer,
            "lyricist": self.lyricist,
            "bitrate": self.bitrate,
            "sampleRate": self.sample_rate,
            "channels": self.channels,
            "otherTags": self.other_tags,
            "sources": /* ... sources 序列化 ... */,
            "primarySourceIndex": self.primary_source_index,
            "sourceCount": self.sources.len(),
            "traces": /* ... traces 序列化 ... */,
            "primaryTraceIndex": self.primary_trace_index,
            "traceCount": self.traces.len(),
        })
    }
}

/// 缓存大小信息结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheSizeInfo {
    pub total_size: u64,
    pub image_cache_size: u64,
    pub data_cache_size: u64,
    pub image_count: u32,
    pub file_count: u32,
}
```

#### 注意事项

1. **可见性修改**: 所有结构体字段需从私有改为 `pub`
2. **循环依赖**: `Artist::get_songs()` 依赖 `ARTIST_SONGS_MAP`，需要引用 `state::app_state`
3. **Trace 类型**: `Song.traces` 字段使用已有的 `crate::trace::Trace` 类型

---

### 3.B 全局状态模块 → `state/app_state.rs`

**目标文件**: `src-tauri/src/state/app_state.rs`
**预估行数**: ~150 行
**职责**: 封装所有全局静态变量为统一的状态管理结构

#### 移动内容清单

| 源位置 | 内容 | 目标位置 |
|--------|------|----------|
| L56-67 | 10个静态 Mutex 变量定义 | `state/app_state.rs` |
| L69-72 | `get_music_dirs()` 函数 | `state/app_state.rs` |

#### 关键接口定义

```rust
// src-tauri/src/state/app_state.rs

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use crate::models::legacy::{Song, Artist, Album};

// ==================== ID 计数器 ====================

pub static SONG_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));
pub static ARTIST_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));
pub static ALBUM_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

// ==================== 数据缓存 ====================

/// 音乐文件缓存：按目录路径组织歌曲列表
pub static MUSIC_CACHE: Lazy<Mutex<HashMap<PathBuf, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 艺术家缓存：按名称索引
pub static ARTIST_CACHE: Lazy<Mutex<HashMap<String, Artist>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑缓存：按名称索引
pub static ALBUM_CACHE: Lazy<Mutex<HashMap<String, Album>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ==================== 索引映射 ====================

/// 艺术家 -> 歌曲列表 映射
pub static ARTIST_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑 -> 歌曲列表 映射
pub static ALBUM_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ==================== 配置状态 ====================

/// 用户配置的音乐目录列表
pub static MUSIC_DIRS: Lazy<Mutex<Vec<PathBuf>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

/// 窗口置顶状态
pub static ALWAYS_ON_TOP_STATE: Lazy<Mutex<bool>> =
    Lazy::new(|| Mutex::new(false));

// ==================== 访问接口 ====================

/// 获取音乐目录列表的副本
pub fn get_music_dirs() -> Vec<PathBuf> {
    MUSIC_DIRS.lock().unwrap().clone()
}
```

#### 设计决策

1. **保留 Lazy 静态变量模式**: 不重构为 AppState struct，因为：
   - 改动范围过大，影响所有现有代码
   - Lazy + Mutex 在当前场景下已经足够
   - 后续可渐进式迁移到 RwLock 或 AppState struct

2. **统一导出**: 所有状态变量通过 `pub` 导出，供其他模块直接访问

---

### 3.C Tauri 命令模块

#### 3.C.1 音乐查询命令 → `commands/music_commands.rs`

**目标文件**: `src-tauri/src/commands/music_commands.rs`
**预估行数**: ~200 行
**职责**: 处理音乐库查询相关的 Tauri 命令

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L280-285 | `get_all_my_albums` | 获取所有专辑 |
| L288-292 | `get_all_my_artists` | 获取所有艺术家 |
| L296-306 | `get_music_list` | 获取音乐列表（含去重） |
| L446-453 | `get_artist_by_id` | 按 ID 获取艺术家 |
| L456-463 | `get_album_by_id` | 按 ID 获取专辑 |
| L466-472 | `get_artists_songs_by_id` | 获取艺术家的歌曲 |
| L475-481 | `get_albums_songs_by_id` | 获取专辑的歌曲 |
| L717-768 | `refresh_music_cache` | 刷新音乐缓存 |

##### 关键接口定义

```rust
// src-tauri/src/commands/music_commands.rs

use crate::models::legacy::{Song, Artist, Album};
use crate::state::app_state::*;
use crate::services::deduplication::deduplicate_songs;
use crate::services::scanner::{scan_music_files, parse_music_file, cache_music_list};

/// 获取所有专辑
#[tauri::command]
pub fn get_all_my_albums() -> Result<Vec<Album>, String> {
    let album_cache = ALBUM_CACHE.lock().unwrap();
    let albums = album_cache.values().cloned().collect();
    Ok(albums)
}

/// 获取所有艺术家
#[tauri::command]
pub fn get_all_my_artists() -> Result<Vec<Artist>, String> {
    let artist_cache = ARTIST_CACHE.lock().unwrap();
    let artists = artist_cache.values().cloned().collect();
    Ok(artists)
}

/// 获取音乐列表（执行去重合并）
#[tauri::command]
pub fn get_music_list() -> Result<Vec<Song>, String> {
    let cache = MUSIC_CACHE.lock().unwrap();
    let all_songs: Vec<Song> = cache
        .values()
        .flat_map(|songs| songs.iter().cloned())
        .collect();

    let deduplicated = deduplicate_songs(all_songs);
    Ok(deduplicated)
}

/// 按 ID 获取艺术家
#[tauri::command]
pub fn get_artist_by_id(artist_id: u32) -> Result<Artist, String> { /* ... */ }

/// 按 ID 获取专辑
#[tauri::command]
pub fn get_album_by_id(album_id: u32) -> Result<Album, String> { /* ... */ }

/// 获取艺术家的所有歌曲
#[tauri::command]
pub fn get_artists_songs_by_id(artist_id: u32) -> Result<Vec<Song>, String> { /* ... */ }

/// 获取专辑的所有歌曲
#[tauri::command]
pub fn get_albums_songs_by_id(album_id: u32) -> Result<Vec<Song>, String> { /* ... */ }

/// 刷新音乐缓存（全量重新扫描）
#[tauri::command]
pub fn refresh_music_cache() -> Result<(), String> { /* ... */ }
```

---

#### 3.C.2 目录管理命令 → `commands/directory_commands.rs`

**目标文件**: `src-tauri/src/commands/directory_commands.rs`
**预估行数**: ~150 行
**职责**: 处理音乐目录的增删查操作

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L1466-1475 | `get_all_music_dirs` | 获取所有音乐目录 |
| L1478-1492 | `remove_music_dirs` | 移除音乐目录 |
| L1495-1517 | `save_music_dirs_to_disk` | 保存目录到磁盘 |
| L1520-1547 | `load_music_dirs_from_disk` | 从磁盘加载目录 |
| L1550-1557 | `add_music_dirs` | 添加音乐目录 |
| L889-894 | `add_users_music_dir` | 添加用户默认音乐目录 |
| L897-899 | `get_users_music_dir` | 获取用户默认音乐目录 |

##### 关键接口定义

```rust
// src-tauri/src/commands/directory_commands.rs

use std::path::PathBuf;
use crate::state::app_state::*;
use crate::common::utils::get_cache_dir;

/// 获取所有已配置的音乐目录
#[tauri::command]
pub fn get_all_music_dirs() -> Result<Vec<String>, String> {
    let music_dirs = MUSIC_DIRS.lock().unwrap();
    let dirs: Vec<String> = music_dirs
        .iter()
        .map(|path| path.display().to_string())
        .collect();
    Ok(dirs)
}

/// 添加新的音乐目录
#[tauri::command]
pub fn add_music_dirs(new_dirs: Vec<String>) -> Result<(), String> {
    {
        let mut music_dirs = MUSIC_DIRS.lock().unwrap();
        music_dirs.extend(new_dirs.iter().map(PathBuf::from));
    }
    save_music_dirs_to_disk()?;
    Ok(())
}

/// 移除指定的音乐目录
#[tauri::command]
pub fn remove_music_dirs(dirs_to_remove: Vec<String>) -> Result<(), String> { /* ... */ }

/// 保存音乐目录配置到磁盘
fn save_music_dirs_to_disk() -> Result<(), String> { /* ... */ }

/// 从磁盘加载音乐目录配置
fn load_music_dirs_from_disk() -> Result<(), String> { /* ... */ }

/// 添加系统默认的用户音乐目录
#[tauri::command]
pub fn add_users_music_dir() { /* ... */ }

/// 获取系统默认的用户音乐目录路径
#[tauri::command]
pub fn get_users_music_dir() -> String { /* ... */ }
```

---

#### 3.C.3 图片处理命令 → `commands/image_commands.rs`

**目标文件**: `src-tauri/src/commands/image_commands.rs`
**预估行数**: ~180 行
**职责**: 处理专辑封面和音乐文件的获取

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L1335-1379 | `get_low_quality_album_cover` | 获取低质量封面（带缓存） |
| L1382-1416 | `get_album_cover` | 获取原始封面 |
| L1419-1463 | `get_music_file` | 获取音乐文件 |
| L171-180 | `get_cache_image_path` | 生成缓存图片路径 |
| L183-191 | `get_cache_dir` | 获取缓存目录 |
| L194-198 | `read_image_from_cache` | 从缓存读取图片 |
| L201-220 | `get_album_cover_data` | 从专辑获取封面数据 |
| L222-232 | `resize_image` | 图片缩放 |

##### 关键接口定义

```rust
// src-tauri/src/commands/image_commands.rs

use image::{DynamicImage, GenericImageView, imageops::FilterType};
use crate::models::legacy::*;
use crate::state::app_state::*;
use crate::music_tag::MetadataParser;

/// 获取低质量专辑封面（带缓存机制）
#[tauri::command]
pub async fn get_low_quality_album_cover(
    album_id: u32,
    max_resolution: u32,
) -> Result<tauri::ipc::Response, String> { /* ... */ }

/// 获取原始专辑封面（不经过缩放）
#[tauri::command]
pub fn get_album_cover(album_id: u32) -> Result<tauri::ipc::Response, String> { /* ... */ }

/// 获取音乐文件内容
#[tauri::command]
pub async fn get_music_file(song_id: u32) -> Result<tauri::ipc::Response, String> { /* ... */ }

// ==================== 辅助函数 ====================

/// 生成缓存图片的完整路径
fn get_cache_image_path(cache_dir: &PathBuf, album_id: u32, max_resolution: u32) -> PathBuf { /* ... */ }

/// 获取应用缓存目录
pub(crate) fn get_cache_dir() -> Result<PathBuf, String> { /* ... */ }

/// 从磁盘缓存读取图片
fn read_image_from_cache(path: &PathBuf) -> Result<tauri::ipc::Response, String> { /* ... */ }

/// 从专辑关联的歌曲中提取封面数据
fn get_album_cover_data(album_id: u32) -> Result<Vec<u8>, String> { /* ... */ }

/// 缩放图片到指定最大分辨率
fn resize_image(image: DynamicImage, max_resolution: u32) -> DynamicImage { /* ... */ }
```

---

#### 3.C.4 缓存管理命令 → `commands/cache_commands.rs`

**目标文件**: `src-tauri/src/commands/cache_commands.rs`
**预估行数**: ~130 行
**职责**: 处理缓存的查询、清理和重置

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L1570-1611 | `get_cache_size_info` | 获取缓存大小信息 |
| L1615-1639 | `clear_image_cache` | 清除图片缓存 |
| L1642-1673 | `reset_all_data` | 重置所有应用数据 |

##### 关键接口定义

```rust
// src-tauri/src/commands/cache_commands.rs

use crate::models::legacy::CacheSizeInfo;
use crate::state::app_state::*;
use crate::commands::image_commands::get_cache_dir;

/// 获取缓存大小统计信息
#[tauri::command]
pub fn get_cache_size_info() -> Result<CacheSizeInfo, String> { /* ... */ }

/// 清除所有图片缓存文件
#[tauri::command]
pub fn clear_image_cache() -> Result<u32, String> { /* ... */ }

/// 重置所有应用数据（内存+磁盘）
#[tauri::command]
pub fn reset_all_data() -> Result<(), String> { /* ... */ }
```

---

#### 3.C.5 窗口控制命令 → `commands/window_commands.rs`

**目标文件**: `src-tauri/src/commands/window_commands.rs`
**预估行数**: ~60 行
**职责**: 处理窗口操作命令

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L1677-1679 | `close_app` | 关闭应用 |
| L1682-1684 | `minimize_window` | 最小化窗口 |
| L1687-1693 | `toggle_maximize` | 切换最大化 |
| L1696-1706 | `toggle_always_on_top` | 切换置顶状态 |
| L67 | `ALWAYS_ON_TOP_STATE` 引用 | 窗口置顶状态变量 |

##### 关键接口定义

```rust
// src-tauri/src/commands/window_commands.rs

use crate::state::app_state::ALWAYS_ON_TOP_STATE;

/// 关闭应用程序
#[tauri::command]
pub fn close_app(window: tauri::Window) {
    window.close().unwrap();
}

/// 最小化窗口
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

/// 切换窗口最大化状态
#[tauri::command]
pub async fn toggle_maximize(window: tauri::Window) { /* ... */ }

/// 切换窗口始终置顶状态
#[tauri::command]
pub async fn toggle_always_on_top(window: tauri::Window) -> Result<bool, String> { /* ... */ }
```

---

### 3.D 业务逻辑服务模块

#### 3.D.1 扫描解析服务 → `services/scanner.rs`

**目标文件**: `src-tauri/src/services/scanner.rs`
**预估行数**: ~250 行
**职责**: 音乐文件扫描、元数据解析、缓存构建

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L272-278 | `is_music_file` | 判断是否为音乐文件 |
| L484-501 | `scan_music_files` | 递归扫描目录 |
| L503-516 | `split_artist_names` | 分割艺术家名称 |
| L519-709 | `parse_music_file` | 解析音乐文件元数据 |
| L712-714 | `cache_music_list` | 缓存音乐列表 |

##### 重构建议：将 `parse_music_file` 拆分为子函数

```rust
// src-tauri/src/services/scanner.rs

use std::fs::{self, DirEntry};
use std::path::PathBuf;
use crate::models::legacy::*;
use crate::state::app_state::*;
use crate::common::utils::{next_id, sanitize_filename};
use crate::music_tag::MetadataParser;
use crate::trace::Trace;
use crate::trace::{TraceDataType, ResourceInfo, SourceType};

/// 判断目录条目是否为支持的音乐文件
pub(crate) fn is_music_file(entry: &DirEntry) -> bool {
    matches!(
        entry.path().extension().and_then(|ext| ext.to_str()),
        Some("mp3" | "ogg" | "flac" | "m4a" | "wav" | "aac")
    )
}

/// 递归扫描目录中的所有音乐文件
pub(crate) fn scan_music_files(dir: &PathBuf) -> Vec<PathBuf> { /* ... */ }

/// 分割艺术家名称（支持 / & \ 分隔符）
pub(crate) fn split_artist_names(artists: Vec<&str>) -> Vec<&str> { /* ... } */

/// 解析单个音乐文件，提取元数据并构建 Song 对象
pub(crate) fn parse_music_file(file: PathBuf) -> Result<Song, String> {
    // 主入口，调用以下子步骤：
    // 1. resolve_metadata()     - 读取文件元数据
    // 2. resolve_artists()      - 处理艺术家信息
    // 3. resolve_album()        - 处理专辑信息
    // 4. build_source_info()    - 构建来源信息
    // 5. build_trace()          - 构建 Trace 追踪
    // 6. assemble_song()        - 组装 Song 对象
    // 7. update_index_mappings() - 更新索引映射
}

/// 将解析后的歌曲列表缓存到指定目录键下
pub(crate) fn cache_music_list(dir: PathBuf, songs: Vec<Song>) {
    MUSIC_CACHE.lock().unwrap().insert(dir, songs);
}
```

##### `parse_music_file` 内部子函数建议签名

```rust
/// 从 metadata 结果中解析标题
fn resolve_title(metadata: &crate::music_tag::ParsedMetadata, file_name: &str) -> String { /* ... */ }

/// 从 metadata 中解析艺术家列表
fn resolve_artists(
    metadata: &crate::music_tag::ParsedMetadata,
) -> Vec<Artist> { /* ... */ }

/// 从 metadata 中解析或创建专辑
fn resolve_album(metadata: &crate::music_tag::ParsedMetadata) -> Album { /* ... */ }

/// 构建音轨来源信息
fn build_source_info(
    file: &PathBuf,
    metadata: &Option<crate::music_tag::ParsedMetadata>,
) -> TrackSourceInfo { /* ... */ }

/// 构建 Trace 来源追踪对象
fn build_trace(source_info: &TrackSourceInfo, file: &PathBuf) -> Trace { /* ... */ }

/// 组装完整的 Song 对象
fn assemble_song(/* ... */) -> Song { /* ... */ }

/// 更新艺术家-歌曲 和 专辑-歌曲 的索引映射
fn update_index_mappings(song: &Song) { /* ... */ }
```

---

#### 3.D.2 去重服务 → `services/deduplication.rs`

**目标文件**: `src-tauri/src/services/deduplication.rs`
**预估行数**: ~120 行
**职责**: 歌曲去重合并逻辑

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L309-335 | `deduplicate_songs` | 主去重函数 |
| L338-350 | `generate_fingerprint` | 生成歌曲指纹 |
| L353-367 | `normalize_for_dedup` | 标准化字符串 |
| L370-402 | `merge_songs` | 合并多首相同歌曲 |
| L405-443 | `calculate_song_quality_score` | 计算音质评分 |
| L846-885 | `calculate_quality_score` | **删除**（合并到上方） |

##### 关键接口定义

```rust
// src-tauri/src/services/deduplication.rs

use crate::models::legacy::Song;

/// 对歌曲列表进行去重合并
pub(crate) fn deduplicate_songs(songs: Vec<Song>) -> Vec<Song> {
    use std::collections::HashMap;

    let mut groups: HashMap<String, Vec<Song>> = HashMap::new();

    for song in songs {
        let fingerprint = generate_fingerprint(&song);
        groups.entry(fingerprint).or_insert_with(Vec::new).push(song);
    }

    let mut result = Vec::new();
    for (_, group) in groups {
        if group.len() == 1 {
            result.push(group.into_iter().next().unwrap());
        } else {
            let merged = merge_songs(group);
            result.push(merged);
        }
    }

    result
}

/// 生成歌曲唯一指纹（用于去重分组）
fn generate_fingerprint(song: &Song) -> String { /* ... */ }

/// 标准化字符串（去除空格、特殊字符等）
fn normalize_for_dedup(s: &str) -> String { /* ... */ }

/// 合并多首相同歌曲（按音质评分排序，保留最佳版本）
fn merge_songs(mut songs: Vec<Song>) -> Song { /* ... */ }

/// 计算单首歌曲的综合音质评分
///
/// 评分规则：
/// - 比特率：最高 320 分（320kbps 满分）
/// - 格式：FLAC=500, WAV/AIFF=400, AAC/M4A=300, MP3=200, OGG=250
/// - 采样率：最高 480 分（48kHz）
/// - 时长：>3min=100, >1min=50
pub(crate) fn calculate_song_quality_score(song: &Song) -> u32 { /* ... */ }
```

##### 合并说明

原代码中有两个相似的评分函数：
- `calculate_song_quality_score(L405-443)`：接收 `&Song`，用于去重排序
- `calculate_quality_score(L846-885)`：接收独立参数，用于 `parse_music_file` 内部

**拆分后只保留 `calculate_song_quality_score`**，在 `parse_music_file` 中调用时先构造临时 Song 对象或提取公共评分逻辑。

---

#### 3.D.3 持久化服务 → `services/persistence.rs`

**目标文件**: `src-tauri/src/services/persistence.rs`
**预估行数**: ~200 行
**职责**: 应用数据的持久化存储与恢复

##### 移动内容清单

| 源位置 | 内容 | 说明 |
|--------|------|------|
| L903-947 | `init_application` | 应用初始化入口 |
| L950-971 | `load_from_persistent_cache` | 从持久化缓存加载数据 |
| L974-1153 | `rebuild_memory_cache_from_persistent` | 从缓存重建内存 |
| L1156-1170 | `save_to_persistent_cache` | 保存到持久化缓存 |
| L1173-1263 | `build_persistent_cache_from_memory` | 从内存构建持久化数据 |
| L1266-1332 | `perform_background_incremental_scan` | 后台增量扫描 |

##### 关键接口定义

```rust
// src-tauri/src/services/persistence.rs

use crate::music_library_cache::{
    MusicLibraryCacheData, LibraryCacheManager,
    CachedSongMetadata, CachedArtist, CachedAlbum, FileFingerprint
};
use crate::incremental_scanner::{IncrementalScanner, ScanResult};
use crate::performance_monitor::{PerformanceMonitor, MetricType};
use crate::models::legacy::*;
use crate::state::app_state::*;
use crate::services::scanner::{refresh_music_cache, cache_music_list};

/// 应用初始化主函数
///
/// 执行流程：
/// 1. 初始化缓存管理器
/// 2. 加载音乐目录配置
/// 3. 尝试从持久化缓存快速启动
/// 4. 若缓存无效则执行全量扫描
/// 5. 启动后台增量扫描
#[tauri::command]
pub fn init_application() { /* ... */ }

/// 从持久化缓存加载数据到内存
/// 返回 true 表示成功加载
fn load_from_persistent_cache() -> bool { /* ... */ }

/// 从持久化缓存数据重建所有内存中的 HashMap
fn rebuild_memory_cache_from_persistent(cache: &MusicLibraryCacheData) { /* ... */ }

/// 将当前内存状态保存到持久化缓存
fn save_to_persistent_cache() { /* ... */ }

/// 从当前内存状态构建 MusicLibraryCacheData
fn build_persistent_cache_from_memory() -> MusicLibraryCacheData { /* ... */ }

/// 在后台线程执行增量扫描
fn perform_background_incremental_scan() { /* ... */ }
```

##### `rebuild_memory_cache_from_persistent` 子步骤建议

当前该函数长达 180 行（L974-1153），建议进一步拆分为：

```rust
fn rebuild_memory_cache_from_persistent(cache: &MusicLibraryCacheData) {
    restore_id_counters(cache);           // 恢复 ID 计数器
    rebuild_artist_cache(cache);          // 重建艺术家缓存
    rebuild_album_cache(cache);           // 重建专辑缓存
    rebuild_music_and_indexes(cache);     // 重建歌曲缓存及映射关系
}

fn restore_id_counters(cache: &MusicLibraryCacheData) { /* ... */ }
fn rebuild_artist_cache(cache: &MusicLibraryCacheData) { /* ... */ }
fn rebuild_album_cache(cache: &MusicLibraryCacheData) { /* ... } */
fn rebuild_music_and_indexes(cache: &MusicLibraryCacheData) { /* ... */ }
```

---

### 3.E 工具函数模块 → `common/utils.rs`

**目标文件**: `src-tauri/src/common/utils.rs`
**预估行数**: ~100 行
**职责**: 提供通用的工具函数

#### 移动内容清单

| 源位置 | 内容 | 处理方式 |
|--------|------|----------|
| L266-270 | `next_id` | **保留**（通用 ID 生成器） |
| L827-831 | `next_song_id` | **删除**（与 next_id 重复） |
| L833-837 | `next_artist_id` | **删除**（与 next_id 重复） |
| L839-843 | `next_album_id` | **删除**（与 next_id 重复） |
| L236-263 | `sanitize_filename` | 移入 |
| L74-87 | `get_or_create_artist` | 移入 |
| L89-102 | `get_or_create_album` | 移入 |
| L222-232 | `resize_image` | 移入（从 image_commands 移来或保留副本） |

#### 关键接口定义

```rust
// src-tauri/src/common/utils.rs

use std::sync::Mutex;
use crate::state::app_state::{SONG_ID_COUNTER, ARTIST_ID_COUNTER, ALBUM_ID_COUNTER};
use crate::state::app_state::{ARTIST_CACHE, ALBUM_CACHE};
use crate::models::legacy::{Artist, Album};

/// 通用 ID 生成器
///
/// # Arguments
/// * `counter` - 要递增的 Mutex<u32> 计数器引用
///
/// # Returns
/// 递增后的新 ID 值
pub(crate) fn next_id(counter: &Mutex<u32>) -> u32 {
    let mut id = counter.lock().unwrap();
    *id += 1;
    *id
}

/// 清理文件名，移除非法字符
pub(crate) fn sanitize_filename(name: String) -> String { /* ... */ }

/// 获取或创建艺术家（若不存在则自动创建）
pub(crate) fn get_or_create_artist(name: String) -> Artist {
    let mut cache = ARTIST_CACHE.lock().unwrap();
    cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ARTIST_ID_COUNTER);
            Artist {
                id,
                name: name.clone(),
                alias: vec![],
            }
        })
        .clone()
}

/// 获取或创建专辑（若不存在则自动创建）
pub(crate) fn get_or_create_album(name: String) -> Album {
    let mut cache = ALBUM_CACHE.lock().unwrap();
    cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ALBUM_ID_COUNTER);
            Album {
                id,
                name: name,
                pic_url: String::new(),
            }
        })
        .clone()
}
```

---

### 3.F lib.rs 精简后的形态

**目标文件**: `src-tauri/src/lib.rs`
**预估行数**: ~200 行
**职责**: 仅作为模块声明、依赖注入和 Tauri 入口

#### 保留内容

```rust
// src-tauri/src/lib.rs (精简后)

// ==================== 外部模块引入 ====================
mod music_tag;
mod image_processor;
mod gpu_image_processor;
mod music_library_cache;
mod resource_cache;
mod incremental_scanner;
mod performance_monitor;
mod music_deduplicator;
mod trace;
mod http_proxy;
mod models;

// ==================== 内部模块声明 ====================
mod state;
mod common;
mod services;
mod commands;

// ==================== 公共导出 ====================
pub use trace::{Trace, TraceDataType, SourceType, StorageType, FetchMethod, ResourceInfo, BaseModel};
pub use http_proxy::{HttpRequest, HttpResponse, http_request, http_get, http_post};

// ==================== 使用声明 ====================
use music_tag::MetadataParser;
use image_processor::IMAGE_PROCESSOR;
use gpu_image_processor::{init_gpu_processor, resize_with_gpu_fallback};
use music_library_cache::{MusicLibraryCache as LibraryCacheManager, CachedSongMetadata, MusicLibraryCacheData};
use resource_cache::{ResourceCacheManager, ResourcePoolType, CachedResource, ResourceCacheInfo, ResourcePoolStats};
use incremental_scanner::{IncrementalScanner, ScanResult};
use performance_monitor::{PerformanceMonitor, MetricType};
use music_deduplicator::{MusicDeduplicator, MergedTrack, deduplicate_tracks};

// ==================== Tauri 入口 ====================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化缓存管理器
    let _ = LibraryCacheManager::init();
    let _ = ResourceCacheManager::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 音乐查询命令
            commands::music_commands::get_music_list,
            commands::music_commands::get_all_my_albums,
            commands::music_commands::get_all_my_artists,
            commands::music_commands::get_artist_by_id,
            commands::music_commands::get_album_by_id,
            commands::music_commands::get_artists_songs_by_id,
            commands::music_commands::get_albums_songs_by_id,
            commands::music_commands::refresh_music_cache,

            // 目录管理命令
            commands::directory_commands::get_all_music_dirs,
            commands::directory_commands::add_music_dirs,
            commands::directory_commands::remove_music_dirs,
            commands::directory_commands::add_users_music_dir,
            commands::directory_commands::get_users_music_dir,

            // 图片处理命令
            commands::image_commands::get_low_quality_album_cover,
            commands::image_commands::get_album_cover,
            commands::image_commands::get_music_file,

            // 缓存管理命令
            commands::cache_commands::get_cache_size_info,
            commands::cache_commands::clear_image_cache,
            commands::cache_commands::reset_all_data,

            // 窗口控制命令
            commands::window_commands::close_app,
            commands::window_commands::minimize_window,
            commands::window_commands::toggle_maximize,
            commands::window_commands::toggle_always_on_top,

            // 应用初始化
            commands::persistence::init_application,

            // 其他已有模块命令（保持不变）
            music_library_cache::get_library_cache_stats,
            music_library_cache::clear_library_cache,
            music_library_cache::is_library_cache_valid,
            incremental_scanner::perform_incremental_scan,
            incremental_scanner::perform_full_scan,
            performance_monitor::get_performance_stats,
            performance_monitor::get_performance_report,
            performance_monitor::reset_performance_stats,
            performance_monitor::record_resource_load,
            performance_monitor::start_performance_timer,
            performance_monitor::end_performance_timer,
            resource_cache::cache_resource,
            resource_cache::move_resource_to_preference_pool,
            resource_cache::remove_resource_from_preference_pool,
            resource_cache::get_resource_cache_info,
            resource_cache::clear_temp_resource_cache,
            resource_cache::clear_preference_resource_cache,
            resource_cache::is_resource_cached,
            resource_cache::get_cached_resource_path,
            resource_cache::cleanup_temp_resource_cache,
            resource_cache::set_resource_cache_pool_sizes,
            resource_cache::read_cached_file,
            http_proxy::http_request,
            http_proxy::http_get,
            http_proxy::http_post,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. 迁移执行计划

### 4.1 迁移顺序（避免编译错误的关键）

按照**自底向上**的原则迁移，确保每一步都能编译通过：

```
阶段 1: 无依赖的基础层（可并行）
├── 3.A models/legacy.rs          ← 纯数据定义，零依赖
├── 3.E common/utils.rs           ← 只依赖 state（但 state 此时还未创建）
└── 3.B state/app_state.rs        ← 零依赖（最基础）

阶段 2: 业务逻辑层（依赖阶段 1）
├── 3.D.2 services/deduplication.rs  ← 依赖 models
├── 3.D.1 services/scanner.rs        ← 依赖 models + state + common
└── 3.D.3 services/persistence.rs    ← 依赖上述全部

阶段 3: 命令层（依赖阶段 1+2）
├── 3.C.5 commands/window_commands.rs     ← 最简单，先做
├── 3.C.4 commands/cache_commands.rs      ← 依赖 models + state
├── 3.C.2 commands/directory_commands.rs  ← 依赖 state + common
├── 3.C.3 commands/image_commands.rs      ← 依赖较多
└── 3.C.1 commands/music_commands.rs      ← 依赖最多，最后做

阶段 4: 收尾
└── 3.F lib.rs 精简                  ← 清理原文件
```

### 4.2 各阶段详细步骤

#### 阶段 1: 基础层搭建（预计 30 分钟）

**Step 1.1**: 创建 `models/mod.rs` 和 `models/legacy.rs`
- 创建目录 `src-tauri/src/models/`
- 移动所有数据结构定义
- 修改字段可见性为 `pub`
- 创建 `mod.rs` 导出

**Step 1.2**: 创建 `state/mod.rs` 和 `state/app_state.rs`
- 创建目录 `src-tauri/src/state/`
- 移动 10 个静态变量
- 移动 `get_music_dirs()` 函数
- 创建 `mod.rs` 导出

**Step 1.3**: 创建 `common/mod.rs` 和 `common/utils.rs`
- 创建目录 `src-tauri/src/common/`
- 移动工具函数
- 删除冗余的 `next_song_id/artist_id/album_id`
- 创建 `mod.rs` 导出

**验证方法**:
```bash
cd src-tauri
cargo check
# 预期：此时 lib.rs 仍包含原始代码，应编译通过
# 新模块只是额外存在，尚未被引用
```

#### 阶段 2: 服务层迁移（预计 45 分钟）

**Step 2.1**: 创建 `services/mod.rs`, `services/deduplication.rs`
- 移动去重相关 5 个函数
- 合并 `calculate_quality_score` 到 `calculate_song_quality_score`
- 更新内部调用为 `crate::models::legacy::*`

**Step 2.2**: 创建 `services/scanner.rs`
- 移动扫描解析相关函数
- 可选：拆分 `parse_music_file` 为子函数（非必须，可在后续优化）

**Step 2.3**: 创建 `services/persistence.rs`
- 移动持久化相关 6 个函数
- 更新所有对静态变量的引用路径

**验证方法**:
```bash
cd src-tauri
cargo check
# 预期：新 services 模块编译通过
# lib.rs 中原始函数仍存在，暂不删除
```

#### 阶段 3: 命令层迁移（预计 60 分钟）

**Step 3.1**: 创建 `commands/mod.rs` 和各命令文件
- 按优先级从简到繁依次创建：
  1. `window_commands.rs`（~60 行，最简单）
  2. `cache_commands.rs`（~130 行）
  3. `directory_commands.rs`（~150 行）
  4. `image_commands.rs`（~180 行）
  5. `music_commands.rs`（~200 行，最复杂）

**Step 3.2**: 每个命令文件完成后立即验证
```bash
cd src-tauri
cargo check --lib
```

#### 阶段 4: lib.rs 精简（预计 15 分钟）

**Step 4.1**: 替换 lib.rs 为精简版本
- 保留 `mod` 声明
- 保留 `use` 语句
- 保留 `run()` 函数
- 删除所有已迁移的函数和结构体

**Step 4.2**: 最终验证
```bash
cd src-tauri
cargo build
cargo test（如果有测试）
# 运行应用手动验证功能完整性
```

---

## 5. 各阶段验证方法

### 5.1 编译验证

每个阶段完成后执行：

```powershell
# 进入 Tauri 项目目录
Set-Location c:\Users\Administrator\Documents\Code\BlurLyric-3.0\src-tauri

# 检查编译（比 build 快）
cargo check

# 完整构建（最终阶段使用）
cargo build --release

# 运行测试（如果存在）
cargo test
```

### 5.2 功能验证清单

完成全部迁移后，需逐项验证：

| 功能类别 | 验证项 | 验证方法 |
|----------|--------|----------|
| **音乐库** | 启动时自动扫描 | 启动应用，检查控制台日志 |
| | 显示歌曲列表 | 前端查看「全部音乐」页面 |
| | 按艺术家筛选 | 点击艺术家，查看关联歌曲 |
| | 按专辑筛选 | 点击专辑，查看关联歌曲 |
| | 去重合并 | 准备相同歌曲的不同格式文件，检查是否合并 |
| **目录管理** | 添加目录 | 设置页添加新目录，重启后仍存在 |
| | 移除目录 | 移除目录后对应歌曲消失 |
| **图片** | 专辑封面显示 | 查看专辑/歌曲卡片上的封面 |
| | 封面缓存 | 第二次打开同一专辑应更快 |
| **缓存** | 查看缓存大小 | 设置页查看缓存统计 |
| | 清除图片缓存 | 执行清除后检查缓存目录 |
| | 重置所有数据 | 执行重置后应用恢复初始状态 |
| **窗口** | 关闭应用 | 点击关闭按钮正常退出 |
| | 最小化 | 点击最小化按钮正常工作 |
| | 最大化切换 | 点击最大化按钮正常切换 |
| | 置顶切换 | 切换置顶后窗口行为正确 |

### 5.3 回滚策略

如果在某个阶段遇到无法解决的问题：

1. **Git 分支保护**: 始终在特性分支工作
   ```bash
   git checkout -b refactor/split-lib-rs
   ```

2. **阶段性提交**: 每个阶段完成后提交一次
   ```bash
   git add -A
   git commit -m "refactor: 完成 [阶段N] 模块拆分"
   ```

3. **快速回滚**:
   ```bash
   git checkout main  # 回到拆分前的稳定版本
   ```

---

## 6. 风险与注意事项

### 6.1 技术风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 循环依赖 | 编译失败 | 严格遵循自底向上顺序；必要时使用 `crate::` 绝对路径 |
| `pub` 可见性过度暴露 | 封装性降低 | 使用 `pub(crate)` 限制为 crate 内部可见 |
| Mutex 锁竞争 | 性能下降 | 后续可考虑迁移到 `RwLock` |
| `parse_music_file` 过长（191行） | 可读性差 | 首次迁移保持原样，后续单独优化 |

### 6.2 兼容性保证

1. **Tauri 命令签名不变**: 所有 `#[tauri::command]` 函数签名保持一致
2. **JSON 输出格式不变**: `Song::to_json()` 输出的字段名和结构完全一致
3. **全局状态变量名不变**: 方便其他已有模块（如 `music_library_cache` 等）继续引用

### 6.3 后续优化方向（不在本次范围内）

本次拆分专注于**代码组织**，不涉及以下优化（可作为后续迭代）：

- [ ] 将 `Lazy<Mutex<T>>` 重构为 `AppState` struct + `RwLock`
- [ ] 将 `parse_music_file` 拆分为更细粒度的子函数
- [ ] 引入依赖注入框架或 service locator 模式
- [ ] 为关键路径添加单元测试
- [ ] 将 `HashMap` 索引替换为更高效的数据结构

---

## 7. 总结

### 7.1 拆分前后对比

| 维度 | 拆分前 | 拆分后 |
|------|--------|--------|
| lib.rs 行数 | 1779 行 | ~200 行 |
| 最大单文件行数 | 1779 行 | ~250 行（scanner.rs） |
| 模块数量 | 1 个 | 12 个（含 mod.rs） |
| 职责清晰度 | 所有逻辑混杂 | 按功能域清晰分离 |
| 可维护性 | 困难 | 显著提升 |
| 可测试性 | 几乎不可能 | 可针对单个模块编写测试 |

### 7.2 预计工作量

| 阶段 | 预计时间 | 复杂度 |
|------|----------|--------|
| 阶段 1: 基础层 | 30 分钟 | 低 |
| 阶段 2: 服务层 | 45 分钟 | 中 |
| 阶段 3: 命令层 | 60 分钟 | 中高 |
| 阶段 4: 收尾 | 15 分钟 | 低 |
| **总计** | **~2.5 小时** | - |

### 7.3 成功标准

- [x] `cargo check` 编译通过，无 warning
- [x] `cargo build --release` 构建成功
- [x] 应用启动正常，音乐库加载完整
- [x] 所有 Tauri 命令在前端正常调用
- [x] 无功能回归（对比拆分前后行为一致）
