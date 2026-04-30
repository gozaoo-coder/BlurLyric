use blurlyric_lib::library_manager::music_storage_source_library_manager::MusicStorageSourceLibraryManager;
use blurlyric_lib::core_v2::models::*;
use blurlyric_lib::core_v2::quality::Quality;
use blurlyric_lib::core_v2::events::create_event_channel;

fn make_trace(source_id: &str) -> Trace {
    Trace {
        source_type: SourceType::StorageSource,
        source_id: source_id.to_string(),
        object_info: ObjectInfo {
            object_type: "song".to_string(),
            id: "obj1".to_string(),
            details: Some(Details::StorageSong {
                path: "/music/song.mp3".to_string(),
                size: 1024,
                quality: Quality::Normal,
                fingerprint: None,
            }),
        },
    }
}

#[test]
fn test_library_manager_initialization() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);
    assert!(manager.get_all_songs().is_empty());
    assert!(manager.get_all_albums().is_empty());
    assert!(manager.get_all_artists().is_empty());
}

#[test]
fn test_library_manager_register_song() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);

    let song = Song {
        id: "song1".to_string(),
        name: "Test Song".to_string(),
        artist_ids: vec!["artist1".to_string()],
        album_id: Some("album1".to_string()),
        traces: vec![],
        duration: Some(std::time::Duration::from_secs(180)),
    };

    manager.register_song(song, make_trace("source1"));

    let songs = manager.get_all_songs();
    assert_eq!(songs.len(), 1);
    assert_eq!(songs[0].id, "song1");
    assert_eq!(songs[0].name, "Test Song");
    assert_eq!(songs[0].traces.len(), 1);
}

#[test]
fn test_library_manager_register_album() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);

    let album = Album {
        id: "album1".to_string(),
        name: "Test Album".to_string(),
        artist_ids: vec!["artist1".to_string()],
        song_ids: vec!["song1".to_string()],
        traces: vec![],
    };

    let trace = Trace {
        source_type: SourceType::StorageSource,
        source_id: "source1".to_string(),
        object_info: ObjectInfo {
            object_type: "album".to_string(),
            id: "obj1".to_string(),
            details: Some(Details::StorageAlbum {
                path: "/music/album".to_string(),
            }),
        },
    };

    manager.register_album(album, trace);

    let albums = manager.get_all_albums();
    assert_eq!(albums.len(), 1);
    assert_eq!(albums[0].id, "album1");
    assert_eq!(albums[0].name, "Test Album");
}

#[test]
fn test_library_manager_register_artist() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);

    let artist = Artist {
        id: "artist1".to_string(),
        name: "Test Artist".to_string(),
        album_ids: vec!["album1".to_string()],
        song_ids: vec!["song1".to_string()],
        traces: vec![],
    };

    let trace = Trace {
        source_type: SourceType::StorageSource,
        source_id: "source1".to_string(),
        object_info: ObjectInfo {
            object_type: "artist".to_string(),
            id: "obj1".to_string(),
            details: None,
        },
    };

    manager.register_artist(artist, trace);

    let artists = manager.get_all_artists();
    assert_eq!(artists.len(), 1);
    assert_eq!(artists[0].id, "artist1");
    assert_eq!(artists[0].name, "Test Artist");
}

#[test]
fn test_library_manager_get_song_with_relations() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);

    let artist = Artist {
        id: "artist1".to_string(),
        name: "Test Artist".to_string(),
        album_ids: vec![],
        song_ids: vec![],
        traces: vec![],
    };

    let album = Album {
        id: "album1".to_string(),
        name: "Test Album".to_string(),
        artist_ids: vec!["artist1".to_string()],
        song_ids: vec![],
        traces: vec![],
    };

    let song = Song {
        id: "song1".to_string(),
        name: "Test Song".to_string(),
        artist_ids: vec!["artist1".to_string()],
        album_id: Some("album1".to_string()),
        traces: vec![],
        duration: None,
    };

    let artist_trace = Trace {
        source_type: SourceType::StorageSource,
        source_id: "source1".to_string(),
        object_info: ObjectInfo {
            object_type: "artist".to_string(),
            id: "obj1".to_string(),
            details: None,
        },
    };
    let album_trace = Trace {
        source_type: SourceType::StorageSource,
        source_id: "source1".to_string(),
        object_info: ObjectInfo {
            object_type: "album".to_string(),
            id: "obj2".to_string(),
            details: None,
        },
    };

    manager.register_artist(artist, artist_trace);
    manager.register_album(album, album_trace);
    manager.register_song(song, make_trace("source1"));

    let rel = manager.get_song_with_relations(&"song1".to_string()).unwrap();
    assert_eq!(rel.song.id, "song1");
    assert_eq!(rel.artists.len(), 1);
    assert_eq!(rel.artists[0].name, "Test Artist");
    assert!(rel.album.is_some());
    assert_eq!(rel.album.as_ref().unwrap().name, "Test Album");
}

#[test]
fn test_library_manager_unregister_source_traces() {
    let (tx, _) = create_event_channel();
    let manager = MusicStorageSourceLibraryManager::new(tx);

    let song = Song {
        id: "song1".to_string(),
        name: "Test Song".to_string(),
        artist_ids: vec![],
        album_id: None,
        traces: vec![],
        duration: None,
    };

    manager.register_song(song, make_trace("source1"));
    assert_eq!(manager.get_all_songs().len(), 1);

    // Unregister the source - song should be cleaned up since it has no traces left
    manager.unregister_source_traces("source1");
    assert!(manager.get_all_songs().is_empty());
}
