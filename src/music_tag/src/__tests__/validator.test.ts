/**
 * MusicTag模块 - 验证器和格式化器单元测试
 */

import {
    MusicMetadata,
    Artist,
    Album
} from '../types';

import {
    MetadataValidator,
    MetadataFormatter,
    MetadataCleaner,
    ValidationRule
} from '../validator';

describe('元数据验证器测试', () => {
    let validator: MetadataValidator;

    beforeEach(() => {
        validator = new MetadataValidator();
    });

    const createValidMetadata = (): MusicMetadata => ({
        title: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' }
    });

    describe('基本验证', () => {
        it('应该通过有效的元数据验证', () => {
            const metadata = createValidMetadata();
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('应该检测到空的标题', () => {
            const metadata = createValidMetadata();
            metadata.title = '';
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.code === 'ERR_EMPTY_TITLE')).toBe(true);
        });

        it('应该检测到空的艺术家列表', () => {
            const metadata = createValidMetadata();
            metadata.artists = [];
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.code === 'ERR_EMPTY_ARTISTS')).toBe(true);
        });

        it('应该检测到空的专辑名称', () => {
            const metadata = createValidMetadata();
            metadata.album = { name: '' };
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.code === 'ERR_EMPTY_ALBUM')).toBe(true);
        });
    });

    describe('音轨号验证', () => {
        it('应该接受有效的音轨号', () => {
            const metadata = createValidMetadata();
            metadata.trackNumber = 5;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(true);
        });

        it('应该拒绝无效的音轨号（负数）', () => {
            const metadata = createValidMetadata();
            metadata.trackNumber = -1;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.code === 'ERR_INVALID_TRACK_NUMBER')).toBe(true);
        });

        it('应该拒绝无效的音轨号（过大）', () => {
            const metadata = createValidMetadata();
            metadata.trackNumber = 1000;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
        });
    });

    describe('碟片号验证', () => {
        it('应该接受有效的碟片号', () => {
            const metadata = createValidMetadata();
            metadata.discNumber = 2;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(true);
        });

        it('应该拒绝无效的碟片号', () => {
            const metadata = createValidMetadata();
            metadata.discNumber = 100;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(false);
        });
    });

    describe('年份验证', () => {
        it('应该接受有效年份', () => {
            const metadata = createValidMetadata();
            metadata.year = 2023;
            const result = validator.validate(metadata);
            expect(result.isValid).toBe(true);
        });

        it('应该对无效年份发出警告', () => {
            const metadata = createValidMetadata();
            metadata.year = 999;
            const result = validator.validate(metadata);
            expect(result.warnings.some(w => w.includes('年份'))).toBe(true);
        });
    });

    describe('自定义验证规则', () => {
        it('应该能够注册自定义验证规则', () => {
            const customRule: ValidationRule = {
                name: 'customRule',
                validate: (metadata) => {
                    if (metadata.title.length < 3) {
                        return {
                            field: 'title',
                            message: '标题至少需要3个字符',
                            code: 'ERR_SHORT_TITLE'
                        };
                    }
                    return null;
                }
            };

            validator.registerRule(customRule);
            const metadata = createValidMetadata();
            metadata.title = 'AB';
            const result = validator.validate(metadata);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.code === 'ERR_SHORT_TITLE')).toBe(true);
        });

        it('应该能够移除验证规则', () => {
            const ruleName = 'trackNumberRange';
            validator.removeRule(ruleName);

            const metadata = createValidMetadata();
            metadata.trackNumber = 1000;
            const result = validator.validate(metadata);

            expect(result.errors.some(e => e.code === 'ERR_INVALID_TRACK_NUMBER')).toBe(false);
        });
    });
});

describe('元数据格式化器测试', () => {
    let formatter: MetadataFormatter;

    beforeEach(() => {
        formatter = new MetadataFormatter();
    });

    const createMetadata = (): MusicMetadata => ({
        title: '  Test Song  ',
        artists: [{ name: '  Test Artist  ' }],
        album: { name: '  Test Album  ' },
        genre: '  Rock  '
    });

    it('应该去除首尾空白', () => {
        const metadata = createMetadata();
        const result = formatter.format(metadata);

        expect(result.title).toBe('Test Song');
        expect(result.artists[0].name).toBe('Test Artist');
        expect(result.album.name).toBe('Test Album');
    });

    it('应该去除多余空格', () => {
        const metadata = createMetadata();
        metadata.title = 'Test   Song  Title';
        const result = formatter.format(metadata);

        expect(result.title).toBe('Test Song Title');
    });

    it('应该处理Unicode标准化', () => {
        const metadata = createMetadata();
        metadata.title = 'Café\u0301';
        const result = formatter.format(metadata);

        expect(result.title).toBe('Café');
    });
});

describe('元数据清理器测试', () => {
    it('应该清理空值和无效数据', () => {
        const metadata: MusicMetadata = {
            title: '  Test Song  ',
            artists: [{ name: 'Test Artist' }],
            album: { name: 'Test Album' },
            trackNumber: 0,
            totalTracks: 0,
            year: 0,
            genre: '',
            duration: undefined,
            bitrate: 0
        };

        const cleaned = MetadataCleaner.clean(metadata);

        expect(cleaned.title).toBe('Test Song');
        expect(cleaned.trackNumber).toBeUndefined();
        expect(cleaned.year).toBeUndefined();
        expect(cleaned.genre).toBeUndefined();
        expect(cleaned.duration).toBeUndefined();
    });

    it('应该正确处理艺术家列表', () => {
        const metadata: MusicMetadata = {
            title: 'Test',
            artists: [
                { name: 'Artist 1' },
                { name: '' },
                { name: '  ' },
                { name: 'Artist 2' }
            ],
            album: { name: 'Album' }
        };

        const cleaned = MetadataCleaner.clean(metadata);

        expect(cleaned.artists).toHaveLength(2);
        expect(cleaned.artists[0].name).toBe('Artist 1');
        expect(cleaned.artists[1].name).toBe('Artist 2');
    });

    it('应该处理空专辑', () => {
        const metadata: MusicMetadata = {
            title: 'Test',
            artists: [],
            album: { name: '' }
        };

        const cleaned = MetadataCleaner.clean(metadata);

        expect(cleaned.album.name).toBe('Unknown Album');
    });
});
