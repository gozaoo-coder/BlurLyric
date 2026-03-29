//! Album - 专辑数据模型

use serde::{Deserialize, Serialize};
use crate::trace::{Trace, BaseModel};

/// Album - 专辑完整信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    // ========== 基本信息 ==========
    /// 本地唯一 ID
    pub id: String,
    /// 专辑名称
    pub name: String,
    /// 发行年份
    pub year: Option<u32>,

    // ========== 来源追踪 ==========
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
    /// 主来源索引
    #[serde(default)]
    pub primary_trace_index: usize,

    // ========== 关联数据 ==========
    /// 艺术家列表（摘要）
    #[serde(default)]
    pub artists: Vec<super::ArtistSummup>,
    /// 曲目列表（摘要）
    #[serde(default)]
    pub tracks: Vec<super::TrackSummup>,
    /// 曲目数量
    #[serde(default)]
    pub track_count: u32,

    // ========== 资源 ==========
    /// 封面 URL
    pub cover_url: Option<String>,
    /// 本地封面资源
    pub local_cover: Option<LocalCoverInfo>,
    
    // ========== 向后兼容字段 ==========
    /// 封面图片 URL（旧格式）
    #[serde(default)]
    #[serde(rename = "picUrl")]
    pub pic_url: String,
}

/// 本地封面资源信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LocalCoverInfo {
    /// 本地文件路径
    pub path: String,
    /// 缓存时间
    pub cached_at: u64,
}

/// AlbumSummup - 专辑摘要
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AlbumSummup {
    /// 本地唯一 ID
    pub id: String,
    /// 专辑名称
    pub name: String,
    /// 艺术家名称列表
    #[serde(default)]
    pub artists: Vec<String>,
    /// 封面 URL
    pub cover_url: Option<String>,
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
}

impl Album {
    /// 创建新 Album
    #[allow(dead_code)]
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Album {
            id: id.into(),
            name: name.into(),
            ..Default::default()
        }
    }

    /// 从旧格式创建
    #[allow(dead_code)]
    pub fn from_legacy(id: u32, name: String, pic_url: String) -> Self {
        Album {
            id: id.to_string(),
            name,
            cover_url: if pic_url.is_empty() { None } else { Some(pic_url.clone()) },
            pic_url,
            ..Default::default()
        }
    }

    /// 转换为摘要
    #[allow(dead_code)]
    pub fn to_summup(&self) -> AlbumSummup {
        AlbumSummup {
            id: self.id.clone(),
            name: self.name.clone(),
            artists: self.artists.iter().map(|a| a.name.clone()).collect(),
            cover_url: self.cover_url.clone(),
            traces: self.traces.clone(),
        }
    }
}

impl BaseModel for Album {
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

impl BaseModel for AlbumSummup {
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
