use std::fs::DirEntry;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::constants::*;

pub fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn is_music_file(entry: &DirEntry) -> bool {
    entry
        .path()
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| MUSIC_EXTENSIONS.contains(&ext))
}

pub fn is_music_file_by_path<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| MUSIC_EXTENSIONS.contains(&ext))
}

pub fn normalize_for_matching(s: &str) -> String {
    s.to_lowercase()
        .trim()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
        .replace("'", "")
        .replace("\"", "")
        .replace("(", "")
        .replace(")", "")
        .replace("[", "")
        .replace("]", "")
        .replace("，", "")
        .replace(",", "")
}

pub fn calculate_audio_quality_score(
    bitrate: Option<u32>,
    format: &str,
    sample_rate: Option<u32>,
    duration: Option<f64>,
) -> u32 {
    let mut score = 0u32;

    if let Some(bitrate) = bitrate {
        score += bitrate.min(BITRATE_MAX_SCORE);
    }

    score += match format.to_lowercase().as_str() {
        "flac" => QUALITY_SCORE_FLAC,
        "wav" | "aiff" => QUALITY_SCORE_WAV_AIFF,
        "aac" | "m4a" => QUALITY_SCORE_AAC_M4A,
        "mp3" => QUALITY_SCORE_MP3,
        "ogg" => QUALITY_SCORE_OGG,
        "wma" => QUALITY_SCORE_WMA,
        _ => QUALITY_SCORE_UNKNOWN,
    };

    if let Some(sample_rate) = sample_rate {
        score += (sample_rate / 100).min(SAMPLE_RATE_MAX_SCORE);
    }

    if let Some(duration) = duration {
        if duration > DURATION_LONG_THRESHOLD_SECS {
            score += DURATION_LONG_BONUS;
        } else if duration > DURATION_MEDIUM_THRESHOLD_SECS {
            score += DURATION_MEDIUM_BONUS;
        }
    }

    score
}

pub fn get_base_cache_dir() -> Result<PathBuf, String> {
    let path = dirs::cache_dir().ok_or("Cannot get cache directory")?;
    Ok(path.join(CACHE_DIR_NAME))
}

pub fn ensure_cache_dir(path: &Path) -> Result<(), String> {
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn sanitize_filename(name: String) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
                c.to_string()
            } else {
                "_".to_string()
            }
        })
        .collect();
    if sanitized.len() > MAX_FILENAME_LENGTH {
        let mut truncated = sanitized
            .chars()
            .take(MAX_FILENAME_LENGTH)
            .collect::<String>();
        while truncated.ends_with('.') || truncated.ends_with('_') {
            if !truncated.is_empty() {
                truncated.pop();
            } else {
                break;
            }
        }
        truncated
    } else {
        sanitized
    }
}

pub fn validate_path_within_base(path: &Path, base_dir: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    let base_canonical = base_dir
        .canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    if !canonical.starts_with(&base_canonical) {
        return Err("Path traversal detected: access denied".to_string());
    }
    Ok(canonical)
}
