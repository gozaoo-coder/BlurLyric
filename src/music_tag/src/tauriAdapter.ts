/**
 * MusicTag模块 - Tauri适配器
 * 
 * 提供与Tauri后端的集成，通过Tauri命令调用Rust端元数据读取功能
 * 
 * @example
 * ```typescript
 * import { TauriMusicTagAdapter } from './music_tag/tauriAdapter';
 * 
 * const adapter = new TauriMusicTagAdapter();
 * const result = await adapter.readMetadata('/path/to/song.mp3');
 * ```
 */

import {
    MusicMetadata,
    Song,
    Artist,
    Album,
    Picture,
    ParseResult,
    ParseOptions,
    AudioFormat,
    AudioFileInfo,
    ValidationResult
} from './types';

import {
    IMetadataParser,
    BaseMetadataParser,
    globalParserRegistry,
    ParserCapabilities
} from './parser';

import {
    MetadataValidator,
    MetadataFormatter,
    MetadataCleaner,
    createDefaultValidator,
    createDefaultFormatter
} from './validator';

import { toJson, fromJson } from './serializer';

/**
 * Tauri命令接口
 * 定义与Rust后端通信的命令
 */
export interface TauriCommands {
    /** 读取音乐文件元数据 */
    readMusicMetadata: (filePath: string, options?: ParseOptions) => Promise<MusicMetadata>;
    /** 批量读取音乐文件元数据 */
    readMusicMetadataBatch: (filePaths: string[], options?: ParseOptions) => Promise<MusicMetadata[]>;
    /** 读取音频文件信息 */
    readAudioFileInfo: (filePath: string) => Promise<AudioFileInfo>;
    /** 读取专辑封面 */
    readAlbumCover: (filePath: string) => Promise<Picture | null>;
    /** 检查文件是否为支持的音频格式 */
    isSupportedAudioFile: (filePath: string) => Promise<boolean>;
}

/**
 * Tauri调用函数类型
 */
type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Tauri音乐标签适配器
 * 
 * 封装Tauri调用，提供统一的元数据读取接口
 */
export class TauriMusicTagAdapter {
    private invoke: TauriInvoke;
    private validator: MetadataValidator;
    private formatter: MetadataFormatter;
    private useBackendParser: boolean;
    
    /**
     * 创建Tauri适配器实例
     * @param invoke Tauri调用函数
     * @param options 适配器选项
     */
    constructor(
        invoke: TauriInvoke,
        options: {
            useBackendParser?: boolean;
        } = {}
    ) {
        this.invoke = invoke;
        this.validator = createDefaultValidator();
        this.formatter = createDefaultFormatter();
        this.useBackendParser = options.useBackendParser ?? true;
    }
    
    /**
     * 读取音乐文件元数据
     * @param filePath 文件路径
     * @param options 解析选项
     */
    async readMetadata(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>> {
        try {
            if (this.useBackendParser) {
                // 使用后端解析器
                const metadata = await this.invoke<MusicMetadata>('read_music_metadata', {
                    filePath,
                    options
                });
                
                // 清理和格式化
                let cleanedMetadata = MetadataCleaner.clean(metadata);
                cleanedMetadata = this.formatter.format(cleanedMetadata);
                
                return {
                    success: true,
                    data: cleanedMetadata
                };
            } else {
                // 使用前端解析器（需要注册具体解析器）
                const parser = globalParserRegistry.getParsersForFile(filePath)[0];
                if (!parser) {
                    return {
                        success: false,
                        error: `不支持的音频格式: ${filePath}`
                    };
                }
                return await parser.parse(filePath, options);
            }
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
    async readMetadataBatch(filePaths: string[], options?: ParseOptions): Promise<ParseResult<MusicMetadata>[]> {
        try {
            if (this.useBackendParser) {
                const results = await this.invoke<MusicMetadata[]>('read_music_metadata_batch', {
                    filePaths,
                    options
                });
                
                return results.map(metadata => {
                    const cleanedMetadata = this.formatter.format(MetadataCleaner.clean(metadata));
                    return {
                        success: true,
                        data: cleanedMetadata
                    };
                });
            } else {
                const results: ParseResult<MusicMetadata>[] = [];
                for (const filePath of filePaths) {
                    const result = await this.readMetadata(filePath, options);
                    results.push(result);
                }
                return results;
            }
        } catch (error) {
            return filePaths.map(() => ({
                success: false,
                error: `批量读取元数据失败: ${error instanceof Error ? error.message : String(error)}`
            }));
        }
    }
    
    /**
     * 读取音频文件信息
     * @param filePath 文件路径
     */
    async readAudioFileInfo(filePath: string): Promise<AudioFileInfo> {
        return await this.invoke<AudioFileInfo>('read_audio_file_info', { filePath });
    }
    
    /**
     * 读取专辑封面
     * @param filePath 文件路径
     */
    async readAlbumCover(filePath: string): Promise<Picture | null> {
        return await this.invoke<Picture | null>('read_album_cover', { filePath });
    }
    
    /**
     * 检查文件是否为支持的音频格式
     * @param filePath 文件路径
     */
    async isSupportedFile(filePath: string): Promise<boolean> {
        return await this.invoke<boolean>('is_supported_audio_file', { filePath });
    }
    
    /**
     * 验证元数据
     * @param metadata 音乐元数据
     */
    validateMetadata(metadata: MusicMetadata): ValidationResult {
        return this.validator.validate(metadata);
    }
    
    /**
     * 格式化元数据
     * @param metadata 音乐元数据
     */
    formatMetadata(metadata: MusicMetadata): MusicMetadata {
        return this.formatter.format(MetadataCleaner.clean(metadata));
    }
    
    /**
     * 将元数据转换为JSON字符串
     * @param metadata 音乐元数据
     */
    toJson(metadata: MusicMetadata): string {
        return toJson(metadata);
    }
    
    /**
     * 从JSON字符串解析元数据
     * @param json JSON字符串
     */
    fromJson(json: string): ParseResult<MusicMetadata> {
        return fromJson(json);
    }
    
    /**
     * 设置是否使用后端解析器
     * @param useBackend 是否使用后端
     */
    setUseBackendParser(useBackend: boolean): void {
        this.useBackendParser = useBackend;
    }
}

/**
 * Tauri元数据解析器
 * 实现IMetadataParser接口，通过Tauri调用后端
 */
export class TauriMetadataParser extends BaseMetadataParser {
    readonly name = 'Tauri Metadata Parser';
    readonly version = '1.0.0';
    
    private invoke: TauriInvoke;
    
    constructor(invoke: TauriInvoke) {
        super({
            supportedFormats: [
                AudioFormat.MP3,
                AudioFormat.FLAC,
                AudioFormat.OGG,
                AudioFormat.WAV,
                AudioFormat.AAC,
                AudioFormat.M4A
            ],
            supportedStandards: [],
            supportsWriting: false,
            supportsPictures: true,
            supportsLyrics: true
        });
        this.invoke = invoke;
    }
    
    async parse(filePath: string, options?: ParseOptions): Promise<ParseResult<MusicMetadata>> {
        try {
            const metadata = await this.invoke<MusicMetadata>('read_music_metadata', {
                filePath,
                options
            });
            
            return this.createSuccessResult(metadata);
        } catch (error) {
            return this.createErrorResult(`解析失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    async parseRaw(filePath: string): Promise<ParseResult<import('./types').RawMetadataEntry[]>> {
        try {
            const rawEntries = await this.invoke<import('./types').RawMetadataEntry[]>('read_raw_metadata', {
                filePath
            });
            
            return this.createSuccessResult(rawEntries);
        } catch (error) {
            return this.createErrorResult(`解析原始元数据失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/**
 * 创建Tauri适配器实例的工厂函数
 * @param invoke Tauri调用函数
 * @param options 适配器选项
 */
export function createTauriAdapter(
    invoke: TauriInvoke,
    options?: { useBackendParser?: boolean }
): TauriMusicTagAdapter {
    return new TauriMusicTagAdapter(invoke, options);
}

/**
 * 注册Tauri解析器到全局注册表
 * @param invoke Tauri调用函数
 */
export function registerTauriParser(invoke: TauriInvoke): void {
    const parser = new TauriMetadataParser(invoke);
    globalParserRegistry.register(parser);
}

/**
 * 便捷函数：使用Tauri适配器读取元数据
 * @param invoke Tauri调用函数
 * @param filePath 文件路径
 * @param options 解析选项
 */
export async function readMetadataWithTauri(
    invoke: TauriInvoke,
    filePath: string,
    options?: ParseOptions
): Promise<ParseResult<MusicMetadata>> {
    const adapter = createTauriAdapter(invoke);
    return await adapter.readMetadata(filePath, options);
}

export default TauriMusicTagAdapter;
