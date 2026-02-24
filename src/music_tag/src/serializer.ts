/**
 * MusicTag模块 - 元数据序列化和反序列化
 * 
 * 提供元数据的序列化和反序列化功能，支持多种格式
 */

import {
    MusicMetadata,
    Song,
    Artist,
    Album,
    Picture,
    Lyrics,
    SerializeOptions,
    MetadataStandard,
    AudioFormat,
    ParseResult
} from './types';

/**
 * 序列化器接口
 */
export interface ISerializer {
    /** 序列化器名称 */
    readonly name: string;
    /** 支持的格式 */
    readonly format: string;
    
    /**
     * 序列化元数据
     * @param metadata 音乐元数据
     * @param options 序列化选项
     */
    serialize(metadata: MusicMetadata, options?: SerializeOptions): string;
    
    /**
     * 反序列化元数据
     * @param data 序列化数据
     */
    deserialize(data: string): ParseResult<MusicMetadata>;
    
    /**
     * 检查是否支持指定格式
     * @param format 格式名称
     */
    supportsFormat(format: string): boolean;
}

/**
 * JSON序列化器
 */
export class JsonSerializer implements ISerializer {
    readonly name = 'JSON Serializer';
    readonly format = 'json';
    
    serialize(metadata: MusicMetadata, options?: SerializeOptions): string {
        const data = this.prepareForSerialization(metadata, options);
        return JSON.stringify(data, null, 2);
    }
    
    deserialize(data: string): ParseResult<MusicMetadata> {
        try {
            const parsed = JSON.parse(data);
            const metadata = this.parseFromObject(parsed);
            return {
                success: true,
                data: metadata
            };
        } catch (error) {
            return {
                success: false,
                error: `JSON解析错误: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    supportsFormat(format: string): boolean {
        return format.toLowerCase() === 'json';
    }
    
    /**
     * 准备元数据用于序列化
     */
    private prepareForSerialization(metadata: MusicMetadata, options?: SerializeOptions): unknown {
        const data: Record<string, unknown> = {
            title: metadata.title,
            artists: metadata.artists.map(artist => ({
                id: artist.id,
                name: artist.name,
                aliases: artist.aliases
            })),
            album: {
                id: metadata.album.id,
                name: metadata.album.name,
                picUrl: metadata.album.picUrl,
                artist: metadata.album.artist,
                year: metadata.album.year
            }
        };
        
        // 添加可选字段
        if (metadata.trackNumber !== undefined) {
            data.trackNumber = metadata.trackNumber;
        }
        if (metadata.totalTracks !== undefined) {
            data.totalTracks = metadata.totalTracks;
        }
        if (metadata.discNumber !== undefined) {
            data.discNumber = metadata.discNumber;
        }
        if (metadata.totalDiscs !== undefined) {
            data.totalDiscs = metadata.totalDiscs;
        }
        if (metadata.year !== undefined) {
            data.year = metadata.year;
        }
        if (metadata.genre) {
            data.genre = metadata.genre;
        }
        if (metadata.comment) {
            data.comment = metadata.comment;
        }
        if (metadata.composer) {
            data.composer = metadata.composer;
        }
        if (metadata.lyricist) {
            data.lyricist = metadata.lyricist;
        }
        if (metadata.lyrics) {
            data.lyrics = metadata.lyrics;
        }
        if (metadata.duration !== undefined) {
            data.duration = metadata.duration;
        }
        if (metadata.bitrate !== undefined) {
            data.bitrate = metadata.bitrate;
        }
        if (metadata.sampleRate !== undefined) {
            data.sampleRate = metadata.sampleRate;
        }
        if (metadata.channels !== undefined) {
            data.channels = metadata.channels;
        }
        
        // 处理图片数据
        if (metadata.pictures && metadata.pictures.length > 0) {
            if (options?.includeBinary) {
                data.pictures = metadata.pictures.map(pic => ({
                    mimeType: pic.mimeType,
                    pictureType: pic.pictureType,
                    description: pic.description,
                    data: this.arrayBufferToBase64(pic.data)
                }));
            } else {
                data.pictures = metadata.pictures.map(pic => ({
                    mimeType: pic.mimeType,
                    pictureType: pic.pictureType,
                    description: pic.description,
                    dataSize: pic.data.length
                }));
            }
        }
        
        return data;
    }
    
    /**
     * 从对象解析元数据
     */
    private parseFromObject(obj: Record<string, unknown>): MusicMetadata {
        const metadata: MusicMetadata = {
            title: String(obj.title || ''),
            artists: this.parseArtists(obj.artists),
            album: this.parseAlbum(obj.album)
        };
        
        if (obj.trackNumber !== undefined) {
            metadata.trackNumber = Number(obj.trackNumber);
        }
        if (obj.totalTracks !== undefined) {
            metadata.totalTracks = Number(obj.totalTracks);
        }
        if (obj.discNumber !== undefined) {
            metadata.discNumber = Number(obj.discNumber);
        }
        if (obj.totalDiscs !== undefined) {
            metadata.totalDiscs = Number(obj.totalDiscs);
        }
        if (obj.year !== undefined) {
            metadata.year = Number(obj.year);
        }
        if (obj.genre) {
            metadata.genre = String(obj.genre);
        }
        if (obj.comment) {
            metadata.comment = String(obj.comment);
        }
        if (obj.composer) {
            metadata.composer = String(obj.composer);
        }
        if (obj.lyricist) {
            metadata.lyricist = String(obj.lyricist);
        }
        if (obj.lyrics) {
            metadata.lyrics = obj.lyrics as Lyrics;
        }
        if (obj.duration !== undefined) {
            metadata.duration = Number(obj.duration);
        }
        if (obj.bitrate !== undefined) {
            metadata.bitrate = Number(obj.bitrate);
        }
        if (obj.sampleRate !== undefined) {
            metadata.sampleRate = Number(obj.sampleRate);
        }
        if (obj.channels !== undefined) {
            metadata.channels = Number(obj.channels);
        }
        if (obj.pictures) {
            metadata.pictures = this.parsePictures(obj.pictures);
        }
        
        return metadata;
    }
    
    /**
     * 解析艺术家列表
     */
    private parseArtists(artistsData: unknown): Artist[] {
        if (!Array.isArray(artistsData)) {
            return [{ name: 'Unknown Artist' }];
        }
        
        return artistsData.map(artist => ({
            id: artist.id as number | undefined,
            name: String(artist.name || 'Unknown Artist'),
            aliases: Array.isArray(artist.aliases) ? artist.aliases.map(String) : undefined
        }));
    }
    
    /**
     * 解析专辑信息
     */
    private parseAlbum(albumData: unknown): Album {
        if (!albumData || typeof albumData !== 'object') {
            return { name: 'Unknown Album' };
        }
        
        const album = albumData as Record<string, unknown>;
        return {
            id: album.id as number | undefined,
            name: String(album.name || 'Unknown Album'),
            picUrl: album.picUrl as string | undefined,
            artist: album.artist as string | undefined,
            year: album.year as number | undefined
        };
    }
    
    /**
     * 解析图片列表
     */
    private parsePictures(picturesData: unknown): Picture[] {
        if (!Array.isArray(picturesData)) {
            return [];
        }
        
        return picturesData.map(pic => ({
            mimeType: String(pic.mimeType || 'image/jpeg'),
            pictureType: Number(pic.pictureType || 0),
            description: String(pic.description || ''),
            data: pic.data ? this.base64ToArrayBuffer(pic.data as string) : new Uint8Array()
        }));
    }
    
    /**
     * ArrayBuffer转Base64
     */
    private arrayBufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Base64转ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

/**
 * XML序列化器
 */
export class XmlSerializer implements ISerializer {
    readonly name = 'XML Serializer';
    readonly format = 'xml';
    
    serialize(metadata: MusicMetadata, options?: SerializeOptions): string {
        const xmlParts: string[] = [];
        xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
        xmlParts.push('<metadata>');
        
        xmlParts.push(`  <title>${this.escapeXml(metadata.title)}</title>`);
        
        xmlParts.push('  <artists>');
        for (const artist of metadata.artists) {
            xmlParts.push('    <artist>');
            xmlParts.push(`      <name>${this.escapeXml(artist.name)}</name>`);
            if (artist.aliases && artist.aliases.length > 0) {
                xmlParts.push('      <aliases>');
                for (const alias of artist.aliases) {
                    xmlParts.push(`        <alias>${this.escapeXml(alias)}</alias>`);
                }
                xmlParts.push('      </aliases>');
            }
            xmlParts.push('    </artist>');
        }
        xmlParts.push('  </artists>');
        
        xmlParts.push('  <album>');
        xmlParts.push(`    <name>${this.escapeXml(metadata.album.name)}</name>`);
        if (metadata.album.artist) {
            xmlParts.push(`    <artist>${this.escapeXml(metadata.album.artist)}</artist>`);
        }
        if (metadata.album.year) {
            xmlParts.push(`    <year>${metadata.album.year}</year>`);
        }
        xmlParts.push('  </album>');
        
        if (metadata.trackNumber !== undefined) {
            xmlParts.push(`  <trackNumber>${metadata.trackNumber}</trackNumber>`);
        }
        if (metadata.year !== undefined) {
            xmlParts.push(`  <year>${metadata.year}</year>`);
        }
        if (metadata.genre) {
            xmlParts.push(`  <genre>${this.escapeXml(metadata.genre)}</genre>`);
        }
        
        xmlParts.push('</metadata>');
        
        return xmlParts.join('\n');
    }
    
    deserialize(data: string): ParseResult<MusicMetadata> {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/xml');
            
            if (doc.getElementsByTagName('parsererror').length > 0) {
                return {
                    success: false,
                    error: 'XML解析错误'
                };
            }
            
            const metadata = this.parseFromXml(doc);
            return {
                success: true,
                data: metadata
            };
        } catch (error) {
            return {
                success: false,
                error: `XML解析错误: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    supportsFormat(format: string): boolean {
        return format.toLowerCase() === 'xml';
    }
    
    /**
     * 从XML文档解析元数据
     */
    private parseFromXml(doc: Document): MusicMetadata {
        const getTextContent = (tagName: string): string => {
            const element = doc.getElementsByTagName(tagName)[0];
            return element ? element.textContent || '' : '';
        };
        
        const metadata: MusicMetadata = {
            title: getTextContent('title'),
            artists: this.parseArtistsFromXml(doc),
            album: {
                name: getTextContent('album'),
                artist: getTextContent('albumArtist') || undefined,
                year: parseInt(getTextContent('year')) || undefined
            }
        };
        
        const trackNumber = parseInt(getTextContent('trackNumber'));
        if (!isNaN(trackNumber)) {
            metadata.trackNumber = trackNumber;
        }
        
        const year = parseInt(getTextContent('year'));
        if (!isNaN(year)) {
            metadata.year = year;
        }
        
        const genre = getTextContent('genre');
        if (genre) {
            metadata.genre = genre;
        }
        
        return metadata;
    }
    
    /**
     * 从XML解析艺术家列表
     */
    private parseArtistsFromXml(doc: Document): Artist[] {
        const artistElements = doc.getElementsByTagName('artist');
        const artists: Artist[] = [];
        
        for (let i = 0; i < artistElements.length; i++) {
            const element = artistElements[i];
            const nameElement = element.getElementsByTagName('name')[0];
            const name = nameElement ? nameElement.textContent || 'Unknown Artist' : 'Unknown Artist';
            
            artists.push({ name });
        }
        
        return artists.length > 0 ? artists : [{ name: 'Unknown Artist' }];
    }
    
    /**
     * XML转义
     */
    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

/**
 * 序列化管理器
 */
export class SerializationManager {
    private serializers: Map<string, ISerializer> = new Map();
    
    constructor() {
        // 注册默认序列化器
        this.register(new JsonSerializer());
        this.register(new XmlSerializer());
    }
    
    /**
     * 注册序列化器
     * @param serializer 序列化器实例
     */
    register(serializer: ISerializer): void {
        this.serializers.set(serializer.format.toLowerCase(), serializer);
    }
    
    /**
     * 获取序列化器
     * @param format 格式名称
     */
    getSerializer(format: string): ISerializer | undefined {
        return this.serializers.get(format.toLowerCase());
    }
    
    /**
     * 序列化元数据
     * @param metadata 音乐元数据
     * @param format 目标格式
     * @param options 序列化选项
     */
    serialize(metadata: MusicMetadata, format: string, options?: SerializeOptions): string {
        const serializer = this.getSerializer(format);
        if (!serializer) {
            throw new Error(`不支持的序列化格式: ${format}`);
        }
        return serializer.serialize(metadata, options);
    }
    
    /**
     * 反序列化元数据
     * @param data 序列化数据
     * @param format 数据格式
     */
    deserialize(data: string, format: string): ParseResult<MusicMetadata> {
        const serializer = this.getSerializer(format);
        if (!serializer) {
            return {
                success: false,
                error: `不支持的序列化格式: ${format}`
            };
        }
        return serializer.deserialize(data);
    }
    
    /**
     * 获取支持的格式列表
     */
    getSupportedFormats(): string[] {
        return Array.from(this.serializers.keys());
    }
}

/**
 * 全局序列化管理器实例
 */
export const globalSerializationManager = new SerializationManager();

/**
 * 便捷函数：序列化为JSON
 */
export function toJson(metadata: MusicMetadata, options?: SerializeOptions): string {
    return globalSerializationManager.serialize(metadata, 'json', options);
}

/**
 * 便捷函数：从JSON反序列化
 */
export function fromJson(data: string): ParseResult<MusicMetadata> {
    return globalSerializationManager.deserialize(data, 'json');
}

/**
 * 便捷函数：序列化为XML
 */
export function toXml(metadata: MusicMetadata, options?: SerializeOptions): string {
    return globalSerializationManager.serialize(metadata, 'xml', options);
}

/**
 * 便捷函数：从XML反序列化
 */
export function fromXml(data: string): ParseResult<MusicMetadata> {
    return globalSerializationManager.deserialize(data, 'xml');
}
