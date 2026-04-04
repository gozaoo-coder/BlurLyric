//! 图片/封面命令模块
//!
//! 包含专辑封面获取、图片处理、音乐文件访问等相关命令

use image::{imageops::FilterType, DynamicImage, GenericImageView};
use crate::music_tag::MetadataParser;
use crate::image_processor::IMAGE_PROCESSOR;
use crate::performance_monitor::{PerformanceMonitor, MetricType};
use std::path::PathBuf;
use std::fs;
use tokio::fs as async_fs;
use tracing::{debug, info};

use crate::common::utils;
use crate::state::*;

/// 获取低质量（压缩后）的专辑封面
#[tauri::command]
pub async fn get_low_quality_album_cover(
    album_id: u32,
    max_resolution: u32,
) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("album_cover_{}", album_id));

    let cache_dir = get_cache_dir_internal().map_err(|e| e.to_string())?;
    let cache_path = get_cache_image_path(&cache_dir, album_id, max_resolution);

    // 检查缓存是否存在
    if cache_path.exists() {
        debug!(album_id = %album_id, resolution = %max_resolution, "Cache hit for album cover");

        if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_{}", album_id)) {
            PerformanceMonitor::record_metric(
                MetricType::CacheHit,
                duration,
                format!("album_cover:{}", album_id),
            );
        }

        return read_image_from_cache(&cache_path);
    }

    // 获取封面数据
    let cover_data = get_album_cover_data(album_id).map_err(|e| e.to_string())?;

    // 使用新的图片处理器（带线程池控制）
    let processed_data = IMAGE_PROCESSOR
        .process_album_cover(cover_data, max_resolution)
        .await?;

    // 写入缓存
    fs::write(&cache_path, &processed_data).map_err(|e| e.to_string())?;

    if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_{}", album_id)) {
        PerformanceMonitor::record_metric(
            MetricType::CacheMiss,
            duration,
            format!("album_cover:{}", album_id),
        );
    }

    Ok(tauri::ipc::Response::new(processed_data))
}

/// 获取原始质量的专辑封面
#[tauri::command]
pub fn get_album_cover(album_id: u32) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("album_cover_origin_{}", album_id));

    let result = (|| {
        // 使用 O(1) 索引查找专辑封面路径
        let cover_index = ALBUM_COVER_INDEX.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        let song_path = cover_index.get(&album_id)
            .cloned()
            .ok_or_else(|| "Album cover not found".to_string())?;

        // 使用新的music_tag模块读取封面
        let parser = MetadataParser::new();
        match parser.parse(&song_path) {
            Ok(metadata) => {
                if let Some(picture) = metadata.front_cover() {
                    return Ok(tauri::ipc::Response::new(picture.data.clone()));
                }
                Err("No front cover in file".into())
            }
            Err(e) => Err(format!("Failed to parse music file: {}", e)),
        }
    })();

    if let Some(duration) = PerformanceMonitor::end_timer(&format!("album_cover_origin_{}", album_id)) {
        let from_cache = result.is_ok();
        PerformanceMonitor::record_metric(
            if from_cache { MetricType::CacheHit } else { MetricType::CacheMiss },
            duration,
            format!("album_cover_origin:{}", album_id),
        );
    }

    result
}

/// 获取音乐文件内容
#[tauri::command]
pub async fn get_music_file(song_id: u32) -> Result<tauri::ipc::Response, String> {
    PerformanceMonitor::start_timer(&format!("music_file_{}", song_id));

    debug!(song_id = %song_id, "Searching for song");

    // 使用 O(1) 索引查找歌曲路径
    let song_path = {
        let index = SONG_PATH_INDEX.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        debug!("Index locked, looking up song");
        index.get(&song_id).cloned()
    };

    // 根据找到的路径读取文件
    let result = if let Some(song_path) = song_path {
        debug!(path = %song_path.display(), "Song found, reading file");

        // 读取歌曲文件内容
        match async_fs::read(song_path).await {
            Ok(data) => {
                debug!("Song data sent to frontend");
                Ok(tauri::ipc::Response::new(data))
            }
            Err(e) => Err(format!("Failed to read music file: {}", e)),
        }
    } else {
        tracing::warn!(song_id = %song_id, "Music file not found in cache");
        Err("Music file not found".into())
    };

    if let Some(duration) = PerformanceMonitor::end_timer(&format!("music_file_{}", song_id)) {
        PerformanceMonitor::record_metric(
            MetricType::ResourceLoadTime,
            duration,
            format!("music_file:{}", song_id),
        );
    }

    result
}

/// 生成缓存图片路径
pub fn get_cache_image_path(cache_dir: &PathBuf, album_id: u32, max_resolution: u32) -> PathBuf {
    let mut path = cache_dir.clone();
    // 使用 O(1) 索引查找专辑
    let album_index = ALBUM_INDEX.lock().unwrap_or_else(|e| e.into_inner());
    let album = album_index.get(&album_id).unwrap();
    path.push(utils::sanitize_filename(format!(
        "album_{}_{}.webp",
        album.name, max_resolution
    )));
    path
}

/// 从专辑获取封面数据
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

/// 缩放图像到指定最大分辨率
pub fn resize_image(image: DynamicImage, max_resolution: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    let scale = f32::max(width as f32, height as f32) / max_resolution as f32;
    if scale > 1.0 {
        let new_width = (width as f32 / scale) as u32;
        let new_height = (height as f32 / scale) as u32;
        image.resize(new_width, new_height, FilterType::Lanczos3)
    } else {
        image
    }
}

// ==================== 辅助函数 ====================

/// 从缓存读取图片
fn read_image_from_cache(path: &PathBuf) -> Result<tauri::ipc::Response, String> {
    fs::read(path)
        .map(|data| tauri::ipc::Response::new(data))
        .map_err(|e| e.to_string())
}

/// 内部函数：获取缓存目录
fn get_cache_dir_internal() -> Result<PathBuf, String> {
    let path = utils::get_base_cache_dir()?;
    utils::ensure_cache_dir(&path)?;
    Ok(path)
}
