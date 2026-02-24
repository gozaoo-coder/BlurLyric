/**
 * MusicTag模块 - 主入口
 * 
 * 提供音乐元数据读取、解析、验证和序列化的完整功能
 * 
 * @example
 * ```typescript
 * import { MusicTag } from './music_tag';
 * 
 * const musicTag = new MusicTag();
 * const result = await musicTag.read('path/to/song.mp3');
 * 
 * if (result.success) {
 *   console.log(result.data.title);
 *   console.log(result.data.artists);
 * }
 * ```
 */

// 导出类型定义
export * from './types';

// 导出解析器相关
export {
    IMetadataParser,
    BaseMetadataParser,
    ParserRegistry,
    ParserFactory,
    FormatDetector,
    AudioFileInfoReader,
    globalParserRegistry
} from './parser';

// 导出验证和格式化
export {
    MetadataValidator,
    MetadataFormatter,
    MetadataCleaner,
    ValidationRule,
    FormatterOptions,
    createDefaultValidator,
    createDefaultFormatter
} from './validator';

// 导出序列化
export {
    ISerializer,
    JsonSerializer,
    XmlSerializer,
    SerializationManager,
    globalSerializationManager,
    toJson,
    fromJson,
    toXml,
    fromXml
} from './serializer';

// 导入依赖
import {
    MusicMetadata,
    Song,
    ParseResult,
    ParseOptions,
    SerializeOptions,
    MetadataStandard,
    AudioFormat,
    MusicTagConfig,
    DEFAULT_CONFIG,
    AUDIO_FORMAT_EXTENSIONS
} from './types';

import {
    IMetadataParser,
    ParserRegistry,
    ParserFactory,
    FormatDetector,
    globalParserRegistry
} from './parser';

import {
    MetadataValidator,
    MetadataFormatter,
    MetadataCleaner,
    createDefaultValidator,
    createDefaultFormatter
} from './validator';

import {
    SerializationManager,
    globalSerializationManager,
    toJson
} from './serializer';

/**
 * MusicTag主类
 * 
 * 提供统一的API接口用于音乐元数据操作
 */
export class MusicTag {
    private config: MusicTagConfig;
    private parserRegistry: ParserRegistry;
    private parserFactory: ParserFactory;
    private validator: MetadataValidator;
    private formatter: MetadataFormatter;
    private serializer: SerializationManager;
    
    /**
     * 创建MusicTag实例
     * @param config 模块配置
     */
    constructor(config?: Partial<MusicTagConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.parserRegistry = globalParserRegistry;
        this.parserFactory = new ParserFactory(this.parserRegistry);
        this.validator = createDefaultValidator();
        this.formatter = createDefaultFormatter();
        this.serializer = globalSerializationManager;
    }
    
    /**
     * 读取音乐文件元数据
     * @param filePath 文件路径
     * @param options 解析选项
     */
    async read(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>> {
        const parser = this.parserFactory.createParserForFile(filePath);
        
        if (!parser) {
            return {
                success: false,
                error: `不支持的音频格式: ${filePath}`
            };
        }
        
        try {
            const result = await parser.parse(filePath, options);
            
            if (result.success && result.data) {
                // 清理和格式化
                let metadata = MetadataCleaner.clean(result.data);
                metadata = this.formatter.format(metadata);
                
                // 验证
                const validation = this.validator.validate(metadata);
                if (!validation.isValid && this.config.strictMode) {
                    return {
                        success: false,
                        error: `元数据验证失败: ${validation.errors.map(e => e.message).join(', ')}`
                    };
                }
                
                return {
                    success: true,
                    data: metadata,
                    warnings: validation.warnings
                };
            }
            
            return result;
        } catch (error) {
            return {
                success: false,
                error: `读取元数据失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 批量读取音乐文件元数据
     * @param filePaths 文件路径列表
     * @param options 解析选项
     */
    async readBatch(filePaths: string[], options?: ParseOptions): Promise<ParseResult<MusicMetadata>[]> {
        const results: ParseResult<MusicMetadata>[] = [];
        
        for (const filePath of filePaths) {
            const result = await this.read(filePath, options);
            results.push(result);
        }
        
        return results;
    }
    
    /**
     * 验证元数据
     * @param metadata 音乐元数据
     */
    validate(metadata: MusicMetadata): import('./types').ValidationResult {
        return this.validator.validate(metadata);
    }
    
    /**
     * 格式化元数据
     * @param metadata 音乐元数据
     */
    format(metadata: MusicMetadata): MusicMetadata {
        return this.formatter.format(MetadataCleaner.clean(metadata));
    }
    
    /**
     * 序列化元数据
     * @param metadata 音乐元数据
     * @param format 目标格式
     * @param options 序列化选项
     */
    serialize(metadata: MusicMetadata, format: string = 'json', options?: SerializeOptions): string {
        return this.serializer.serialize(metadata, format, options);
    }
    
    /**
     * 反序列化元数据
     * @param data 序列化数据
     * @param format 数据格式
     */
    deserialize(data: string, format: string = 'json'): ParseResult<MusicMetadata> {
        return this.serializer.deserialize(data, format);
    }
    
    /**
     * 检测音频格式
     * @param filePath 文件路径
     */
    detectFormat(filePath: string): AudioFormat {
        return FormatDetector.detectFromPath(filePath);
    }
    
    /**
     * 检查是否支持指定格式
     * @param format 音频格式
     */
    supportsFormat(format: AudioFormat): boolean {
        return this.parserRegistry.hasParserForFormat(format);
    }
    
    /**
     * 检查是否支持指定文件
     * @param filePath 文件路径
     */
    supportsFile(filePath: string): boolean {
        return this.parserRegistry.hasParserForFile(filePath);
    }
    
    /**
     * 获取支持的格式列表
     */
    getSupportedFormats(): AudioFormat[] {
        const formats = new Set<AudioFormat>();
        for (const parser of this.parserRegistry.getAllParsers()) {
            for (const format of parser.getCapabilities().supportedFormats) {
                formats.add(format);
            }
        }
        return Array.from(formats);
    }
    
    /**
     * 注册自定义解析器
     * @param parser 解析器实例
     */
    registerParser(parser: IMetadataParser): void {
        this.parserRegistry.register(parser);
    }
    
    /**
     * 获取模块配置
     */
    getConfig(): MusicTagConfig {
        return { ...this.config };
    }
    
    /**
     * 更新模块配置
     * @param config 配置更新
     */
    updateConfig(config: Partial<MusicTagConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * 创建MusicTag实例的工厂函数
 * @param config 模块配置
 */
export function createMusicTag(config?: Partial<MusicTagConfig>): MusicTag {
    return new MusicTag(config);
}

/**
 * 默认MusicTag实例
 */
export const defaultMusicTag = new MusicTag();

/**
 * 便捷函数：读取音乐文件元数据
 * @param filePath 文件路径
 * @param options 解析选项
 */
export function readMetadata(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>> {
    return defaultMusicTag.read(filePath, options);
}

/**
 * 便捷函数：批量读取音乐文件元数据
 * @param filePaths 文件路径列表
 * @param options 解析选项
 */
export function readMetadataBatch(filePaths: string[], options?: ParseOptions): Promise<ParseResult<MusicMetadata>[]> {
    return defaultMusicTag.readBatch(filePaths, options);
}

/**
 * 便捷函数：验证元数据
 * @param metadata 音乐元数据
 */
export function validateMetadata(metadata: MusicMetadata): import('./types').ValidationResult {
    return defaultMusicTag.validate(metadata);
}

/**
 * 便捷函数：格式化元数据
 * @param metadata 音乐元数据
 */
export function formatMetadata(metadata: MusicMetadata): MusicMetadata {
    return defaultMusicTag.format(metadata);
}

/**
 * 便捷函数：将元数据转换为JSON
 * @param metadata 音乐元数据
 * @param options 序列化选项
 */
export function metadataToJson(metadata: MusicMetadata, options?: SerializeOptions): string {
    return toJson(metadata, options);
}

// 默认导出
export default MusicTag;
