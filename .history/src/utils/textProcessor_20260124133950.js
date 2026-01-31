// src/utils/textProcessor.js

/**
 * Enhanced Text Processing Utilities
 * Provides comprehensive text analysis and processing capabilities
 * 包含中文分词、剪贴板操作和文本分析功能
 */

/**
 * Checks if a string is a valid URL.
 * @param {string} str The string to check.
 * @returns {boolean}
 */
export function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Extracts and processes text based on Switch 1's logic.
 * @param {string} text The input text.
 * @returns {object} An object containing processed parts.
 */
export function processTextExtraction(text) {
    const results = {
        cleanedText: '',
        extractedLinks: [],
    };

    if (!text || !text.trim()) return results;

    // 1. Extract links first - Enhanced URL detection
    const urlRegex = /https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi;
    let potentialLinks = text.match(urlRegex) || [];
    
    // Post-process to validate URLs more strictly
    results.extractedLinks = [...new Set(potentialLinks.filter(url => {
        try {
            // Validate URL format
            const testUrl = url.startsWith('http') ? url : `http://${url}`;
            new URL(testUrl);
            return true;
        } catch (_) {
            return false;
        }
    }))];
    
    // 2. Clean the text for English-focused processing
    let cleaned = text;
    
    // Remove links that were found to avoid processing them as text
    if (results.extractedLinks.length > 0) {
        results.extractedLinks.forEach(url => {
            // Escape special regex characters in the URL before replacing
            const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            cleaned = cleaned.replace(new RegExp(escapedUrl, 'gi'), ' ');
        });
    }
    
    // Remove Chinese characters (as per original requirement for Switch 1)
    // U+4e00-U+9fa5 covers common CJK characters.
    cleaned = cleaned.replace(/[\u4e00-\u9fa5]/g, '');
    
    // Remove specific Chinese punctuation (based on user example)
    // Keep only 。 (U+3002) as specified. Other common ones: ， (U+FF0C), ； (U+FF1B), ： (U+FF1A), ？ (U+FF1F), ！ (U+FF01)
    cleaned = cleaned.replace(/[，；：？！]/g, '');
    
    // Replace Chinese period with English period
    cleaned = cleaned.replace(/。/g, '.');
    
    // Remove content within square brackets and the brackets themselves
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    
    // Remove all non-English letters, non-digits, non-spaces, non-periods
    // This aggressive cleaning is for the specific use case of this tool (Switch 1).
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s.]/g, ' ');
    
    // Trim whitespace and normalize internal spaces (replace multiple spaces with single space)
    results.cleanedText = cleaned.trim().replace(/\s+/g, ' ');

    return results;
}

/**
 * 智能文本拆分 - 支持多种分隔规则和内容类型识别
 * @param {string} text 输入文本
 * @param {string|Array} delimiter 分隔规则，支持单个规则或多个规则组合
 * @returns {Array} 拆分结果数组
 */
export function splitText(text, delimiter = 'en-sentence') {
    if (!text || !text.trim()) return [];
    
    // 支持多规则同时应用
    const delimiters = Array.isArray(delimiter) ? delimiter : [delimiter];
    let results = [text.trim()];
    
    // 按优先级依次应用分隔规则
    for (const rule of delimiters) {
        const newResults = [];
        for (const segment of results) {
            newResults.push(...applySingleSplitRule(segment, rule));
        }
        results = newResults;
    }
    
    // 后处理：去重、过滤、长度校准
    return postProcessSplitResults(results);
}

/**
 * 应用单个分隔规则
 * @param {string} text 文本片段
 * @param {string} rule 分隔规则
 * @returns {Array} 分隔结果
 */
function applySingleSplitRule(text, rule) {
    if (!text || !text.trim()) return [];
    
    const contentType = detectContentType(text);
    
    switch (rule) {
        case 'auto':
            return autoSplit(text, contentType);
        case 'en-sentence':
            return splitEnglishSentences(text);
        case 'zh-sentence':
            return splitChineseSentences(text);
        case 'zh-word':
            return chineseWordSegmentation(text);
        case 'mixed-sentence':
            return splitMixedLanguageSentences(text);
        case 'code-naming':
            return splitCodeNaming(text);
        case 'list-items':
            return splitListItems(text);
        case 'wrapped-content':
            return splitWrappedContent(text);
        case 'space':
            return text.split(/\s+/).filter(Boolean);
        case 'newline':
            return text.split(/\r?\n+/).filter(Boolean);
        case 'punctuation':
            return splitByPunctuation(text);
        case 'word':
            return text.split(/\W+/).filter(Boolean);
        default:
            return splitEnglishSentences(text);
    }
}

/**
 * 检测内容类型
 * @param {string} text 输入文本
 * @returns {string} 内容类型
 */
function detectContentType(text) {
    // 1. 检测列表类内容
    if (/^[\s]*(?:\d+[.)]\s*|[一二三四五六七八九十]+[、.]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|[-*•·]\s*)/m.test(text)) {
        return 'list';
    }
    
    // 2. 检测代码/函数名
    if (/[a-zA-Z_$][a-zA-Z0-9_$]*[A-Z][a-zA-Z0-9_$]*|[a-zA-Z_$][a-zA-Z0-9_$]*_[a-zA-Z0-9_$]+|[a-zA-Z_$][a-zA-Z0-9_$]*-[a-zA-Z0-9_$]+/.test(text)) {
        return 'code';
    }
    
    // 3. 检测包裹类标点
    if (/["""''（）()【】《》<>「」『』]/g.test(text)) {
        return 'wrapped';
    }
    
    // 4. 检测中英文混合
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    
    if (chineseCount > 0 && englishCount > 0) {
        return 'mixed';
    } else if (chineseCount > englishCount) {
        return 'chinese';
    } else if (englishCount > 0) {
        return 'english';
    }
    
    return 'unknown';
}

/**
 * 自动智能拆分
 * @param {string} text 输入文本
 * @param {string} contentType 内容类型
 * @returns {Array} 拆分结果
 */
function autoSplit(text, contentType) {
    switch (contentType) {
        case 'list':
            return splitListItems(text);
        case 'code':
            return splitCodeNaming(text);
        case 'wrapped':
            return splitWrappedContent(text);
        case 'mixed':
            return splitMixedLanguageSentences(text);
        case 'chinese':
            return splitChineseSentences(text);
        case 'english':
            return splitEnglishSentences(text);
        default:
            return splitMixedLanguageSentences(text);
    }
}

/**
 * 拆分英文句子
 * @param {string} text 英文文本
 * @returns {Array} 句子数组
 */
function splitEnglishSentences(text) {
    // 先按句号、感叹号、问号拆分
    const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
    const results = [];
    
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
    
    return results;
}

/**
 * 轻量级中文分词算法 - 基于正向最大匹配
 * @param {string} text 待分词的中文文本
 * @param {number} maxWordLength 最大词长，默认5
 * @returns {Array} 分词结果数组
 */
function chineseWordSegmentation(text, maxWordLength = 5) {
    if (!text || !text.trim()) return [];
    
    // 简化的常用词词典
    const commonWords = new Set([
        '中文', '分词', '算法', '轻量级', '正向', '最大', '匹配', '文本', '处理', 
        '浏览器', '扩展', '功能', '工具', '智能', '搜索', '体验', '用户', '开发',
        '项目', '环境', '规则', '词典', '集成', '实现', '更新', '功能', '代码',
        '字符', '数组', '函数', '方法', '返回', '结果', '参数', '长度', '循环',
        '判断', '处理', '过滤', '空格', '标点', '符号', '分割', '提取', '转换',
        '类型', '检测', '识别', '内容', '句子', '词语', '语言', '混合', '智能',
        '列表', '项目', '代码', '命名', '包裹', '路径', '链接', '仓库', '检测',
        '分析', '分类', '规则', '说明', '可用', '选择', '适合', '场景', '基础',
        '语义', '单元', '序号', '标记', '引号', '括号', '书名号', '空格', '换行',
        '单词', '多行', '片段', '功能', '接口', 'UI', '统一', '路径', '转换',
        '链接', '提取', '仓库', '生成', '邮箱', '电话', 'IP', '地址', '转换'
    ]);
    
    const textToProcess = text.trim();
    const result = [];
    let index = 0;
    
    while (index < textToProcess.length) {
        let matched = false;
        let currentWordLength = Math.min(maxWordLength, textToProcess.length - index);
        
        // 正向最大匹配
        while (currentWordLength > 0) {
            const word = textToProcess.substring(index, index + currentWordLength);
            
            // 检查是否为常用词或单字符
            if (commonWords.has(word) || currentWordLength === 1) {
                result.push(word);
                index += currentWordLength;
                matched = true;
                break;
            }
            
            currentWordLength--;
        }
        
        // 防止死循环
        if (!matched) {
            index++;
        }
    }
    
    return result;
}

/**
 * 拆分中文句子
 * @param {string} text 中文文本
 * @returns {Array} 句子数组
 */
function splitChineseSentences(text) {
    // 按中文句号、感叹号、问号、分号拆分
    const sentences = text.split(/[。！？；]/).filter(Boolean);
    const results = [];
    
    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;
        
        // 如果句子过长，按逗号、顿号进一步拆分
        if (sentence.length > 50) {
            const parts = sentence.split(/[，、]/).filter(part => {
                const trimmed = part.trim();
                // 过滤掉过短的虚词
                return trimmed.length > 1 && !/^[的了是在有和与或但而且然后因为所以]$/.test(trimmed);
            });
            results.push(...parts);
        } else {
            results.push(sentence);
        }
    }
    
    return results;
}

/**
 * 拆分中英文混合句子
 * @param {string} text 混合语言文本
 * @returns {Array} 拆分结果
 */
function splitMixedLanguageSentences(text) {
    const results = [];
    
    // 按语言边界拆分
    const segments = text.match(/[\u4e00-\u9fa5，。！？；：""''（）【】《》]+|[a-zA-Z0-9\s,.!?;:()"'<>\[\]{}]+/g) || [];
    
    for (let segment of segments) {
        segment = segment.trim();
        if (!segment) continue;
        
        // 判断是中文还是英文主导
        const chineseCount = (segment.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishCount = (segment.match(/[a-zA-Z]/g) || []).length;
        
        if (chineseCount > englishCount) {
            results.push(...splitChineseSentences(segment));
        } else {
            results.push(...splitEnglishSentences(segment));
        }
    }
    
    return results;
}

/**
 * 拆分代码命名
 * @param {string} text 代码文本
 * @returns {Array} 拆分结果
 */
function splitCodeNaming(text) {
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
        else {
            results.push(token);
        }
    }
    
    return results;
}

/**
 * 拆分列表项
 * @param {string} text 列表文本
 * @returns {Array} 列表项数组
 */
function splitListItems(text) {
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

/**
 * 拆分包裹内容
 * @param {string} text 包含包裹标点的文本
 * @returns {Array} 拆分结果
 */
function splitWrappedContent(text) {
    const results = [];
    
    // 定义包裹符号对
    const wrappers = [
        { open: '"', close: '"' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "'", close: "'" },
        { open: '（', close: '）' },
        { open: '(', close: ')' },
        { open: '【', close: '】' },
        { open: '[', close: ']' },
        { open: '《', close: '》' },
        { open: '<', close: '>' },
        { open: '「', close: '」' },
        { open: '『', close: '』' }
    ];
    
    let remaining = text;
    
    for (const wrapper of wrappers) {
        const regex = new RegExp(`\\${wrapper.open}([^\\${wrapper.close}]*)\\${wrapper.close}`, 'g');
        let match;
        
        while ((match = regex.exec(remaining)) !== null) {
            const content = match[1].trim();
            if (content) {
                results.push(content);
            }
            // 移除已处理的部分
            remaining = remaining.replace(match[0], ' ');
        }
    }
    
    // 处理剩余的非包裹内容
    const leftover = remaining.trim();
    if (leftover) {
        // 按标点符号拆分剩余内容
        results.push(...splitByPunctuation(leftover));
    }
    
    return results;
}

/**
 * 按标点符号拆分
 * @param {string} text 文本
 * @returns {Array} 拆分结果
 */
function splitByPunctuation(text) {
    // 中英文标点符号
    return text.split(/[,.!?;:，。！？；：、]/)
               .map(part => part.trim())
               .filter(Boolean);
}

/**
 * 后处理拆分结果
 * @param {Array} results 原始拆分结果
 * @returns {Array} 处理后的结果
 */
function postProcessSplitResults(results) {
    if (!results || results.length === 0) return [];
    
    // 1. 去重
    const uniqueResults = [...new Set(results.map(item => item.trim()))].filter(Boolean);
    
    // 2. 长度校准 - 合并过短的片段
    const processed = [];
    let i = 0;
    
    while (i < uniqueResults.length) {
        let current = uniqueResults[i];
        
        // 如果当前项过短（1-2个字符），尝试与相邻项合并
        if (current.length <= 2 && i < uniqueResults.length - 1) {
            const next = uniqueResults[i + 1];
            // 检查是否为无意义的虚词或单字符
            if (/^[的了是在有和与或但而且然后因为所以a-zA-Z]$/.test(current)) {
                current = current + next;
                i += 2; // 跳过下一项
            } else {
                processed.push(current);
                i++;
            }
        } else {
            processed.push(current);
            i++;
        }
    }
    
    // 3. 语义补全 - 保护固定搭配
    const protectedPhrases = [
        '北京大学', '清华大学', '中国科学院', 'HTTP', 'HTTPS', 'API', 'URL', 'JSON', 'XML',
        'JavaScript', 'TypeScript', 'GitHub', 'Google', 'Microsoft', 'Apple'
    ];
    
    return processed.filter(item => {
        // 保留长度合适的项目
        return item.length >= 1 && item.length <= 200;
    });
}

/**
 * Generates different path formats from a Windows path.
 * @param {string} path The input Windows path.
 * @returns {string[]|null} An array of path formats or null if not a valid path.
 */
export function processPath(path) {
    if (!path || !path.trim()) return null;
    
    const input = path.trim();
    
    // Strictly check for Windows path format, distinguishes between quoted and unquoted
    // Matches paths like: D:\Users\Jliu Pureey\Downloads\gitmine\Edge-Homepage\README.md
    // And quoted paths like: "C:\Program Files\Microsoft Office\Office16\WINWORD.EXE"
    
    // Check for path with quotes
    const matchWithQuotes = input.match(/^"([a-zA-Z]:\\[^"<>|?*]*)"$/);
    // Check for path without quotes 
    const matchWithoutQuotes = input.match(/^([a-zA-Z]:\\[^"<>|?*]*)$/);
    
    let cleanPath = null;
    if (matchWithQuotes) {
        cleanPath = matchWithQuotes[1];
    } else if (matchWithoutQuotes) {
        cleanPath = matchWithoutQuotes[1];
    } else {
        return null; // Not a valid Windows path format
    }

    // 1. Original clean path
    const originalPath = cleanPath;
    
    // 2. Unix-style file URL
    const unixPath = cleanPath.replace(/\\/g, '/');
    const fileUrlUnix = 'file:///' + unixPath;
    
    // 3. Double backslash escaped
    const escapedPath = cleanPath.replace(/\\/g, '\\\\'); 
    
    // 4. Alternative file URL format (encoded)
    const fileUrlAlt = 'file:///' + encodeURI(unixPath);

    return [
        originalPath,
        fileUrlUnix,
        escapedPath,
        fileUrlAlt,
    ];
}

/**
 * Generates various repository links from a "user/repo" string or a known URL.
 * @param {string} text The input text.
 * @returns {object|null} An object containing the original GitHub link and an array of generated links, or null.
 */
export function processLinkGeneration(text) {
    if (!text || !text.trim()) return null;
    
    const knownDomains = ['github.com', 'zread.ai', 'deepwiki.com', 'context7.com'];
    const templates = {
        github: 'https://github.com/{user_repo}',
        zread: 'https://zread.ai/{user_repo}',
        deepwiki: 'https://deepwiki.com/{user_repo}',
        context7: 'https://context7.com/{user_repo}',
    };

    let userRepo = '';
    let originalGithubLink = null;

    // Check for "user/repo" format
    const shortMatch = text.trim().match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (shortMatch) {
        userRepo = text.trim();
        // originalGithubLink is only captured when the original input is a GitHub URL
    } else {
        // Check for known URLs
        try {
            const url = new URL(text);
            const hostname = url.hostname.replace('www.', '');
            if (knownDomains.includes(hostname)) {
                const pathParts = url.pathname.split('/').filter(Boolean);
                if (pathParts.length >= 2) {
                    userRepo = `${pathParts[0]}/${pathParts[1]}`;
                    // Capture the original link only when the input was a GitHub URL
                    if (hostname === 'github.com') {
                        originalGithubLink = text.trim();
                    }
                }
            }
        } catch (e) {
            // Not a valid URL, do nothing
        }
    }

    if (userRepo) {
        const generatedLinks = Object.values(templates).map(template => 
            template.replace('{user_repo}', userRepo)
        );
        return {
            originalGithubLink,
            generatedLinks
        };
    }

    return null;
}

/**
 * 多格式分析功能 - 同时检测多种内容格式
 * @param {string} text 输入文本
 * @returns {object} 包含各种检测结果的对象
 */
export function processMultiFormat(text) {
    const results = {
        urls: [],
        paths: [],
        emails: [],
        phones: [],
        repos: [],
        ips: [],
        dates: [],
        numbers: [],
        chineseText: [],
        englishText: []
    };

    if (!text || !text.trim()) return results;

    // URL检测 (更全面的正则)
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)/gi;
    results.urls = [...new Set((text.match(urlRegex) || []).map(url => 
        url.startsWith('www.') ? 'http://' + url : url
    ))];

    // 路径检测 (Windows和Unix路径)
    const pathRegex = /(?:[a-zA-Z]:[\\/]|[\\/])[^<>"*?|]+|~\/[^<>"*?|]+/g;
    results.paths = [...new Set(text.match(pathRegex) || [])];

    // 邮箱检测
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    results.emails = [...new Set(text.match(emailRegex) || [])];

    // 电话号码检测 (中国手机号和固话)
    const phoneRegex = /(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g;
    results.phones = [...new Set(text.match(phoneRegex) || [])];

    // 代码仓库检测 (user/repo格式)
    const repoRegex = /(?:^|\s)([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:\s|$)/g;
    const repoMatches = text.match(repoRegex);
    if (repoMatches) {
        results.repos = [...new Set(repoMatches.map(match => match.trim()))];
    }

    // IP地址检测
    const ipRegex = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
    results.ips = [...new Set(text.match(ipRegex) || [])];

    // 日期检测 (多种格式)
    const dateRegex = /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}年\d{1,2}月\d{1,2}日/g;
    results.dates = [...new Set(text.match(dateRegex) || [])];

    // 数字检测 (整数、小数、百分比等)
    const numberRegex = /\d+(?:\.\d+)?%?/g;
    results.numbers = [...new Set(text.match(numberRegex) || [])].filter(num => 
        num.length > 2 || num.includes('.') || num.includes('%')
    );

    // 中文文本片段检测
    const chineseRegex = /[\u4e00-\u9fa5]+(?:[\u4e00-\u9fa5\s，。！？；：""''（）【】《》]*[\u4e00-\u9fa5])?/g;
    results.chineseText = [...new Set(text.match(chineseRegex) || [])].filter(t => t.length > 1);

    // 英文单词检测
    const englishRegex = /[a-zA-Z]+(?:[a-zA-Z\s'-]*[a-zA-Z])?/g;
    results.englishText = [...new Set(text.match(englishRegex) || [])].filter(t => 
        t.length > 2 && !results.urls.some(url => url.includes(t))
    );

    return results;
}

/**
 * 智能文本分类 - 根据内容特征自动分类
 * @param {string} text 输入文本
 * @returns {object} 分类结果
 */
export function classifyText(text) {
    const multiFormat = processMultiFormat(text);
    const classification = {
        type: 'unknown',
        confidence: 0,
        suggestions: []
    };

    // 判断文本类型
    if (multiFormat.urls.length > 0) {
        classification.type = 'url_collection';
        classification.confidence = 0.9;
        classification.suggestions.push('检测到链接，可以批量打开或验证');
    } else if (multiFormat.paths.length > 0) {
        classification.type = 'file_paths';
        classification.confidence = 0.85;
        classification.suggestions.push('检测到文件路径，可以转换格式或批量处理');
    } else if (multiFormat.emails.length > 0) {
        classification.type = 'contact_info';
        classification.confidence = 0.8;
        classification.suggestions.push('检测到邮箱地址，可以批量发送邮件');
    } else if (multiFormat.repos.length > 0) {
        classification.type = 'code_repos';
        classification.confidence = 0.85;
        classification.suggestions.push('检测到代码仓库，可以生成各平台链接');
    } else if (multiFormat.chineseText.length > multiFormat.englishText.length) {
        classification.type = 'chinese_text';
        classification.confidence = 0.7;
        classification.suggestions.push('中文文本，可以进行分词或翻译');
    } else if (multiFormat.englishText.length > 0) {
        classification.type = 'english_text';
        classification.confidence = 0.7;
        classification.suggestions.push('英文文本，可以进行语法检查或翻译');
    }

    return classification;
}

/**
 * 多格式分析功能 - 为UI提供统一的分析接口
 * @param {string} text 输入文本
 * @returns {Array} 包含各种检测结果的数组
 */
export function analyzeTextForMultipleFormats(text) {
    const results = [];
    
    if (!text || !text.trim()) return results;

    // 路径检测和转换
    const pathResults = processPath(text);
    if (pathResults) {
        results.push({
            type: '路径转换',
            data: pathResults
        });
    }

    // URL提取
    const { extractedLinks } = processTextExtraction(text);
    if (extractedLinks.length > 0) {
        results.push({
            type: '链接提取',
            data: extractedLinks.map(url => ({ url }))
        });
    }

    // 仓库链接生成
    const repoResult = processLinkGeneration(text);
    if (repoResult) {
        results.push({
            type: '仓库链接',
            data: repoResult.generatedLinks.map(url => ({ url }))
        });
        // Also push the original GitHub link if it exists
        if (repoResult.originalGithubLink) {
            results.push({
                type: 'GitHub链接',
                data: [{ url: repoResult.originalGithubLink }]
            });
        }
    }

    // 多格式检测
    const multiFormat = processMultiFormat(text);
    
    // 邮箱检测
    if (multiFormat.emails.length > 0) {
        results.push({
            type: '邮箱地址',
            data: multiFormat.emails.map(email => ({ url: `mailto:${email}` }))
        });
    }

    // 电话号码检测
    if (multiFormat.phones.length > 0) {
        results.push({
            type: '电话号码',
            data: multiFormat.phones.map(phone => ({ url: `tel:${phone}` }))
        });
    }

    // IP地址检测
    if (multiFormat.ips.length > 0) {
        results.push({
            type: 'IP地址',
            data: multiFormat.ips.map(ip => ({ url: `http://${ip}` }))
        });
    }

    return results;
}

/**
 * 获取分隔规则的说明信息
 * @param {string} rule 分隔规则名称
 * @returns {string} 规则说明
 */
export function getSplitRuleDescription(rule) {
    const descriptions = {
        'auto': '智能分析：根据内容类型自动选择最适合的分隔方式，支持列表、代码、包裹内容等复杂场景',
        'en-sentence': '英文句子：按句号、感叹号、问号拆分英文句子，长句子会按逗号进一步拆分',
        'zh-sentence': '中文句子：按中文标点（。！？；）拆分句子，长句按逗号、顿号拆分并过滤虚词',
        'mixed-sentence': '中英混合：按语言边界智能拆分，中文部分用中文规则，英文部分用英文规则',
        'code-naming': '代码命名：识别驼峰、蛇形、串式命名法，拆分函数名和变量名为基础语义单元',
        'list-items': '列表项目：提取有序列表（1. 一、 ①）和无序列表（- * •）的内容，自动过滤序号标记',
        'wrapped-content': '包裹内容：提取引号、括号、书名号等包裹符号内的内容，支持中英文标点',
        'space': '空格分隔：按空格拆分单词，适合英文文本的基础分词',
        'newline': '换行分隔：按换行符拆分，适合处理多行文本内容',
        'punctuation': '标点分隔：按中英文标点符号拆分，获取基础文本片段',
        'word': '单词分隔：按非字母数字字符拆分，提取纯单词内容'
    };
    
    return descriptions[rule] || '未知规则';
}

/**
 * 获取所有可用的分隔规则
 * @returns {Array} 规则列表
 */
export function getAvailableSplitRules() {
    return [
        { value: 'auto', label: '智能分析', description: getSplitRuleDescription('auto') },
        { value: 'mixed-sentence', label: '中英混合', description: getSplitRuleDescription('mixed-sentence') },
        { value: 'zh-sentence', label: '中文句子', description: getSplitRuleDescription('zh-sentence') },
        { value: 'en-sentence', label: '英文句子', description: getSplitRuleDescription('en-sentence') },
        { value: 'code-naming', label: '代码命名', description: getSplitRuleDescription('code-naming') },
        { value: 'list-items', label: '列表项目', description: getSplitRuleDescription('list-items') },
        { value: 'wrapped-content', label: '包裹内容', description: getSplitRuleDescription('wrapped-content') },
        { value: 'space', label: '空格分隔', description: getSplitRuleDescription('space') },
        { value: 'newline', label: '换行分隔', description: getSplitRuleDescription('newline') },
        { value: 'punctuation', label: '标点分隔', description: getSplitRuleDescription('punctuation') },
        { value: 'word', label: '单词分隔', description: getSplitRuleDescription('word') }
    ];
}
