/**
 * 增强的分词系统
 * 提供模块化、可扩展的分词功能，支持多种分词策略和插件机制
 */

import { logger } from './logger.js';

/**
 * 分词系统核心类
 * 提供统一的分词接口和插件管理
 */
export class Segmenter {
    constructor() {
        this.plugins = new Map();
        this.cache = new Map();
        this.defaultPlugins = ['chinese', 'english', 'url', 'code', 'list'];
        this.worker = null;
        this.initDefaultPlugins();
        this.initWorker();
    }

    /**
     * 初始化默认插件
     */
    initDefaultPlugins() {
        // 注册默认分词插件
        this.registerPlugin('chinese', new ChineseSegmenterPlugin());
        this.registerPlugin('english', new EnglishSegmenterPlugin());
        this.registerPlugin('url', new UrlSegmenterPlugin());
        this.registerPlugin('code', new CodeSegmenterPlugin());
        this.registerPlugin('list', new ListSegmenterPlugin());
    }

    /**
     * 初始化Web Worker
     */
    initWorker() {
        try {
            this.worker = new Worker('../workers/segmenterWorker.js', { type: 'module' });
            logger.info('分词Web Worker初始化成功');
        } catch (error) {
            logger.error('分词Web Worker初始化失败:', error);
            this.worker = null;
        }
    }

    /**
     * 注册分词插件
     * @param {string} name 插件名称
     * @param {object} plugin 插件实例
     */
    registerPlugin(name, plugin) {
        if (typeof plugin.segment === 'function') {
            this.plugins.set(name, plugin);
            logger.info(`分词插件 ${name} 注册成功`);
        } else {
            logger.error(`分词插件 ${name} 注册失败：缺少 segment 方法`);
        }
    }

    /**
     * 移除分词插件
     * @param {string} name 插件名称
     */
    removePlugin(name) {
        if (this.plugins.has(name)) {
            this.plugins.delete(name);
            logger.info(`分词插件 ${name} 移除成功`);
        }
    }

    /**
     * 获取分词插件
     * @param {string} name 插件名称
     * @returns {object|null} 插件实例
     */
    getPlugin(name) {
        return this.plugins.get(name) || null;
    }

    /**
     * 智能分词 - 根据内容类型自动选择合适的分词策略
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        if (!text || !text.trim()) return [];

        const {
            plugins = this.defaultPlugins,
            enableCache = true,
            maxCacheSize = 1000,
            useWorker = true
        } = options;

        // 检查缓存
        if (enableCache) {
            const cacheKey = this.generateCacheKey(text, options);
            if (this.cache.has(cacheKey)) {
                logger.debug('使用缓存的分词结果');
                return this.cache.get(cacheKey);
            }
        }

        let results = [];

        // 对于大型文本，使用Web Worker
        if (useWorker && this.worker && text.length > 1000) {
            logger.debug('使用Web Worker进行分词');
            results = await this.workerSegment(text, options);
        } else {
            // 对于小型文本，直接在主线程处理
            logger.debug('在主线程进行分词');
            results = await this.mainThreadSegment(text, options);
        }

        // 缓存结果
        if (enableCache) {
            const cacheKey = this.generateCacheKey(text, options);
            this.cache.set(cacheKey, results);

            // 控制缓存大小
            if (this.cache.size > maxCacheSize) {
                this.trimCache(maxCacheSize);
            }
        }

        return results;
    }

    /**
     * 在主线程中执行分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async mainThreadSegment(text, options = {}) {
        const { plugins = this.defaultPlugins } = options;

        // 检测文本类型
        const textType = this.detectTextType(text);
        logger.debug(`检测到文本类型: ${textType}`);

        // 根据文本类型选择合适的插件
        const selectedPlugins = this.selectPlugins(textType, plugins);
        logger.debug(`选择的分词插件: ${selectedPlugins.join(', ')}`);

        // 执行分词
        let results = [];
        for (const pluginName of selectedPlugins) {
            const plugin = this.getPlugin(pluginName);
            if (plugin) {
                try {
                    const pluginResults = await plugin.segment(text, { textType, ...options });
                    results = [...results, ...pluginResults];
                } catch (error) {
                    logger.error(`插件 ${pluginName} 分词失败:`, error);
                }
            }
        }

        // 去重和后处理
        results = this.postProcess(results);

        return results;
    }

    /**
     * 使用Web Worker执行分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async workerSegment(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                // Worker不可用，回退到主线程
                this.mainThreadSegment(text, options).then(resolve).catch(reject);
                return;
            }

            const taskId = Date.now() + Math.random();
            const timeout = setTimeout(() => {
                reject(new Error('分词超时'));
            }, 10000); // 10秒超时

            const handleMessage = (event) => {
                const { id, result, error } = event.data;
                if (id === taskId) {
                    clearTimeout(timeout);
                    this.worker.removeEventListener('message', handleMessage);
                    if (error) {
                        reject(new Error(error));
                    } else {
                        resolve(result);
                    }
                }
            };

            this.worker.addEventListener('message', handleMessage);
            this.worker.postMessage({ id: taskId, action: 'segment', payload: { text, options } });
        });
    }

    /**
     * 检测文本类型
     * @param {string} text 输入文本
     * @returns {string} 文本类型
     */
    detectTextType(text) {
        // 1. 优先检测URL
        if (/^https?:\/\//.test(text) || /(https?:\/\/[\S]+)/.test(text)) {
            return 'url';
        }

        // 2. 检测列表类内容
        if (/^[\s]*(?:\d+[.)]\s*|[一二三四五六七八九十]+[、.]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|[-*•·]\s*)/m.test(text)) {
            return 'list';
        }

        // 3. 检测代码/函数名
        if (!/^https?:\/\//.test(text) && 
            /[a-zA-Z_$][a-zA-Z0-9_$]*[A-Z][a-zA-Z0-9_$]*|[a-zA-Z_$][a-zA-Z0-9_$]*_[a-zA-Z0-9_$]+|[a-zA-Z_$][a-zA-Z0-9_$]*-[a-zA-Z0-9_$]+/.test(text)) {
            return 'code';
        }

        // 4. 检测中英文混合
        const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishCount = (text.match(/[a-zA-Z]/g) || []).length;

        if (chineseCount > englishCount) {
            return 'chinese';
        } else if (englishCount > 0) {
            return 'english';
        }

        return 'unknown';
    }

    /**
     * 根据文本类型选择合适的插件
     * @param {string} textType 文本类型
     * @param {Array} availablePlugins 可用插件列表
     * @returns {Array} 选择的插件列表
     */
    selectPlugins(textType, availablePlugins) {
        const pluginMap = {
            'url': ['url', 'english'],
            'code': ['code', 'english'],
            'list': ['list', 'chinese', 'english'],
            'chinese': ['chinese', 'english'],
            'english': ['english'],
            'unknown': ['chinese', 'english']
        };

        const recommendedPlugins = pluginMap[textType] || pluginMap.unknown;
        return recommendedPlugins.filter(plugin => availablePlugins.includes(plugin));
    }

    /**
     * 后处理分词结果
     * @param {Array} results 原始分词结果
     * @returns {Array} 处理后的分词结果
     */
    postProcess(results) {
        // 1. 去重
        const uniqueResults = [...new Set(results.map(item => 
            typeof item === 'string' ? item.trim() : JSON.stringify(item)
        ))].filter(Boolean);

        // 2. 过滤过短的分词
        const filteredResults = uniqueResults.filter(item => {
            const content = typeof item === 'string' ? item : JSON.stringify(item);
            return content.length >= 1 && content.length <= 200;
        });

        return filteredResults;
    }

    /**
     * 生成缓存键
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {string} 缓存键
     */
    generateCacheKey(text, options) {
        const textHash = this.hashText(text.substring(0, 1000)); // 限制文本长度
        const optionsHash = JSON.stringify(options);
        return `${textHash}:${optionsHash}`;
    }

    /**
     * 简单的文本哈希函数
     * @param {string} text 输入文本
     * @returns {string} 哈希值
     */
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * 修剪缓存
     * @param {number} maxSize 最大缓存大小
     */
    trimCache(maxSize) {
        const entries = [...this.cache.entries()];
        const toRemove = entries.slice(0, entries.length - maxSize);
        toRemove.forEach(([key]) => this.cache.delete(key));
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
        logger.info('分词缓存已清空');
    }

    /**
     * 销毁分词器
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            logger.info('分词Web Worker已销毁');
        }
        this.clearCache();
        this.plugins.clear();
    }
}

/**
 * 中文分词插件
 */
class ChineseSegmenterPlugin {
    /**
     * 中文分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        const results = [];
        
        // 提取中文文本片段
        const chineseSegments = text.match(/[\u4e00-\u9fa5]+(?:[\u4e00-\u9fa5\s，。！？；：""''（）【】《》]*[\u4e00-\u9fa5])?/g) || [];
        
        for (const segment of chineseSegments) {
            const trimmedSegment = segment.trim();
            if (!trimmedSegment) continue;
            
            // 按中文标点符号拆分
            const sentences = trimmedSegment.split(/[。！？；]/).filter(Boolean);
            
            for (let sentence of sentences) {
                sentence = sentence.trim();
                if (!sentence) continue;
                
                // 如果句子过长，按逗号、顿号进一步拆分
                if (sentence.length > 50) {
                    const parts = sentence.split(/[，、]/).filter(part => {
                        const trimmedPart = part.trim();
                        return trimmedPart.length > 1 && !/^[的了是在有和与或但而且然后因为所以]$/.test(trimmedPart);
                    });
                    results.push(...parts);
                } else {
                    results.push(sentence);
                }
            }
        }
        
        return results;
    }
}

/**
 * 英文分词插件
 */
class EnglishSegmenterPlugin {
    /**
     * 英文分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        const results = [];
        
        // 提取英文文本片段
        const englishSegments = text.match(/[a-zA-Z0-9\s,.!?;:()"'<>\[\]{}]+/g) || [];
        
        for (const segment of englishSegments) {
            const trimmedSegment = segment.trim();
            if (!trimmedSegment) continue;
            
            // 按英文标点符号拆分句子
            const sentences = trimmedSegment.match(/[^.!?]+[.!?]?/g) || [];
            
            for (let sentence of sentences) {
                sentence = sentence.trim();
                if (!sentence) continue;
                
                // 如果句子过长，按逗号进一步拆分
                if (sentence.length > 100) {
                    const parts = sentence.split(/,\s+/).filter(Boolean);
                    results.push(...parts);
                } else {
                    results.push(sentence);
                }
            }
        }
        
        return results;
    }
}

/**
 * URL分词插件
 */
class UrlSegmenterPlugin {
    /**
     * URL分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        const results = [];
        
        // 提取URL
        const urlRegex = /(https?:\/\/(?:[\w.-]+)(?::[0-9]+)?(?:\/(?:[\w\/._-])*(?:\?(?:[\w&=%.+-])*)?(?:#(?:[\w._-])*)?)?)/gi;
        const urls = text.match(urlRegex) || [];
        
        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                
                // 提取域名
                results.push(urlObj.hostname);
                
                // 提取路径段
                const pathSegments = urlObj.pathname.split('/').filter(Boolean);
                results.push(...pathSegments);
                
                // 提取查询参数
                for (const [key, value] of urlObj.searchParams.entries()) {
                    results.push(key);
                    if (value) results.push(value);
                }
                
                // 提取文件扩展名
                const pathParts = urlObj.pathname.split('.');
                if (pathParts.length > 1) {
                    const fileExtension = pathParts[pathParts.length - 1].split('?')[0];
                    if (fileExtension.length <= 6 && /^[a-zA-Z0-9]+$/.test(fileExtension)) {
                        results.push(fileExtension);
                    }
                }
                
                // 智能URL类型识别
                const urlType = this.identifyUrlType(urlObj);
                results.push(urlType);
                
            } catch (error) {
                // URL解析失败，添加原始URL
                results.push(url);
            }
        }
        
        return results;
    }
    
    /**
     * 智能识别URL类型
     * @param {URL} urlObj URL对象
     * @returns {string} URL类型
     */
    identifyUrlType(urlObj) {
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        
        // 识别常见平台
        if (hostname.includes('github.com')) {
            return 'github';
        } else if (hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com')) {
            return 'stackoverflow';
        } else if (hostname.includes('google.') || hostname.includes('bing.') || hostname.includes('baidu.com')) {
            return 'search_engine';
        } else if (hostname.includes('youtube.com') || hostname.includes('vimeo.com')) {
            return 'video';
        } else if (hostname.includes('twitter.com') || hostname.includes('facebook.com') || hostname.includes('instagram.com') || hostname.includes('linkedin.com')) {
            return 'social';
        } else if (hostname.includes('docs.') || hostname.includes('documentation.')) {
            return 'documentation';
        } else if (hostname.includes('api.') || pathname.includes('/api/')) {
            return 'api';
        } else if (pathname.endsWith('.pdf')) {
            return 'pdf';
        } else if (pathname.endsWith('.docx') || pathname.endsWith('.doc')) {
            return 'word';
        } else if (pathname.endsWith('.xlsx') || pathname.endsWith('.xls')) {
            return 'excel';
        } else if (pathname.endsWith('.ppt') || pathname.endsWith('.pptx')) {
            return 'powerpoint';
        } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.png') || pathname.endsWith('.gif') || pathname.endsWith('.webp')) {
            return 'image';
        } else if (pathname.endsWith('.mp3') || pathname.endsWith('.mp4') || pathname.endsWith('.avi') || pathname.endsWith('.mov')) {
            return 'media';
        } else if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.match(/^192\.168\.\d+\.\d+$/)) {
            return 'local';
        } else {
            return 'general';
        }
    }
}

/**
 * 代码分词插件
 */
class CodeSegmenterPlugin {
    /**
     * 代码分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        const results = [];
        
        // 按空格和换行先拆分
        const tokens = text.split(/\s+/).filter(Boolean);
        
        for (const token of tokens) {
            // 检测驼峰命名法 (camelCase, PascalCase)
            if (/[a-z][A-Z]/.test(token)) {
                const parts = token.split(/(?=[A-Z])/).filter(Boolean);
                // 处理连续大写字母的情况 (如 HTTPRequest -> HTTP, Request)
                const processed = [];
                for (let part of parts) {
                    if (/^[A-Z]{2,}/.test(part) && part.length > 2) {
                        const match = part.match(/^([A-Z]+)([A-Z][a-z].*)$/);
                        if (match) {
                            processed.push(match[1].slice(0, -1)); // 前面的大写字母
                            processed.push(match[1].slice(-1) + match[2]); // 最后一个大写字母+后续
                        } else {
                            processed.push(part);
                        }
                    } else {
                        processed.push(part);
                    }
                }
                results.push(...processed);
            }
            // 检测蛇形命名法 (snake_case)
            else if (token.includes('_')) {
                results.push(...token.split('_').filter(Boolean));
            }
            // 检测串式命名法 (kebab-case)
            else if (token.includes('-')) {
                results.push(...token.split('-').filter(Boolean));
            }
            // 检测匈牙利命名法 (如 iCount, strName)
            else if (/^[a-z]+[A-Z]/.test(token)) {
                const match = token.match(/^([a-z]+)([A-Z].*)$/);
                if (match) {
                    results.push(match[1]); // 类型前缀
                    results.push(match[2]); // 变量名
                } else {
                    results.push(token);
                }
            }
            // 处理带括号的函数名
            else if (/\w+\([^)]*\)/.test(token)) {
                const match = token.match(/(\w+)\(([^)]*)\)/);
                if (match) {
                    results.push(match[1]); // 函数名
                    if (match[2].trim()) {
                        results.push(...match[2].split(',').map(p => p.trim()).filter(Boolean));
                    }
                }
            }
            // 处理变量名和常量
            else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
                results.push(token);
            }
            // 处理带命名空间的标识符 (如 namespace::function, module.function)
            else if (token.includes('::') || token.includes('.')) {
                const delimiter = token.includes('::') ? '::' : '.';
                results.push(...token.split(delimiter).filter(Boolean));
            }
        }
        
        return results;
    }
}

/**
 * 列表分词插件
 */
class ListSegmenterPlugin {
    /**
     * 列表分词
     * @param {string} text 输入文本
     * @param {object} options 分词选项
     * @returns {Array} 分词结果
     */
    async segment(text, options = {}) {
        const results = [];
        
        // 按行拆分
        const lines = text.split(/\r?\n/).filter(Boolean);
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 匹配各种列表标记
            const patterns = [
                /^\d+[.)]\s*(.+)$/,           // 1. 或 1) 
                /^[一二三四五六七八九十]+[、.]\s*(.+)$/,  // 一、
                /^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$/,        // ①
                /^[a-zA-Z][.)]\s*(.+)$/,      // a. 或 a)
                /^[-*•·]\s*(.+)$/,            // - * • ·
                /^[▪▫◦‣⁃]\s*(.+)$/           // 其他符号
            ];
            
            let matched = false;
            for (const pattern of patterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    results.push(match[1].trim());
                    matched = true;
                    break;
                }
            }
            
            // 如果没有匹配到列表标记，直接添加
            if (!matched) {
                results.push(trimmed);
            }
        }
        
        return results;
    }
}

// 导出单例
export const segmenter = new Segmenter();
export default segmenter;