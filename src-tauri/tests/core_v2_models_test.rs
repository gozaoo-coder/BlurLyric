use blurlyric_lib::core_v2::models::*;
use blurlyric_lib::core_v2::quality::Quality;

#[test]
fn test_song_creation() {
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

    assert_eq!(song.id, "song1");
    assert_eq!(song.title, "Test Song");
    assert_eq!(song.artists, vec!["artist1"]);
    assert_eq!(song.album_id, Some("album1"));
    assert_eq!(song.duration, 180);
    assert_eq!(song.quality, Quality::High);
    assert_eq!(song.path, "test/path/song.mp3");
    assert_eq!(song.storage_type, StorageType::Local);
}

#[test]
fn test_album_creation() {
    let album = Album {
        id: "album1".to_string(),
        name: "Test Album".to_string(),
        artist_id: Some("artist1".to_string()),
        songs: vec!["song1".to_string(), "song2".to_string()],
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

    assert_eq!(album.id, "album1");
    assert_eq!(album.name, "Test Album");
    assert_eq!(album.artist_id, Some("artist1"));
    assert_eq!(album.songs, vec!["song1", "song2"]);
    assert_eq!(album.cover_path, Some("test/path/cover.jpg"));
}

#[test]
fn test_artist_creation() {
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

    assert_eq!(artist.id, "artist1");
    assert_eq!(artist.name, "Test Artist");
    assert_eq!(artist.albums, vec!["album1"]);
    assert_eq!(artist.songs, vec!["song1"]);
}
