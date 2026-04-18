use blurlyric_lib::source_manager::source_manager::SourceManager;
use blurlyric_lib::library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager;
use blurlyric_lib::core_v2::events::create_event_channel;
use std::sync::{Arc, Mutex};

#[test]
fn test_source_manager_initialization() {
    let (tx, _) = create_event_channel();
    let lm = Arc::new(Mutex::new(MusicStorageSourceLibraryManager::new(tx)));
    let manager = SourceManager::new(lm);
    assert!(manager.get_source_list().is_empty());
}
