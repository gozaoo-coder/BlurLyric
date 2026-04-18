//! 旧版数据模型（Legacy Models）
//!
//! 从 lib.rs 中提取的传统数据结构定义，用于向后兼容
//! 这些结构体使用 pub 可见性以支持跨模块访问
//!
//! # Deprecated
//!
//! **⚠️ 此模块已标记为 deprecated，将在未来版本中移除**
//!
//! 请使用新的统一数据模型替代：
//! - `Song` → 使用 [`crate::models::Track`](super::track::Track)
//! - `Artist` → 使用 [`crate::models::artist::Artist`](super::artist::Artist)
//! - `Album` → 使用 [`crate::models::album::Album`](super::album::Album)
//! - `TrackSourceInfo` → 使用 [`crate::models::track::TrackSourceInfo`](super::track::TrackSourceInfo)
//!
//! 转换方式：使用 `From<Song> for Track` trait 进行类型转换

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::core::trace::Trace;
use crate::state;

// ==================== Song 相关结构体 ====================

/// 歌曲信息
///
/// # Deprecated
///
/// ⚠️ **此结构体已废弃，请使用 [`super::track::Track`](super::track::Track) 替代**
///
/// 可以通过 `Into<Track>` 或 `Track::from(song)` 进行转换
#[deprecated(
    since = "3.1.0",
    note = "Use crate::models::Track instead. Convert using: Track::from(song) or song.into()"
)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Song {
    /// 歌曲名称
    pub name: String,
    /// 唯一标识符
    pub id: u32,
    /// 艺术家列表
    pub ar: Vec<Artist>,
    /// 歌词内容
    pub lyric: String,
    /// 所属专辑
    pub al: Album,
    /// 音频文件源路径
    pub src: PathBuf,
    /// 曲目编号
    pub track_number: u16,
    // ========== 音频属性字段 ==========
    /// 音频时长（秒）
    pub duration: Option<f64>,
    /// 音乐流派
    pub genre: Option<String>,
    /// 发行年份
    pub year: Option<u32>,
    /// 评论信息
    pub comment: Option<String>,
    /// 作曲家
    pub composer: Option<String>,
    /// 作词家
    pub lyricist: Option<String>,
    /// 比特率（kbps）
    pub bitrate: Option<u32>,
    /// 采样率（Hz）
    pub sample_rate: Option<u32>,
    /// 声道数
    pub channels: Option<u8>,
    /// 其他标签信息
    pub other_tags: Option<HashMap<String, String>>,

    // ========== 去重合并相关字段（旧格式，向后兼容） ==========
    /// 所有来源（包括主来源和替代来源）
    pub sources: Vec<TrackSourceInfo>,
    /// 主来源在 sources 中的索引
    pub primary_source_index: usize,

    // ========== Trace 来源追踪字段（新格式） ==========
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
    /// 主来源索引（新格式）
    #[serde(default)]
    pub primary_trace_index: usize,
}

impl Song {
    /// 将 Song 结构体转换为 JSON 值
    ///
    /// # Deprecated
    ///
    /// ⚠️ 此方法已废弃，建议直接使用 `Track::from(song)` 转换后序列化
    ///
    /// 用于向前端传输标准化的歌曲数据格式
    #[deprecated(
        since = "3.1.0",
        note = "Use Track::from(song) instead, then serialize the Track"
    )]
    pub fn to_json(&self) -> serde_json::Value {
        use serde_json::{json, Value as JsonValue};

        json!({
            "name": self.name,
            "id": self.id,
            "ar": self.ar.iter().map(|ar| {
                json!({
                    "id": ar.id,
                    "name": ar.name,
                    "alias": ar.alias,
                })
            }).collect::<Vec<JsonValue>>(),
            "lyric": self.lyric,
            "al": {
                "id": self.al.id,
                "name": self.al.name,
                "picUrl": self.al.pic_url,
            },
            "src": self.src.display().to_string(),
            "trackNumber": self.track_number,
            // 音频属性字段
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
            // 去重合并相关字段（旧格式，向后兼容）
            "sources": self.sources.iter().map(|s| {
                json!({
                    "id": s.id,
                    "path": s.path,
                    "format": s.format,
                    "bitrate": s.bitrate,
                    "sampleRate": s.sample_rate,
                    "duration": s.duration,
                    "qualityScore": s.quality_score,
                    "fileSize": s.file_size,
                })
            }).collect::<Vec<JsonValue>>(),
            "primarySourceIndex": self.primary_source_index,
            "sourceCount": self.sources.len(),
            // 新格式：Trace 来源追踪
            "traces": self.traces.iter().map(|t| {
                serde_json::to_value(t).unwrap_or(json!(null))
            }).collect::<Vec<JsonValue>>(),
            "primaryTraceIndex": self.primary_trace_index,
            "traceCount": self.traces.len(),
        })
    }
}

/// 音轨来源信息（简化版，用于前端传输）
///
/// # Deprecated
///
/// ⚠️ **此结构体已废弃，请使用 [`super::track::TrackSourceInfo`](super::track::TrackSourceInfo) 替代**
#[deprecated(
    since = "3.1.0",
    note = "Use crate::models::track::TrackSourceInfo instead"
)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackSourceInfo {
    /// 来源唯一标识符
    pub id: u32,
    /// 文件路径
    pub path: String,
    /// 文件格式（如 mp3, flac 等）
    pub format: String,
    /// 比特率（kbps）
    pub bitrate: Option<u32>,
    /// 采样率（Hz）
    pub sample_rate: Option<u32>,
    /// 时长（秒）
    pub duration: Option<f64>,
    /// 音质评分
    pub quality_score: u32,
    /// 文件大小（字节）
    pub file_size: u64,
}

// ==================== Artist 结构体 ====================

/// 艺术家信息
///
/// # Deprecated
///
/// ⚠️ **此结构体已废弃，请使用 [`super::artist::Artist`](super::artist::Artist) 替代**
#[deprecated(since = "3.1.0", note = "Use crate::models::artist::Artist instead")]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artist {
    /// 唯一标识符
    pub id: u32,
    /// 艺术家名称
    pub name: String,
    /// 别名列表
    pub alias: Vec<String>,
}

impl Artist {
    /// 获取该艺术家的所有歌曲
    ///
    /// # Deprecated
    ///
    /// ⚠️ 此方法已废弃，建议使用新的查询 API
    ///
    /// 通过查询全局艺术家-歌曲映射表获取关联的歌曲列表
    ///
    /// # Returns
    /// 属于该艺术家的歌曲向量（如果没有则为空向量）
    #[deprecated(since = "3.1.0", note = "Use new artist query API instead")]
    pub fn get_songs(&self) -> Vec<Song> {
        let map = state::ARTIST_SONGS_MAP
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        map.get(&self.id).unwrap_or(&vec![]).clone()
    }
}

// ==================== Album 结构体 ====================

/// 专辑信息
///
/// # Deprecated
///
/// ⚠️ **此结构体已废弃，请使用 [`super::album::Album`](super::album::Album) 替代**
#[deprecated(since = "3.1.0", note = "Use crate::models::album::Album instead")]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Album {
    /// 唯一标识符
    pub id: u32,
    /// 专辑名称
    pub name: String,
    /// 封面图片 URL
    pub pic_url: String,
}

// ==================== 缓存管理相关结构体 ====================

/// 缓存大小信息
///
/// 用于统计和展示应用程序缓存的使用情况
///
/// # Deprecated
///
/// ⚠️ **此结构体可能在未来版本中重构**
#[deprecated(
    since = "3.1.0",
    note = "This struct may be refactored in future versions"
)]
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheSizeInfo {
    /// 总缓存大小（字节）
    pub total_size: u64,
    /// 图片缓存大小（字节）
    pub image_cache_size: u64,
    /// 数据缓存大小（字节）
    pub data_cache_size: u64,
    /// 图片缓存文件数量
    pub image_count: u32,
    /// 总文件数量
    pub file_count: u32,
}
