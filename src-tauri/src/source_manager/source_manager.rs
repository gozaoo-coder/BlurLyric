use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceCell};

use crate::core_v2::models::{Trace, SourceID};
use crate::library_manager::MusicStorageSourceLibraryManager;
use crate::sources::storage_source::StorageSource;
use crate::sources::api_source::APISource;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SourceInfo {
    pub source_id: SourceID,
    pub source_name: String,
    pub source_type: String,
}

pub struct SourceManager {
    storage_sources: Arc<Mutex<HashMap<SourceID, Box<dyn StorageSource + Send + Sync>>>>,
    api_sources: Arc<Mutex<HashMap<SourceID, Box<dyn APISource + Send + Sync>>>>,
    library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>,
    pending_requests: Arc<Mutex<HashMap<String, Arc<OnceCell<Result<Vec<u8>, String>>>>>>,
}

impl SourceManager {
    pub fn new(library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>) -> Self {
        Self {
            storage_sources: Arc::new(Mutex::new(HashMap::new())),
            api_sources: Arc::new(Mutex::new(HashMap::new())),
            library_manager,
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn add_storage_source(&mut self, source_id: SourceID, source: Box<dyn StorageSource + Send + Sync>) {
        self.storage_sources.lock().unwrap().insert(source_id, source);
    }

    pub fn add_api_source(&mut self, source_id: SourceID, source: Box<dyn APISource + Send + Sync>) {
        self.api_sources.lock().unwrap().insert(source_id, source);
    }

    pub fn remove_source(&mut self, source_id: &SourceID) {
        let mut storage_sources = self.storage_sources.lock().unwrap();
        let mut api_sources = self.api_sources.lock().unwrap();
        
        if storage_sources.remove(source_id).is_some() || api_sources.remove(source_id).is_some() {
            self.library_manager.lock().unwrap().unregister_source_traces(source_id);
        }
    }

    pub fn get_source_list(&self) -> Vec<SourceInfo> {
        let mut result = Vec::new();
        
        let storage_sources = self.storage_sources.lock().unwrap();
        for (id, source) in storage_sources.iter() {
            result.push(SourceInfo {
                source_id: id.clone(),
                source_name: source.get_name(),
                source_type: "StorageSource".to_string(),
            });
        }
        
        let api_sources = self.api_sources.lock().unwrap();
        for (id, source) in api_sources.iter() {
            result.push(SourceInfo {
                source_id: id.clone(),
                source_name: source.get_name(),
                source_type: "APISource".to_string(),
            });
        }
        
        result
    }

    pub async fn get_api_source_music_file(&self, trace: &Trace) -> Result<Vec<u8>, String> {
        let key = format!("{}-{}", trace.source_id, trace.object_info.id);
        
        let once_cell = {
            let mut pending = self.pending_requests.lock().unwrap();
            pending.entry(key.clone())
                .or_insert_with(|| Arc::new(OnceCell::new()))
                .clone()
        };
        
        if let Some(result) = once_cell.get() {
            return result.clone();
        }
        
        let result = self.fetch_api_source_music_file(trace).await;
        let _ = once_cell.set(result.clone());
        
        self.pending_requests.lock().unwrap().remove(&key);
        
        result
    }

    async fn fetch_api_source_music_file(&self, trace: &Trace) -> Result<Vec<u8>, String> {
        let api_sources = self.api_sources.lock().unwrap();
        let source = api_sources.get(&trace.source_id)
            .ok_or_else(|| format!("API Source not found: {}", trace.source_id))?;
        
        source.fetch_song_file(trace).await
    }
}

impl Clone for SourceManager {
    fn clone(&self) -> Self {
        Self {
            storage_sources: Arc::clone(&self.storage_sources),
            api_sources: Arc::clone(&self.api_sources),
            library_manager: Arc::clone(&self.library_manager),
            pending_requests: Arc::clone(&self.pending_requests),
        }
    }
}
