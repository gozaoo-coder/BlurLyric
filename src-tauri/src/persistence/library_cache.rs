use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryCache {
    pub version: u32,
    pub timestamp: u64,
    pub songs: Vec<crate::core_v2::models::Song>,
    pub albums: Vec<crate::core_v2::models::Album>,
    pub artists: Vec<crate::core_v2::models::Artist>,
}

impl LibraryCache {
    const CURRENT_VERSION: u32 = 1;
    const CACHE_FILENAME: &str = "library_cache.json";

    pub fn init() -> Result<Self, String> {
        Ok(Self::new())
    }

    pub fn new() -> Self {
        Self {
            version: Self::CURRENT_VERSION,
            timestamp: 0,
            songs: Vec::new(),
            albums: Vec::new(),
            artists: Vec::new(),
        }
    }

    pub async fn load(cache_dir: &PathBuf) -> Result<Self, String> {
        let cache_path = cache_dir.join(Self::CACHE_FILENAME);
        if !cache_path.exists() {
            return Ok(Self::new());
        }

        let content = fs::read_to_string(&cache_path)
            .await
            .map_err(|e| format!("Failed to read cache: {}", e))?;

        let cache: Self = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse cache: {}", e))?;

        if cache.version != Self::CURRENT_VERSION {
            return Ok(Self::new());
        }

        Ok(cache)
    }

    pub async fn save(&self, cache_dir: &PathBuf) -> Result<(), String> {
        if !cache_dir.exists() {
            fs::create_dir_all(cache_dir)
                .await
                .map_err(|e| format!("Failed to create cache dir: {}", e))?;
        }

        let cache_path = cache_dir.join(Self::CACHE_FILENAME);
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize cache: {}", e))?;

        fs::write(&cache_path, content)
            .await
            .map_err(|e| format!("Failed to write cache: {}", e))?;

        Ok(())
    }

    pub fn is_valid(&self, current_timestamp: u64, max_age_seconds: u64) -> bool {
        self.timestamp > 0 && (current_timestamp - self.timestamp) < max_age_seconds
    }
}

impl Default for LibraryCache {
    fn default() -> Self {
        Self::new()
    }
}
