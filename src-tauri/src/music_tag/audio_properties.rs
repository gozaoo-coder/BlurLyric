use std::path::Path;

pub fn parse_audio_properties(path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "flac" => parse_flac_properties(path),
        "wav" | "wave" => parse_wav_properties(path),
        "mp3" => parse_mp3_properties(path),
        "ogg" => parse_ogg_vorbis_properties(path),
        "m4a" | "aac" => parse_m4a_properties(path),
        _ => (None, None, None, None),
    }
}

fn parse_flac_properties(path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_) => return (None, None, None, None),
    };

    if data.len() < 42 || &data[0..4] != b"fLaC" {
        return (None, None, None, None);
    }

    let block_header = data[4];
    let block_size = ((data[5] as usize) << 16) | ((data[6] as usize) << 8) | (data[7] as usize);

    if (block_header & 0x7F) != 0 || block_size < 34 || data.len() < 8 + block_size {
        return (None, None, None, None);
    }

    let si = &data[8..8 + 34];

    let sample_rate_bits = u32::from_be_bytes([si[10], si[11], si[12], si[13]]);
    let sample_rate = (sample_rate_bits >> 12) & 0xFFFFF;
    if sample_rate == 0 {
        return (None, None, None, None);
    }

    let channels = (((sample_rate_bits >> 9) & 0x07) + 1) as u8;

    let total_samples = ((si[14] as u64) << 24)
        | ((si[15] as u64) << 16)
        | ((si[16] as u64) << 8)
        | (si[17] as u64)
        | ((si[18] as u64) << 32)
        | ((si[19] as u64) << 40)
        | ((si[20] as u64) << 48)
        | ((si[21] as u64) << 56);

    if total_samples == 0xFFFFFFFFFFFF {
        return (
            Some(0.0),
            Some(sample_rate),
            Some(sample_rate),
            Some(channels),
        );
    }

    let duration = total_samples as f64 / sample_rate as f64;
    (Some(duration), None, Some(sample_rate), Some(channels))
}

fn parse_wav_properties(path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_) => return (None, None, None, None),
    };

    if data.len() < 44 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
        return (None, None, None, None);
    }

    let sample_rate = u32::from_le_bytes([data[24], data[25], data[26], data[27]]);
    if sample_rate == 0 {
        return (None, None, None, None);
    }

    let byte_rate = u32::from_le_bytes([data[28], data[29], data[30], data[31]]);
    if byte_rate == 0 {
        return (None, None, None, None);
    }

    let channels = u16::from_le_bytes([data[22], data[23]]) as u8;
    let mut pos = 12u32;

    while pos + 8 <= data.len() as u32 {
        let chunk_id = &data[pos as usize..pos as usize + 4];
        let chunk_size = u32::from_le_bytes([
            data[pos as usize + 4],
            data[pos as usize + 5],
            data[pos as usize + 6],
            data[pos as usize + 7],
        ]);

        if chunk_id == b"data" {
            let duration = chunk_size as f64 / byte_rate as f64;
            return (Some(duration), None, Some(sample_rate), Some(channels));
        }

        pos += 8 + chunk_size;
        if chunk_size % 2 != 0 {
            pos += 1;
        }
    }

    (None, None, Some(sample_rate), Some(channels))
}

fn parse_mp3_properties(path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_) => return (None, None, None, None),
    };

    if data.len() < 4 {
        return (None, None, None, None);
    }

    let mut pos = 0usize;

    let is_id3v2 = data.len() >= 10 && &data[0..3] == b"ID3";
    if is_id3v2 {
        let size = ((data[6] as usize) << 21)
            | ((data[7] as usize) << 14)
            | ((data[8] as usize) << 7)
            | (data[9] as usize);
        pos = 10 + size;
    }

    let mut first_frame_header: Option<u32> = None;
    let mut frame_count = 0u64;
    let mut total_samples = 0u64;
    let mut sample_rate = 0u32;
    let mut channels = 0u8;
    let mut vbr_bytes_found = false;
    let mut vbr_frame_count: Option<u64> = None;

    while pos + 4 <= data.len() {
        if pos > 0 && data.len() > pos + 16 {
            let slice = &data[pos..pos + 4.min(data.len() - pos)];
            if slice == b"ID3" || slice == b"Lyric" || slice == b"TAG" {
                break;
            }
            if slice.starts_with(b"Xing") || slice.starts_with(b"Info") {
                let xing_pos = pos + 4;
                if xing_pos + 4 <= data.len() {
                    let flags = u32::from_be_bytes([
                        data[xing_pos],
                        data[xing_pos + 1],
                        data[xing_pos + 2],
                        data[xing_pos + 3],
                    ]);
                    let mut offset = xing_pos + 4;
                    if flags & 0x01 != 0 && offset + 4 <= data.len() {
                        vbr_frame_count = Some(u32::from_be_bytes([
                            data[offset],
                            data[offset + 1],
                            data[offset + 2],
                            data[offset + 3],
                        ]) as u64);
                        offset += 4;
                    }
                    if flags & 0x02 != 0 && offset + 4 <= data.len() {
                        let _vbr_bytes = u32::from_be_bytes([
                            data[offset],
                            data[offset + 1],
                            data[offset + 2],
                            data[offset + 3],
                        ]);
                        vbr_bytes_found = true;
                    }
                }
                pos += 120;
                continue;
            }
        }

        let header = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);

        if (header & 0xFFE00000) != 0xFFE00000 {
            pos += 1;
            continue;
        }

        let version = (header >> 19) & 0x03;
        let layer = (header >> 17) & 0x03;
        let bitrate_idx = (header >> 12) & 0x0F;
        let sr_idx = (header >> 10) & 0x03;
        let padding = (header >> 9) & 0x01;
        let channel_mode = (header >> 6) & 0x03;

        if version == 1
            || layer == 0
            || layer == 3
            || bitrate_idx == 0
            || bitrate_idx == 15
            || sr_idx == 3
        {
            pos += 1;
            continue;
        }

        let sr_table = [44100, 48000, 32000];
        let br_table_mpeg1_v1 = [
            0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 288, 320, 0,
        ];
        let br_table_mpeg1_v2 = [
            0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
        ];
        let br_table_mpeg2 = [
            0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
        ];

        sample_rate = sr_table[sr_idx as usize];
        channels = if channel_mode == 3 { 1 } else { 2 };

        let br_index = bitrate_idx as usize;
        let br_kbps = if version == 3 {
            if layer == 1 {
                br_table_mpeg1_v2[br_index]
            } else {
                br_table_mpeg1_v1[br_index]
            }
        } else {
            br_table_mpeg2[br_index]
        };
        let br = (br_kbps as u64) * 1000;

        if first_frame_header.is_none() {
            first_frame_header = Some(header);
        }

        let samples_per_frame = if version == 3 { 1152 } else { 576 };
        let frame_length = if version == 3 {
            if layer == 1 {
                (48_000 * br / sample_rate as u64 + padding as u64) as usize
            } else {
                (144_000 * br / sample_rate as u64 + padding as u64) as usize
            }
        } else {
            (72_000 * br / sample_rate as u64 + padding as u64) as usize
        };

        if frame_length < 4 {
            break;
        }
        frame_count += 1;
        total_samples += samples_per_frame as u64;
        pos += frame_length;

        if frame_count >= 500 {
            let remaining = data.len().saturating_sub(pos);
            if remaining > 0 && frame_length > 0 {
                let est_additional = remaining / frame_length;
                frame_count += est_additional as u64;
                total_samples += est_additional as u64 * samples_per_frame as u64;
            }
            break;
        }
    }

    if frame_count == 0 || sample_rate == 0 {
        return (None, None, None, None);
    }

    let final_frame_count = vbr_frame_count.unwrap_or(frame_count);
    let duration = final_frame_count as f64 * {
        if first_frame_header.map(|h| (h >> 19) & 0x03) == Some(3) {
            1152.0
        } else {
            576.0
        }
    } / sample_rate as f64;

    (Some(duration), None, Some(sample_rate), Some(channels))
}

fn parse_ogg_vorbis_properties(path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_) => return (None, None, None, None),
    };

    if data.len() < 4 || &data[0..4] != b"OggS" {
        return (None, None, None, None);
    }

    let mut pos = 0usize;
    let mut page_count = 0u32;
    let mut granule_position: i64 = 0;
    let mut sample_rate = 0u32;
    let mut channels = 0u8;

    while pos + 27 <= data.len() && page_count < 3 {
        if &data[pos..pos + 4] != b"OggS" {
            break;
        }

        let gp_raw: i64 = (data[pos + 6] as i64)
            | ((data[pos + 7] as i64) << 8)
            | ((data[pos + 8] as i64) << 16)
            | ((data[pos + 9] as i64) << 24)
            | ((data[pos + 10] as i64) << 32)
            | ((data[pos + 11] as i64) << 40)
            | ((data[pos + 12] as i64) << 48)
            | ((data[pos + 13] as i64) << 56);

        let num_segments = data[pos + 26] as usize;
        let seg_start = pos + 27;
        if seg_start + num_segments > data.len() {
            break;
        }

        let mut page_size = 0usize;
        for i in 0..num_segments {
            page_size += data[seg_start + i] as usize;
        }
        let page_data_start = seg_start + num_segments;
        let page_data_end = (page_data_start + page_size).min(data.len());
        let page_data = &data[page_data_start..page_data_end];

        if page_count == 1 && page_data.len() >= 30 {
            if page_data.len() > 7 && &page_data[1..7] == b"vorbis" {
                sample_rate = u32::from_le_bytes([
                    page_data[12],
                    page_data[13],
                    page_data[14],
                    page_data[15],
                ]);
                channels = page_data[11];
            }
        }

        granule_position = gp_raw;
        page_count += 1;
        pos = page_data_start + page_size;
    }

    if sample_rate == 0 || granule_position <= 0 {
        return (None, None, None, None);
    }

    let duration = granule_position as f64 / sample_rate as f64;
    (Some(duration), None, Some(sample_rate), Some(channels))
}

fn parse_m4a_properties(_path: &Path) -> (Option<f64>, Option<u32>, Option<u32>, Option<u8>) {
    (None, None, None, None)
}
