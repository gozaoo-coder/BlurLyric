/**
 * MusicTag模块 - 元数据验证和格式化
 * 
 * 提供元数据验证、清理和格式化功能
 */

import {
    MusicMetadata,
    ValidationResult,
    ValidationError,
    Artist,
    Album,
    Picture,
    Lyrics
} from './types';

/**
 * 验证规则接口
 */
export interface ValidationRule {
    /** 规则名称 */
    name: string;
    /** 验证函数 */
    validate: (metadata: MusicMetadata) => ValidationError | null;
}

/**
 * 元数据验证器
 */
export class MetadataValidator {
    private rules: ValidationRule[] = [];
    
    constructor() {
        this.registerDefaultRules();
    }
    
    /**
     * 注册验证规则
     * @param rule 验证规则
     */
    registerRule(rule: ValidationRule): void {
        this.rules.push(rule);
    }
    
    /**
     * 移除验证规则
     * @param name 规则名称
     */
    removeRule(name: string): void {
        const index = this.rules.findIndex(r => r.name === name);
        if (index !== -1) {
            this.rules.splice(index, 1);
        }
    }
    
    /**
     * 验证元数据
     * @param metadata 音乐元数据
     */
    validate(metadata: MusicMetadata): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: string[] = [];
        
        for (const rule of this.rules) {
            const error = rule.validate(metadata);
            if (error) {
                if (error.code.startsWith('WARN_')) {
                    warnings.push(error.message);
                } else {
                    errors.push(error);
                }
            }
        }
        
        // 检查必填字段
        if (!metadata.title || metadata.title.trim() === '') {
            errors.push({
                field: 'title',
                message: '歌曲标题不能为空',
                code: 'ERR_EMPTY_TITLE'
            });
        }
        
        if (!metadata.artists || metadata.artists.length === 0) {
            errors.push({
                field: 'artists',
                message: '艺术家信息不能为空',
                code: 'ERR_EMPTY_ARTISTS'
            });
        }
        
        if (!metadata.album || !metadata.album.name || metadata.album.name.trim() === '') {
            errors.push({
                field: 'album',
                message: '专辑信息不能为空',
                code: 'ERR_EMPTY_ALBUM'
            });
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * 快速验证
     * @param metadata 音乐元数据
     */
    isValid(metadata: MusicMetadata): boolean {
        return this.validate(metadata).isValid;
    }
    
    /**
     * 注册默认验证规则
     */
    private registerDefaultRules(): void {
        // 音轨号范围验证
        this.registerRule({
            name: 'trackNumberRange',
            validate: (metadata) => {
                if (metadata.trackNumber !== undefined) {
                    if (metadata.trackNumber < 0 || metadata.trackNumber > 999) {
                        return {
                            field: 'trackNumber',
                            message: '音轨号必须在0-999范围内',
                            code: 'ERR_INVALID_TRACK_NUMBER'
                        };
                    }
                }
                return null;
            }
        });
        
        // 碟片号范围验证
        this.registerRule({
            name: 'discNumberRange',
            validate: (metadata) => {
                if (metadata.discNumber !== undefined) {
                    if (metadata.discNumber < 0 || metadata.discNumber > 99) {
                        return {
                            field: 'discNumber',
                            message: '碟片号必须在0-99范围内',
                            code: 'ERR_INVALID_DISC_NUMBER'
                        };
                    }
                }
                return null;
            }
        });
        
        // 年份范围验证
        this.registerRule({
            name: 'yearRange',
            validate: (metadata) => {
                if (metadata.year !== undefined) {
                    const currentYear = new Date().getFullYear();
                    if (metadata.year < 1000 || metadata.year > currentYear + 1) {
                        return {
                            field: 'year',
                            message: `年份必须在1000-${currentYear + 1}范围内`,
                            code: 'WARN_INVALID_YEAR'
                        };
                    }
                }
                return null;
            }
        });
        
        // 比特率验证
        this.registerRule({
            name: 'bitrateRange',
            validate: (metadata) => {
                if (metadata.bitrate !== undefined) {
                    if (metadata.bitrate < 1 || metadata.bitrate > 10000) {
                        return {
                            field: 'bitrate',
                            message: '比特率值异常',
                            code: 'WARN_INVALID_BITRATE'
                        };
                    }
                }
                return null;
            }
        });
    }
}

/**
 * 元数据格式化器
 */
export class MetadataFormatter {
    private options: FormatterOptions;
    
    constructor(options: FormatterOptions = {}) {
        this.options = {
            trimWhitespace: true,
            normalizeUnicode: true,
            capitalizeWords: false,
            removeExtraSpaces: true,
            maxTitleLength: 200,
            maxArtistNameLength: 100,
            maxAlbumNameLength: 200,
            ...options
        };
    }
    
    /**
     * 格式化元数据
     * @param metadata 原始元数据
     */
    format(metadata: MusicMetadata): MusicMetadata {
        const formatted: MusicMetadata = {
            ...metadata,
            title: this.formatTitle(metadata.title),
            artists: this.formatArtists(metadata.artists),
            album: this.formatAlbum(metadata.album)
        };
        
        if (metadata.genre) {
            formatted.genre = this.formatString(metadata.genre);
        }
        
        if (metadata.comment) {
            formatted.comment = this.formatString(metadata.comment);
        }
        
        if (metadata.composer) {
            formatted.composer = this.formatString(metadata.composer);
        }
        
        if (metadata.lyricist) {
            formatted.lyricist = this.formatString(metadata.lyricist);
        }
        
        return formatted;
    }
    
    /**
     * 格式化标题
     */
    private formatTitle(title: string): string {
        let formatted = this.formatString(title);
        if (this.options.maxTitleLength && formatted.length > this.options.maxTitleLength) {
            formatted = formatted.substring(0, this.options.maxTitleLength).trim();
        }
        return formatted;
    }
    
    /**
     * 格式化艺术家列表
     */
    private formatArtists(artists: Artist[]): Artist[] {
        return artists.map(artist => ({
            ...artist,
            name: this.formatArtistName(artist.name),
            aliases: artist.aliases?.map(alias => this.formatString(alias))
        }));
    }
    
    /**
     * 格式化艺术家名称
     */
    private formatArtistName(name: string): string {
        let formatted = this.formatString(name);
        if (this.options.maxArtistNameLength && formatted.length > this.options.maxArtistNameLength) {
            formatted = formatted.substring(0, this.options.maxArtistNameLength).trim();
        }
        return formatted;
    }
    
    /**
     * 格式化专辑信息
     */
    private formatAlbum(album: Album): Album {
        const formatted: Album = {
            ...album,
            name: this.formatAlbumName(album.name)
        };
        
        if (album.artist) {
            formatted.artist = this.formatString(album.artist);
        }
        
        return formatted;
    }
    
    /**
     * 格式化专辑名称
     */
    private formatAlbumName(name: string): string {
        let formatted = this.formatString(name);
        if (this.options.maxAlbumNameLength && formatted.length > this.options.maxAlbumNameLength) {
            formatted = formatted.substring(0, this.options.maxAlbumNameLength).trim();
        }
        return formatted;
    }
    
    /**
     * 格式化字符串
     */
    private formatString(str: string): string {
        if (!str) return str;
        
        let formatted = str;
        
        if (this.options.trimWhitespace) {
            formatted = formatted.trim();
        }
        
        if (this.options.removeExtraSpaces) {
            formatted = formatted.replace(/\s+/g, ' ');
        }
        
        if (this.options.normalizeUnicode) {
            formatted = this.normalizeUnicode(formatted);
        }
        
        if (this.options.capitalizeWords) {
            formatted = this.capitalizeWords(formatted);
        }
        
        return formatted;
    }
    
    /**
     * Unicode标准化
     */
    private normalizeUnicode(str: string): string {
        // NFC标准化（组合字符）
        return str.normalize('NFC');
    }
    
    /**
     * 单词首字母大写
     */
    private capitalizeWords(str: string): string {
        return str.replace(/\b\w/g, char => char.toUpperCase());
    }
}

/**
 * 格式化选项接口
 */
export interface FormatterOptions {
    /** 是否去除首尾空白 */
    trimWhitespace?: boolean;
    /** 是否标准化Unicode */
    normalizeUnicode?: boolean;
    /** 是否单词首字母大写 */
    capitalizeWords?: boolean;
    /** 是否去除多余空格 */
    removeExtraSpaces?: boolean;
    /** 标题最大长度 */
    maxTitleLength?: number;
    /** 艺术家名称最大长度 */
    maxArtistNameLength?: number;
    /** 专辑名称最大长度 */
    maxAlbumNameLength?: number;
}

/**
 * 元数据清理器
 */
export class MetadataCleaner {
    /**
     * 清理元数据中的空值和无效数据
     * @param metadata 原始元数据
     */
    static clean(metadata: MusicMetadata): MusicMetadata {
        const cleaned: MusicMetadata = {
            title: metadata.title?.trim() || '',
            artists: this.cleanArtists(metadata.artists),
            album: this.cleanAlbum(metadata.album)
        };
        
        // 复制其他字段，过滤掉空值
        if (metadata.trackNumber !== undefined && metadata.trackNumber > 0) {
            cleaned.trackNumber = metadata.trackNumber;
        }
        
        if (metadata.totalTracks !== undefined && metadata.totalTracks > 0) {
            cleaned.totalTracks = metadata.totalTracks;
        }
        
        if (metadata.discNumber !== undefined && metadata.discNumber > 0) {
            cleaned.discNumber = metadata.discNumber;
        }
        
        if (metadata.totalDiscs !== undefined && metadata.totalDiscs > 0) {
            cleaned.totalDiscs = metadata.totalDiscs;
        }
        
        if (metadata.year !== undefined && metadata.year > 0) {
            cleaned.year = metadata.year;
        }
        
        if (metadata.genre?.trim()) {
            cleaned.genre = metadata.genre.trim();
        }
        
        if (metadata.comment?.trim()) {
            cleaned.comment = metadata.comment.trim();
        }
        
        if (metadata.composer?.trim()) {
            cleaned.composer = metadata.composer.trim();
        }
        
        if (metadata.lyricist?.trim()) {
            cleaned.lyricist = metadata.lyricist.trim();
        }
        
        if (metadata.lyrics?.content?.trim()) {
            cleaned.lyrics = metadata.lyrics;
        }
        
        if (metadata.pictures && metadata.pictures.length > 0) {
            cleaned.pictures = metadata.pictures.filter(p => p.data && p.data.length > 0);
        }
        
        if (metadata.duration !== undefined && metadata.duration > 0) {
            cleaned.duration = metadata.duration;
        }
        
        if (metadata.bitrate !== undefined && metadata.bitrate > 0) {
            cleaned.bitrate = metadata.bitrate;
        }
        
        if (metadata.sampleRate !== undefined && metadata.sampleRate > 0) {
            cleaned.sampleRate = metadata.sampleRate;
        }
        
        if (metadata.channels !== undefined && metadata.channels > 0) {
            cleaned.channels = metadata.channels;
        }
        
        return cleaned;
    }
    
    /**
     * 清理艺术家列表
     */
    private static cleanArtists(artists: Artist[]): Artist[] {
        if (!artists) return [];
        
        return artists
            .filter(artist => artist.name && artist.name.trim() !== '')
            .map(artist => ({
                id: artist.id,
                name: artist.name.trim(),
                aliases: artist.aliases?.filter(alias => alias && alias.trim() !== '')
            }));
    }
    
    /**
     * 清理专辑信息
     */
    private static cleanAlbum(album: Album): Album {
        if (!album) {
            return { name: 'Unknown Album' };
        }
        
        return {
            id: album.id,
            name: album.name?.trim() || 'Unknown Album',
            picUrl: album.picUrl?.trim() || undefined,
            artist: album.artist?.trim() || undefined,
            year: album.year
        };
    }
}

/**
 * 创建默认验证器实例
 */
export const createDefaultValidator = (): MetadataValidator => {
    return new MetadataValidator();
};

/**
 * 创建默认格式化器实例
 */
export const createDefaultFormatter = (options?: FormatterOptions): MetadataFormatter => {
    return new MetadataFormatter(options);
};
