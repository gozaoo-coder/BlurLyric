use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::core_v2::models::{Trace, SourceID};
use crate::library_manager::MusicStorageSourceLibraryManager;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SourceInfo {
    pub source_id: SourceID,
    pub source_name: String,
    pub source_type: String,
}

pub struct SourceManager {
    sources: Arc<Mutex<HashMap<SourceID, Box<dyn crate::sources::source::Source + Send + Sync>>>>,
    library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>,
    pending_requests: Arc<Mutex<HashMap<String, ()>>>,
}

impl SourceManager {
    pub fn new(library_manager: Arc<Mutex<MusicStorageSourceLibraryManager>>) -> Self {
        Self {
            sources: Arc::new(Mutex::new(HashMap::new())),
            library_manager,
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn add_source(&mut self, source_id: SourceID, source: Box<dyn crate::sources::source::Source + Send + Sync>) {
        self.sources.lock().unwrap().insert(source_id, source);
    }

    pub fn remove_source(&mut self, source_id: &SourceID) {
        if let Some(source) = self.sources.lock().unwrap().remove(source_id) {
            self.library_manager.lock().unwrap().unregister_source_traces(source_id);
        }
    }

    pub fn get_source_list(&self) -> Vec<SourceInfo> {
        self.sources.lock().unwrap()
            .iter()
            .map(|(id, source)| SourceInfo {
                source_id: id.clone(),
                source_name: source.get_name(),
                source_type: source.get_type(),
            })
            .collect()
    }

    pub async fn get_api_source_music_file(&self, trace: &Trace) -> Result<Vec<u8>, String> {
        let sources = self.sources.lock().unwrap();
        let source = sources.get(&trace.source_id)
            .ok_or_else(|| format!("Source not found: {}", trace.source_id))?;
        
        source.get_song_file(trace).await
    }
}
