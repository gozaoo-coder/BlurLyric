use blurlyric_lib::library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager;
use blurlyric_lib::core_v2::models::*;
use blurlyric_lib::core_v2::quality::Quality;

#[test]
fn test_library_manager_initialization() {
    let manager = MusicStorageSourceLibraryManager::new();
    assert!(manager.songs.read().unwrap().is_empty());
    assert!(manager.albums.read().unwrap().is_empty());
    assert!(manager.artists.read().unwrap().is_empty());
}

#[test]
fn test_library_manager_add_song() {
    let manager = MusicStorageSourceLibraryManager::new();
    
    let song = Song {
        id: "song1".to_string(),
        title: "Test Song".to_string(),
        artists: vec!["artist1".to_string()],
        album_id: Some("album1".to_string()),
        duration: 180,
        quality: Quality::High,
        path: "test/path/song.mp3".to_string(),
        storage_type: StorageType::Local,
        trace: Trace {
            source: "local".to_string(),
            source_type: SourceType::Storage,
            fetch_method: FetchMethod::Local,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
        metadata: Default::default(),
    };
    
    manager.add_song(song.clone());
    
    let songs = manager.songs.read().unwrap();
    assert!(songs.contains_key(&song.id));
    assert_eq!(songs.get(&song.id).unwrap().title, song.title);
}

#[test]
fn test_library_manager_add_album() {
    let manager = MusicStorageSourceLibraryManager::new();
    
    let album = Album {
        id: "album1".to_string(),
        name: "Test Album".to_string(),
        artist_id: Some("artist1".to_string()),
        songs: vec!["song1".to_string()],
        cover_path: Some("test/path/cover.jpg".to_string()),
        release_date: Some(chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()),
        trace: Trace {
            source: "local".to_string(),
            source_type: SourceType::Storage,
            fetch_method: FetchMethod::Local,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
        metadata: Default::default(),
    };
    
    manager.add_album(album.clone());
    
    let albums = manager.albums.read().unwrap();
    assert!(albums.contains_key(&album.id));
    assert_eq!(albums.get(&album.id).unwrap().name, album.name);
}

#[test]
fn test_library_manager_add_artist() {
    let manager = MusicStorageSourceLibraryManager::new();
    
    let artist = Artist {
        id: "artist1".to_string(),
        name: "Test Artist".to_string(),
        albums: vec!["album1".to_string()],
        songs: vec!["song1".to_string()],
        trace: Trace {
            source: "local".to_string(),
            source_type: SourceType::Storage,
            fetch_method: FetchMethod::Local,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
        metadata: Default::default(),
    };
    
    manager.add_artist(artist.clone());
    
    let artists = manager.artists.read().unwrap();
    assert!(artists.contains_key(&artist.id));
    assert_eq!(artists.get(&artist.id).unwrap().name, artist.name);
}
