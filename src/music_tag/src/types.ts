/**
 * MusicTag模块 - 核心类型定义
 * 
 * 提供音乐元数据的完整类型系统，包括歌曲、艺术家、专辑等核心数据结构
 */

/**
 * 音频文件格式枚举
 */
export enum AudioFormat {
    MP3 = 'mp3',
    FLAC = 'flac',
    OGG = 'ogg',
    WAV = 'wav',
    AAC = 'aac',
    M4A = 'm4a',
    WMA = 'wma',
    UNKNOWN = 'unknown'
}

/**
 * 元数据标准类型枚举
 */
export enum MetadataStandard {
    ID3V1 = 'id3v1',
    ID3V2 = 'id3v2',
    VORBIS_COMMENT = 'vorbis_comment',
    APE = 'ape',
    MP4 = 'mp4',
    ASF = 'asf',
    UNKNOWN = 'unknown'
}

/**
 * 图片类型枚举
 */
export enum PictureType {
    OTHER = 0x00,
    FILE_ICON = 0x01,
    OTHER_FILE_ICON = 0x02,
    FRONT_COVER = 0x03,
    BACK_COVER = 0x04,
    LEAFLET_PAGE = 0x05,
    MEDIA = 0x06,
    LEAD_ARTIST = 0x07,
    ARTIST = 0x08,
    CONDUCTOR = 0x09,
    BAND = 0x0A,
    COMPOSER = 0x0B,
    LYRICIST = 0x0C,
    RECORDING_LOCATION = 0x0D,
    DURING_RECORDING = 0x0E,
    DURING_PERFORMANCE = 0x0F,
    VIDEO_SCREEN_CAPTURE = 0x10,
    FISH = 0x11,
    ILLUSTRATION = 0x12,
    BAND_LOGOTYPE = 0x13,
    PUBLISHER_LOGOTYPE = 0x14
}

/**
 * 图片数据接口
 */
export interface Picture {
    /** 图片MIME类型 */
    mimeType: string;
    /** 图片类型 */
    pictureType: PictureType;
    /** 图片描述 */
    description: string;
    /** 图片二进制数据 */
    data: Uint8Array;
}

/**
 * 艺术家信息接口
 */
export interface Artist {
    /** 艺术家唯一标识符 */
    id?: number;
    /** 艺术家名称 */
    name: string;
    /** 艺术家别名列表 */
    aliases?: string[];
}

/**
 * 专辑信息接口
 */
export interface Album {
    /** 专辑唯一标识符 */
    id?: number;
    /** 专辑名称 */
    name: string;
    /** 专辑封面URL或路径 */
    picUrl?: string;
    /** 专辑艺术家 */
    artist?: string;
    /** 发行年份 */
    year?: number;
}

/**
 * 歌词信息接口
 */
export interface Lyrics {
    /** 歌词内容 */
    content: string;
    /** 歌词语言 */
    language?: string;
    /** 歌词描述 */
    description?: string;
}

/**
 * 音乐元数据接口 - 核心数据结构
 */
export interface MusicMetadata {
    /** 歌曲标题 */
    title: string;
    /** 艺术家列表 */
    artists: Artist[];
    /** 专辑信息 */
    album: Album;
    /** 音轨号 */
    trackNumber?: number;
    /** 总音轨数 */
    totalTracks?: number;
    /** 碟片号 */
    discNumber?: number;
    /** 总碟片数 */
    totalDiscs?: number;
    /** 发行年份 */
    year?: number;
    /** 流派 */
    genre?: string;
    /** 歌词 */
    lyrics?: Lyrics;
    /** 评论 */
    comment?: string;
    /** 作曲家 */
    composer?: string;
    /** 作词家 */
    lyricist?: string;
    /** 封面图片 */
    pictures?: Picture[];
    /** 音频时长（秒） */
    duration?: number;
    /** 比特率（kbps） */
    bitrate?: number;
    /** 采样率（Hz） */
    sampleRate?: number;
    /** 声道数 */
    channels?: number;
}

/**
 * 原始元数据条目接口
 */
export interface RawMetadataEntry {
    /** 元数据键 */
    key: string;
    /** 元数据值 */
    value: string | string[] | Uint8Array;
    /** 元数据标准类型 */
    standard: MetadataStandard;
}

/**
 * 解析结果接口
 */
export interface ParseResult<T> {
    /** 是否成功 */
    success: boolean;
    /** 解析结果数据 */
    data?: T;
    /** 错误信息 */
    error?: string;
    /** 警告信息列表 */
    warnings?: string[];
}

/**
 * 解析选项接口
 */
export interface ParseOptions {
    /** 是否包含原始元数据 */
    includeRaw?: boolean;
    /** 是否解析图片 */
    includePictures?: boolean;
    /** 是否解析歌词 */
    includeLyrics?: boolean;
    /** 编码偏好 */
    encodingPreference?: string;
}

/**
 * 序列化选项接口
 */
export interface SerializeOptions {
    /** 目标元数据标准 */
    targetStandard?: MetadataStandard;
    /** 是否包含二进制数据 */
    includeBinary?: boolean;
    /** 输出格式 */
    format?: 'json' | 'xml' | 'yaml';
}

/**
 * 音频文件信息接口
 */
export interface AudioFileInfo {
    /** 文件路径 */
    path: string;
    /** 文件格式 */
    format: AudioFormat;
    /** 文件大小（字节） */
    size: number;
    /** 最后修改时间 */
    modifiedTime?: Date;
}

/**
 * 歌曲完整信息接口
 */
export interface Song extends MusicMetadata {
    /** 歌曲唯一标识符 */
    id?: number;
    /** 源文件路径 */
    src: string;
    /** 文件信息 */
    fileInfo?: AudioFileInfo;
}

/**
 * 元数据验证结果接口
 */
export interface ValidationResult {
    /** 是否有效 */
    isValid: boolean;
    /** 错误字段列表 */
    errors: ValidationError[];
    /** 警告列表 */
    warnings: string[];
}

/**
 * 验证错误接口
 */
export interface ValidationError {
    /** 错误字段 */
    field: string;
    /** 错误信息 */
    message: string;
    /** 错误代码 */
    code: string;
}

/**
 * 元数据比较结果接口
 */
export interface MetadataComparison {
    /** 相同字段 */
    identical: string[];
    /** 不同字段 */
    different: Array<{ field: string; value1: unknown; value2: unknown }>;
    /** 仅在第一个对象中存在的字段 */
    onlyInFirst: string[];
    /** 仅在第二个对象中存在的字段 */
    onlyInSecond: string[];
}

/**
 * 解析器能力接口
 */
export interface ParserCapabilities {
    /** 支持的音频格式列表 */
    supportedFormats: AudioFormat[];
    /** 支持的元数据标准列表 */
    supportedStandards: MetadataStandard[];
    /** 是否支持写入 */
    supportsWriting: boolean;
    /** 是否支持图片 */
    supportsPictures: boolean;
    /** 是否支持歌词 */
    supportsLyrics: boolean;
}

/**
 * 模块配置接口
 */
export interface MusicTagConfig {
    /** 默认编码 */
    defaultEncoding: string;
    /** 是否严格模式 */
    strictMode: boolean;
    /** 日志级别 */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** 缓存配置 */
    cache?: {
        enabled: boolean;
        maxSize: number;
        ttl: number;
    };
}

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG: MusicTagConfig = {
    defaultEncoding: 'UTF-8',
    strictMode: false,
    logLevel: 'info',
    cache: {
        enabled: true,
        maxSize: 100,
        ttl: 300000 // 5分钟
    }
};

/**
 * 音频格式映射表
 */
export const AUDIO_FORMAT_EXTENSIONS: Record<string, AudioFormat> = {
    '.mp3': AudioFormat.MP3,
    '.flac': AudioFormat.FLAC,
    '.ogg': AudioFormat.OGG,
    '.wav': AudioFormat.WAV,
    '.aac': AudioFormat.AAC,
    '.m4a': AudioFormat.M4A,
    '.wma': AudioFormat.WMA
};

/**
 * 元数据字段常量
 */
export const METADATA_FIELDS = {
    TITLE: 'title',
    ARTIST: 'artist',
    ALBUM: 'album',
    ALBUM_ARTIST: 'albumArtist',
    TRACK_NUMBER: 'trackNumber',
    TOTAL_TRACKS: 'totalTracks',
    DISC_NUMBER: 'discNumber',
    TOTAL_DISCS: 'totalDiscs',
    YEAR: 'year',
    GENRE: 'genre',
    COMMENT: 'comment',
    COMPOSER: 'composer',
    LYRICIST: 'lyricist',
    LYRICS: 'lyrics',
    COPYRIGHT: 'copyright',
    URL: 'url',
    ENCODED_BY: 'encodedBy'
} as const;
