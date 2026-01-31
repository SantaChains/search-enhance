/**
 * 分词Web Worker
 * 在后台线程中执行耗时的分词操作，避免阻塞主线程
 */

// 导入分词相关功能
importScripts('../utils/logger.js');

// 分词插件实现
class ChineseSegmenterPlugin {
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

class EnglishSegmenterPlugin {
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

class UrlSegmenterPlugin {
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

class CodeSegmenterPlugin {
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

class ListSegmenterPlugin {
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

// 简化版分词器
class WorkerSegmenter {
    constructor() {
        this.plugins = new Map();
        this.defaultPlugins = ['chinese', 'english', 'url', 'code', 'list'];
        this.initPlugins();
    }

    initPlugins() {
        this.plugins.set('chinese', new ChineseSegmenterPlugin());
        this.plugins.set('english', new EnglishSegmenterPlugin());
        this.plugins.set('url', new UrlSegmenterPlugin());
        this.plugins.set('code', new CodeSegmenterPlugin());
        this.plugins.set('list', new ListSegmenterPlugin());
    }

    async segment(text, options = {}) {
        if (!text || !text.trim()) return [];

        const {
            plugins = this.defaultPlugins
        } = options;

        // 检测文本类型
        const textType = this.detectTextType(text);

        // 根据文本类型选择合适的插件
        const selectedPlugins = this.selectPlugins(textType, plugins);

        // 执行分词
        let results = [];
        for (const pluginName of selectedPlugins) {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                try {
                    const pluginResults = await plugin.segment(text, { textType, ...options });
                    results = [...results, ...pluginResults];
                } catch (error) {
                    console.error(`插件 ${pluginName} 分词失败:`, error);
                }
            }
        }

        // 去重和后处理
        results = this.postProcess(results);

        return results;
    }

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
}

// 创建分词器实例
const segmenter = new WorkerSegmenter();

// 监听消息
self.addEventListener('message', async (event) => {
    const { id, action, payload } = event.data;

    try {
        switch (action) {
            case 'segment':
                const { text, options } = payload;
                const result = await segmenter.segment(text, options);
                self.postMessage({ id, result, error: null });
                break;
            default:
                self.postMessage({ id, result: null, error: `未知操作: ${action}` });
        }
    } catch (error) {
        console.error('分词Worker错误:', error);
        self.postMessage({ id, result: [], error: error.message });
    }
});

console.log('分词Worker初始化成功');
