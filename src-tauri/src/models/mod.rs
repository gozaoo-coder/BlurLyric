//! 数据模型模块
//!
//! 统一数据模型，支持 Trace 来源追踪机制

mod album;
mod artist;
pub mod legacy;
mod track;

#[allow(unused_imports)]
pub use album::{Album, AlbumSummup};
#[allow(unused_imports)]
pub use artist::{Artist, ArtistSummup};
#[allow(unused_imports)]
pub use track::{Track, TrackSourceInfo, TrackSummup};

// 重新导出旧版数据模型（从 lib.rs 迁移）
#[allow(unused_imports)]
pub use legacy::{
    Album as LegacyAlbum, Artist as LegacyArtist, CacheSizeInfo, Song,
    TrackSourceInfo as LegacyTrackSourceInfo,
};

// 重新导出 trace 模块中的公共类型
#[allow(unused_imports)]
pub use crate::core::trace::{
    BaseModel, FetchMethod, ResourceInfo, SourceType, StorageType, Trace, TraceDataType,
};

// ==================== 转换 Trait 实现 ====================
// 第一阶段：纯后端安全改动，提供类型转换能力

use crate::cache::music_library_cache::CachedSongMetadata;
// 注意：Trace, TraceDataType, ResourceInfo 已通过上面的 pub use 导入，无需重复导入
use std::path::PathBuf;

impl From<legacy::Song> for Track {
    /// 从旧版 Song 结构体转换为新的 Track 结构体
    ///
    /// 保持 JSON 序列化输出完全一致（通过 serde rename 实现向后兼容）
    fn from(song: legacy::Song) -> Self {
        // 构建 Trace 列表
        let traces: Vec<Trace> = song
            .sources
            .iter()
            .map(|s| {
                Trace::local_file(s.path.clone(), TraceDataType::Track, s.id.to_string())
                    .with_resource_info(ResourceInfo {
                        format: Some(s.format.clone()),
                        bitrate: s.bitrate,
                        sample_rate: s.sample_rate,
                        size: Some(s.file_size),
                        duration: s.duration,
                        quality_score: Some(s.quality_score),
                    })
            })
            .collect();

        // 如果 sources 为空，从 src 创建默认 trace
        let traces = if traces.is_empty() {
            vec![Trace::local_file(
                song.src.display().to_string(),
                TraceDataType::Track,
                song.id.to_string(),
            )]
        } else {
            traces
        };

        // 转换艺术家列表为旧格式（用于向后兼容）
        let ar: Vec<track::LegacyArtist> = song
            .ar
            .iter()
            .map(|a| track::LegacyArtist {
                id: a.id,
                name: a.name.clone(),
                alias: a.alias.clone(),
            })
            .collect();

        // 转换专辑为旧格式（用于向后兼容）
        let al = Some(track::LegacyAlbum {
            id: song.al.id,
            name: song.al.name.clone(),
            pic_url: song.al.pic_url.clone(),
        });

        // 转换来源信息列表
        let sources: Vec<track::TrackSourceInfo> = song
            .sources
            .iter()
            .map(|s| track::TrackSourceInfo {
                id: s.id,
                path: s.path.clone(),
                format: s.format.clone(),
                bitrate: s.bitrate,
                sample_rate: s.sample_rate,
                duration: s.duration,
                quality_score: s.quality_score,
                file_size: s.file_size,
            })
            .collect();

        Track {
            // 新格式字段
            id: song.id.to_string(),
            name: song.name.clone(),
            duration: song.duration,
            track_number: Some(song.track_number),
            disc_number: None,
            artists: song
                .ar
                .iter()
                .map(|a| ArtistSummup {
                    id: a.id.to_string(),
                    name: a.name.clone(),
                    avatar_url: None,
                    traces: vec![],
                })
                .collect(),
            album: Some(AlbumSummup {
                id: song.al.id.to_string(),
                name: song.al.name.clone(),
                artists: vec![],
                cover_url: if song.al.pic_url.is_empty() {
                    None
                } else {
                    Some(song.al.pic_url.clone())
                },
                traces: vec![],
            }),
            traces,
            primary_trace_index: song.primary_trace_index,
            local_resource: None,
            is_liked: false,
            playlist_ids: vec![],
            genre: song.genre,
            year: song.year,
            comment: song.comment,
            composer: song.composer,
            lyricist: song.lyricist,
            bitrate: song.bitrate,
            sample_rate: song.sample_rate,
            channels: song.channels,
            lyrics: if song.lyric.is_empty() {
                None
            } else {
                Some(song.lyric.clone())
            },
            other_tags: song.other_tags,
            // 向后兼容字段（serde rename 确保输出一致）
            ar,
            al,
            lyric: song.lyric,
            src: song.src.display().to_string(),
            sources,
            primary_source_index: song.primary_source_index,
        }
    }
}

impl From<&legacy::Song> for Track {
    /// 从旧版 Song 引用转换为新的 Track 结构体
    fn from(song: &legacy::Song) -> Self {
        song.clone().into()
    }
}

impl From<CachedSongMetadata> for Track {
    /// 从缓存的歌曲元数据转换为新的 Track 结构体
    ///
    /// 用于持久化缓存加载时的数据转换
    fn from(cached: CachedSongMetadata) -> Self {
        // 从 fingerprint 创建主 trace
        let primary_trace = Trace::local_file(
            cached.fingerprint.path.display().to_string(),
            TraceDataType::Track,
            cached.id.to_string(),
        );

        // 构建来源信息
        let src = cached.fingerprint.path.display().to_string();

        Track {
            // 新格式字段
            id: cached.id.to_string(),
            name: cached.name.clone(),
            duration: cached.duration,
            track_number: Some(cached.track_number),
            disc_number: None,
            artists: cached
                .artists
                .iter()
                .map(|name| ArtistSummup {
                    id: String::new(), // 缓存中没有艺术家 ID，需要后续填充
                    name: name.clone(),
                    avatar_url: None,
                    traces: vec![],
                })
                .collect(),
            album: Some(AlbumSummup {
                id: String::new(), // 缓存中没有专辑 ID，需要后续填充
                name: cached.album.clone(),
                artists: vec![],
                cover_url: None,
                traces: vec![],
            }),
            traces: vec![primary_trace],
            primary_trace_index: 0,
            local_resource: None,
            is_liked: false,
            playlist_ids: vec![],
            genre: cached.genre,
            year: cached.year,
            comment: cached.comment,
            composer: cached.composer,
            lyricist: cached.lyricist,
            bitrate: None, // 缓存中暂无此信息
            sample_rate: None,
            channels: None,
            lyrics: if cached.lyric.is_empty() {
                None
            } else {
                Some(cached.lyric.clone())
            },
            other_tags: None,
            // 向后兼容字段
            ar: cached
                .artists
                .iter()
                .map(|name| track::LegacyArtist {
                    id: 0,
                    name: name.clone(),
                    alias: vec![],
                })
                .collect(),
            al: Some(track::LegacyAlbum {
                id: 0,
                name: cached.album.clone(),
                pic_url: String::new(),
            }),
            lyric: cached.lyric,
            src: src.clone(),
            sources: vec![track::TrackSourceInfo {
                id: cached.id,
                path: src,
                format: cached
                    .fingerprint
                    .path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown")
                    .to_string(),
                bitrate: None,
                sample_rate: None,
                duration: cached.duration,
                quality_score: 0,
                file_size: cached.fingerprint.size,
            }],
            primary_source_index: 0,
        }
    }
}
