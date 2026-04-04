pub const MAX_FILENAME_LENGTH: usize = 50;

pub const QUALITY_SCORE_FLAC: u32 = 500;
pub const QUALITY_SCORE_WAV_AIFF: u32 = 400;
pub const QUALITY_SCORE_OGG: u32 = 250;
pub const QUALITY_SCORE_AAC_M4A: u32 = 300;
pub const QUALITY_SCORE_MP3: u32 = 200;
pub const QUALITY_SCORE_WMA: u32 = 150;
pub const QUALITY_SCORE_UNKNOWN: u32 = 100;

pub const BITRATE_MAX_SCORE: u32 = 320;
pub const SAMPLE_RATE_MAX_SCORE: u32 = 480;
pub const DURATION_LONG_BONUS: u32 = 100;
pub const DURATION_MEDIUM_BONUS: u32 = 50;
pub const DURATION_LONG_THRESHOLD_SECS: f64 = 180.0;
pub const DURATION_MEDIUM_THRESHOLD_SECS: f64 = 60.0;

pub const MUSIC_EXTENSIONS: &[&str] = &["mp3", "ogg", "flac", "m4a", "wav", "aac"];

pub const CACHE_DIR_NAME: &str = "com.blurlyric.app";
pub const RESOURCE_CACHE_SUBDIR: &str = "resource_cache";
