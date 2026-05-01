use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Quality {
    Unknown = 0,
    Standard = 1,
    Normal = 2,
    Lossless = 3,
    HiRes = 4,
}

impl Quality {
    /// 根据媒体信息判定音质等级
    pub fn from_media_info(
        format: Option<&str>,
        sample_rate: Option<u32>,
        bit_depth: Option<u8>,
        bitrate: Option<u32>,
    ) -> Self {
        let format = format.unwrap_or("");

        // Hi-Res: 采样率 > 48kHz 或 位深 > 16bit
        if sample_rate.map_or(false, |sr| sr > 48000)
            || bit_depth.map_or(false, |bd| bd > 16)
        {
            return Quality::HiRes;
        }

        // Lossless: 无损格式且采样率 >= 44.1kHz
        let is_lossless_format = matches!(
            format.to_lowercase().as_str(),
            "flac" | "wav" | "aiff" | "alac" | "ape" | "wmal"
        );
        if is_lossless_format && sample_rate.map_or(true, |sr| sr >= 44100) {
            return Quality::Lossless;
        }

        // Normal: 有损格式中比特率较高的
        if let Some(br) = bitrate {
            if br > 128 {
                return Quality::Normal;
            }
            if br <= 128 {
                return Quality::Standard;
            }
        }

        // 仅有采样率可供判断
        if let Some(sr) = sample_rate {
            if sr < 22050 {
                return Quality::Standard;
            }
            return Quality::Normal;
        }

        Quality::Unknown
    }

    /// 数值评分，用于排序比较
    pub fn score(&self) -> u8 {
        match self {
            Quality::HiRes => 4,
            Quality::Lossless => 3,
            Quality::Normal => 2,
            Quality::Standard => 1,
            Quality::Unknown => 0,
        }
    }

    /// 中文标签
    pub fn label(&self) -> &'static str {
        match self {
            Quality::HiRes => "Hi-Res",
            Quality::Lossless => "无损",
            Quality::Normal => "高品质",
            Quality::Standard => "标准",
            Quality::Unknown => "未知",
        }
    }
}

impl Default for Quality {
    fn default() -> Self {
        Quality::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_hi_res_by_sample_rate() {
        assert_eq!(Quality::from_media_info(Some("flac"), Some(96000), None, None), Quality::HiRes);
    }

    #[test]
    fn test_quality_hi_res_by_bit_depth() {
        assert_eq!(Quality::from_media_info(Some("flac"), Some(44100), Some(24), None), Quality::HiRes);
    }

    #[test]
    fn test_quality_lossless_flac() {
        assert_eq!(Quality::from_media_info(Some("flac"), Some(44100), Some(16), None), Quality::Lossless);
    }

    #[test]
    fn test_quality_lossless_wav() {
        assert_eq!(Quality::from_media_info(Some("wav"), Some(44100), None, None), Quality::Lossless);
    }

    #[test]
    fn test_quality_normal_mp3_320() {
        assert_eq!(Quality::from_media_info(Some("mp3"), Some(44100), None, Some(320)), Quality::Normal);
    }

    #[test]
    fn test_quality_standard_mp3_128() {
        assert_eq!(Quality::from_media_info(Some("mp3"), Some(44100), None, Some(128)), Quality::Standard);
    }

    #[test]
    fn test_quality_unknown() {
        assert_eq!(Quality::from_media_info(None, None, None, None), Quality::Unknown);
    }

    #[test]
    fn test_quality_ordering() {
        assert!(Quality::HiRes > Quality::Lossless);
        assert!(Quality::Lossless > Quality::Normal);
        assert!(Quality::Normal > Quality::Standard);
        assert!(Quality::Standard > Quality::Unknown);
    }

    #[test]
    fn test_quality_scores() {
        assert_eq!(Quality::HiRes.score(), 4);
        assert_eq!(Quality::Lossless.score(), 3);
        assert_eq!(Quality::Normal.score(), 2);
        assert_eq!(Quality::Standard.score(), 1);
        assert_eq!(Quality::Unknown.score(), 0);
    }
}
