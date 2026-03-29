//! Artist - 艺人数据模型

use serde::{Deserialize, Serialize};
use crate::trace::{Trace, BaseModel};

/// Artist - 艺人完整信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    // ========== 基本信息 ==========
    /// 本地唯一 ID
    pub id: String,
    /// 艺人名称
    pub name: String,
    /// 别名列表
    #[serde(default)]
    pub aliases: Vec<String>,
    /// 简介
    pub bio: Option<String>,

    // ========== 来源追踪 ==========
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
    /// 主来源索引
    #[serde(default)]
    pub primary_trace_index: usize,

    // ========== 关联数据 ==========
    /// 专辑列表（摘要）
    #[serde(default)]
    pub albums: Vec<super::AlbumSummup>,
    /// 热门歌曲（摘要）
    #[serde(default)]
    pub top_tracks: Vec<super::TrackSummup>,

    // ========== 资源 ==========
    /// 头像 URL
    pub avatar_url: Option<String>,
    /// 本地头像资源
    pub local_avatar: Option<LocalAvatarInfo>,
    
    // ========== 向后兼容字段 ==========
    /// 别名（旧格式）
    #[serde(default)]
    pub alias: Vec<String>,
}

/// 本地头像资源信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LocalAvatarInfo {
    /// 本地文件路径
    pub path: String,
    /// 缓存时间
    pub cached_at: u64,
}

/// ArtistSummup - 艺人摘要
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArtistSummup {
    /// 本地唯一 ID
    pub id: String,
    /// 艺人名称
    pub name: String,
    /// 头像 URL
    pub avatar_url: Option<String>,
    /// 所有来源 Trace
    #[serde(default)]
    pub traces: Vec<Trace>,
}

impl Artist {
    /// 创建新 Artist
    #[allow(dead_code)]
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Artist {
            id: id.into(),
            name: name.into(),
            ..Default::default()
        }
    }

    /// 从旧格式创建
    #[allow(dead_code)]
    pub fn from_legacy(id: u32, name: String, alias: Vec<String>) -> Self {
        Artist {
            id: id.to_string(),
            name,
            aliases: alias.clone(),
            alias,
            ..Default::default()
        }
    }

    /// 转换为摘要
    #[allow(dead_code)]
    pub fn to_summup(&self) -> ArtistSummup {
        ArtistSummup {
            id: self.id.clone(),
            name: self.name.clone(),
            avatar_url: self.avatar_url.clone(),
            traces: self.traces.clone(),
        }
    }
}

impl BaseModel for Artist {
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

impl BaseModel for ArtistSummup {
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
