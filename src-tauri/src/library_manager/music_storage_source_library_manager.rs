use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::core_v2::events::LibraryEvent;
use crate::core_v2::merge_strategy::{MergeStrategy, StrictMergeStrategy};
use crate::core_v2::models::{
    Song, Album, Artist, Trace, SongID, AlbumID, ArtistID,
    SongWithRelations, AlbumWithRelations, ArtistWithRelations, Details
};
use tokio::sync::broadcast;

pub struct MusicStorageSourceLibraryManager {
    songs: Arc<RwLock<HashMap<SongID, Song>>>,
    albums: Arc<RwLock<HashMap<AlbumID, Album>>>,
    artists: Arc<RwLock<HashMap<ArtistID, Artist>>>,
    merge_strategy: Box<dyn MergeStrategy + Send + Sync>,
    event_sender: broadcast::Sender<LibraryEvent>,
}

impl MusicStorageSourceLibraryManager {
    pub fn new(event_sender: broadcast::Sender<LibraryEvent>) -> Self {
        Self {
            songs: Arc::new(RwLock::new(HashMap::new())),
            albums: Arc::new(RwLock::new(HashMap::new())),
            artists: Arc::new(RwLock::new(HashMap::new())),
            merge_strategy: Box::new(StrictMergeStrategy),
            event_sender,
        }
    }

    pub fn register_song(&mut self, mut song: Song, trace: Trace) {
        let mut songs = self.songs.write().unwrap();
        
        for (existing_id, existing_song) in songs.iter() {
            if self.merge_strategy.is_same_song(&song, existing_song) {
                let existing_song = songs.get_mut(existing_id).unwrap();
                existing_song.traces.push(trace.clone());
                let _ = self.event_sender.send(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        song.traces.push(trace.clone());
        let song_id = song.id.clone();
        songs.insert(song_id.clone(), song);
        let _ = self.event_sender.send(LibraryEvent::TraceAdded {
            entity_id: song_id,
            trace,
        });
    }

    pub fn register_album(&mut self, mut album: Album, trace: Trace) {
        let mut albums = self.albums.write().unwrap();
        
        for (existing_id, existing_album) in albums.iter() {
            if self.merge_strategy.is_same_album(&album, existing_album) {
                let existing_album = albums.get_mut(existing_id).unwrap();
                existing_album.traces.push(trace.clone());
                let _ = self.event_sender.send(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        album.traces.push(trace.clone());
        let album_id = album.id.clone();
        albums.insert(album_id.clone(), album);
        let _ = self.event_sender.send(LibraryEvent::TraceAdded {
            entity_id: album_id,
            trace,
        });
    }

    pub fn register_artist(&mut self, mut artist: Artist, trace: Trace) {
        let mut artists = self.artists.write().unwrap();
        
        for (existing_id, existing_artist) in artists.iter() {
            if self.merge_strategy.is_same_artist(&artist, existing_artist) {
                let existing_artist = artists.get_mut(existing_id).unwrap();
                existing_artist.traces.push(trace.clone());
                let _ = self.event_sender.send(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        artist.traces.push(trace.clone());
        let artist_id = artist.id.clone();
        artists.insert(artist_id.clone(), artist);
        let _ = self.event_sender.send(LibraryEvent::TraceAdded {
            entity_id: artist_id,
            trace,
        });
    }

    pub fn update_trace_details(
        &mut self, 
        source_id: &SourceID, 
        old_path: &str, 
        new_details: Details
    ) {
        let mut songs = self.songs.write().unwrap();
        let mut albums = self.albums.write().unwrap();
        
        for song in songs.values_mut() {
            for trace in &mut song.traces {
                if trace.source_id == *source_id {
                    if let Some(Details::StorageSong { path, .. }) = &mut trace.object_info.details {
                        if path == old_path {
                            trace.object_info.details = Some(new_details.clone());
                        }
                    }
                }
            }
        }
        
        for album in albums.values_mut() {
            for trace in &mut album.traces {
                if trace.source_id == *source_id {
                    if let Some(Details::StorageAlbum { path }) = &mut trace.object_info.details {
                        if path == old_path {
                            trace.object_info.details = Some(new_details.clone());
                        }
                    }
                }
            }
        }
    }

    pub fn unregister_source_traces(&mut self, source_id: &str) {
        let mut songs = self.songs.write().unwrap();
        let mut albums = self.albums.write().unwrap();
        let mut artists = self.artists.write().unwrap();
        
        let mut songs_to_remove = Vec::new();
        for (song_id, song) in songs.iter_mut() {
            let original_len = song.traces.len();
            song.traces.retain(|t| t.source_id != source_id);
            for trace in song.traces.iter().filter(|t| t.source_id == source_id) {
                let _ = self.event_sender.send(LibraryEvent::TraceRemoved {
                    entity_id: song_id.clone(),
                    trace: trace.clone(),
                });
            }
            if song.traces.is_empty() && original_len > 0 {
                songs_to_remove.push(song_id.clone());
            }
        }
        
        for song_id in songs_to_remove {
            songs.remove(&song_id);
            let _ = self.event_sender.send(LibraryEvent::EntityCleanup { entity_id: song_id });
        }
    }

    pub fn get_song(&self, song_id: &SongID) -> Option<Song> {
        self.songs.read().unwrap().get(song_id).cloned()
    }

    pub fn get_song_with_relations(&self, song_id: &SongID) -> Option<SongWithRelations> {
        let songs = self.songs.read().unwrap();
        let artists = self.artists.read().unwrap();
        let albums = self.albums.read().unwrap();
        
        let song = songs.get(song_id)?;
        let song_artists: Vec<Artist> = song.artist_ids
            .iter()
            .filter_map(|id| artists.get(id).cloned())
            .collect();
        let song_album = song.album_id.as_ref().and_then(|id| albums.get(id).cloned());
        
        Some(SongWithRelations {
            song: song.clone(),
            artists: song_artists,
            album: song_album,
        })
    }

    pub fn get_all_songs(&self) -> Vec<Song> {
        self.songs.read().unwrap().values().cloned().collect()
    }

    pub fn get_album(&self, album_id: &AlbumID) -> Option<Album> {
        self.albums.read().unwrap().get(album_id).cloned()
    }

    pub fn get_all_albums(&self) -> Vec<Album> {
        self.albums.read().unwrap().values().cloned().collect()
    }

    pub fn get_artist(&self, artist_id: &ArtistID) -> Option<Artist> {
        self.artists.read().unwrap().get(artist_id).cloned()
    }

    pub fn get_all_artists(&self) -> Vec<Artist> {
        self.artists.read().unwrap().values().cloned().collect()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<LibraryEvent> {
        self.event_sender.subscribe()
    }
}

impl Clone for MusicStorageSourceLibraryManager {
    fn clone(&self) -> Self {
        Self {
            songs: Arc::clone(&self.songs),
            albums: Arc::clone(&self.albums),
            artists: Arc::clone(&self.artists),
            merge_strategy: Box::new(StrictMergeStrategy),
            event_sender: self.event_sender.clone(),
        }
    }
}
