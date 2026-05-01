use crate::modules::music_library::object_id::ObjectId;
use crate::modules::music_library::quality::Quality;
use crate::modules::music_library::models::source_song::SourceSong;
use crate::modules::music_library::models::trace_link::TraceLink;
use crate::modules::music_library::models::song_full::SongFull;
use crate::modules::music_library::manager::MusicStorageSourceLibraryManager;

/// 来源优先级
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum SourcePriority {
    Api = 0,
    Temp = 1,
    Local = 2,
    Favor = 3,
}

fn get_source_priority(source_id: &str) -> SourcePriority {
    if source_id.starts_with("favor") {
        SourcePriority::Favor
    } else if source_id.starts_with("local") {
        SourcePriority::Local
    } else if source_id.starts_with("temp") {
        SourcePriority::Temp
    } else {
        SourcePriority::Api
    }
}

impl MusicStorageSourceLibraryManager {
    /// 获取最佳音源路由
    /// 返回 (SourceSong, source_id) 或 None
    pub fn get_best_audio_stream(
        &self,
        master_id: &ObjectId,
        _preferred_quality: Option<Quality>,
    ) -> Option<(SourceSong, String)> {
        let song_full = self.resolve_song_full(master_id)?;

        // 按优先级和音质排序
        let mut candidates: Vec<(SourceSong, String)> = song_full.sources.into_iter()
            .map(|(trace, source_song)| {
                (source_song, trace.source_id)
            })
            .collect();

        candidates.sort_by(|a, b| {
            let prio_a = get_source_priority(&a.1);
            let prio_b = get_source_priority(&b.1);
            let qual_a = a.0.details.quality.score();
            let qual_b = b.0.details.quality.score();
            // 降序：优先级高优先，同优先级音质高优先
            prio_b.cmp(&prio_a)
                .then_with(|| qual_b.cmp(&qual_a))
                .then_with(|| {
                    let bit_a = a.0.details.bitrate.unwrap_or(0);
                    let bit_b = b.0.details.bitrate.unwrap_or(0);
                    bit_b.cmp(&bit_a)
                })
        });

        candidates.into_iter().next()
    }

    /// 获取最佳音源用于获取专辑封面
    pub fn get_best_source_for_cover<'a>(
        &self,
        song_full: &'a SongFull,
    ) -> Option<&'a TraceLink> {
        song_full.song.traces.iter()
            .max_by_key(|trace| get_source_priority(&trace.source_id))
    }
}
