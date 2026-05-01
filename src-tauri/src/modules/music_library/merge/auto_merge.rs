/// 标准化名称：去标点、小写、trim
pub fn normalize_name(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// 构建歌曲匹配键
pub fn build_song_match_key(
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
pub fn build_album_match_key(name: &str, artist_names: &[String]) -> String {
    let name_norm = normalize_name(name);
    let artist_norm = {
        let mut sorted: Vec<String> = artist_names.iter().map(|n| normalize_name(n)).collect();
        sorted.sort();
        sorted.join("|")
    };
    format!("{}|{}", name_norm, artist_norm)
}

/// 构建艺术家匹配键
pub fn build_artist_match_key(name: &str) -> String {
    normalize_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_basic() {
        assert_eq!(normalize_name("  Hello World! "), "hello world");
        assert_eq!(normalize_name("Test (feat. Artist)"), "test feat artist");
    }

    #[test]
    fn test_song_match_key() {
        let key = build_song_match_key(
            "Hello",
            &["World".to_string()],
            Some("Album Name"),
            Some(240.5),
        );
        assert!(key.contains("hello"));
        assert!(key.contains("world"));
        assert!(key.contains("album name"));
        assert!(key.contains("240"));
    }

    #[test]
    fn test_duration_tolerance() {
        let key1 = build_song_match_key("Test", &[], None, Some(241.0));
        let key2 = build_song_match_key("Test", &[], None, Some(244.0));
        // Both should round to 240
        assert!(key1.contains("240"));
        assert!(key2.contains("240"));
    }

    #[test]
    fn test_different_titles_dont_match() {
        let key1 = build_song_match_key("Song A", &[], None, None);
        let key2 = build_song_match_key("Song B", &[], None, None);
        assert_ne!(key1, key2);
    }
}
