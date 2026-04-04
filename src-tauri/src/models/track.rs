//! Track - 单曲数据模型

use serde::{Deserialize, Serialize};
use crate::trace::{Trace, TraceDataType, BaseModel};

/// TrackSourceInfo - 音轨来源信息（简化版，用于前端传输和向后兼容）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackSourceInfo {
    /// 来源 ID
    pub id: u32,
    /// 文件路径
    pub path: String,
    /// 格式
    pub format: String,
    /// 比特率
    pub bitrate: Option<u32>,
    /// 采样率
    pub sample_rate: Option<u32>,
    /// 时长
    pub duration: Option<f64>,
    /// 音质评分
    pub quality_score: u32,
    /// 文件大小
    pub file_size: u64,
}

/// Track - 单曲完整信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    // ========== 基本信息 ==========
    /// 本地唯一 ID（系统生成）
    pub id: String,
    /// 歌曲名称
    pub name: String,
    /// 时长(秒)
    pub duration: Option<f64>,
    /// 音轨号
    pub track_number: Option<u16>,
    /// 碟片号
    pub disc_number: Option<u16>,

    // ========== 关联数据（摘要形式）==========
    /// 艺术家列表（摘要）
    #[serde(default)]
    pub artists: Vec<super::ArtistSummup>,
    /// 专辑（摘要）
    pub album: Option<super::AlbumSummup>,

    // ========== 来源追踪（核心）==========
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
    /// 主来源索引
    #[serde(default)]
    pub primary_trace_index: usize,

    // ========== 本地资源状态 ==========
    /// 本地资源信息（已缓存时）
    pub local_resource: Option<LocalResourceInfo>,

    // ========== 用户偏好状态 ==========
    /// 是否已收藏
    #[serde(default)]
    pub is_liked: bool,
    /// 所属歌单 ID 列表
    #[serde(default)]
    pub playlist_ids: Vec<String>,

    // ========== 扩展元数据 ==========
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub comment: Option<String>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub lyrics: Option<String>,
    /// 其他标签信息（键值对）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub other_tags: Option<std::collections::HashMap<String, String>>,
    
    // ========== 向后兼容字段 ==========
    /// 艺术家列表（旧格式，用于前端兼容）
    #[serde(rename = "ar", default)]
    pub ar: Vec<LegacyArtist>,
    /// 专辑（旧格式）
    #[serde(rename = "al")]
    pub al: Option<LegacyAlbum>,
    /// 歌词（旧格式）
    #[serde(rename = "lyric", default)]
    pub lyric: String,
    /// 来源路径（旧格式）
    #[serde(rename = "src", default)]
    pub src: String,
    /// 来源信息列表（旧格式，用于去重合并）
    #[serde(default)]
    pub sources: Vec<TrackSourceInfo>,
    /// 主来源索引（旧格式）
    #[serde(default)]
    pub primary_source_index: usize,
}

/// 本地资源信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LocalResourceInfo {
    /// 本地文件路径
    pub path: String,
    /// 缓存时间
    pub cached_at: u64,
    /// 缓存类型
    pub cache_type: CacheType,
    /// 文件大小
    pub size: u64,
    /// 格式
    pub format: String,
}

/// 缓存类型
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum CacheType {
    /// 临时缓存池
    #[default]
    Temp,
    /// 用户偏好池
    Preference,
}

/// TrackSummup - 单曲摘要（用于列表展示）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackSummup {
    /// 本地唯一 ID
    pub id: String,
    /// 歌曲名称
    pub name: String,
    /// 艺术家名称列表
    #[serde(default)]
    pub artists: Vec<String>,
    /// 专辑名称
    pub album: Option<String>,
    /// 时长
    pub duration: Option<f64>,

    // ========== 来源追踪 ==========
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
    /// 主来源索引
    #[serde(default)]
    pub primary_trace_index: usize,
}

/// 旧格式艺术家（向后兼容）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyArtist {
    pub id: u32,
    pub name: String,
    #[serde(default)]
    pub alias: Vec<String>,
}

/// 旧格式专辑（向后兼容）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyAlbum {
    pub id: u32,
    pub name: String,
    #[serde(default)]
    #[serde(rename = "picUrl")]
    pub pic_url: String,
}

impl Track {
    /// 创建新 Track
    #[allow(dead_code)]
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Track {
            id: id.into(),
            name: name.into(),
            ..Default::default()
        }
    }

    /// 添加来源 Trace
    #[allow(dead_code)]
    pub fn add_trace_item(mut self, trace: Trace) -> Self {
        self.traces.push(trace);
        self
    }

    /// 获取主 Trace
    #[allow(dead_code)]
    pub fn primary_trace(&self) -> Option<&Trace> {
        self.traces.get(self.primary_trace_index)
    }

    /// 转换为摘要
    #[allow(dead_code)]
    pub fn to_summup(&self) -> TrackSummup {
        TrackSummup {
            id: self.id.clone(),
            name: self.name.clone(),
            artists: self.artists.iter().map(|a| a.name.clone()).collect(),
            album: self.album.as_ref().map(|a| a.name.clone()),
            duration: self.duration,
            traces: self.traces.clone(),
            primary_trace_index: self.primary_trace_index,
        }
    }

    /// 从旧格式 Song 创建 Track
    #[allow(dead_code)]
    pub fn from_legacy_song(
        id: u32,
        name: String,
        artists: Vec<LegacyArtist>,
        album: Option<LegacyAlbum>,
        src: String,
        track_number: u16,
        lyric: String,
        duration: Option<f64>,
        genre: Option<String>,
        year: Option<u32>,
        comment: Option<String>,
        composer: Option<String>,
        lyricist: Option<String>,
        bitrate: Option<u32>,
        sample_rate: Option<u32>,
        channels: Option<u8>,
        other_tags: Option<std::collections::HashMap<String, String>>,
        sources: Vec<TrackSourceInfo>,
        primary_source_index: usize,
    ) -> Self {
        // 创建 Trace
        let trace = Trace::local_file(&src, TraceDataType::Track, id.to_string());
        
        Track {
            id: id.to_string(),
            name,
            duration,
            track_number: Some(track_number),
            disc_number: None,
            artists: artists.iter().map(|a| super::ArtistSummup {
                id: a.id.to_string(),
                name: a.name.clone(),
                avatar_url: None,
                traces: vec![],
            }).collect(),
            album: album.as_ref().map(|a| super::AlbumSummup {
                id: a.id.to_string(),
                name: a.name.clone(),
                artists: vec![],
                cover_url: if a.pic_url.is_empty() { None } else { Some(a.pic_url.clone()) },
                traces: vec![],
            }),
            traces: vec![trace],
            primary_trace_index: 0,
            local_resource: None,
            is_liked: false,
            playlist_ids: vec![],
            genre,
            year,
            comment,
            composer,
            lyricist,
            bitrate,
            sample_rate,
            channels,
            lyrics: if lyric.is_empty() { None } else { Some(lyric.clone()) },
            other_tags,
            // 向后兼容字段
            ar: artists,
            al: album,
            lyric,
            src,
            sources,
            primary_source_index,
        }
    }
}

impl BaseModel for Track {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn traces(&self) -> &[Trace] {
        &self.traces
    }

    fn add_trace(&mut self, trace: Trace) {
        self.traces.push(trace);
    }
}

impl BaseModel for TrackSummup {
    fn id(&self) -> &str {
        &self.id
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn traces(&self) -> &[Trace] {
        &self.traces
    }

    fn add_trace(&mut self, trace: Trace) {
        self.traces.push(trace);
    }
}
