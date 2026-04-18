use blurlyric_lib::core_v2::models::*;
use blurlyric_lib::core_v2::quality::Quality;

#[test]
fn test_song_creation() {
    let song = Song {
        id: "song1".to_string(),
        name: "Test Song".to_string(),
        artist_ids: vec!["artist1".to_string()],
        album_id: Some("album1".to_string()),
        traces: vec![],
        duration: Some(std::time::Duration::from_secs(180)),
    };

    assert_eq!(song.id, "song1");
    assert_eq!(song.name, "Test Song");
    assert_eq!(song.artist_ids, vec!["artist1"]);
    assert_eq!(song.album_id, Some("album1".to_string()));
    assert_eq!(song.duration, Some(std::time::Duration::from_secs(180)));
}

#[test]
fn test_album_creation() {
    let album = Album {
        id: "album1".to_string(),
        name: "Test Album".to_string(),
        artist_ids: vec!["artist1".to_string()],
        song_ids: vec!["song1".to_string(), "song2".to_string()],
        traces: vec![],
    };

    assert_eq!(album.id, "album1");
    assert_eq!(album.name, "Test Album");
    assert_eq!(album.artist_ids, vec!["artist1"]);
    assert_eq!(album.song_ids, vec!["song1", "song2"]);
}

#[test]
fn test_artist_creation() {
    let artist = Artist {
        id: "artist1".to_string(),
        name: "Test Artist".to_string(),
        album_ids: vec!["album1".to_string()],
        song_ids: vec!["song1".to_string()],
        traces: vec![],
    };

    assert_eq!(artist.id, "artist1");
    assert_eq!(artist.name, "Test Artist");
    assert_eq!(artist.album_ids, vec!["album1"]);
    assert_eq!(artist.song_ids, vec!["song1"]);
}

#[test]
fn test_trace_creation() {
    let trace = Trace {
        source_type: SourceType::StorageSource,
        source_id: "local".to_string(),
        object_info: ObjectInfo {
            object_type: "song".to_string(),
            id: "obj1".to_string(),
            details: Some(Details::StorageSong {
                path: "/music/song.mp3".to_string(),
                size: 1024,
                quality: Quality::Lossless,
                fingerprint: Some("abc123".to_string()),
            }),
        },
    };

    assert_eq!(trace.source_type, SourceType::StorageSource);
    assert_eq!(trace.source_id, "local");
    assert_eq!(trace.object_info.object_type, "song");
}

#[test]
fn test_quality_from_bitrate() {
    assert_eq!(Quality::from_bitrate(64), Quality::Standard);
    assert_eq!(Quality::from_bitrate(200), Quality::Normal);
    assert_eq!(Quality::from_bitrate(500), Quality::HighQuality);
    assert_eq!(Quality::from_bitrate(1000), Quality::Lossless);
    assert_eq!(Quality::from_bitrate(2000), Quality::HiRes);
}

#[test]
fn test_details_serde_roundtrip() {
    let details = Details::StorageSong {
        path: "/music/song.flac".to_string(),
        size: 2048,
        quality: Quality::Lossless,
        fingerprint: None,
    };
    let json = serde_json::to_string(&details).unwrap();
    let deserialized: Details = serde_json::from_str(&json).unwrap();
    assert_eq!(json, serde_json::to_string(&deserialized).unwrap());
}
