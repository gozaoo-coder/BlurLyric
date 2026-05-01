use crate::modules::music_library::object_id::{ObjectId, M_SONG, M_ALBUM, M_ARTIST, R_SONG};
use crate::modules::music_library::models::master_song::MasterSong;
use crate::modules::music_library::models::master_album::MasterAlbum;
use crate::modules::music_library::models::master_artist::MasterArtist;
use crate::modules::music_library::models::source_song::{SourceSong, SourceSongDetails};
use crate::modules::music_library::models::source_album::SourceAlbum;
use crate::modules::music_library::models::source_artist::SourceArtist;
use crate::modules::music_library::models::trace_link::TraceLink;
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;
use crate::modules::music_library::manager::ObjectEntry;

/// 标准化名称：去标点、小写、trim
fn normalize_name(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// 构建歌曲匹配键：名称标准化 + 主艺人 + 专辑 + 时长容差
fn build_song_match_key(
    name: &str,
    artist_names: &[String],
    album_name: Option<&str>,
    duration: Option<f64>,
) -> String {
    let name_norm = normalize_name(name);
    let artist_norm = {
        let mut sorted: Vec<String> = artist_names.iter().map(|n| normalize_name(n)).collect();
        sorted.sort();
        sorted.join("|")
    };
    let album_norm = album_name.map(normalize_name).unwrap_or_default();
    let duration_rounded = duration.map(|d| (d / 10.0).round() as u32 * 10).unwrap_or(0);

    format!("{}|{}|{}|{}", name_norm, artist_norm, album_norm, duration_rounded)
}

/// 构建专辑匹配键
fn build_album_match_key(name: &str, artist_names: &[String]) -> String {
    let name_norm = normalize_name(name);
    let artist_norm = {
        let mut sorted: Vec<String> = artist_names.iter().map(|n| normalize_name(n)).collect();
        sorted.sort();
        sorted.join("|")
    };
    format!("{}|{}", name_norm, artist_norm)
}

/// 构建艺术家匹配键
fn build_artist_match_key(name: &str) -> String {
    normalize_name(name)
}

impl MusicStorageSourceLibraryManager {
    /// 注册或合并一首歌的 SourceRecord
    /// 返回 MasterSong 的 ObjectId
    pub fn register_or_merge_song(
        &mut self,
        source_song: SourceSong,
        song_name: &str,
        album_name: Option<&str>,
        artist_names: Vec<String>,
    ) -> ObjectId {
        // 1. 检查 merge_overrides 是否有强制映射
        let record_id_str = source_song.id.as_str().to_string();
        if let Some(target_id) = self.merge_overrides.force_merges.get(&record_id_str) {
            // 强制合并到指定 Master
            if let Ok(master_id) = ObjectId::from_string(target_id) {
                if let Some(entry) = self.objects.get_mut(&master_id) {
                    if let ObjectEntry::MasterSong(ref mut master) = entry {
                        master.add_trace(TraceLink::new(
                            source_song.source_id.clone(),
                            source_song.id.as_str(),
                        ));
                        self.insert(ObjectEntry::SourceSong(source_song));
                        return master_id.clone();
                    }
                }
            }
        }

        // 2. 构建匹配键
        let match_key = build_song_match_key(
            song_name,
            &artist_names,
            album_name,
            source_song.details.duration,
        );

        // 3. 查找已有匹配 MasterSong
        let song_name = song_name.to_string();

        let existing_master = self.all_master_songs().iter().find(|master| {
            // 解析 artist_refs 获取名称
            let resolved_artist_names: Vec<String> = master.artist_refs.iter()
                .filter_map(|ref_str| {
                    ObjectId::from_string(ref_str).ok()
                        .and_then(|id| self.objects.get(&id))
                        .and_then(|entry| match entry {
                            ObjectEntry::MasterArtist(a) => Some(a.name.clone()),
                            _ => None,
                        })
                })
                .collect();

            // 解析 album_ref 获取实际专辑名（album_ref 存的是 MasterAlbum 的 ObjectId）
            let resolved_album_name: Option<String> = master.album_ref.as_ref().and_then(|ref_str| {
                ObjectId::from_string(ref_str).ok()
                    .and_then(|id| self.objects.get(&id))
                    .and_then(|entry| match entry {
                        ObjectEntry::MasterAlbum(a) => Some(a.name.clone()),
                        _ => None,
                    })
            });

            let m_key = build_song_match_key(
                &master.name,
                &resolved_artist_names,
                resolved_album_name.as_deref(),
                master.duration_ms.map(|ms| ms as f64 / 1000.0),
            );
            m_key == match_key
        }).map(|m| m.id.clone());

        if let Some(master_id) = existing_master {
            // 找到已有 Master，添加 TraceLink
            let trace = TraceLink::new(
                source_song.source_id.clone(),
                source_song.id.as_str(),
            );
            if let Some(entry) = self.objects.get_mut(&master_id) {
                if let ObjectEntry::MasterSong(ref mut master) = entry {
                    master.add_trace(trace);
                }
            }
            self.insert(ObjectEntry::SourceSong(source_song));
            master_id
        } else {
            // 未找到，创建新实体并关联

            // 1. 创建或查找 MasterArtist
            let artist_ids: Vec<String> = artist_names.iter().map(|name| {
                let artist_key = build_artist_match_key(name);
                let existing = self.all_master_artists().iter()
                    .find(|a| build_artist_match_key(&a.name) == artist_key)
                    .map(|a| a.id.clone());

                match existing {
                    Some(id) => id.as_str().to_string(),
                    None => {
                        let artist_id = ObjectId::new(M_ARTIST);
                        let master = MasterArtist::new(artist_id.clone(), name.clone());
                        self.insert(ObjectEntry::MasterArtist(master));
                        artist_id.as_str().to_string()
                    }
                }
            }).collect();

            // 2. 创建或查找 MasterAlbum
            let album_id: Option<String> = album_name.map(|name| {
                let album_key = build_album_match_key(name, &artist_names);
                let existing = self.all_master_albums().iter()
                    .find(|a| {
                        let resolved_album_artists: Vec<String> = a.artist_refs.iter()
                            .filter_map(|ref_str| {
                                ObjectId::from_string(ref_str).ok()
                                    .and_then(|id| self.objects.get(&id))
                                    .and_then(|entry| match entry {
                                        ObjectEntry::MasterArtist(a) => Some(a.name.clone()),
                                        _ => None,
                                    })
                            })
                            .collect();
                        build_album_match_key(&a.name, &resolved_album_artists) == album_key
                    })
                    .map(|a| a.id.clone());

                match existing {
                    Some(id) => id.as_str().to_string(),
                    None => {
                        let album_id = ObjectId::new(M_ALBUM);
                        let mut master = MasterAlbum::new(
                            album_id.clone(),
                            name.to_string(),
                            artist_ids.clone(),
                        );
                        self.insert(ObjectEntry::MasterAlbum(master));
                        album_id.as_str().to_string()
                    }
                }
            });

            // 3. 创建 MasterSong
            let master_id = ObjectId::new(M_SONG);
            let mut master = MasterSong::new(
                master_id.clone(),
                song_name.clone(),
                source_song.details.duration.map(|d| (d * 1000.0) as u64),
                artist_ids.clone(),
                album_id.clone(),
            );
            master.add_trace(TraceLink::new(
                source_song.source_id.clone(),
                source_song.id.as_str(),
            ));

            // 4. 在 MasterArtist 和 MasterAlbum 中建立反向引用
            for artist_id_str in &artist_ids {
                if let Ok(aid) = ObjectId::from_string(artist_id_str) {
                    if let Some(entry) = self.objects.get_mut(&aid) {
                        if let ObjectEntry::MasterArtist(ref mut artist) = entry {
                            artist.add_song(master_id.as_str().to_string());
                            if let Some(ref alb_id) = album_id {
                                artist.add_album(alb_id.clone());
                            }
                        }
                    }
                }
            }

            if let Some(ref alb_id_str) = album_id {
                if let Ok(aid) = ObjectId::from_string(alb_id_str) {
                    if let Some(entry) = self.objects.get_mut(&aid) {
                        if let ObjectEntry::MasterAlbum(ref mut album) = entry {
                            album.add_song(master_id.as_str().to_string());
                        }
                    }
                }
            }

            // 5. 插入
            self.insert(ObjectEntry::SourceSong(source_song));
            self.insert(ObjectEntry::MasterSong(master));

            master_id
        }
    }

    /// 注册或合并一张专辑的 SourceRecord
    pub fn register_or_merge_album(
        &mut self,
        source_album: SourceAlbum,
        artist_names: Vec<String>,
    ) -> ObjectId {
        // 检查 merge_overrides
        let record_id_str = source_album.id.as_str().to_string();
        if let Some(target_id) = self.merge_overrides.force_merges.get(&record_id_str) {
            if let Ok(master_id) = ObjectId::from_string(target_id) {
                if let Some(entry) = self.objects.get_mut(&master_id) {
                    if let ObjectEntry::MasterAlbum(ref mut master) = entry {
                        master.add_trace(TraceLink::new(
                            source_album.source_id.clone(),
                            source_album.id.as_str(),
                        ));
                        self.insert(ObjectEntry::SourceAlbum(source_album));
                        return master_id.clone();
                    }
                }
            }
        }

        let album_name = source_album.details.path.as_deref()
            .and_then(|p| std::path::Path::new(p).file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let match_key = build_album_match_key(&album_name, &artist_names);

        let existing = self.all_master_albums().iter().find(|master| {
            let m_key = build_album_match_key(&master.name, &[]);
            m_key == match_key
        }).map(|m| m.id.clone());

        if let Some(master_id) = existing {
            if let Some(entry) = self.objects.get_mut(&master_id) {
                if let ObjectEntry::MasterAlbum(ref mut master) = entry {
                    master.add_trace(TraceLink::new(
                        source_album.source_id.clone(),
                        source_album.id.as_str(),
                    ));
                }
            }
            self.insert(ObjectEntry::SourceAlbum(source_album));
            master_id
        } else {
            let master_id = ObjectId::new(M_ALBUM);
            let master = MasterAlbum::new(master_id.clone(), album_name, Vec::new());
            self.insert(ObjectEntry::SourceAlbum(source_album));
            self.insert(ObjectEntry::MasterAlbum(master));
            master_id
        }
    }

    /// 注册或合并一位艺术家的 SourceRecord
    pub fn register_or_merge_artist(
        &mut self,
        source_artist: SourceArtist,
    ) -> ObjectId {
        let record_id_str = source_artist.id.as_str().to_string();
        if let Some(target_id) = self.merge_overrides.force_merges.get(&record_id_str) {
            if let Ok(master_id) = ObjectId::from_string(target_id) {
                if let Some(entry) = self.objects.get_mut(&master_id) {
                    if let ObjectEntry::MasterArtist(ref mut master) = entry {
                        master.add_trace(TraceLink::new(
                            source_artist.source_id.clone(),
                            source_artist.id.as_str(),
                        ));
                        self.insert(ObjectEntry::SourceArtist(source_artist));
                        return master_id.clone();
                    }
                }
            }
        }

        let artist_name = source_artist.id.as_str().to_string();
        let match_key = build_artist_match_key(&artist_name);

        let existing = self.all_master_artists().iter().find(|master| {
            build_artist_match_key(&master.name) == match_key
        }).map(|m| m.id.clone());

        if let Some(master_id) = existing {
            if let Some(entry) = self.objects.get_mut(&master_id) {
                if let ObjectEntry::MasterArtist(ref mut master) = entry {
                    master.add_trace(TraceLink::new(
                        source_artist.source_id.clone(),
                        source_artist.id.as_str(),
                    ));
                }
            }
            self.insert(ObjectEntry::SourceArtist(source_artist));
            master_id
        } else {
            let master_id = ObjectId::new(M_ARTIST);
            let name = source_artist.details.alias.first()
                .cloned()
                .unwrap_or_else(|| "unknown".to_string());
            let master = MasterArtist::new(master_id.clone(), name);
            self.insert(ObjectEntry::SourceArtist(source_artist));
            self.insert(ObjectEntry::MasterArtist(master));
            master_id
        }
    }

    /// 根据扫描元数据注册一首歌（便捷方法）
    pub fn register_song_from_scan(
        &mut self,
        source_id: &str,
        external_id: &str,
        song_name: &str,
        details: SourceSongDetails,
        album_name: Option<&str>,
        artist_names: Vec<String>,
    ) -> ObjectId {
        let record_id = ObjectId::new(R_SONG);
        let source_song = SourceSong::new(
            record_id,
            source_id,
            external_id,
            details,
        );
        self.register_or_merge_song(source_song, song_name, album_name, artist_names)
    }

    /// 在 MasterSong 和 MasterArtist 之间建立关联
    pub fn link_song_artist(&mut self, song_id: &ObjectId, artist_id: &ObjectId) {
        // 在 MasterSong 中添加 artist_ref
        if let Some(entry) = self.objects.get_mut(song_id) {
            if let ObjectEntry::MasterSong(ref mut song) = entry {
                let artist_id_str = artist_id.as_str().to_string();
                if !song.artist_refs.contains(&artist_id_str) {
                    song.artist_refs.push(artist_id_str.clone());
                }
            }
        }
        // 在 MasterArtist 中添加 song_ref
        if let Some(entry) = self.objects.get_mut(artist_id) {
            if let ObjectEntry::MasterArtist(ref mut artist) = entry {
                artist.add_song(song_id.as_str().to_string());
            }
        }
    }

    /// 在 MasterSong 和 MasterAlbum 之间建立关联
    pub fn link_song_album(&mut self, song_id: &ObjectId, album_id: &ObjectId) {
        if let Some(entry) = self.objects.get_mut(song_id) {
            if let ObjectEntry::MasterSong(ref mut song) = entry {
                song.album_ref = Some(album_id.as_str().to_string());
            }
        }
        if let Some(entry) = self.objects.get_mut(album_id) {
            if let ObjectEntry::MasterAlbum(ref mut album) = entry {
                album.add_song(song_id.as_str().to_string());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::music_library::quality::Quality;

    fn create_test_song_details() -> SourceSongDetails {
        SourceSongDetails::from_scan(
            Some("/music/test.flac".to_string()),
            Some(1000000),
            Some("flac".to_string()),
            None,
            Some(44100),
            Some(16),
            Some(2),
            Some(240.0),
        )
    }

    fn make_manager() -> MusicStorageSourceLibraryManager {
        MusicStorageSourceLibraryManager::new()
    }

    #[test]
    fn test_register_new_song_creates_master() {
        let mut manager = make_manager();
        let details = create_test_song_details();
        let master_id = manager.register_song_from_scan(
            "local_storage",
            "ext_1",
            "Test Song",
            details,
            Some("Test Album"),
            vec!["Test Artist".to_string()],
        );

        // Should have created MasterSong + SourceSong
        let master_songs = manager.all_master_songs();
        assert_eq!(master_songs.len(), 1);
        assert_eq!(master_songs[0].id, master_id);

        let source_songs = manager.all_source_songs();
        assert_eq!(source_songs.len(), 1);
    }

    #[test]
    fn test_register_duplicate_merges() {
        let mut manager = make_manager();
        let details1 = create_test_song_details();
        let details2 = SourceSongDetails::from_scan(
            Some("/music/test_copy.flac".to_string()),
            Some(1000001),
            Some("flac".to_string()),
            None,
            Some(44100),
            Some(16),
            Some(2),
            Some(240.0),
        );

        let id1 = manager.register_song_from_scan(
            "local_storage", "ext_1", "Test Song", details1,
            Some("Test Album"), vec!["Test Artist".to_string()],
        );
        let id2 = manager.register_song_from_scan(
            "local_storage", "ext_2", "Test Song", details2,
            Some("Test Album"), vec!["Test Artist".to_string()],
        );

        // Same song should merge into one Master
        assert_eq!(id1, id2);
        let master_songs = manager.all_master_songs();
        assert_eq!(master_songs.len(), 1);
        // Should have 2 traces
        assert_eq!(master_songs[0].traces.len(), 2);
    }
}
