/**
 * MusicTag模块 - 类型定义单元测试
 */

import {
    AudioFormat,
    MetadataStandard,
    PictureType,
    AUDIO_FORMAT_EXTENSIONS,
    METADATA_FIELDS,
    DEFAULT_CONFIG
} from '../types';

describe('类型定义测试', () => {
    describe('AudioFormat枚举', () => {
        it('应该包含所有支持的音频格式', () => {
            expect(AudioFormat.MP3).toBe('mp3');
            expect(AudioFormat.FLAC).toBe('flac');
            expect(AudioFormat.OGG).toBe('ogg');
            expect(AudioFormat.WAV).toBe('wav');
            expect(AudioFormat.AAC).toBe('aac');
            expect(AudioFormat.M4A).toBe('m4a');
            expect(AudioFormat.WMA).toBe('wma');
            expect(AudioFormat.UNKNOWN).toBe('unknown');
        });
    });

    describe('MetadataStandard枚举', () => {
        it('应该包含所有支持的元数据标准', () => {
            expect(MetadataStandard.ID3V1).toBe('id3v1');
            expect(MetadataStandard.ID3V2).toBe('id3v2');
            expect(MetadataStandard.VORBIS_COMMENT).toBe('vorbis_comment');
            expect(MetadataStandard.APE).toBe('ape');
            expect(MetadataStandard.MP4).toBe('mp4');
            expect(MetadataStandard.ASF).toBe('asf');
        });
    });

    describe('PictureType枚举', () => {
        it('应该包含所有支持的图片类型', () => {
            expect(PictureType.FRONT_COVER).toBe(0x03);
            expect(PictureType.BACK_COVER).toBe(0x04);
            expect(PictureType.ARTIST).toBe(0x08);
            expect(PictureType.LEAD_ARTIST).toBe(0x07);
        });
    });

    describe('AUDIO_FORMAT_EXTENSIONS映射', () => {
        it('应该正确映射文件扩展名到音频格式', () => {
            expect(AUDIO_FORMAT_EXTENSIONS['.mp3']).toBe(AudioFormat.MP3);
            expect(AUDIO_FORMAT_EXTENSIONS['.flac']).toBe(AudioFormat.FLAC);
            expect(AUDIO_FORMAT_EXTENSIONS['.ogg']).toBe(AudioFormat.OGG);
            expect(AUDIO_FORMAT_EXTENSIONS['.wav']).toBe(AudioFormat.WAV);
        });
    });

    describe('METADATA_FIELDS常量', () => {
        it('应该包含所有元数据字段', () => {
            expect(METADATA_FIELDS.TITLE).toBe('title');
            expect(METADATA_FIELDS.ARTIST).toBe('artist');
            expect(METADATA_FIELDS.ALBUM).toBe('album');
            expect(METADATA_FIELDS.TRACK_NUMBER).toBe('trackNumber');
            expect(METADATA_FIELDS.YEAR).toBe('year');
            expect(METADATA_FIELDS.GENRE).toBe('genre');
        });
    });

    describe('DEFAULT_CONFIG常量', () => {
        it('应该包含默认配置值', () => {
            expect(DEFAULT_CONFIG.defaultEncoding).toBe('UTF-8');
            expect(DEFAULT_CONFIG.strictMode).toBe(false);
            expect(DEFAULT_CONFIG.logLevel).toBe('info');
            expect(DEFAULT_CONFIG.cache?.enabled).toBe(true);
            expect(DEFAULT_CONFIG.cache?.maxSize).toBe(100);
            expect(DEFAULT_CONFIG.cache?.ttl).toBe(300000);
        });
    });
});
