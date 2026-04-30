use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;

impl MusicStorageSourceLibraryManager {
    /// 重建所有索引（启动时调用）
    pub fn rebuild_indexes(&mut self) {
        self.name_index.clear();
        self.external_index.clear();

        let all_ids: Vec<ObjectId> = self.objects.keys().cloned().collect();
        for id in all_ids {
            // 重新获取 entry（通过 index 重新构建）
            if let Some(entry) = self.objects.get(&id) {
                let name = entry.name().to_string();
                if !name.is_empty() {
                    self.name_index
                        .entry(name)
                        .or_insert_with(Vec::new)
                        .push(id.clone());
                }

                match entry {
                    crate::modules::music_library::manager::ObjectEntry::SourceSong(s) => {
                        self.external_index.insert(
                            (s.source_id.clone(), s.external_id.clone()),
                            id.clone(),
                        );
                    }
                    crate::modules::music_library::manager::ObjectEntry::SourceAlbum(s) => {
                        self.external_index.insert(
                            (s.source_id.clone(), s.external_id.clone()),
                            id.clone(),
                        );
                    }
                    crate::modules::music_library::manager::ObjectEntry::SourceArtist(s) => {
                        self.external_index.insert(
                            (s.source_id.clone(), s.external_id.clone()),
                            id.clone(),
                        );
                    }
                    _ => {}
                }
            }
        }
    }
}
