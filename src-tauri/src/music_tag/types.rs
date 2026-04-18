/**
 * MusicTag Rust模块 - 类型定义
 *
 * 定义音乐元数据相关的所有数据结构
 */
use serde::{Deserialize, Serialize};
use std::fmt;

/// 音频文件格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    MP3,
    FLAC,
    OGG,
    WAV,
    AAC,
    M4A,
    WMA,
    #[serde(rename = "unknown")]
    Unknown,
}

impl fmt::Display for AudioFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AudioFormat::MP3 => write!(f, "mp3"),
            AudioFormat::FLAC => write!(f, "flac"),
            AudioFormat::OGG => write!(f, "ogg"),
            AudioFormat::WAV => write!(f, "wav"),
            AudioFormat::AAC => write!(f, "aac"),
            AudioFormat::M4A => write!(f, "m4a"),
            AudioFormat::WMA => write!(f, "wma"),
            AudioFormat::Unknown => write!(f, "unknown"),
        }
    }
}

impl AudioFormat {
    /// 从文件扩展名检测音频格式
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "mp3" => AudioFormat::MP3,
            "flac" => AudioFormat::FLAC,
            "ogg" => AudioFormat::OGG,
            "wav" => AudioFormat::WAV,
            "aac" => AudioFormat::AAC,
            "m4a" => AudioFormat::M4A,
            "wma" => AudioFormat::WMA,
            _ => AudioFormat::Unknown,
        }
    }

    /// 获取文件扩展名
    pub fn extension(&self) -> &'static str {
        match self {
            AudioFormat::MP3 => "mp3",
            AudioFormat::FLAC => "flac",
            AudioFormat::OGG => "ogg",
            AudioFormat::WAV => "wav",
            AudioFormat::AAC => "aac",
            AudioFormat::M4A => "m4a",
            AudioFormat::WMA => "wma",
            AudioFormat::Unknown => "",
        }
    }
}

/// 元数据标准类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataStandard {
    Id3v1,
    Id3v2,
    VorbisComment,
    Ape,
    Mp4,
    Asf,
    Unknown,
}

/// 图片类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PictureType {
    Other = 0x00,
    FileIcon = 0x01,
    OtherFileIcon = 0x02,
    FrontCover = 0x03,
    BackCover = 0x04,
    LeafletPage = 0x05,
    Media = 0x06,
    LeadArtist = 0x07,
    Artist = 0x08,
    Conductor = 0x09,
    Band = 0x0A,
    Composer = 0x0B,
    Lyricist = 0x0C,
    RecordingLocation = 0x0D,
    DuringRecording = 0x0E,
    DuringPerformance = 0x0F,
    VideoScreenCapture = 0x10,
    Fish = 0x11,
    Illustration = 0x12,
    BandLogotype = 0x13,
    PublisherLogotype = 0x14,
}

impl From<u8> for PictureType {
    fn from(value: u8) -> Self {
        match value {
            0x00 => PictureType::Other,
            0x01 => PictureType::FileIcon,
            0x02 => PictureType::OtherFileIcon,
            0x03 => PictureType::FrontCover,
            0x04 => PictureType::BackCover,
            0x05 => PictureType::LeafletPage,
            0x06 => PictureType::Media,
            0x07 => PictureType::LeadArtist,
            0x08 => PictureType::Artist,
            0x09 => PictureType::Conductor,
            0x0A => PictureType::Band,
            0x0B => PictureType::Composer,
            0x0C => PictureType::Lyricist,
            0x0D => PictureType::RecordingLocation,
            0x0E => PictureType::DuringRecording,
            0x0F => PictureType::DuringPerformance,
            0x10 => PictureType::VideoScreenCapture,
            0x11 => PictureType::Fish,
            0x12 => PictureType::Illustration,
            0x13 => PictureType::BandLogotype,
            0x14 => PictureType::PublisherLogotype,
            _ => PictureType::Other,
        }
    }
}

/// 图片数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Picture {
    /// 图片MIME类型
    pub mime_type: String,
    /// 图片类型
    pub picture_type: PictureType,
    /// 图片描述
    pub description: String,
    /// 图片二进制数据
    pub data: Vec<u8>,
}

/// 艺术家信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    /// 艺术家唯一标识符
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u32>,
    /// 艺术家名称
    pub name: String,
    /// 艺术家别名列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,
}

impl Artist {
    /// 创建新的艺术家
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: None,
            name: name.into(),
            aliases: None,
        }
    }

    /// 创建带ID的艺术家
    pub fn with_id(id: u32, name: impl Into<String>) -> Self {
        Self {
            id: Some(id),
            name: name.into(),
            aliases: None,
        }
    }
}

/// 专辑信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    /// 专辑唯一标识符
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u32>,
    /// 专辑名称
    pub name: String,
    /// 专辑封面URL或路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pic_url: Option<String>,
    /// 专辑艺术家
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
    /// 发行年份
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u32>,
}

impl Album {
    /// 创建新的专辑
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: None,
            name: name.into(),
            pic_url: None,
            artist: None,
            year: None,
        }
    }

    /// 创建带ID的专辑
    pub fn with_id(id: u32, name: impl Into<String>) -> Self {
        Self {
            id: Some(id),
            name: name.into(),
            pic_url: None,
            artist: None,
            year: None,
        }
    }
}

/// 歌词信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lyrics {
    /// 歌词内容
    pub content: String,
    /// 歌词语言
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// 歌词描述
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// 音频文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFileInfo {
    /// 文件路径
    pub path: String,
    /// 文件格式
    pub format: AudioFormat,
    /// 文件大小（字节）
    pub size: u64,
    /// 最后修改时间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_time: Option<u64>,
}

/// 音乐元数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicMetadata {
    /// 歌曲标题
    pub title: String,
    /// 艺术家列表
    pub artists: Vec<Artist>,
    /// 专辑信息
    pub album: Album,
    /// 音轨号
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_number: Option<u16>,
    /// 总音轨数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tracks: Option<u16>,
    /// 碟片号
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disc_number: Option<u16>,
    /// 总碟片数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_discs: Option<u16>,
    /// 发行年份
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u32>,
    /// 流派
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    /// 歌词
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lyrics: Option<Lyrics>,
    /// 评论
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    /// 作曲家
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer: Option<String>,
    /// 作词家
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lyricist: Option<String>,
    /// 封面图片
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pictures: Option<Vec<Picture>>,
    /// 音频时长（秒）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    /// 比特率（kbps）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u32>,
    /// 采样率（Hz）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u32>,
    /// 声道数
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<u8>,
    /// 其他未识别的标签
    #[serde(skip_serializing_if = "Option::is_none")]
    pub other_tags: Option<std::collections::HashMap<String, String>>,
}

impl MusicMetadata {
    /// 创建新的元数据结构
    pub fn new(title: impl Into<String>, artists: Vec<Artist>, album: Album) -> Self {
        Self {
            title: title.into(),
            artists,
            album,
            track_number: None,
            total_tracks: None,
            disc_number: None,
            total_discs: None,
            year: None,
            genre: None,
            lyrics: None,
            comment: None,
            composer: None,
            lyricist: None,
            pictures: None,
            duration: None,
            bitrate: None,
            sample_rate: None,
            channels: None,
            other_tags: None,
        }
    }

    /// 获取主封面图片
    pub fn front_cover(&self) -> Option<&Picture> {
        self.pictures
            .as_ref()?
            .iter()
            .find(|p| p.picture_type == PictureType::FrontCover)
            .or_else(|| self.pictures.as_ref()?.first())
    }

    /// 获取艺术家名称字符串（逗号分隔）
    pub fn artists_string(&self) -> String {
        self.artists
            .iter()
            .map(|a| a.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    }

    /// 检查是否有封面图片
    pub fn has_cover(&self) -> bool {
        self.pictures
            .as_ref()
            .map(|p| !p.is_empty())
            .unwrap_or(false)
    }
}

/// 原始元数据条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMetadataEntry {
    /// 元数据键
    pub key: String,
    /// 元数据值
    pub value: String,
    /// 元数据标准类型
    pub standard: MetadataStandard,
}

/// 解析选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseOptions {
    /// 是否包含原始元数据
    #[serde(default)]
    pub include_raw: bool,
    /// 是否解析图片
    #[serde(default = "default_true")]
    pub include_pictures: bool,
    /// 是否解析歌词
    #[serde(default = "default_true")]
    pub include_lyrics: bool,
    /// 编码偏好
    #[serde(default = "default_encoding")]
    pub encoding_preference: String,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            include_raw: false,
            include_pictures: true,
            include_lyrics: true,
            encoding_preference: "UTF-8".to_string(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_encoding() -> String {
    "UTF-8".to_string()
}

/// 解析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult<T> {
    /// 是否成功
    pub success: bool,
    /// 解析结果数据
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// 错误信息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// 警告信息列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
}

impl<T> ParseResult<T> {
    /// 创建成功结果
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            warnings: None,
        }
    }

    /// 创建失败结果
    pub fn error(error: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
            warnings: None,
        }
    }

    /// 添加警告
    pub fn with_warning(mut self, warning: impl Into<String>) -> Self {
        let warnings = self.warnings.get_or_insert_with(Vec::new);
        warnings.push(warning.into());
        self
    }
}

/// 模块配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicTagConfig {
    /// 默认编码
    #[serde(default = "default_encoding")]
    pub default_encoding: String,
    /// 是否严格模式
    #[serde(default)]
    pub strict_mode: bool,
    /// 日志级别
    #[serde(default = "default_log_level")]
    pub log_level: String,
}

impl Default for MusicTagConfig {
    fn default() -> Self {
        Self {
            default_encoding: "UTF-8".to_string(),
            strict_mode: false,
            log_level: "info".to_string(),
        }
    }
}

fn default_log_level() -> String {
    "info".to_string()
}
