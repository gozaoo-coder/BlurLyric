use blurlyric_lib::source_manager::source_manager::SourceManager;
use blurlyric_lib::sources::storage_source::StorageSource;
use blurlyric_lib::sources::api_source::APISource;
use async_trait::async_trait;

// 测试用的 StorageSource 实现
#[derive(Debug)]
struct TestStorageSource {
    id: String,
    name: String,
}

#[async_trait]
impl StorageSource for TestStorageSource {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn scan(&self) -> Result<(), anyhow::Error> {
        Ok(())
    }
    
    async fn get_songs(&self) -> Result<Vec<String>, anyhow::Error> {
        Ok(vec![])
    }
}

// 测试用的 APISource 实现
#[derive(Debug)]
struct TestAPISource {
    id: String,
    name: String,
}

#[async_trait]
impl APISource for TestAPISource {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn search(&self, query: &str) -> Result<Vec<String>, anyhow::Error> {
        Ok(vec![])
    }
    
    async fn get_song_details(&self, song_id: &str) -> Result<Option<String>, anyhow::Error> {
        Ok(None)
    }
}

#[test]
fn test_source_manager_initialization() {
    let manager = SourceManager::new();
    assert!(manager.storage_sources.read().unwrap().is_empty());
    assert!(manager.api_sources.read().unwrap().is_empty());
}

#[test]
fn test_source_manager_add_storage_source() {
    let manager = SourceManager::new();
    
    let storage_source = TestStorageSource {
        id: "storage1".to_string(),
        name: "Test Storage".to_string(),
    };
    
    manager.add_storage_source(Box::new(storage_source));
    
    let storage_sources = manager.storage_sources.read().unwrap();
    assert!(storage_sources.contains_key("storage1"));
    assert_eq!(storage_sources.get("storage1").unwrap().name(), "Test Storage");
}

#[test]
fn test_source_manager_add_api_source() {
    let manager = SourceManager::new();
    
    let api_source = TestAPISource {
        id: "api1".to_string(),
        name: "Test API".to_string(),
    };
    
    manager.add_api_source(Box::new(api_source));
    
    let api_sources = manager.api_sources.read().unwrap();
    assert!(api_sources.contains_key("api1"));
    assert_eq!(api_sources.get("api1").unwrap().name(), "Test API");
}

#[test]
fn test_source_manager_remove_storage_source() {
    let manager = SourceManager::new();
    
    let storage_source = TestStorageSource {
        id: "storage1".to_string(),
        name: "Test Storage".to_string(),
    };
    
    manager.add_storage_source(Box::new(storage_source));
    manager.remove_storage_source("storage1");
    
    let storage_sources = manager.storage_sources.read().unwrap();
    assert!(!storage_sources.contains_key("storage1"));
}

#[test]
fn test_source_manager_remove_api_source() {
    let manager = SourceManager::new();
    
    let api_source = TestAPISource {
        id: "api1".to_string(),
        name: "Test API".to_string(),
    };
    
    manager.add_api_source(Box::new(api_source));
    manager.remove_api_source("api1");
    
    let api_sources = manager.api_sources.read().unwrap();
    assert!(!api_sources.contains_key("api1"));
}
