pub mod registration;
pub mod resolution;
pub mod routing;
pub mod garbage;
pub mod persistence;
pub mod index;

use std::collections::HashMap;
use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use crate::modules::music_library::models::music_object::ObjectKind;
use crate::modules::music_library::models::master_song::MasterSong;
use crate::modules::music_library::models::master_album::MasterAlbum;
use crate::modules::music_library::models::master_artist::MasterArtist;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::source_album::SourceAlbum;
use crate::modules::music_library::models::source_artist::SourceArtist;
use crate::modules::music_library::merge::MergeOverrideTable;

/// 所有对象类型的枚举包装（支持异构存储）
#[derive(Debug)]
pub enum ObjectEntry {
    MasterSong(MasterSong),
    MasterAlbum(MasterAlbum),
    MasterArtist(MasterArtist),
    SourceSong(SourceSong),
    SourceAlbum(SourceAlbum),
    SourceArtist(SourceArtist),
}

impl ObjectEntry {
    pub fn id(&self) -> &ObjectId {
        match self {
            ObjectEntry::MasterSong(m) => &m.id,
            ObjectEntry::MasterAlbum(m) => &m.id,
            ObjectEntry::MasterArtist(m) => &m.id,
            ObjectEntry::SourceSong(s) => &s.id,
            ObjectEntry::SourceAlbum(s) => &s.id,
            ObjectEntry::SourceArtist(s) => &s.id,
        }
    }

    pub fn kind(&self) -> ObjectKind {
        match self {
            ObjectEntry::MasterSong(_) => ObjectKind::MasterSong,
            ObjectEntry::MasterAlbum(_) => ObjectKind::MasterAlbum,
            ObjectEntry::MasterArtist(_) => ObjectKind::MasterArtist,
            ObjectEntry::SourceSong(_) => ObjectKind::SourceSong,
            ObjectEntry::SourceAlbum(_) => ObjectKind::SourceAlbum,
            ObjectEntry::SourceArtist(_) => ObjectKind::SourceArtist,
        }
    }

    pub fn status(&self) -> ObjectStatus {
        match self {
            ObjectEntry::MasterSong(m) => m.status.clone(),
            ObjectEntry::MasterAlbum(m) => m.status.clone(),
            ObjectEntry::MasterArtist(m) => m.status.clone(),
            ObjectEntry::SourceSong(_) => ObjectStatus::Active,
            ObjectEntry::SourceAlbum(_) => ObjectStatus::Active,
            ObjectEntry::SourceArtist(_) => ObjectStatus::Active,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            ObjectEntry::MasterSong(m) => &m.name,
            ObjectEntry::MasterAlbum(m) => &m.name,
            ObjectEntry::MasterArtist(m) => &m.name,
            ObjectEntry::SourceSong(_) => "",
            ObjectEntry::SourceAlbum(_) => "",
            ObjectEntry::SourceArtist(_) => "",
        }
    }
}

impl From<MasterSong> for ObjectEntry {
    fn from(v: MasterSong) -> Self { ObjectEntry::MasterSong(v) }
}
impl From<MasterAlbum> for ObjectEntry {
    fn from(v: MasterAlbum) -> Self { ObjectEntry::MasterAlbum(v) }
}
impl From<MasterArtist> for ObjectEntry {
    fn from(v: MasterArtist) -> Self { ObjectEntry::MasterArtist(v) }
}
impl From<SourceSong> for ObjectEntry {
    fn from(v: SourceSong) -> Self { ObjectEntry::SourceSong(v) }
}
impl From<SourceAlbum> for ObjectEntry {
    fn from(v: SourceAlbum) -> Self { ObjectEntry::SourceAlbum(v) }
}
impl From<SourceArtist> for ObjectEntry {
    fn from(v: SourceArtist) -> Self { ObjectEntry::SourceArtist(v) }
}

/// 音乐资源库核心管理器
/// 统一管理所有 Master 和 SourceRecord 对象
#[derive(Debug)]
pub struct MusicStorageSourceLibraryManager {
    pub objects: HashMap<ObjectId, ObjectEntry>,
    pub name_index: HashMap<String, Vec<ObjectId>>,
    pub external_index: HashMap<(String, String), ObjectId>,
    pub merge_overrides: MergeOverrideTable,
    pub version: u32,
}

impl MusicStorageSourceLibraryManager {
    pub fn new() -> Self {
        MusicStorageSourceLibraryManager {
            objects: HashMap::new(),
            name_index: HashMap::new(),
            external_index: HashMap::new(),
            merge_overrides: MergeOverrideTable::default(),
            version: 1,
        }
    }

    /// 获取对象引用
    pub fn get(&self, id: &ObjectId) -> Option<&ObjectEntry> {
        self.objects.get(id)
    }

    /// 获取可变对象引用
    pub fn get_mut(&mut self, id: &ObjectId) -> Option<&mut ObjectEntry> {
        self.objects.get_mut(id)
    }

    /// 插入对象并更新索引
    pub fn insert(&mut self, entry: ObjectEntry) {
        let id = entry.id().clone();
        let name = entry.name().to_string();
        let kind = entry.kind();

        // 更新 name_index（仅 Master 对象需要）
        if !name.is_empty() {
            self.name_index
                .entry(name)
                .or_insert_with(Vec::new)
                .push(id.clone());
        }

        // 更新 external_index（仅 Source 对象需要）
        match &entry {
            ObjectEntry::SourceSong(s) => {
                self.external_index
                    .insert((s.source_id.clone(), s.external_id.clone()), id.clone());
            }
            ObjectEntry::SourceAlbum(s) => {
                self.external_index
                    .insert((s.source_id.clone(), s.external_id.clone()), id.clone());
            }
            ObjectEntry::SourceArtist(s) => {
                self.external_index
                    .insert((s.source_id.clone(), s.external_id.clone()), id.clone());
            }
            _ => {}
        }

        self.objects.insert(id, entry);
    }

    /// 移除对象并清理索引
    pub fn remove(&mut self, id: &ObjectId) -> Option<ObjectEntry> {
        let entry = self.objects.remove(id)?;

        // 清理 name_index
        let name = entry.name().to_string();
        if !name.is_empty() {
            if let Some(ids) = self.name_index.get_mut(&name) {
                ids.retain(|i| i != id);
                if ids.is_empty() {
                    self.name_index.remove(&name);
                }
            }
        }

        // 清理 external_index
        match &entry {
            ObjectEntry::SourceSong(s) => {
                self.external_index.remove(&(s.source_id.clone(), s.external_id.clone()));
            }
            ObjectEntry::SourceAlbum(s) => {
                self.external_index.remove(&(s.source_id.clone(), s.external_id.clone()));
            }
            ObjectEntry::SourceArtist(s) => {
                self.external_index.remove(&(s.source_id.clone(), s.external_id.clone()));
            }
            _ => {}
        }

        Some(entry)
    }

    /// 通过 external_index 查找对象（source_id + external_id -> ObjectId）
    pub fn lookup_external(&self, source_id: &str, external_id: &str) -> Option<&ObjectId> {
        self.external_index.get(&(source_id.to_string(), external_id.to_string()))
    }

    /// 通过名称查找 Master 对象
    pub fn lookup_by_name(&self, name: &str) -> Option<&Vec<ObjectId>> {
        self.name_index.get(name)
    }

    /// 获取所有 MasterSong
    pub fn all_master_songs(&self) -> Vec<&MasterSong> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::MasterSong(s) = entry { Some(s) } else { None }
        }).collect()
    }

    /// 获取所有 MasterAlbum
    pub fn all_master_albums(&self) -> Vec<&MasterAlbum> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::MasterAlbum(a) = entry { Some(a) } else { None }
        }).collect()
    }

    /// 获取所有 MasterArtist
    pub fn all_master_artists(&self) -> Vec<&MasterArtist> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::MasterArtist(a) = entry { Some(a) } else { None }
        }).collect()
    }

    /// 获取所有 SourceSong
    pub fn all_source_songs(&self) -> Vec<&SourceSong> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::SourceSong(s) = entry { Some(s) } else { None }
        }).collect()
    }

    /// 获取所有 SourceAlbum
    pub fn all_source_albums(&self) -> Vec<&SourceAlbum> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::SourceAlbum(a) = entry { Some(a) } else { None }
        }).collect()
    }

    /// 获取所有 SourceArtist
    pub fn all_source_artists(&self) -> Vec<&SourceArtist> {
        self.objects.values().filter_map(|entry| {
            if let ObjectEntry::SourceArtist(a) = entry { Some(a) } else { None }
        }).collect()
    }

    /// 对象总数
    pub fn len(&self) -> usize {
        self.objects.len()
    }

    pub fn is_empty(&self) -> bool {
        self.objects.is_empty()
    }
}
