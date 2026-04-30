use std::path::Path;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use crate::modules::music_library::error::Result;
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;

/// 持久化格式的 library.json
#[derive(Debug, Serialize, Deserialize)]
struct LibraryData {
    version: u32,
    #[serde(rename = "objects")]
    objects: Map<String, Value>,
}

impl MusicStorageSourceLibraryManager {
    /// 将整个库序列化为 library.json
    pub fn save_to_disk(&self, path: &Path) -> Result<()> {
        let mut objects_map = Map::new();

        for (id, entry) in &self.objects {
            let value = match entry {
                crate::modules::music_library::manager::ObjectEntry::MasterSong(s) => {
                    serde_json::to_value(s)?
                }
                crate::modules::music_library::manager::ObjectEntry::MasterAlbum(a) => {
                    serde_json::to_value(a)?
                }
                crate::modules::music_library::manager::ObjectEntry::MasterArtist(a) => {
                    serde_json::to_value(a)?
                }
                crate::modules::music_library::manager::ObjectEntry::SourceSong(s) => {
                    serde_json::to_value(s)?
                }
                crate::modules::music_library::manager::ObjectEntry::SourceAlbum(a) => {
                    serde_json::to_value(a)?
                }
                crate::modules::music_library::manager::ObjectEntry::SourceArtist(a) => {
                    serde_json::to_value(a)?
                }
            };
            objects_map.insert(id.as_str().to_string(), value);
        }

        let library = LibraryData {
            version: self.version,
            objects: objects_map,
        };

        // 原子写入：先写入临时文件，再 rename
        let temp_path = path.with_extension("json.tmp");
        let json_str = serde_json::to_string_pretty(&library)?;
        std::fs::write(&temp_path, &json_str)?;
        std::fs::rename(&temp_path, path)?;

        Ok(())
    }

    /// 从 library.json 加载库
    pub fn load_from_disk(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(MusicStorageSourceLibraryManager::new());
        }

        let json_str = std::fs::read_to_string(path)?;
        let library: LibraryData = serde_json::from_str(&json_str)?;

        let mut manager = MusicStorageSourceLibraryManager::new();
        manager.version = library.version;

        for (id_str, value) in library.objects {
            let id = ObjectId::from_string(&id_str)
                .map_err(|e| crate::modules::music_library::error::MusicLibraryError::ParseError(e))?;

            let entry = deserialize_entry(&id, &value)?;
            manager.insert(entry);
        }

        Ok(manager)
    }
}

/// 根据 type 字段反序列化为对应的 ObjectEntry
fn deserialize_entry(id: &ObjectId, value: &Value) -> Result<crate::modules::music_library::manager::ObjectEntry> {
    let type_str = value.get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    match type_str {
        "master_song" => {
            let song: super::MasterSong = serde_json::from_value(value.clone())?;
            // 确保 ID 一致
            Ok(crate::modules::music_library::manager::ObjectEntry::MasterSong(song))
        }
        "master_album" => {
            let album: super::MasterAlbum = serde_json::from_value(value.clone())?;
            Ok(crate::modules::music_library::manager::ObjectEntry::MasterAlbum(album))
        }
        "master_artist" => {
            let artist: super::MasterArtist = serde_json::from_value(value.clone())?;
            Ok(crate::modules::music_library::manager::ObjectEntry::MasterArtist(artist))
        }
        "source_song" => {
            let song: super::SourceSong = serde_json::from_value(value.clone())?;
            Ok(crate::modules::music_library::manager::ObjectEntry::SourceSong(song))
        }
        "source_album" => {
            let album: super::SourceAlbum = serde_json::from_value(value.clone())?;
            Ok(crate::modules::music_library::manager::ObjectEntry::SourceAlbum(album))
        }
        "source_artist" => {
            let artist: super::SourceArtist = serde_json::from_value(value.clone())?;
            Ok(crate::modules::music_library::manager::ObjectEntry::SourceArtist(artist))
        }
        _ => Err(crate::modules::music_library::error::MusicLibraryError::ParseError(
            format!("Unknown object type: {} for id: {}", type_str, id)
        ))
    }
}
