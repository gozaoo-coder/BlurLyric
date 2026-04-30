use std::path::Path;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use super::MetadataParser;

impl MetadataParser {
    pub fn parse_duration<P: AsRef<Path>>(&self, path: P) -> Option<f64> {
        let path = path.as_ref();

        let file = std::fs::File::open(path).ok()?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let format_opts: FormatOptions = Default::default();
        let metadata_opts: MetadataOptions = Default::default();
        let decoder_opts: DecoderOptions = Default::default();

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts)
            .ok()?;

        let mut format = probed.format;

        let track = format.tracks().first()?;

        if let Some(duration) = track.codec_params.time_base {
            if let Some(n_frames) = track.codec_params.n_frames {
                let duration_secs = n_frames as f64 * duration.numer as f64 / duration.denom as f64;
                return Some(duration_secs);
            }
        }

        let _decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &decoder_opts)
            .ok()?;

        if let Some(duration) = format.default_track().and_then(|t| t.codec_params.time_base) {
            if let Some(n_frames) = format.default_track().and_then(|t| t.codec_params.n_frames) {
                let duration_secs = n_frames as f64 * duration.numer as f64 / duration.denom as f64;
                return Some(duration_secs);
            }
        }

        None
    }

    pub(super) fn parse_audio_properties<P: AsRef<Path>>(&self, path: P) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
        let path = path.as_ref();

        let file = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(_) => return (None, None, None, None),
        };

        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let format_opts: FormatOptions = Default::default();
        let metadata_opts: MetadataOptions = Default::default();

        let probed = match symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts) {
            Ok(p) => p,
            Err(_) => return (None, None, None, None),
        };

        let format = probed.format;

        let track = match format.tracks().first() {
            Some(t) => t,
            None => return (None, None, None, None),
        };

        let params = &track.codec_params;

        let duration = if let Some(time_base) = params.time_base {
            params.n_frames.map(|n_frames| {
                n_frames as f64 * time_base.numer as f64 / time_base.denom as f64
            })
        } else {
            None
        };

        let sample_rate = params.sample_rate;
        let channels = params.channels.map(|c| c.count() as u8);

        (duration, None, sample_rate, channels)
    }
}
