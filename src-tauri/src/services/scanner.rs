// 音乐文件扫描与解析服务
//
// 本模块负责：
// - 扫描指定目录下的音乐文件
// - 解析音乐文件元数据（标签信息）
// - 构建歌曲、艺术家、专辑数据结构
// - 缓存管理

use std::fs::{self, DirEntry};
use std::path::PathBuf;
use tracing::{debug, error, info, warn};

use super::deduplication::{
    deduplicate_songs, generate_fingerprint, merge_songs, normalize_for_dedup,
};
use crate::common::utils;
use crate::core::trace::{ResourceInfo, Trace, TraceDataType};
use crate::models::legacy::{Album, Artist, Song, TrackSourceInfo};
use crate::music_tag::MetadataParser;
use crate::state::*;

/// 扫描文件夹中的音乐文件（递归）
///
/// # 参数
/// - `dir`: 要扫描的目录路径
///
/// # 返回值
/// 返回找到的所有音乐文件路径列表
pub fn scan_music_files(dir: &PathBuf) -> Vec<PathBuf> {
    fs::read_dir(dir)
        .ok()
        .into_iter()
        .flat_map(|entries| {
            entries.filter_map(Result::ok).flat_map(|entry| {
                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    scan_music_files(&entry.path())
                } else if is_music_file(&entry) {
                    info!(found_file = %entry.path().display(), "Found music file");
                    vec![entry.path()]
                } else {
                    vec![]
                }
            })
        })
        .collect()
}

/// 判断文件是否为音乐文件（委托给 utils 模块）
pub fn is_music_file(entry: &DirEntry) -> bool {
    utils::is_music_file(entry)
}

/// 分割艺术家名称
///
/// 支持多种分隔符：/ & \
///
/// # 参数
/// - `artists`: 艺术家名称列表
///
/// # 返回值
/// 分割后的艺术家名称列表
pub fn split_artist_names(artists: Vec<&str>) -> Vec<&str> {
    let mut split_names = Vec::new();
    for name in artists {
        // 检查并分割特定字符
        let parts: Vec<&str> = name
            .split('/')
            .flat_map(|part| part.split('&'))
            .flat_map(|part| part.split('\\'))
            .filter(|part| !part.is_empty()) // 过滤掉空字符串
            .collect();
        split_names.extend(parts);
    }
    split_names
}

/// 解析音乐文件并提取元数据
///
/// 这是核心解析函数，负责：
/// 1. 使用 MetadataParser 读取音频标签
/// 2. 提取标题、艺术家、专辑等信息
/// 3. 创建 Song 结构体并关联 Artist 和 Album
/// 4. 构建 Trace 来源追踪信息
/// 5. 更新艺术家-歌曲和专辑-歌曲映射关系
///
/// # 参数
/// - `file`: 音乐文件路径
///
/// # 返回值
/// 成功返回 Song 对象，失败返回错误信息
pub fn parse_music_file(file: PathBuf) -> Result<Song, String> {
    // 使用新的music_tag模块读取元数据
    let parser = MetadataParser::new();
    let metadata_result = parser.parse(&file);

    // 获取文件名作为备用标题
    let file_name = file
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown Title")
        .to_string();

    // 根据元数据读取结果处理
    let song = match metadata_result {
        Ok(metadata) => {
            // 如果成功读取标签，则使用标签中的信息
            let track_number = metadata.track_number.unwrap_or(0);
            let title = if metadata.title.is_empty() {
                file_name.clone()
            } else {
                metadata.title
            };

            // 处理多个艺术家
            let artists: Vec<Artist> = if metadata.artists.is_empty() {
                vec![get_or_create_artist("Unknown Artist".to_string())]
            } else {
                metadata
                    .artists
                    .iter()
                    .flat_map(|artist| {
                        split_artist_names(vec![&artist.name])
                            .iter()
                            .map(|name| get_or_create_artist(name.to_string()))
                            .collect::<Vec<Artist>>()
                    })
                    .collect()
            };

            let album_name = if metadata.album.name.is_empty() {
                "Unknown Album".to_string()
            } else {
                metadata.album.name
            };

            let album = get_or_create_album(album_name);

            // 获取文件格式
            let format = file
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string();

            // 计算音质评分
            let quality_score = calculate_quality_score(
                metadata.bitrate,
                &format,
                metadata.sample_rate,
                metadata.duration,
            );

            // 创建来源信息
            let source_info = TrackSourceInfo {
                id: next_id(&SONG_ID_COUNTER),
                path: file.display().to_string(),
                format: format.clone(),
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                duration: metadata.duration,
                quality_score,
                file_size: std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
            };

            // 创建 Trace 来源追踪信息
            let trace = Trace::local_file(
                file.display().to_string(),
                TraceDataType::Track,
                source_info.id.to_string(),
            )
            .with_resource_info(ResourceInfo {
                format: Some(format.clone()),
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                size: Some(std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0)),
                duration: metadata.duration,
                quality_score: Some(quality_score),
            });

            Song {
                name: title,
                id: source_info.id,
                ar: artists,
                lyric: metadata.lyrics.map(|l| l.content).unwrap_or_default(),
                al: album,
                src: file,
                track_number,
                // 新增字段
                duration: metadata.duration,
                genre: metadata.genre,
                year: metadata.year,
                comment: metadata.comment,
                composer: metadata.composer,
                lyricist: metadata.lyricist,
                bitrate: metadata.bitrate,
                sample_rate: metadata.sample_rate,
                channels: metadata.channels,
                other_tags: metadata.other_tags,
                // 去重合并相关字段（旧格式，向后兼容）
                sources: vec![source_info],
                primary_source_index: 0,
                // 新格式：Trace 来源追踪
                traces: vec![trace],
                primary_trace_index: 0,
            }
        }
        Err(_) => {
            // 如果读取标签失败，则使用默认值
            let album = get_or_create_album("Unknown Album".to_string());
            let format = file
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string();

            let source_info = TrackSourceInfo {
                id: next_id(&SONG_ID_COUNTER),
                path: file.display().to_string(),
                format,
                bitrate: None,
                sample_rate: None,
                duration: None,
                quality_score: 0,
                file_size: std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0),
            };

            // 创建 Trace 来源追踪信息
            let trace = Trace::local_file(
                file.display().to_string(),
                TraceDataType::Track,
                source_info.id.to_string(),
            )
            .with_resource_info(ResourceInfo {
                format: None,
                bitrate: None,
                sample_rate: None,
                size: Some(std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0)),
                duration: None,
                quality_score: Some(0),
            });

            Song {
                name: file_name,
                id: source_info.id,
                ar: vec![get_or_create_artist("Unknown Artist".to_string())],
                lyric: String::new(),
                al: album,
                src: file,
                track_number: 0,
                duration: None,
                genre: None,
                year: None,
                comment: None,
                composer: None,
                lyricist: None,
                bitrate: None,
                sample_rate: None,
                channels: None,
                other_tags: None,
                // 去重合并相关字段（旧格式，向后兼容）
                sources: vec![source_info],
                primary_source_index: 0,
                // 新格式：Trace 来源追踪
                traces: vec![trace],
                primary_trace_index: 0,
            }
        }
    };

    {
        let mut artist_songs_map = ARTIST_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());
        let mut album_songs_map = ALBUM_SONGS_MAP.lock().unwrap_or_else(|e| e.into_inner());

        for artist in &song.ar {
            artist_songs_map
                .entry(artist.id)
                .or_insert_with(Vec::new)
                .push(song.clone());
        }

        album_songs_map
            .entry(song.al.id)
            .or_insert_with(Vec::new)
            .push(song.clone());
    }

    // 更新 O(1) 索引
    add_song_to_index(song.id, song.src.clone());
    add_album_cover_index(song.al.id, song.src.clone());

    Ok(song)
}

/// 缓存音乐列表到内存缓存
///
/// # 参数
/// - `dir`: 目录路径
/// - `songs`: 该目录下的歌曲列表
pub fn cache_music_list(dir: PathBuf, songs: Vec<Song>) {
    MUSIC_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(dir, songs);
}

/// 计算单首歌曲的音质评分（委托给 utils）
///
/// # 参数
/// - `song`: 歌曲对象
///
/// # 返回值
/// 音质评分（0-100）
pub fn calculate_song_quality_score(song: &Song) -> u32 {
    let format = song
        .src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown");
    utils::calculate_audio_quality_score(song.bitrate, format, song.sample_rate, song.duration)
}

/// 计算音质评分（委托给 utils）
///
/// # 参数
/// - `bitrate`: 比特率 (kbps)
/// - `format`: 文件格式
/// - `sample_rate`: 采样率 (Hz)
/// - `duration`: 时长（秒）
///
/// # 返回值
/// 音质评分（0-100）
pub fn calculate_quality_score(
    bitrate: Option<u32>,
    format: &str,
    sample_rate: Option<u32>,
    duration: Option<f64>,
) -> u32 {
    utils::calculate_audio_quality_score(bitrate, format, sample_rate, duration)
}

/// 从专辑获取封面数据
///
/// 遍历内存缓存中该专辑的所有歌曲，
/// 使用第一个找到的封面数据。
///
/// # 参数
/// - `album_id`: 专辑 ID
///
/// # 返回值
/// 成功返回封面图片的二进制数据，失败返回错误信息
pub fn get_album_cover_data(album_id: u32) -> Result<Vec<u8>, String> {
    let cache = MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    for songs in cache.values() {
        for song in songs {
            if song.al.id == album_id {
                // 使用新的music_tag模块读取封面
                let parser = MetadataParser::new();
                match parser.parse(&song.src) {
                    Ok(metadata) => {
                        if let Some(picture) = metadata.front_cover() {
                            return Ok(picture.data.clone());
                        }
                    }
                    Err(_) => continue,
                }
            }
        }
    }
    Err("Album cover not found".to_string())
}
