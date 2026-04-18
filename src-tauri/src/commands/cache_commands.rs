//! 缓存管理命令模块
//!
//! 包含缓存大小查询、清理和重置等功能

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::info;

use crate::common::utils;
use crate::state::*;

/// 缓存大小信息结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheSizeInfo {
    pub total_size: u64,
    pub image_cache_size: u64,
    pub data_cache_size: u64,
    pub image_count: u32,
    pub file_count: u32,
}

/// 获取缓存大小信息
#[tauri::command]
pub fn get_cache_size_info() -> Result<CacheSizeInfo, String> {
    let cache_dir = get_cache_dir_internal()?;

    let mut total_size = 0u64;
    let mut image_cache_size = 0u64;
    let mut data_cache_size = 0u64;
    let mut image_count = 0u32;
    let mut file_count = 0u32;

    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    let size = metadata.len();
                    total_size += size;
                    file_count += 1;

                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    if file_name.starts_with("album_") && file_name.ends_with(".webp") {
                        image_cache_size += size;
                        image_count += 1;
                    } else {
                        data_cache_size += size;
                    }
                }
            }
        }
    }

    Ok(CacheSizeInfo {
        total_size,
        image_cache_size,
        data_cache_size,
        image_count,
        file_count,
    })
}

/// 清除图片缓存（仅删除缩略图）
#[tauri::command]
pub fn clear_image_cache() -> Result<u32, String> {
    let cache_dir = get_cache_dir_internal()?;
    let mut deleted_count = 0u32;

    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                if file_name.starts_with("album_") && file_name.ends_with(".webp") {
                    fs::remove_file(&path)
                        .map_err(|e| format!("Failed to delete {}: {}", file_name, e))?;
                    deleted_count += 1;
                }
            }
        }
    }

    info!(deleted_count = deleted_count, "Cleared image cache files");
    Ok(deleted_count)
}

/// 重置所有应用数据（清空缓存和内存数据）
#[tauri::command]
pub fn reset_all_data() -> Result<(), String> {
    let cache_dir = get_cache_dir_internal()?;

    // 1. 清空内存缓存
    *SONG_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ARTIST_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    *ALBUM_ID_COUNTER
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))? = 0;
    MUSIC_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ARTIST_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ALBUM_CACHE
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ARTIST_SONGS_MAP
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    ALBUM_SONGS_MAP
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();
    MUSIC_DIRS
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?
        .clear();

    // 2. 删除缓存目录中的所有文件
    if cache_dir.exists() {
        for entry in fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    fs::remove_file(&path)
                        .map_err(|e| format!("Failed to delete {}: {}", path.display(), e))?;
                }
            }
        }
    }

    info!("All application data has been reset");
    Ok(())
}

/// 内部函数：获取缓存目录
fn get_cache_dir_internal() -> Result<PathBuf, String> {
    let path = utils::get_base_cache_dir()?;
    utils::ensure_cache_dir(&path)?;
    Ok(path)
}
