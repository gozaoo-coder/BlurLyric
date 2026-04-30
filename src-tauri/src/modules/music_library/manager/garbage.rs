use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::object_status::ObjectStatus;
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;
use crate::modules::music_library::manager::ObjectEntry;

impl MusicStorageSourceLibraryManager {
    /// 清理废弃对象
    /// 触发时机：traces 变动、歌单变动、手动调用
    pub fn collect_garbage(&mut self) -> GarbageReport {
        let mut report = GarbageReport::default();
        let mut to_remove: Vec<ObjectId> = Vec::new();

        // 收集需要清理的对象
        let current_ids: Vec<ObjectId> = self.objects.keys().cloned().collect();
        for id in &current_ids {
            let entry = match self.objects.get(id) {
                Some(e) => e,
                None => continue,
            };

            match entry {
                ObjectEntry::MasterSong(song) => {
                    // Master 清理条件：traces 为空且未被任何歌单引用
                    if song.traces.is_empty() && song.status == ObjectStatus::Active {
                        // 在 FavorSystem 集成前，先检查是否有有效的 song_refs
                        let is_referenced = self.objects.values().any(|other| {
                            match other {
                                ObjectEntry::MasterAlbum(album) => {
                                    album.song_refs.contains(&id.as_str().to_string())
                                }
                                ObjectEntry::MasterArtist(artist) => {
                                    artist.song_refs.contains(&id.as_str().to_string())
                                }
                                _ => false,
                            }
                        });
                        if !is_referenced {
                            report.deprecated_songs.push(("mark".to_string(), id.clone()));
                            // 标记为 Deprecated
                            // 在 v1 中直接标记后下一轮清理
                        }
                    }
                }
                ObjectEntry::MasterAlbum(album) => {
                    if album.traces.is_empty() && album.status == ObjectStatus::Active {
                        to_remove.push(id.clone());
                        report.removed_albums += 1;
                    }
                }
                ObjectEntry::MasterArtist(artist) => {
                    if artist.traces.is_empty() && artist.status == ObjectStatus::Active {
                        to_remove.push(id.clone());
                        report.removed_artists += 1;
                    }
                }
                _ => {}
            }
        }

        // 执行移除
        for id in to_remove {
            self.remove(&id);
        }

        report
    }

    /// 标记 MasterSong 为 Deprecated（当从歌单移除时调用）
    pub fn mark_song_deprecated(&mut self, song_id: &ObjectId) {
        if let Some(entry) = self.objects.get_mut(song_id) {
            match entry {
                ObjectEntry::MasterSong(song) => {
                    song.status = ObjectStatus::Deprecated;
                }
                _ => {}
            }
        }
    }
}

/// 垃圾清理报告
#[derive(Debug, Default)]
pub struct GarbageReport {
    pub deprecated_songs: Vec<(String, ObjectId)>,
    pub removed_albums: u32,
    pub removed_artists: u32,
}
