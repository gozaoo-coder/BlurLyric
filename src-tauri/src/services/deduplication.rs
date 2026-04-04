// 歌曲去重与合并服务
//
// 本模块负责：
// - 生成歌曲指纹用于识别重复歌曲
// - 对歌曲列表进行去重处理
// - 合并多首相同歌曲（按音质排序）

use std::collections::HashMap;

use crate::models::legacy::Song;
use crate::common::utils;

/// 对歌曲列表进行去重合并
///
/// 使用指纹算法将相似歌曲分组，
/// 然后对每组中的多首歌曲进行合并。
///
/// # 参数
/// - `songs`: 原始歌曲列表（可能包含重复）
///
/// # 返回值
/// 去重合并后的歌曲列表
pub fn deduplicate_songs(songs: Vec<Song>) -> Vec<Song> {
    // 使用指纹作为key进行分组
    let mut groups: HashMap<String, Vec<Song>> = HashMap::new();
    
    for song in songs {
        // 生成指纹（标准化后的标题+艺术家+专辑）
        let fingerprint = generate_fingerprint(&song);
        groups.entry(fingerprint).or_insert_with(Vec::new).push(song);
    }
    
    // 合并每组歌曲
    let mut result = Vec::new();
    for (_, group) in groups {
        if group.len() == 1 {
            // 只有一首，直接添加
            result.push(group.into_iter().next().unwrap());
        } else {
            // 有多首，合并它们
            let merged = merge_songs(group);
            result.push(merged);
        }
    }
    
    result
}

/// 生成歌曲指纹
///
/// 指纹由标准化后的标题、艺术家、专辑名称组成，
/// 用于识别相同或相似的歌曲。
///
/// # 参数
/// - `song`: 歌曲对象
///
/// # 返回值
/// 格式为 "标题|艺术家1&艺术家2|专辑" 的字符串
pub fn generate_fingerprint(song: &Song) -> String {
    let normalized_title = normalize_for_dedup(&song.name);
    let normalized_artists: Vec<String> = song.ar.iter()
        .map(|a| normalize_for_dedup(&a.name))
        .collect();
    let normalized_album = normalize_for_dedup(&song.al.name);
    
    format!("{}|{}|{}", 
        normalized_title,
        normalized_artists.join("&"),
        normalized_album
    )
}

/// 标准化字符串用于去重比较（委托给 utils）
///
/// # 参数
/// - `s`: 输入字符串
///
/// # 返回值
/// 标准化后的字符串（小写、去除特殊字符等）
pub fn normalize_for_dedup(s: &str) -> String {
    utils::normalize_for_matching(s)
}

/// 合并多首相同歌曲（按音质排序）
///
/// 当检测到多首相同歌曲时，选择音质最高的作为主来源，
/// 其他来源作为替代来源保留。
///
/// # 参数
/// - `songs`: 需要合并的歌曲列表（至少2首）
///
/// # 返回值
/// 合并后的单首歌曲对象
pub fn merge_songs(mut songs: Vec<Song>) -> Song {
    // 按音质评分排序（降序）
    songs.sort_by(|a, b| {
        let score_a = calculate_song_quality_score(a);
        let score_b = calculate_song_quality_score(b);
        score_b.cmp(&score_a)
    });
    
    // 主歌曲（音质最高的）
    let mut primary = songs.remove(0);
    
    // 收集所有来源
    let mut all_sources = primary.sources.clone();
    
    // 添加其他歌曲的来源
    for song in songs {
        all_sources.extend(song.sources);
    }
    
    // 重新计算音质评分并排序来源
    all_sources.sort_by(|a, b| b.quality_score.cmp(&a.quality_score));
    
    // 更新主歌曲的来源信息
    primary.sources = all_sources;
    primary.primary_source_index = 0;
    
    // 更新主歌曲的路径为音质最高的来源
    if let Some(best_source) = primary.sources.first() {
        primary.src = std::path::PathBuf::from(&best_source.path);
    }
    
    primary
}

/// 计算单首歌曲的音质评分
///
/// 综合考虑比特率、文件格式、采样率等因素。
///
/// # 参数
/// - `song`: 歌曲对象
///
/// # 返回值
/// 音质评分（0-100）
fn calculate_song_quality_score(song: &Song) -> u32 {
    let format = song.src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown");
    utils::calculate_audio_quality_score(song.bitrate, format, song.sample_rate, song.duration)
}
