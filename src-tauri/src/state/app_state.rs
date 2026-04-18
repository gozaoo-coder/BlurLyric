//! 全局应用状态和数据缓存
//!
//! 从 lib.rs 中提取的全局静态变量、ID生成器和辅助函数

use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use super::super::models::legacy::{Album, Artist, Song};

// ==================== ID 计数器 ====================

/// 歌曲 ID 计数器
pub static SONG_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

/// 艺术家 ID 计数器
pub static ARTIST_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

/// 专辑 ID 计数器
pub static ALBUM_ID_COUNTER: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(0));

// ==================== 数据缓存 ====================

/// 音乐缓存（按目录路径索引）
pub static MUSIC_CACHE: Lazy<Mutex<HashMap<PathBuf, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 艺术家缓存（按名称索引）
pub static ARTIST_CACHE: Lazy<Mutex<HashMap<String, Artist>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑缓存（按名称索引）
pub static ALBUM_CACHE: Lazy<Mutex<HashMap<String, Album>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ==================== 映射关系 ====================

/// 艺术家到歌曲的映射关系
pub static ARTIST_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑到歌曲的映射关系
pub static ALBUM_SONGS_MAP: Lazy<Mutex<HashMap<u32, Vec<Song>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ==================== O(1) 索引 ====================

/// 歌曲 ID -> 文件路径的 O(1) 索引
pub static SONG_PATH_INDEX: Lazy<Mutex<HashMap<u32, PathBuf>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑 ID -> 封面文件路径的 O(1) 索引（存储该专辑第一首歌曲的路径）
pub static ALBUM_COVER_INDEX: Lazy<Mutex<HashMap<u32, PathBuf>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 艺术家 ID -> Artist 对象的 O(1) 索引
pub static ARTIST_INDEX: Lazy<Mutex<HashMap<u32, Artist>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 专辑 ID -> Album 对象的 O(1) 索引
pub static ALBUM_INDEX: Lazy<Mutex<HashMap<u32, Album>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// ==================== 应用配置 ====================

/// 音乐目录列表
pub static MUSIC_DIRS: Lazy<Mutex<Vec<PathBuf>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// 窗口置顶状态
pub static ALWAYS_ON_TOP_STATE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

// ==================== 辅助函数 ====================

/// 获取音乐目录列表
///
/// 返回当前配置的所有音乐目录路径的克隆
pub fn get_music_dirs() -> Vec<PathBuf> {
    MUSIC_DIRS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// 生成下一个唯一 ID
///
/// # Arguments
/// * `counter` - 要递增的计数器
///
/// # Returns
/// 递增后的新 ID 值
pub fn next_id(counter: &Mutex<u32>) -> u32 {
    let mut id = counter.lock().unwrap_or_else(|e| e.into_inner());
    *id += 1;
    *id
}

/// 获取或创建艺术家
///
/// 如果艺术家已存在于缓存中则返回现有实例，
/// 否则创建新的艺术家并添加到缓存中。
///
/// # Arguments
/// * `name` - 艺术家名称
///
/// # Returns
/// 艺术家实例（包含自动生成的 ID）
pub fn get_or_create_artist(name: String) -> Artist {
    let mut cache = ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ARTIST_ID_COUNTER);
            Artist {
                id,
                name: name.clone(),
                alias: vec![],
            }
        })
        .clone()
}

/// 获取或创建专辑
///
/// 如果专辑已存在于缓存中则返回现有实例，
/// 否则创建新的专辑并添加到缓存中。
///
/// # Arguments
/// * `name` - 专辑名称
///
/// # Returns
/// 专辑实例（包含自动生成的 ID）
pub fn get_or_create_album(name: String) -> Album {
    let mut cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let album = cache
        .entry(name.clone())
        .or_insert_with(|| {
            let id = next_id(&ALBUM_ID_COUNTER);
            Album {
                id,
                name: name,
                pic_url: String::new(),
            }
        })
        .clone();

    // 同步更新 ALBUM_INDEX
    {
        let mut index = ALBUM_INDEX.lock().unwrap_or_else(|e| e.into_inner());
        index.insert(album.id, album.clone());
    }

    album
}

// ==================== 索引维护函数 ====================

/// 将歌曲添加到 O(1) 索引中
///
/// # Arguments
/// * `song_id` - 歌曲唯一 ID
/// * `path` - 歌曲文件路径
pub fn add_song_to_index(song_id: u32, path: PathBuf) {
    let mut index = SONG_PATH_INDEX.lock().unwrap_or_else(|e| e.into_inner());
    index.insert(song_id, path);
}

/// 将专辑封面路径添加到索引中
///
/// 如果该专辑已有封面记录，则不覆盖（保留第一首歌曲的路径）
///
/// # Arguments
/// * `album_id` - 专辑唯一 ID
/// * `path` - 该专辑下某首歌曲的文件路径（用于读取内嵌封面）
pub fn add_album_cover_index(album_id: u32, path: PathBuf) {
    let mut index = ALBUM_COVER_INDEX.lock().unwrap_or_else(|e| e.into_inner());
    // 只在索引不存在时插入，确保保留第一首歌曲的路径
    index.entry(album_id).or_insert(path);
}

/// 重建所有 O(1) 索引
///
/// 遍历 MUSIC_CACHE、ARTIST_CACHE、ALBUM_CACHE 重建所有索引。
/// 应在 refresh_music_cache 和 rebuild_memory_cache_from_persistent 结束时调用。
pub fn rebuild_all_indexes() {
    // 清空所有索引
    {
        SONG_PATH_INDEX
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        ALBUM_COVER_INDEX
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        ARTIST_INDEX
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        ALBUM_INDEX
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    // 重建 SONG_PATH_INDEX 和 ALBUM_COVER_INDEX
    {
        let cache = MUSIC_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        let mut song_index = SONG_PATH_INDEX.lock().unwrap_or_else(|e| e.into_inner());
        let mut cover_index = ALBUM_COVER_INDEX.lock().unwrap_or_else(|e| e.into_inner());

        for songs in cache.values() {
            for song in songs {
                song_index.insert(song.id, song.src.clone());
                cover_index
                    .entry(song.al.id)
                    .or_insert_with(|| song.src.clone());
            }
        }
    }

    // 重建 ARTIST_INDEX
    {
        let cache = ARTIST_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        let mut index = ARTIST_INDEX.lock().unwrap_or_else(|e| e.into_inner());
        for artist in cache.values() {
            index.insert(artist.id, artist.clone());
        }
    }

    // 重建 ALBUM_INDEX
    {
        let cache = ALBUM_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        let mut index = ALBUM_INDEX.lock().unwrap_or_else(|e| e.into_inner());
        for album in cache.values() {
            index.insert(album.id, album.clone());
        }
    }
}
