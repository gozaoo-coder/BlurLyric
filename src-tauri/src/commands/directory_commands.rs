//! 目录管理命令模块
//!
//! 包含音乐目录的添加、删除、保存和加载等操作

use std::path::PathBuf;
use std::fs;
use serde_json;
use tracing::{debug, warn, error};

use crate::common::utils;
use crate::state::*;

/// 添加用户默认音乐文件夹（通常是系统音频目录）
#[tauri::command]
pub fn add_users_music_dir() {
    use super::directory_commands::add_music_dirs;
    if let Some(audio_dir) = dirs::audio_dir() {
        let audio_dir_path = audio_dir.to_str().unwrap().to_string();
        let _ = add_music_dirs(vec![audio_dir_path]);
    }
}

/// 获取用户默认音乐目录路径
#[tauri::command]
pub fn get_users_music_dir() -> String {
    dirs::audio_dir().map(|dir| dir.to_str().unwrap().to_string()).unwrap_or_default()
}

/// 获取所有已添加的音乐目录
#[tauri::command]
pub fn get_all_music_dirs() -> Result<Vec<String>, String> {
    // 返回用户手动添加的音乐目录，而不是缓存中的所有目录
    // 这样可以避免子目录被显示为独立的文件夹
    let music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
    let dirs: Vec<String> = music_dirs
        .iter()
        .map(|path| path.display().to_string())
        .collect();
    Ok(dirs)
}

/// 添加新的音乐目录
#[tauri::command]
pub fn add_music_dirs(new_dirs: Vec<String>) -> Result<(), String> {
    for dir in &new_dirs {
        let path = PathBuf::from(dir);
        if !path.exists() {
            return Err(format!("Music directory does not exist: {}", dir));
        }
    }
    {
        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        music_dirs.extend(new_dirs.iter().map(PathBuf::from));
    }
    let _ = save_music_dirs_to_disk();
    Ok(())
}

/// 移除指定的音乐目录
#[tauri::command]
pub fn remove_music_dirs(dirs_to_remove: Vec<String>) -> Result<(), String> {
    {
        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        music_dirs.retain(|dir| !dirs_to_remove.contains(&dir.display().to_string()));

        let mut cache = MUSIC_CACHE.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        for dir_str in dirs_to_remove {
            let dir = PathBuf::from(dir_str);
            cache.remove(&dir);
        }
    }

    let _ = save_music_dirs_to_disk();
    Ok(())
}

/// 保存音乐目录到磁盘
pub fn save_music_dirs_to_disk() -> Result<(), String> {
    let cache_dir = get_cache_dir_internal().map_err(|e| e.to_string())?;

    debug!(cache_dir = ?cache_dir, "Cache directory");
    if !cache_dir.exists() {
        if let Err(e) = fs::create_dir_all(&cache_dir) {
            return Err(format!("Failed to create cache directory: {}", e));
        }
    }

    let file_path = cache_dir.join("MUSIC_DIRS.json");
    debug!(file_path = ?file_path, "File path");

    let file = match fs::File::create(&file_path) {
        Ok(f) => f,
        Err(e) => return Err(format!("Failed to create file: {}", e)),
    };

    let dirs_clone = {
        let dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        dirs.clone()
    };

    if let Err(e) = serde_json::to_writer(&file, &dirs_clone) {
        return Err(format!("Failed to write to file: {}", e));
    }
    Ok(())
}

/// 从磁盘加载音乐目录
pub fn load_music_dirs_from_disk() -> Result<(), String> {
    let cache_dir = get_cache_dir_internal().map_err(|e| e.to_string())?;

    debug!(cache_dir = ?cache_dir, "Cache directory");
    if !cache_dir.exists() {
        if let Err(e) = fs::create_dir_all(&cache_dir) {
            return Err(format!("Failed to create cache directory: {}", e));
        }
    }

    let file_path = cache_dir.join("MUSIC_DIRS.json");
    debug!(file_path = ?file_path, "File path");

    if !file_path.exists() {
        // 文件不存在，使用默认音频目录并创建配置文件
        let audio_dir = dirs::audio_dir().ok_or("No default audio directory found")?;
        let dirs = vec![audio_dir];

        let file = match fs::File::create(&file_path) {
            Ok(f) => f,
            Err(e) => return Err(format!("Failed to create file: {}", e)),
        };

        if let Err(e) = serde_json::to_writer(&file, &dirs) {
            return Err(format!("Failed to write to file: {}", e));
        }
    } else {
        // 文件存在，读取配置
        let file = fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let dirs: Vec<PathBuf> = serde_json::from_reader(file).map_err(|e| e.to_string())?;

        let mut music_dirs = MUSIC_DIRS.lock().map_err(|e| format!("Mutex poisoned: {}", e))?;
        *music_dirs = dirs;
    }
    Ok(())
}

/// 内部函数：获取缓存目录
fn get_cache_dir_internal() -> Result<PathBuf, String> {
    let path = utils::get_base_cache_dir()?;
    utils::ensure_cache_dir(&path)?;
    Ok(path)
}
