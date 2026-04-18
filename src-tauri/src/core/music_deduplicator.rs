/**
 * Music Deduplicator - 音乐去重合并模块
 *
 * 提供音乐去重、音质评分和合并功能
 */
use crate::cache::music_library_cache::{CachedSongMetadata, TrackSource};
use crate::common::utils;
use crate::music_tag::AudioFormat;
use std::collections::HashMap;
use std::path::Path;

/// 音乐指纹（用于去重）
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct TrackFingerprint {
    normalized_title: String,
    normalized_artists: String,
    normalized_album: String,
}

impl TrackFingerprint {
    /// 从歌曲元数据创建指纹
    pub fn from_song(song: &CachedSongMetadata) -> Self {
        Self {
            normalized_title: normalize_string(&song.name),
            normalized_artists: song
                .artists
                .iter()
                .map(|a| normalize_string(a))
                .collect::<Vec<_>>()
                .join("&"),
            normalized_album: normalize_string(&song.album),
        }
    }

    /// 从Song结构体创建指纹（用于运行时去重）
    pub fn from_raw(name: &str, artists: &[String], album: &str) -> Self {
        Self {
            normalized_title: normalize_string(name),
            normalized_artists: artists
                .iter()
                .map(|a| normalize_string(a))
                .collect::<Vec<_>>()
                .join("&"),
            normalized_album: normalize_string(album),
        }
    }
}

fn normalize_string(s: &str) -> String {
    utils::normalize_for_matching(s)
}

/// 音乐去重器
pub struct MusicDeduplicator {
    tracks: HashMap<TrackFingerprint, Vec<CachedSongMetadata>>,
}

impl MusicDeduplicator {
    /// 创建新的去重器
    pub fn new() -> Self {
        Self {
            tracks: HashMap::new(),
        }
    }

    /// 添加歌曲到去重器
    pub fn add_track(&mut self, song: CachedSongMetadata) {
        let fingerprint = TrackFingerprint::from_song(&song);
        self.tracks
            .entry(fingerprint)
            .or_insert_with(Vec::new)
            .push(song);
    }

    /// 批量添加歌曲
    pub fn add_tracks(&mut self, songs: Vec<CachedSongMetadata>) {
        for song in songs {
            self.add_track(song);
        }
    }

    /// 执行去重合并，返回合并后的歌曲列表
    pub fn deduplicate(&self) -> Vec<MergedTrack> {
        self.tracks
            .iter()
            .map(|(fingerprint, songs)| self.merge_tracks(fingerprint, songs))
            .collect()
    }

    /// 合并同一指纹的多首歌曲
    fn merge_tracks(
        &self,
        fingerprint: &TrackFingerprint,
        songs: &[CachedSongMetadata],
    ) -> MergedTrack {
        if songs.is_empty() {
            panic!("Cannot merge empty track list");
        }

        // 按音质评分排序
        let mut sorted_songs: Vec<_> = songs.iter().collect();
        sorted_songs.sort_by(|a, b| {
            let score_a = get_song_quality_score(a);
            let score_b = get_song_quality_score(b);
            score_b.cmp(&score_a) // 降序排列，音质高的在前
        });

        // 主记录（音质最高的）
        let primary = sorted_songs[0].clone();

        // 构建来源列表
        let mut sources = Vec::new();

        // 主来源
        if let Some(ref source) = primary.primary_source {
            sources.push(source.clone());
        } else {
            // 如果没有primary_source，从fingerprint构建
            let format = Path::new(&primary.fingerprint.path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("unknown")
                .to_string();

            sources.push(TrackSource::from_metadata(
                primary.id,
                primary.fingerprint.path.clone(),
                primary.fingerprint.size,
                primary.fingerprint.modified_time,
                None, // bitrate 未知
                &format,
                None, // sample_rate 未知
                primary.duration,
            ));
        }

        // 其他来源
        for song in sorted_songs.iter().skip(1) {
            if let Some(ref source) = song.primary_source {
                sources.push(source.clone());
            } else {
                let format = Path::new(&song.fingerprint.path)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                sources.push(TrackSource::from_metadata(
                    song.id,
                    song.fingerprint.path.clone(),
                    song.fingerprint.size,
                    song.fingerprint.modified_time,
                    None,
                    &format,
                    None,
                    song.duration,
                ));
            }
        }

        MergedTrack {
            id: primary.id,
            name: primary.name.clone(),
            artists: primary.artists.clone(),
            album: primary.album.clone(),
            track_number: primary.track_number,
            lyric: primary.lyric.clone(),
            duration: primary.duration,
            genre: primary.genre.clone(),
            year: primary.year,
            comment: primary.comment.clone(),
            composer: primary.composer.clone(),
            lyricist: primary.lyricist.clone(),
            fingerprint: primary.fingerprint.clone(),
            cached_at: primary.cached_at,
            sources,
        }
    }

    /// 获取重复统计信息
    pub fn get_stats(&self) -> DeduplicationStats {
        let total_tracks: usize = self.tracks.values().map(|v| v.len()).sum();
        let unique_tracks = self.tracks.len();
        let duplicated_groups = self.tracks.values().filter(|v| v.len() > 1).count();
        let duplicated_tracks = total_tracks - unique_tracks;

        DeduplicationStats {
            total_tracks,
            unique_tracks,
            duplicated_groups,
            duplicated_tracks,
        }
    }
}

impl Default for MusicDeduplicator {
    fn default() -> Self {
        Self::new()
    }
}

/// 合并后的音轨
#[derive(Debug, Clone)]
pub struct MergedTrack {
    pub id: u32,
    pub name: String,
    pub artists: Vec<String>,
    pub album: String,
    pub track_number: u16,
    pub lyric: String,
    pub duration: Option<f64>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub comment: Option<String>,
    pub composer: Option<String>,
    pub lyricist: Option<String>,
    pub fingerprint: crate::cache::music_library_cache::FileFingerprint,
    pub cached_at: u64,
    pub sources: Vec<TrackSource>,
}

impl MergedTrack {
    /// 获取主来源（音质最高的）
    pub fn primary_source(&self) -> Option<&TrackSource> {
        self.sources.first()
    }

    /// 获取替代来源
    pub fn alternative_sources(&self) -> &[TrackSource] {
        if self.sources.len() > 1 {
            &self.sources[1..]
        } else {
            &[]
        }
    }

    /// 获取所有来源数量
    pub fn source_count(&self) -> usize {
        self.sources.len()
    }

    /// 转换为CachedSongMetadata（用于缓存兼容）
    pub fn to_cached_metadata(&self) -> CachedSongMetadata {
        CachedSongMetadata {
            id: self.id,
            name: self.name.clone(),
            artists: self.artists.clone(),
            album: self.album.clone(),
            track_number: self.track_number,
            lyric: self.lyric.clone(),
            fingerprint: self.fingerprint.clone(),
            cached_at: self.cached_at,
            primary_source: self.primary_source().cloned(),
            alternative_sources: self.alternative_sources().to_vec(),
            duration: self.duration,
            genre: self.genre.clone(),
            year: self.year,
            comment: self.comment.clone(),
            composer: self.composer.clone(),
            lyricist: self.lyricist.clone(),
        }
    }
}

/// 去重统计信息
#[derive(Debug, Clone)]
pub struct DeduplicationStats {
    pub total_tracks: usize,
    pub unique_tracks: usize,
    pub duplicated_groups: usize,
    pub duplicated_tracks: usize,
}

/// 计算歌曲音质评分
fn get_song_quality_score(song: &CachedSongMetadata) -> u32 {
    let mut score = 0u32;

    // 如果有primary_source，使用它的评分
    if let Some(ref source) = song.primary_source {
        return source.quality_score;
    }

    // 否则从元数据计算
    // 比特率分数
    // 注意：这里无法直接获取比特率，需要后续改进

    // 格式分数
    let format = Path::new(&song.fingerprint.path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown");

    score += match format.to_lowercase().as_str() {
        "flac" => 500,
        "wav" | "aiff" => 400,
        "aac" | "m4a" => 300,
        "mp3" => 200,
        "ogg" => 250,
        "wma" => 150,
        _ => 100,
    };

    // 时长分数
    if let Some(duration) = song.duration {
        if duration > 180.0 {
            score += 100;
        } else if duration > 60.0 {
            score += 50;
        }
    }

    score
}

/// 检测两首歌曲是否为重复
pub fn is_duplicate(song1: &CachedSongMetadata, song2: &CachedSongMetadata) -> bool {
    let fp1 = TrackFingerprint::from_song(song1);
    let fp2 = TrackFingerprint::from_song(song2);
    fp1 == fp2
}

/// 批量去重（便捷函数）
pub fn deduplicate_tracks(tracks: Vec<CachedSongMetadata>) -> Vec<MergedTrack> {
    let mut deduplicator = MusicDeduplicator::new();
    deduplicator.add_tracks(tracks);
    deduplicator.deduplicate()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_string() {
        assert_eq!(normalize_string("Hello World"), "helloworld");
        assert_eq!(normalize_string("Test (Live)"), "testlive");
        assert_eq!(normalize_string("Song [Remix]"), "songremix");
    }

    #[test]
    fn test_fingerprint_equality() {
        let fp1 = TrackFingerprint::from_raw(
            "Hello World",
            &["Artist1".to_string(), "Artist2".to_string()],
            "Album",
        );
        let fp2 = TrackFingerprint::from_raw(
            "hello world",
            &["artist1".to_string(), "artist2".to_string()],
            "album",
        );
        assert_eq!(fp1, fp2);
    }
}
