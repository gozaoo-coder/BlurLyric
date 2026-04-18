use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::core_v2::events::LibraryEvent;
use crate::core_v2::merge_strategy::{MergeStrategy, StrictMergeStrategy};
use crate::core_v2::models::{Song, Album, Artist, Trace, SongID, AlbumID, ArtistID};

pub struct MusicStorageSourceLibraryManager {
    songs: Arc<Mutex<HashMap<SongID, Song>>>,
    albums: Arc<Mutex<HashMap<AlbumID, Album>>>,
    artists: Arc<Mutex<HashMap<ArtistID, Artist>>>,
    merge_strategy: Box<dyn MergeStrategy + Send + Sync>,
    event_handlers: Arc<Mutex<Vec<Box<dyn Fn(&LibraryEvent) + Send + Sync>>>>,
}

impl MusicStorageSourceLibraryManager {
    pub fn new() -> Self {
        Self {
            songs: Arc::new(Mutex::new(HashMap::new())),
            albums: Arc::new(Mutex::new(HashMap::new())),
            artists: Arc::new(Mutex::new(HashMap::new())),
            merge_strategy: Box::new(StrictMergeStrategy),
            event_handlers: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn register_song(&mut self, mut song: Song, trace: Trace) {
        let mut songs = self.songs.lock().unwrap();
        
        for (existing_id, existing_song) in songs.iter() {
            if self.merge_strategy.is_same_song(&song, existing_song) {
                let existing_song = songs.get_mut(existing_id).unwrap();
                existing_song.traces.push(trace.clone());
                self.emit_event(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        song.traces.push(trace.clone());
        let song_id = song.id.clone();
        songs.insert(song_id.clone(), song);
        self.emit_event(LibraryEvent::TraceAdded {
            entity_id: song_id,
            trace,
        });
    }

    pub fn register_album(&mut self, mut album: Album, trace: Trace) {
        let mut albums = self.albums.lock().unwrap();
        
        for (existing_id, existing_album) in albums.iter() {
            if self.merge_strategy.is_same_album(&album, existing_album) {
                let existing_album = albums.get_mut(existing_id).unwrap();
                existing_album.traces.push(trace.clone());
                self.emit_event(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        album.traces.push(trace.clone());
        let album_id = album.id.clone();
        albums.insert(album_id.clone(), album);
        self.emit_event(LibraryEvent::TraceAdded {
            entity_id: album_id,
            trace,
        });
    }

    pub fn register_artist(&mut self, mut artist: Artist, trace: Trace) {
        let mut artists = self.artists.lock().unwrap();
        
        for (existing_id, existing_artist) in artists.iter() {
            if self.merge_strategy.is_same_artist(&artist, existing_artist) {
                let existing_artist = artists.get_mut(existing_id).unwrap();
                existing_artist.traces.push(trace.clone());
                self.emit_event(LibraryEvent::TraceAdded {
                    entity_id: existing_id.clone(),
                    trace,
                });
                return;
            }
        }
        
        artist.traces.push(trace.clone());
        let artist_id = artist.id.clone();
        artists.insert(artist_id.clone(), artist);
        self.emit_event(LibraryEvent::TraceAdded {
            entity_id: artist_id,
            trace,
        });
    }

    pub fn unregister_source_traces(&mut self, source_id: &str) {
        let mut songs = self.songs.lock().unwrap();
        let mut albums = self.albums.lock().unwrap();
        let mut artists = self.artists.lock().unwrap();
        
        let mut songs_to_remove = Vec::new();
        for (song_id, song) in songs.iter_mut() {
            let original_len = song.traces.len();
            song.traces.retain(|t| t.source_id != source_id);
            for trace in song.traces.iter().filter(|t| t.source_id == source_id) {
                self.emit_event(LibraryEvent::TraceRemoved {
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
            self.emit_event(LibraryEvent::EntityCleanup { entity_id: song_id });
        }
    }

    pub fn get_song(&self, song_id: &SongID) -> Option<Song> {
        self.songs.lock().unwrap().get(song_id).cloned()
    }

    pub fn get_all_songs(&self) -> Vec<Song> {
        self.songs.lock().unwrap().values().cloned().collect()
    }

    pub fn get_album(&self, album_id: &AlbumID) -> Option<Album> {
        self.albums.lock().unwrap().get(album_id).cloned()
    }

    pub fn get_all_albums(&self) -> Vec<Album> {
        self.albums.lock().unwrap().values().cloned().collect()
    }

    pub fn get_artist(&self, artist_id: &ArtistID) -> Option<Artist> {
        self.artists.lock().unwrap().get(artist_id).cloned()
    }

    pub fn get_all_artists(&self) -> Vec<Artist> {
        self.artists.lock().unwrap().values().cloned().collect()
    }

    pub fn add_event_handler<F>(&mut self, handler: F)
    where
        F: Fn(&LibraryEvent) + Send + Sync + 'static,
    {
        self.event_handlers.lock().unwrap().push(Box::new(handler));
    }

    fn emit_event(&self, event: LibraryEvent) {
        let handlers = self.event_handlers.lock().unwrap();
        for handler in handlers.iter() {
            handler(&event);
        }
    }
}

impl Default for MusicStorageSourceLibraryManager {
    fn default() -> Self {
        Self::new()
    }
}
