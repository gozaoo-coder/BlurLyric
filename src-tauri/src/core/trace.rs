//! Trace - 来源追踪机制
//!
//! Trace 是所有数据模型（Track、Artist、Album）的核心追踪机制，实现以下目标：
//! - 来源追踪：记录数据来自哪个 Source
//! - 类型标识：标明数据类型（track/artist/album）
//! - 资源获取：提供获取资源的统一方法
//! - 精准跳转：根据来源和 ID 实现精准跳转

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[allow(unused_imports)]
use std::path::PathBuf;

/// 数据类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TraceDataType {
    /// 单曲
    Track,
    /// 艺人
    Artist,
    /// 专辑
    Album,
    /// 歌单
    Playlist,
}

impl Default for TraceDataType {
    fn default() -> Self {
        Self::Track
    }
}

impl TraceDataType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TraceDataType::Track => "Track",
            TraceDataType::Artist => "Artist",
            TraceDataType::Album => "Album",
            TraceDataType::Playlist => "Playlist",
        }
    }
}

/// 存储型来源
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StorageType {
    /// 本地文件 (TauriSource)
    Local,
    /// WebDAV 存储
    WebDAV,
}

impl Default for StorageType {
    fn default() -> Self {
        Self::Local
    }
}

/// 来源类型枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "storage", rename_all = "camelCase")]
pub enum SourceType {
    /// 存储型：本地文件、WebDAV 等
    Storage(StorageType),
    /// API 型（不硬编码具体平台）
    Api,
}

impl SourceType {
    /// 检查是否为存储型来源
    pub fn is_storage(&self) -> bool {
        matches!(self, SourceType::Storage(_))
    }

    /// 检查是否为 API 型来源
    pub fn is_api(&self) -> bool {
        matches!(self, SourceType::Api)
    }

    /// 检查是否为本地文件
    pub fn is_local(&self) -> bool {
        matches!(self, SourceType::Storage(StorageType::Local))
    }

    /// 检查是否为 WebDAV
    pub fn is_webdav(&self) -> bool {
        matches!(self, SourceType::Storage(StorageType::WebDAV))
    }
}

impl Default for SourceType {
    fn default() -> Self {
        Self::Storage(StorageType::Local)
    }
}

/// 资源获取方法
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "params", rename_all = "camelCase")]
pub enum FetchMethod {
    /// 本地文件：直接读取
    LocalFile { path: String },
    /// 需要下载：从 URL 下载到本地
    Download { url: String, format: String },
    /// 流式播放：直接流式访问（不推荐）
    Stream { url: String },
    /// 需要 API 调用：通过 API 获取
    ApiCall {
        endpoint: String,
        params: HashMap<String, String>,
    },
}

impl Default for FetchMethod {
    fn default() -> Self {
        Self::LocalFile {
            path: String::new(),
        }
    }
}

/// 资源元信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInfo {
    /// 格式 (mp3/flac 等)
    pub format: Option<String>,
    /// 比特率
    pub bitrate: Option<u32>,
    /// 采样率
    pub sample_rate: Option<u32>,
    /// 文件大小
    pub size: Option<u64>,
    /// 时长
    pub duration: Option<f64>,
    /// 音质评分
    pub quality_score: Option<u32>,
}

/// Trace - 来源追踪信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Trace {
    // ========== 来源标识 ==========
    /// 来源类型
    pub source_type: SourceType,
    /// 来源唯一标识（用户自定义，如 "my-music-api-1"）
    pub source_id: String,
    /// 来源名称（显示用，如 "我的音乐 API"）
    pub source_name: String,
    /// 数据类型
    pub data_type: TraceDataType,

    // ========== API 源配置（仅 Api 类型需要）==========
    /// API 基础 URL（符合接口规范即可接入）
    pub base_url: Option<String>,

    // ========== 数据标识 ==========
    /// 数据在该来源中的唯一 ID
    pub data_id: String,
    /// 数据在该来源中的 URL（可选）
    pub data_url: Option<String>,

    // ========== 资源信息 ==========
    /// 资源获取方法
    pub fetch_method: FetchMethod,
    /// 资源元信息
    pub resource_info: Option<ResourceInfo>,

    // ========== 扩展元数据 ==========
    /// 平台特有元数据（通用 KV 结构）
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Trace {
    /// 创建本地文件 Trace
    pub fn local_file(
        path: impl Into<String>,
        data_type: TraceDataType,
        data_id: impl Into<String>,
    ) -> Self {
        Trace {
            source_type: SourceType::Storage(StorageType::Local),
            source_id: "local".to_string(),
            source_name: "本地音乐库".to_string(),
            data_type,
            base_url: None,
            data_id: data_id.into(),
            data_url: None,
            fetch_method: FetchMethod::LocalFile { path: path.into() },
            resource_info: None,
            metadata: HashMap::new(),
        }
    }

    /// 创建 WebDAV Trace
    pub fn webdav(
        source_id: impl Into<String>,
        source_name: impl Into<String>,
        data_type: TraceDataType,
        data_id: impl Into<String>,
        path: impl Into<String>,
    ) -> Self {
        Trace {
            source_type: SourceType::Storage(StorageType::WebDAV),
            source_id: source_id.into(),
            source_name: source_name.into(),
            data_type,
            base_url: None,
            data_id: data_id.into(),
            data_url: Some(path.into()),
            fetch_method: FetchMethod::LocalFile {
                path: String::new(),
            },
            resource_info: None,
            metadata: HashMap::new(),
        }
    }

    /// 创建 API 来源 Trace
    pub fn api_source(
        source_id: impl Into<String>,
        source_name: impl Into<String>,
        base_url: impl Into<String>,
        data_type: TraceDataType,
        data_id: impl Into<String>,
        fetch_method: FetchMethod,
    ) -> Self {
        Trace {
            source_type: SourceType::Api,
            source_id: source_id.into(),
            source_name: source_name.into(),
            data_type,
            base_url: Some(base_url.into()),
            data_id: data_id.into(),
            data_url: None,
            fetch_method,
            resource_info: None,
            metadata: HashMap::new(),
        }
    }

    /// 检查是否为存储型来源
    pub fn is_storage(&self) -> bool {
        self.source_type.is_storage()
    }

    /// 检查是否为 API 型来源
    pub fn is_api(&self) -> bool {
        self.source_type.is_api()
    }

    /// 检查是否为本地文件
    pub fn is_local(&self) -> bool {
        self.source_type.is_local()
    }

    /// 检查是否为 WebDAV
    pub fn is_webdav(&self) -> bool {
        self.source_type.is_webdav()
    }

    /// 设置资源信息
    pub fn with_resource_info(mut self, info: ResourceInfo) -> Self {
        self.resource_info = Some(info);
        self
    }

    /// 添加元数据
    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata.insert(key.into(), value);
        self
    }
}

/// BaseModel - 数据模型基础特征
pub trait BaseModel: Serialize + for<'de> Deserialize<'de> + Clone + Send + Sync {
    /// 获取唯一 ID
    fn id(&self) -> &str;

    /// 获取名称
    fn name(&self) -> &str;

    /// 获取所有 Trace
    fn traces(&self) -> &[Trace];

    /// 添加 Trace
    fn add_trace(&mut self, trace: Trace);

    /// 获取主 Trace
    fn primary_trace(&self) -> Option<&Trace> {
        self.traces().first()
    }

    /// 根据来源类型获取 Trace
    fn get_trace_by_source(&self, source_type: &SourceType) -> Option<&Trace> {
        self.traces().iter().find(|t| &t.source_type == source_type)
    }

    /// 获取本地资源 Trace（优先）
    fn get_local_trace(&self) -> Option<&Trace> {
        self.traces().iter().find(|t| t.is_storage())
    }

    /// 检查是否有本地资源
    fn has_local_resource(&self) -> bool {
        self.traces().iter().any(|t| t.is_storage())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trace_local_file() {
        let trace = Trace::local_file("/path/to/music.mp3", TraceDataType::Track, "123");

        assert!(trace.is_local());
        assert!(trace.is_storage());
        assert!(!trace.is_api());
        assert_eq!(trace.source_id, "local");
        assert_eq!(trace.source_name, "本地音乐库");
    }

    #[test]
    fn test_trace_api_source() {
        let trace = Trace::api_source(
            "my-api-1",
            "我的音乐 API",
            "https://api.example.com",
            TraceDataType::Track,
            "track-123",
            FetchMethod::Download {
                url: "https://api.example.com/track/123/file".to_string(),
                format: "mp3".to_string(),
            },
        );

        assert!(trace.is_api());
        assert!(!trace.is_storage());
        assert_eq!(trace.base_url, Some("https://api.example.com".to_string()));
    }

    #[test]
    fn test_trace_serialization() {
        let trace = Trace::local_file("/path/to/music.mp3", TraceDataType::Track, "123");
        let json = serde_json::to_string(&trace).unwrap();

        // 验证序列化包含 camelCase 字段
        assert!(json.contains("sourceType"));
        assert!(json.contains("sourceId"));
        assert!(json.contains("dataType"));
    }
}
