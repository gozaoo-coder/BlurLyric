/**
 * MusicTag模块 - 序列化器单元测试
 */

import {
    MusicMetadata,
    Artist,
    Album,
    Picture,
    PictureType
} from '../types';

import {
    JsonSerializer,
    XmlSerializer,
    SerializationManager,
    toJson,
    fromJson,
    toXml,
    fromXml
} from '../serializer';

describe('JSON序列化器测试', () => {
    let serializer: JsonSerializer;

    beforeEach(() => {
        serializer = new JsonSerializer();
    });

    const createMetadata = (): MusicMetadata => ({
        title: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' },
        trackNumber: 5,
        year: 2023,
        genre: 'Rock'
    });

    describe('序列化', () => {
        it('应该正确序列化元数据', () => {
            const metadata = createMetadata();
            const json = serializer.serialize(metadata);
            const parsed = JSON.parse(json);

            expect(parsed.title).toBe('Test Song');
            expect(parsed.artists).toHaveLength(1);
            expect(parsed.artists[0].name).toBe('Test Artist');
            expect(parsed.album.name).toBe('Test Album');
            expect(parsed.trackNumber).toBe(5);
            expect(parsed.year).toBe(2023);
            expect(parsed.genre).toBe('Rock');
        });

        it('应该处理包含图片的元数据', () => {
            const metadata = createMetadata();
            const picture: Picture = {
                mimeType: 'image/jpeg',
                pictureType: PictureType.FRONT_COVER,
                description: 'Cover',
                data: new Uint8Array([1, 2, 3, 4, 5])
            };
            metadata.pictures = [picture];

            const json = serializer.serialize(metadata, { includeBinary: true });
            const parsed = JSON.parse(json);

            expect(parsed.pictures).toHaveLength(1);
            expect(parsed.pictures[0].mimeType).toBe('image/jpeg');
            expect(parsed.pictures[0].data).toBeDefined();
        });
    });

    describe('反序列化', () => {
        it('应该正确反序列化JSON', () => {
            const metadata = createMetadata();
            const json = serializer.serialize(metadata);
            const result = serializer.deserialize(json);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.title).toBe('Test Song');
            expect(result.data!.artists[0].name).toBe('Test Artist');
        });

        it('应该处理无效的JSON', () => {
            const result = serializer.deserialize('invalid json');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('应该处理空数据', () => {
            const result = serializer.deserialize('{}');

            expect(result.success).toBe(true);
            expect(result.data!.title).toBe('');
            expect(result.data!.artists[0].name).toBe('Unknown Artist');
        });
    });

    describe('格式支持', () => {
        it('应该支持JSON格式', () => {
            expect(serializer.supportsFormat('json')).toBe(true);
            expect(serializer.supportsFormat('JSON')).toBe(true);
        });

        it('不应该支持其他格式', () => {
            expect(serializer.supportsFormat('xml')).toBe(false);
            expect(serializer.supportsFormat('yaml')).toBe(false);
        });
    });
});

describe('XML序列化器测试', () => {
    let serializer: XmlSerializer;

    beforeEach(() => {
        serializer = new XmlSerializer();
    });

    const createMetadata = (): MusicMetadata => ({
        title: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' },
        trackNumber: 5,
        year: 2023,
        genre: 'Rock'
    });

    describe('序列化', () => {
        it('应该正确序列化元数据到XML', () => {
            const metadata = createMetadata();
            const xml = serializer.serialize(metadata);

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<metadata>');
            expect(xml).toContain('<title>Test Song</title>');
            expect(xml).toContain('<name>Test Artist</name>');
            expect(xml).toContain('<name>Test Album</name>');
        });

        it('应该正确处理XML特殊字符', () => {
            const metadata = createMetadata();
            metadata.title = 'Test <Song> & "Title"';
            const xml = serializer.serialize(metadata);

            expect(xml).toContain('&lt;Song&gt;');
            expect(xml).toContain('&amp;');
            expect(xml).toContain('&quot;Title&quot;');
        });
    });

    describe('格式支持', () => {
        it('应该支持XML格式', () => {
            expect(serializer.supportsFormat('xml')).toBe(true);
            expect(serializer.supportsFormat('XML')).toBe(true);
        });

        it('不应该支持其他格式', () => {
            expect(serializer.supportsFormat('json')).toBe(false);
        });
    });
});

describe('序列化管理器测试', () => {
    let manager: SerializationManager;

    beforeEach(() => {
        manager = new SerializationManager();
    });

    const createMetadata = (): MusicMetadata => ({
        title: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' }
    });

    describe('格式管理', () => {
        it('应该支持JSON格式', () => {
            const formats = manager.getSupportedFormats();
            expect(formats).toContain('json');
        });

        it('应该支持XML格式', () => {
            const formats = manager.getSupportedFormats();
            expect(formats).toContain('xml');
        });
    });

    describe('序列化和反序列化', () => {
        it('应该正确序列化为JSON', () => {
            const metadata = createMetadata();
            const json = manager.serialize(metadata, 'json');
            const parsed = JSON.parse(json);

            expect(parsed.title).toBe('Test Song');
        });

        it('应该正确反序列化JSON', () => {
            const metadata = createMetadata();
            const json = manager.serialize(metadata, 'json');
            const result = manager.deserialize(json, 'json');

            expect(result.success).toBe(true);
            expect(result.data!.title).toBe('Test Song');
        });

        it('应该对不支持的格式返回错误', () => {
            const metadata = createMetadata();

            expect(() => {
                manager.serialize(metadata, 'unsupported');
            }).toThrow('不支持的序列化格式');
        });
    });
});

describe('便捷函数测试', () => {
    const createMetadata = (): MusicMetadata => ({
        title: 'Test Song',
        artists: [{ name: 'Test Artist' }],
        album: { name: 'Test Album' }
    });

    it('toJson应该正确工作', () => {
        const metadata = createMetadata();
        const json = toJson(metadata);
        const parsed = JSON.parse(json);

        expect(parsed.title).toBe('Test Song');
    });

    it('fromJson应该正确工作', () => {
        const metadata = createMetadata();
        const json = toJson(metadata);
        const result = fromJson(json);

        expect(result.success).toBe(true);
        expect(result.data!.title).toBe('Test Song');
    });

    it('toXml应该正确工作', () => {
        const metadata = createMetadata();
        const xml = toXml(metadata);

        expect(xml).toContain('<title>Test Song</title>');
    });
});
