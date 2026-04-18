use crate::common::utils;
/**
 * Resource Cache - 网络资源缓存模块
 *
 * ==================== 模块职责 ====================
 *
 * 本模块专门负责网络资源的缓存管理：
 * - 缓存从网络下载的音频、图片等资源文件
 * - 支持临时缓存池（用于试听）和偏好缓存池（用于收藏）
 * - 实现 LRU 自动清理策略
 * - 提供缓存资源的获取、存储和管理接口
 *
 * ==================== 与 MusicLibraryCache 的区别 ====================
 *
 * 本模块（ResourceCache）：
 *   - 缓存内容：网络下载的音频、图片等资源文件
 *   - 数据来源：网络下载
 *   - 清理策略：LRU 自动清理
 *   - 用户交互：用户可手动管理
 *
 * MusicLibraryCache 模块：
 *   - 缓存内容：本地音乐文件的元数据
 *   - 数据来源：本地文件扫描
 *   - 清理策略：增量扫描时更新
 *   - 用户交互：无感知，自动管理
 *
 * ==================== 缓存池分层策略 ====================
 *
 * 临时缓存池（Temp Pool）：
 *   - 用途：临时搜索试听的音乐资源
 *   - 大小限制：默认 500MB
 *   - 清理策略：LRU 自动清理
 *   - 用户操作：自动管理，用户可手动清空
 *
 * 偏好缓存池（Preference Pool）：
 *   - 用途：用户收藏/歌单中的音乐资源
 *   - 大小限制：默认 5GB
 *   - 清理策略：用户手动管理
 *   - 用户操作：收藏时自动从临时池移动到此
 *
 * ==================== 存储位置 ====================
 *
 * 缓存文件存储在系统缓存目录：
 * - Windows: C:\Users\{用户名}\AppData\Local\com.blurlyric.app\resource_cache\
 * - macOS: ~/Library/Caches/com.blurlyric.app/resource_cache/
 * - Linux: ~/.cache/com.blurlyric.app/resource_cache/
 */
use crate::core::trace::Trace;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

/// 缓存池类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResourcePoolType {
    /// 临时缓存池（临时搜索试听）
    Temp,
    /// 用户偏好池（用户收藏/歌单）
    Preference,
}

impl Default for ResourcePoolType {
    fn default() -> Self {
        Self::Temp
    }
}

/// 缓存资源项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedResource {
    /// 缓存唯一标识（基于 Trace 生成）
    pub id: String,
    /// 来源追踪信息
    pub trace: Trace,
    /// 缓存池类型
    pub pool: ResourcePoolType,
    /// 本地缓存路径
    pub path: PathBuf,
    /// 文件大小（字节）
    pub size: u64,
    /// 缓存时间戳
    pub cached_at: u64,
    /// 最后访问时间戳
    pub last_accessed: u64,
    /// 访问次数
    pub access_count: u32,
    /// 资源格式
    pub format: String,
    /// 关联的歌曲 ID（用于偏好池管理）
    pub track_id: Option<String>,
}

impl CachedResource {
    /// 创建新的缓存资源项
    pub fn new(
        id: String,
        trace: Trace,
        pool: ResourcePoolType,
        path: PathBuf,
        size: u64,
        format: String,
    ) -> Self {
        let now = current_timestamp();
        CachedResource {
            id,
            trace,
            pool,
            path,
            size,
            cached_at: now,
            last_accessed: now,
            access_count: 1,
            format,
            track_id: None,
        }
    }

    /// 更新访问信息
    pub fn touch(&mut self) {
        self.last_accessed = current_timestamp();
        self.access_count += 1;
    }

    /// 计算 LRU 评分（越低越应该被清理）
    pub fn lru_score(&self) -> u64 {
        let now = current_timestamp();
        let age = now.saturating_sub(self.last_accessed);
        let access_weight = self.access_count.saturating_sub(1) as u64 * 1000;
        age.saturating_sub(access_weight)
    }
}

/// 缓存池统计信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePoolStats {
    /// 缓存项数量
    pub count: usize,
    /// 总大小（字节）
    pub total_size: u64,
    /// 最大大小（字节）
    pub max_size: u64,
    /// 使用百分比
    pub usage_percent: f64,
}

/// 资源缓存管理器
pub struct ResourceCacheManager {
    /// 缓存目录
    cache_dir: PathBuf,
    /// 临时缓存池
    temp_pool: HashMap<String, CachedResource>,
    /// 用户偏好池
    preference_pool: HashMap<String, CachedResource>,
    /// 临时池最大大小（默认 500MB）
    max_temp_size: u64,
    /// 偏好池最大大小（默认 5GB）
    max_preference_size: u64,
    /// 索引文件路径
    index_file: PathBuf,
}

static RESOURCE_CACHE: Lazy<Mutex<Option<ResourceCacheManager>>> = Lazy::new(|| Mutex::new(None));

impl ResourceCacheManager {
    /// 初始化资源缓存管理器
    pub fn init() -> Result<(), String> {
        info!("Initializing resource cache manager");

        let cache_dir = get_resource_cache_dir()?;
        info!("Resource cache directory: {}", cache_dir.display());

        let index_file = cache_dir.join("resource_cache_index.json");

        let mut manager = ResourceCacheManager {
            cache_dir: cache_dir.clone(),
            temp_pool: HashMap::new(),
            preference_pool: HashMap::new(),
            max_temp_size: 500 * 1024 * 1024,            // 500MB
            max_preference_size: 5 * 1024 * 1024 * 1024, // 5GB
            index_file,
        };

        // 创建缓存目录
        info!(
            "Creating temp pool directory: {}",
            manager.temp_pool_dir().display()
        );
        fs::create_dir_all(&manager.temp_pool_dir()).map_err(|e| {
            error!("Failed to create temp pool dir: {}", e);
            format!("Failed to create temp pool dir: {}", e)
        })?;

        info!(
            "Creating preference pool directory: {}",
            manager.preference_pool_dir().display()
        );
        fs::create_dir_all(&manager.preference_pool_dir()).map_err(|e| {
            error!("Failed to create preference pool dir: {}", e);
            format!("Failed to create preference pool dir: {}", e)
        })?;

        // 加载索引
        info!("Loading resource cache index");
        manager.load_index()?;

        *RESOURCE_CACHE.lock().unwrap() = Some(manager);
        info!("Resource cache manager initialized successfully");
        Ok(())
    }

    /// 获取管理器实例
    pub fn instance() -> Option<std::sync::MutexGuard<'static, Option<ResourceCacheManager>>> {
        RESOURCE_CACHE.lock().ok()
    }

    /// 临时池目录
    fn temp_pool_dir(&self) -> PathBuf {
        self.cache_dir.join("temp_pool")
    }

    /// 偏好池目录
    fn preference_pool_dir(&self) -> PathBuf {
        self.cache_dir.join("preference_pool")
    }

    /// 生成缓存 ID（基于 Trace）
    pub fn generate_cache_id(trace: &Trace) -> String {
        let input = format!(
            "{}:{}:{}",
            trace.source_id,
            trace.data_type.as_str(),
            trace.data_id
        );
        blake3::hash(input.as_bytes()).to_hex().to_string()[..16].to_string()
    }

    /// 加载索引
    fn load_index(&mut self) -> Result<(), String> {
        if !self.index_file.exists() {
            debug!("Index file does not exist, creating new index");
            return Ok(());
        }

        debug!("Loading index from file: {}", self.index_file.display());
        let mut file = fs::File::open(&self.index_file).map_err(|e| {
            error!("Failed to open index file: {}", e);
            format!("Failed to open index file: {}", e)
        })?;

        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| {
            error!("Failed to read index file: {}", e);
            format!("Failed to read index file: {}", e)
        })?;

        let index: ResourceCacheIndex = serde_json::from_str(&contents).map_err(|e| {
            error!("Failed to parse index: {}", e);
            format!("Failed to parse index: {}", e)
        })?;

        self.temp_pool = index.temp_pool;
        self.preference_pool = index.preference_pool;

        debug!(
            "Loaded index: {} temp items, {} preference items",
            self.temp_pool.len(),
            self.preference_pool.len()
        );

        // 验证缓存文件是否存在，移除无效项
        debug!("Validating cache items");
        self.validate_cache_items();
        debug!(
            "Validation complete: {} temp items, {} preference items",
            self.temp_pool.len(),
            self.preference_pool.len()
        );

        Ok(())
    }

    /// 保存索引
    fn save_index(&self) -> Result<(), String> {
        debug!("Saving index to file: {}", self.index_file.display());

        let index = ResourceCacheIndex {
            temp_pool: self.temp_pool.clone(),
            preference_pool: self.preference_pool.clone(),
        };

        let json = serde_json::to_string_pretty(&index).map_err(|e| {
            error!("Failed to serialize index: {}", e);
            format!("Failed to serialize index: {}", e)
        })?;

        let mut file = fs::File::create(&self.index_file).map_err(|e| {
            error!("Failed to create index file: {}", e);
            format!("Failed to create index file: {}", e)
        })?;

        file.write_all(json.as_bytes()).map_err(|e| {
            error!("Failed to write index file: {}", e);
            format!("Failed to write index file: {}", e)
        })?;

        debug!(
            "Index saved successfully: {} temp items, {} preference items",
            self.temp_pool.len(),
            self.preference_pool.len()
        );
        Ok(())
    }

    /// 验证缓存项，移除不存在的文件
    fn validate_cache_items(&mut self) {
        let temp_dir = self.temp_pool_dir();
        let pref_dir = self.preference_pool_dir();

        self.temp_pool
            .retain(|_, item| temp_dir.join(&item.path).exists());

        self.preference_pool
            .retain(|_, item| pref_dir.join(&item.path).exists());
    }

    /// 添加资源到临时缓存池
    pub fn add_to_temp_pool(
        &mut self,
        trace: Trace,
        data: Vec<u8>,
        format: String,
    ) -> Result<String, String> {
        let cache_id = Self::generate_cache_id(&trace);
        let size = data.len() as u64;

        debug!(
            "Adding resource to temp pool: cache_id={}, size={} bytes, format={}",
            cache_id, size, format
        );

        // 检查是否已缓存
        if self.temp_pool.contains_key(&cache_id) || self.preference_pool.contains_key(&cache_id) {
            if let Some(item) = self.temp_pool.get_mut(&cache_id) {
                item.touch();
                debug!(
                    "Resource already in temp pool, updated access time: cache_id={}",
                    cache_id
                );
            } else if self.preference_pool.contains_key(&cache_id) {
                debug!("Resource already in preference pool: cache_id={}", cache_id);
            }
            return Ok(cache_id);
        }

        // 检查临时池空间，必要时清理
        debug!("Checking temp pool space: required={} bytes", size);
        self.ensure_temp_pool_space(size)?;

        // 保存文件
        let filename = format!("{}.{}", cache_id, format);
        let file_path = self.temp_pool_dir().join(&filename);

        debug!("Writing cache file: {}", file_path.display());
        fs::write(&file_path, &data).map_err(|e| {
            error!("Failed to write cache file: {}", e);
            format!("Failed to write cache file: {}", e)
        })?;

        // 创建缓存项
        let item = CachedResource::new(
            cache_id.clone(),
            trace,
            ResourcePoolType::Temp,
            PathBuf::from(&filename),
            size,
            format,
        );

        self.temp_pool.insert(cache_id.clone(), item);
        debug!("Resource added to temp pool: cache_id={}", cache_id);

        self.save_index()?;
        debug!("Cache index saved");

        Ok(cache_id)
    }

    /// 移动到偏好池（用户收藏/加入歌单时）
    pub fn move_to_preference_pool(
        &mut self,
        cache_id: &str,
        track_id: Option<String>,
    ) -> Result<(), String> {
        debug!(
            "Moving resource to preference pool: cache_id={}, track_id={:?}",
            cache_id, track_id
        );

        // 检查是否已在偏好池
        if self.preference_pool.contains_key(cache_id) {
            debug!("Resource already in preference pool: cache_id={}", cache_id);
            return Ok(());
        }

        // 从临时池取出
        let mut item = self.temp_pool.remove(cache_id).ok_or_else(|| {
            error!("Cache item not found in temp pool: {}", cache_id);
            format!("Cache item not found in temp pool: {}", cache_id)
        })?;

        // 移动文件
        let old_path = self.temp_pool_dir().join(&item.path);
        let new_path = self.preference_pool_dir().join(&item.path);

        if old_path.exists() {
            debug!(
                "Moving cache file from {} to {}",
                old_path.display(),
                new_path.display()
            );
            fs::rename(&old_path, &new_path).map_err(|e| {
                error!("Failed to move cache file: {}", e);
                format!("Failed to move cache file: {}", e)
            })?;
        }

        // 更新缓存项
        item.pool = ResourcePoolType::Preference;
        item.track_id = track_id;

        self.preference_pool.insert(cache_id.to_string(), item);
        debug!("Resource moved to preference pool: cache_id={}", cache_id);

        self.save_index()?;
        debug!("Cache index saved");

        Ok(())
    }

    /// 从偏好池移除（用户取消收藏/移出歌单时）
    pub fn remove_from_preference_pool(&mut self, cache_id: &str) -> Result<(), String> {
        debug!(
            "Removing resource from preference pool: cache_id={}",
            cache_id
        );

        let item = self.preference_pool.remove(cache_id).ok_or_else(|| {
            error!("Cache item not found in preference pool: {}", cache_id);
            format!("Cache item not found in preference pool: {}", cache_id)
        })?;

        // 删除文件
        let file_path = self.preference_pool_dir().join(&item.path);
        if file_path.exists() {
            debug!("Removing cache file: {}", file_path.display());
            fs::remove_file(&file_path).map_err(|e| {
                error!("Failed to remove cache file: {}", e);
                format!("Failed to remove cache file: {}", e)
            })?;
        }

        self.save_index()?;
        debug!(
            "Resource removed from preference pool: cache_id={}",
            cache_id
        );
        Ok(())
    }

    /// 执行 LRU 清理，返回释放的空间大小
    fn perform_lru_cleanup(&mut self, current_size: u64, target_size: u64) -> u64 {
        debug!("Performing LRU cleanup, current={} bytes, target={} bytes", current_size, target_size);
        
        let mut items: Vec<_> = self.temp_pool.iter().collect();
        items.sort_by_key(|(_, item)| item.lru_score());

        let mut freed_size = 0u64;
        let mut ids_to_remove = Vec::new();
        let mut paths_to_remove = Vec::new();

        for (id, item) in items {
            if current_size - freed_size <= target_size {
                break;
            }
            freed_size += item.size;
            ids_to_remove.push(id.clone());
            paths_to_remove.push(self.temp_pool_dir().join(&item.path));
        }

        debug!("Removing {} items to free {} bytes", ids_to_remove.len(), freed_size);
        
        // 批量删除文件
        for path in paths_to_remove {
            if path.exists() {
                debug!("Removing cache file: {}", path.display());
                let _ = fs::remove_file(&path);
            }
        }

        // 批量从哈希表中删除
        for id in ids_to_remove {
            self.temp_pool.remove(&id);
        }

        freed_size
    }

    /// 确保临时池有足够空间
    fn ensure_temp_pool_space(&mut self, required_size: u64) -> Result<(), String> {
        let current_size: u64 = self.temp_pool.values().map(|i| i.size).sum();

        debug!(
            "Checking temp pool space: current={} bytes, required={} bytes, max={} bytes",
            current_size, required_size, self.max_temp_size
        );

        if current_size + required_size <= self.max_temp_size {
            debug!("Sufficient space available in temp pool");
            return Ok(());
        }

        // 需要 LRU 清理
        debug!("Insufficient space, performing LRU cleanup");
        let target_size = self.max_temp_size.saturating_sub(required_size);
        let freed_size = self.perform_lru_cleanup(current_size, target_size);

        self.save_index()?;
        debug!("Temp pool cleanup completed, freed {} bytes", freed_size);
        Ok(())
    }

    /// 清理临时缓存（LRU 策略）
    pub fn cleanup_temp_pool(&mut self) -> Result<u64, String> {
        let current_size: u64 = self.temp_pool.values().map(|i| i.size).sum();

        debug!(
            "Cleaning up temp pool: current={} bytes, max={} bytes",
            current_size, self.max_temp_size
        );

        if current_size <= self.max_temp_size * 80 / 100 {
            debug!("Temp pool usage below threshold, no cleanup needed");
            return Ok(0);
        }

        let target_size = self.max_temp_size * 70 / 100;
        let freed_size = self.perform_lru_cleanup(current_size, target_size);

        self.save_index()?;
        info!("Temp pool cleanup completed, freed {} bytes", freed_size);
        Ok(freed_size)
    }

    /// 检查缓存是否存在
    pub fn is_cached(&self, trace: &Trace) -> bool {
        let cache_id = Self::generate_cache_id(trace);
        self.temp_pool.contains_key(&cache_id) || self.preference_pool.contains_key(&cache_id)
    }

    /// 获取缓存路径
    pub fn get_cache_path(&mut self, trace: &Trace) -> Option<PathBuf> {
        let cache_id = Self::generate_cache_id(trace);

        // 先计算目录路径
        let temp_dir = self.temp_pool_dir();
        let pref_dir = self.preference_pool_dir();

        if let Some(item) = self.temp_pool.get_mut(&cache_id) {
            item.touch();
            return Some(temp_dir.join(&item.path));
        }

        if let Some(item) = self.preference_pool.get_mut(&cache_id) {
            item.touch();
            return Some(pref_dir.join(&item.path));
        }

        None
    }

    /// 获取缓存项
    pub fn get_cache_item(&mut self, trace: &Trace) -> Option<&mut CachedResource> {
        let cache_id = Self::generate_cache_id(trace);

        if let Some(item) = self.temp_pool.get_mut(&cache_id) {
            item.touch();
            return Some(item);
        }

        if let Some(item) = self.preference_pool.get_mut(&cache_id) {
            item.touch();
            return Some(item);
        }

        None
    }

    /// 获取缓存统计信息
    pub fn get_cache_info(&self) -> ResourceCacheInfo {
        let temp_stats = self.get_pool_stats(ResourcePoolType::Temp);
        let pref_stats = self.get_pool_stats(ResourcePoolType::Preference);

        ResourceCacheInfo {
            temp_pool: temp_stats,
            preference_pool: pref_stats,
        }
    }

    /// 获取池统计信息
    fn get_pool_stats(&self, pool: ResourcePoolType) -> ResourcePoolStats {
        let (items, max_size) = match pool {
            ResourcePoolType::Temp => (&self.temp_pool, self.max_temp_size),
            ResourcePoolType::Preference => (&self.preference_pool, self.max_preference_size),
        };

        let total_size: u64 = items.values().map(|i| i.size).sum();
        let usage_percent = if max_size > 0 {
            (total_size as f64 / max_size as f64) * 100.0
        } else {
            0.0
        };

        ResourcePoolStats {
            count: items.len(),
            total_size,
            max_size,
            usage_percent,
        }
    }

    /// 清空临时池
    pub fn clear_temp_pool(&mut self) -> Result<u64, String> {
        let mut freed_size = 0u64;

        for item in self.temp_pool.values() {
            let file_path = self.temp_pool_dir().join(&item.path);
            if file_path.exists() {
                freed_size += item.size;
                let _ = fs::remove_file(&file_path);
            }
        }

        self.temp_pool.clear();
        self.save_index()?;

        Ok(freed_size)
    }

    /// 清空偏好池
    pub fn clear_preference_pool(&mut self) -> Result<u64, String> {
        let mut freed_size = 0u64;

        for item in self.preference_pool.values() {
            let file_path = self.preference_pool_dir().join(&item.path);
            if file_path.exists() {
                freed_size += item.size;
                let _ = fs::remove_file(&file_path);
            }
        }

        self.preference_pool.clear();
        self.save_index()?;

        Ok(freed_size)
    }

    /// 设置临时池最大大小
    pub fn set_max_temp_size(&mut self, size: u64) {
        self.max_temp_size = size;
    }

    /// 设置偏好池最大大小
    pub fn set_max_preference_size(&mut self, size: u64) {
        self.max_preference_size = size;
    }
}

/// 资源缓存索引
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct ResourceCacheIndex {
    temp_pool: HashMap<String, CachedResource>,
    preference_pool: HashMap<String, CachedResource>,
}

/// 资源缓存信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceCacheInfo {
    pub temp_pool: ResourcePoolStats,
    pub preference_pool: ResourcePoolStats,
}

fn get_resource_cache_dir() -> Result<PathBuf, String> {
    let path = utils::get_base_cache_dir()?.join(crate::common::RESOURCE_CACHE_SUBDIR);
    utils::ensure_cache_dir(&path)?;
    Ok(path)
}

fn current_timestamp() -> u64 {
    utils::current_timestamp()
}

// ========== Tauri IPC 命令 ==========

/// 缓存资源到临时池
#[tauri::command]
pub fn cache_resource(trace: Trace, data: Vec<u8>, format: String) -> Result<String, String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.add_to_temp_pool(trace, data, format);
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 移动到偏好池
#[tauri::command]
pub fn move_resource_to_preference_pool(
    cache_id: String,
    track_id: Option<String>,
) -> Result<(), String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.move_to_preference_pool(&cache_id, track_id);
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 从偏好池移除
#[tauri::command]
pub fn remove_resource_from_preference_pool(cache_id: String) -> Result<(), String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.remove_from_preference_pool(&cache_id);
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 获取资源缓存信息
#[tauri::command]
pub fn get_resource_cache_info() -> Result<ResourceCacheInfo, String> {
    if let Some(manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            return Ok(manager.get_cache_info());
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 清空临时资源缓存
#[tauri::command]
pub fn clear_temp_resource_cache() -> Result<u64, String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.clear_temp_pool();
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 清空偏好资源缓存
#[tauri::command]
pub fn clear_preference_resource_cache() -> Result<u64, String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.clear_preference_pool();
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 检查资源是否已缓存
#[tauri::command]
pub fn is_resource_cached(trace: Trace) -> bool {
    if let Some(manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_ref() {
            return manager.is_cached(&trace);
        }
    }
    false
}

/// 获取缓存资源路径
#[tauri::command]
pub fn get_cached_resource_path(trace: Trace) -> Option<String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager
                .get_cache_path(&trace)
                .map(|p| p.display().to_string());
        }
    }
    None
}

/// 清理临时资源缓存
#[tauri::command]
pub fn cleanup_temp_resource_cache() -> Result<u64, String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            return manager.cleanup_temp_pool();
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 设置资源缓存池大小
#[tauri::command]
pub fn set_resource_cache_pool_sizes(temp_size: u64, preference_size: u64) -> Result<(), String> {
    if let Some(mut manager_guard) = ResourceCacheManager::instance() {
        if let Some(manager) = manager_guard.as_mut() {
            manager.set_max_temp_size(temp_size);
            manager.set_max_preference_size(preference_size);
            return Ok(());
        }
    }
    Err("Resource cache manager not initialized".to_string())
}

/// 读取缓存文件
/// 用于前端读取已缓存的资源文件
#[tauri::command]
pub fn read_cached_file(path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(&path);
    let cache_dir = utils::get_base_cache_dir()?;

    let validated = utils::validate_path_within_base(&path, &cache_dir)?;

    if !validated.exists() {
        return Err(format!("Cache file not found: {}", path.display()));
    }

    fs::read(&validated).map_err(|e| format!("Failed to read cache file: {}", e))
}

// ========== 向后兼容的类型别名（将在未来版本移除） ==========

/// @deprecated 使用 ResourcePoolType 代替
pub type CachePool = ResourcePoolType;

/// @deprecated 使用 CachedResource 代替
pub type CacheItem = CachedResource;

/// @deprecated 使用 ResourcePoolStats 代替
pub type CachePoolStats = ResourcePoolStats;

/// @deprecated 使用 ResourceCacheInfo 代替
pub type CacheLayerInfo = ResourceCacheInfo;

/// @deprecated 使用 ResourceCacheManager::init() 代替
pub fn init_cache_layer() -> Result<(), String> {
    ResourceCacheManager::init()
}

/// @deprecated 使用 ResourceCacheManager::instance() 代替  
pub fn get_cache_layer_instance(
) -> Option<std::sync::MutexGuard<'static, Option<ResourceCacheManager>>> {
    ResourceCacheManager::instance()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::trace::{FetchMethod, SourceType, StorageType, Trace, TraceDataType};

    #[test]
    fn test_generate_cache_id() {
        let trace = Trace::local_file("/path/to/test.mp3", TraceDataType::Track, "test-id-123");
        let cache_id = ResourceCacheManager::generate_cache_id(&trace);

        assert!(!cache_id.is_empty());
        assert_eq!(cache_id.len(), 16);
    }

    #[test]
    fn test_cached_resource_lru_score() {
        let trace = Trace::local_file("/path/to/test.mp3", TraceDataType::Track, "test-id-123");
        let mut resource = CachedResource::new(
            "test-cache-id".to_string(),
            trace,
            ResourcePoolType::Temp,
            PathBuf::from("test.mp3"),
            1024 * 1024, // 1MB
            "mp3".to_string(),
        );

        let initial_score = resource.lru_score();
        // 模拟访问，更新访问时间
        resource.touch();
        let updated_score = resource.lru_score();

        // 访问后评分应该更低（更不容易被清理）
        assert!(updated_score < initial_score);
    }

    #[test]
    fn test_resource_pool_type_default() {
        let default_pool = ResourcePoolType::default();
        assert_eq!(default_pool, ResourcePoolType::Temp);
    }
}
