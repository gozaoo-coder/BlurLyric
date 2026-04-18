use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Quality {
    Standard,
    Normal,
    HighQuality,
    Lossless,
    HiRes,
}

impl Quality {
    pub fn from_bitrate(bitrate: u32) -> Self {
        match bitrate {
            0..=128 => Quality::Standard,
            129..=320 => Quality::Normal,
            321..=900 => Quality::HighQuality,
            901..=1500 => Quality::Lossless,
            _ => Quality::HiRes,
        }
    }
}

impl Default for Quality {
    fn default() -> Self {
        Quality::Standard
    }
}
