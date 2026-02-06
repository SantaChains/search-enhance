// src/utils/textProcessor.js

/**
 * Enhanced Text Processing Utilities
 * Provides comprehensive text analysis and processing capabilities
 * 包含中文分词、剪贴板操作和文本分析功能
 * 
 * 性能优化版本：
 * - 词典和正则表达式提取为模块级常量
 * - 预编译正则表达式避免重复创建
 * - 优化字符串操作减少中间对象创建
 * - 添加浏览器API兼容性检查
 */

// ============================================================================
// 模块级常量定义（预编译，避免重复创建）
// ============================================================================

const COMMON_WORDS = new Set([
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
    '链接', '提取', '仓库', '生成', '邮箱', '电话', 'IP', '地址', '转换',
    
    '的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '且', '然后', '因为', '所以',
    '可以', '可能', '应该', '需要', '必须', '如何', '什么', '为什么', '哪里', '时候',
    '方法', '步骤', '流程', '过程', '结果', '效果', '影响', '意义', '价值', '作用',
    '系统', '平台', '框架', '库', '工具', '应用', '程序', '软件', '硬件', '网络',
    '数据', '信息', '知识', '内容', '资源', '服务', '产品', '解决方案', '技术', '方案',
    
    'JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue', 'Angular', 'Node.js',
    'API', 'HTTP', 'HTTPS', 'URL', 'JSON', 'XML', 'DOM', 'BOM', 'AJAX', 'REST',
    '算法', '数据结构', '数据库', '缓存', '性能', '优化', '安全', '加密', '解密',
    '前端', '后端', '全栈', '开发', '测试', '部署', '维护', '版本', '控制', 'Git'
]);

const SIMPLE_COMMON_WORDS = new Set([
    '中文', '分词', '算法', '轻量级', '正向', '最大', '匹配', '文本', '处理', 
    '浏览器', '扩展', '功能', '工具', '智能', '搜索', '体验', '用户', '开发',
    '项目', '环境', '规则', '词典', '集成', '实现', '更新', '功能', '代码'
]);

const MEANINGLESS_CHARS = new Set(['的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '且', '然后', '因为', '所以']);

const PROTECTED_PHRASES = [
    '北京大学', '清华大学', '中国科学院', 'HTTP', 'HTTPS', 'API', 'URL', 'JSON', 'XML',
    'JavaScript', 'TypeScript', 'GitHub', 'Google', 'Microsoft', 'Apple'
];

const KNOWN_DOMAINS = ['github.com', 'zread.ai', 'deepwiki.com', 'context7.com'];

const LINK_TEMPLATES = {
    github: 'https://github.com/{user_repo}',
    zread: 'https://zread.ai/{user_repo}',
    deepwiki: 'https://deepwiki.com/{user_repo}',
    context7: 'https://context7.com/{user_repo}',
};

// ============================================================================
// 预编译正则表达式
// ============================================================================

const REGEX_PATTERNS = {
    url: {
        extraction: /(?:https?:\/\/|www\.)[^\s<>""']+/gi,
        comprehensive: /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)/gi,
    },
    chineseChar: /[\u4e00-\u9fa5]/g,
    chinesePunctuation: /[，；：？！]/g,
    chinesePeriod: /。/g,
    squareBrackets: /\[[^\]]*\]/g,
    nonEnglishClean: /[^a-zA-Z0-9\s.]/g,
    whitespace: /\s+/g,
    listDetection: /^[\s]*(?:\d+[.)]\s*|[一二三四五六七八九十]+[、.]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|[-*•·]\s*)/m,
    codeNaming: /[a-zA-Z_$][a-zA-Z0-9_$]*[A-Z][a-zA-Z0-9_$]*|[a-zA-Z_$][a-zA-Z0-9_$]*_[a-zA-Z0-9_$]+|[a-zA-Z_$][a-zA-Z0-9_$]*-[a-zA-Z0-9_$]+/,
    wrappedContent: /["'"（）()【】《》<>「」『』]/g,
    englishSentence: /[^.!?]+[.!?]?/g,
    commaSplit: /,\s+/g,
    chineseSentence: /[。！？；]/g,
    chineseComma: /[，、]/g,
    mixedLanguage: /[\u4e00-\u9fa5，。！？；：""''（）【】《》]+|[a-zA-Z0-9\s,.!?;:()"'<>\[\]{}]+/g,
    camelCase: /[a-z][A-Z]/g,
    uppercaseSequence: /^[A-Z]{2,}/,
    uppercaseSplit: /^([A-Z]+)([A-Z][a-z].*)$/,
    functionCall: /\w+\([^)]*\)/,
    lines: /\r?\n/,
    listPatterns: [
        /^\d+[.)]\s*(.+)$/,
        /^[一二三四五六七八九十]+[、.]\s*(.+)$/,
        /^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$/,
        /^[a-zA-Z][.)]\s*(.+)$/,
        /^[-*•·]\s*(.+)$/,
        /^[▪▫◦‣⁃]\s*(.+)$/
    ],
    punctuation: /[,.!?;:，。！？；：、]/g,
    pathWithQuotes: /^"([a-zA-Z]:\\[^"<>|?*]*)"$/,
    pathWithoutQuotes: /^([a-zA-Z]:\\[^"<>|?*]*)$/,
    repoPattern: /^\/?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)\/?$/,
    embeddedRepo: /(?:https?:\/\/[^\/]+\/|^\/?)\s*([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/,
    pathRegex: /(?:[a-zA-Z]:[\\/]|[\\/])[^<>"*?|]+|~\/[^<>"*?|]+/g,
    emailRegex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phoneRegex: /(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g,
    repoRegex: /(?:^|\s)([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)(?:\s|$)/g,
    ipRegex: /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g,
    dateRegex: /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}年\d{1,2}月\d{1,2}日/g,
    numberRegex: /\d+(?:\.\d+)?%?/g,
    chineseTextRegex: /[\u4e00-\u9fa5]+(?:[\u4e00-\u9fa5\s，。！？；：""''（）【】《》]*[\u4e00-\u9fa5])?/g,
    englishRegex: /[a-zA-Z]+(?:[a-zA-Z\s'-]*[a-zA-Z])?/g,
    shortWordFilter: /^[的了是在有和与或但而且然后因为所以a-zA-Z]$/,
    emptyFilter: /^\s*$/,
};

const WRAPPERS = [
    { open: '"', close: '"' },
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

/**
 * 检查剪贴板API是否可用
 * @returns {boolean}
 */
function isClipboardAPIAvailable() {
    return !!(navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.readText);
}

/**
 * 安全地创建正则表达式
 * @param {string} pattern 正则表达式字符串
 * @param {string} flags 标志
 * @returns {RegExp|null}
 */
function safeCreateRegex(pattern, flags = 'g') {
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        console.error('正则表达式创建失败:', pattern, e);
        return null;
    }
}

/**
 * 安全转义URL中的正则特殊字符
 * @param {string} url URL字符串
 * @returns {string}
 */
function escapeUrlForRegex(url) {
    return url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// 公共API
// ============================================================================

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

    const trimmedText = text.trim();
    const urlRegex = REGEX_PATTERNS.url.extraction;
    
    let potentialLinks = trimmedText.match(urlRegex) || [];
    
    const seenUrls = new Set();
    results.extractedLinks = potentialLinks.filter(url => {
        if (seenUrls.has(url)) return false;
        
        try {
            const testUrl = url.startsWith('http') ? url : `http://${url}`;
            new URL(testUrl);
            seenUrls.add(url);
            return true;
        } catch (_) {
            return false;
        }
    });
    
    let cleaned = trimmedText;
    
    if (results.extractedLinks.length > 0) {
        const urlSet = new Set(results.extractedLinks);
        cleaned = cleaned.replace(new RegExp(
            [...urlSet].map(escapeUrlForRegex).join('|'), 
            'gi'
        ), ' ');
    }
    
    cleaned = cleaned.replace(REGEX_PATTERNS.chineseChar, '');
    cleaned = cleaned.replace(REGEX_PATTERNS.chinesePunctuation, '');
    cleaned = cleaned.replace(REGEX_PATTERNS.chinesePeriod, '.');
    cleaned = cleaned.replace(REGEX_PATTERNS.squareBrackets, '');
    cleaned = cleaned.replace(REGEX_PATTERNS.nonEnglishClean, ' ');
    cleaned = REGEX_PATTERNS.whitespace.test(cleaned) 
        ? cleaned.trim().replace(REGEX_PATTERNS.whitespace, ' ')
        : cleaned.trim();

    results.cleanedText = cleaned;

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
    
    const delimiters = Array.isArray(delimiter) ? delimiter : [delimiter];
    let results = [text.trim()];
    
    for (const rule of delimiters) {
        const newResults = [];
        for (const segment of results) {
            newResults.push(...applySingleSplitRule(segment, rule));
        }
        results = newResults;
    }
    
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
            return intelligentSegmentation(text);
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
    if (REGEX_PATTERNS.listDetection.test(text)) {
        return 'list';
    }
    
    if (REGEX_PATTERNS.codeNaming.test(text)) {
        return 'code';
    }
    
    if (REGEX_PATTERNS.wrappedContent.test(text)) {
        return 'wrapped';
    }
    
    const chineseChars = text.match(REGEX_PATTERNS.chineseChar) || [];
    const englishChars = text.match(/[a-zA-Z]/g) || [];
    const chineseCount = chineseChars.length;
    const englishCount = englishChars.length;
    
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
    const sentences = text.match(REGEX_PATTERNS.englishSentence) || [];
    const results = [];
    
    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;
        
        if (sentence.length > 100) {
            const parts = sentence.split(REGEX_PATTERNS.commaSplit).filter(Boolean);
            results.push(...parts);
        } else {
            results.push(sentence);
        }
    }
    
    return results;
}

/**
 * 增强版中文分词算法 - 基于正向最大匹配
 * @param {string} text 待分词的中文文本
 * @param {number} maxWordLength 最大词长，默认5
 * @param {Object} options 分词选项
 * @param {boolean} options.useEnhancedDict 是否使用增强词典，默认true
 * @returns {Array} 分词结果数组
 */
export function chineseWordSegmentation(text, maxWordLength = 5, options = { useEnhancedDict: true }) {
    if (!text || !text.trim()) return [];
    
    const commonWords = options.useEnhancedDict !== false ? COMMON_WORDS : SIMPLE_COMMON_WORDS;
    const textToProcess = text.trim();
    const result = [];
    let index = 0;
    const length = textToProcess.length;
    
    while (index < length) {
        let matched = false;
        let currentWordLength = Math.min(maxWordLength, length - index);
        
        while (currentWordLength > 0) {
            const word = textToProcess.substring(index, index + currentWordLength);
            
            if (commonWords.has(word) || currentWordLength === 1) {
                result.push(word);
                index += currentWordLength;
                matched = true;
                break;
            }
            
            currentWordLength--;
        }
        
        if (!matched) {
            index++;
        }
    }
    
    return postProcessSegmentationResult(result);
}

/**
 * 分词结果后处理函数
 * @param {Array} segmentationResult 原始分词结果
 * @returns {Array} 处理后的分词结果
 */
function postProcessSegmentationResult(segmentationResult) {
    if (!segmentationResult || segmentationResult.length === 0) return [];
    
    const filtered = segmentationResult.filter(word => {
        if (word.length > 1) return true;
        return !MEANINGLESS_CHARS.has(word);
    });
    
    const merged = [];
    let i = 0;
    const len = filtered.length;
    
    while (i < len) {
        const current = filtered[i];
        
        if (current.length === 1 && i < len - 1 && filtered[i + 1].length === 1) {
            const combined = current + filtered[i + 1];
            merged.push(combined);
            i += 2;
        } else {
            merged.push(current);
            i++;
        }
    }
    
    return merged;
}

/**
 * 智能分词函数 - 根据文本长度和复杂度选择合适的分词策略
 * @param {string} text 待分词的文本
 * @param {Object} options 分词选项
 * @returns {Array} 分词结果数组
 */
export function intelligentSegmentation(text, options = {}) {
    if (!text || !text.trim()) return [];
    
    const trimmedText = text.trim();
    const length = trimmedText.length;
    
    if (length < 10) {
        return chineseWordSegmentation(trimmedText, 3, { useEnhancedDict: false });
    } else if (length < 100) {
        return chineseWordSegmentation(trimmedText, 4);
    } else {
        return chineseWordSegmentation(trimmedText, 5);
    }
}

/**
 * 拆分中文句子
 * @param {string} text 中文文本
 * @returns {Array} 句子数组
 */
function splitChineseSentences(text) {
    const sentences = text.split(REGEX_PATTERNS.chineseSentence).filter(Boolean);
    const results = [];
    
    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;
        
        if (sentence.length > 50) {
            const parts = sentence.split(REGEX_PATTERNS.chineseComma).filter(part => {
                const trimmed = part.trim();
                return trimmed.length > 1 && !REGEX_PATTERNS.shortWordFilter.test(trimmed);
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
    
    const segments = text.match(REGEX_PATTERNS.mixedLanguage) || [];
    
    for (let segment of segments) {
        segment = segment.trim();
        if (!segment) continue;
        
        const chineseChars = segment.match(REGEX_PATTERNS.chineseChar) || [];
        const englishChars = segment.match(/[a-zA-Z]/g) || [];
        
        if (chineseChars.length > englishChars.length) {
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
    
    const tokens = text.split(/\s+/).filter(Boolean);
    
    for (const token of tokens) {
        if (REGEX_PATTERNS.camelCase.test(token)) {
            const parts = token.split(/(?=[A-Z])/).filter(Boolean);
            const processed = [];
            for (let part of parts) {
                if (REGEX_PATTERNS.uppercaseSequence.test(part) && part.length > 2) {
                    const match = part.match(REGEX_PATTERNS.uppercaseSplit);
                    if (match) {
                        processed.push(match[1].slice(0, -1));
                        processed.push(match[1].slice(-1) + match[2]);
                    } else {
                        processed.push(part);
                    }
                } else {
                    processed.push(part);
                }
            }
            results.push(...processed);
        }
        else if (token.includes('_')) {
            results.push(...token.split('_').filter(Boolean));
        }
        else if (token.includes('-')) {
            results.push(...token.split('-').filter(Boolean));
        }
        else if (REGEX_PATTERNS.functionCall.test(token)) {
            const match = token.match(/(\w+)\(([^)]*)\)/);
            if (match) {
                results.push(match[1]);
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
    
    const lines = text.split(REGEX_PATTERNS.lines).filter(Boolean);
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        let matched = false;
        for (const pattern of REGEX_PATTERNS.listPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                results.push(match[1].trim());
                matched = true;
                break;
            }
        }
        
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
    let remaining = text;
    
    for (const wrapper of WRAPPERS) {
        const regex = safeCreateRegex(`\\${wrapper.open}([^\\${wrapper.close}]*)\\${wrapper.close}`);
        if (!regex) continue;
        
        let match;
        while ((match = regex.exec(remaining)) !== null) {
            const content = match[1].trim();
            if (content) {
                results.push(content);
            }
            remaining = remaining.replace(match[0], ' ');
        }
    }
    
    const leftover = remaining.trim();
    if (leftover) {
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
    return text.split(REGEX_PATTERNS.punctuation)
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
    
    const uniqueResults = [...new Set(results.map(item => item.trim()))].filter(Boolean);
    
    const processed = [];
    let i = 0;
    const len = uniqueResults.length;
    
    while (i < len) {
        let current = uniqueResults[i];
        
        if (current.length <= 2 && i < len - 1) {
            const next = uniqueResults[i + 1];
            if (REGEX_PATTERNS.shortWordFilter.test(current)) {
                current = current + next;
                i += 2;
            } else {
                processed.push(current);
                i++;
            }
        } else {
            processed.push(current);
            i++;
        }
    }
    
    return processed.filter(item => {
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
    
    const matchWithQuotes = input.match(REGEX_PATTERNS.pathWithQuotes);
    const matchWithoutQuotes = input.match(REGEX_PATTERNS.pathWithoutQuotes);
    
    let cleanPath = null;
    if (matchWithQuotes) {
        cleanPath = matchWithQuotes[1];
    } else if (matchWithoutQuotes) {
        cleanPath = matchWithoutQuotes[1];
    } else {
        return null;
    }

    const originalPath = cleanPath;
    const unixPath = cleanPath.replace(/\\/g, '/');
    const fileUrlUnix = 'file:///' + unixPath;
    const escapedPath = cleanPath.replace(/\\/g, '\\\\'); 
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
    
    let userRepo = '';
    let originalGithubLink = null;
    const trimmedText = text.trim();
    
    try {
        const url = new URL(trimmedText);
        const hostname = url.hostname.replace('www.', '');
        if (KNOWN_DOMAINS.includes(hostname)) {
            const pathParts = url.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                let repoName = pathParts[1];
                if (repoName.endsWith('.git')) {
                    repoName = repoName.slice(0, -4);
                }
                userRepo = `${pathParts[0]}/${repoName}`;
                if (hostname === 'github.com') {
                    originalGithubLink = trimmedText;
                }
            }
        }
    } catch (e) {
        // Not a valid URL
    }
    
    if (!userRepo) {
        const repoMatch = trimmedText.match(REGEX_PATTERNS.repoPattern);
        if (repoMatch) {
            userRepo = `${repoMatch[1]}/${repoMatch[2]}`;
        } else {
            const embeddedMatch = trimmedText.match(REGEX_PATTERNS.embeddedRepo);
            if (embeddedMatch) {
                userRepo = `${embeddedMatch[1]}/${embeddedMatch[2]}`;
            }
        }
    }

    if (userRepo) {
        const generatedLinks = Object.values(LINK_TEMPLATES).map(template => 
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

    if (text.length > 5000) {
        console.warn('文本长度超过5000字符，仅进行基本格式检测以避免性能问题');
        return results;
    }

    const urlRegex = REGEX_PATTERNS.url.comprehensive;
    results.urls = [...new Set((text.match(urlRegex) || []).map(url => 
        url.startsWith('www.') ? 'http://' + url : url
    ))];

    results.paths = [...new Set(text.match(REGEX_PATTERNS.pathRegex) || [])];
    results.emails = [...new Set(text.match(REGEX_PATTERNS.emailRegex) || [])];
    results.phones = [...new Set(text.match(REGEX_PATTERNS.phoneRegex) || [])];

    const repoMatches = text.match(REGEX_PATTERNS.repoRegex);
    if (repoMatches) {
        results.repos = [...new Set(repoMatches.map(match => match.trim()))];
    }

    results.ips = [...new Set(text.match(REGEX_PATTERNS.ipRegex) || [])];
    results.dates = [...new Set(text.match(REGEX_PATTERNS.dateRegex) || [])];
    results.numbers = [...new Set(text.match(REGEX_PATTERNS.numberRegex) || [])].filter(num => 
        num.length > 2 || num.includes('.') || num.includes('%')
    );

    results.chineseText = [...new Set(text.match(REGEX_PATTERNS.chineseTextRegex) || [])].filter(t => t.length > 1);
    results.englishText = [...new Set(text.match(REGEX_PATTERNS.englishRegex) || [])].filter(t => 
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
 * 复制文本到剪贴板（现代方法）
 * @param {string} text - 要复制的文本内容
 * @returns {Promise<boolean>} - 复制成功返回true，失败返回false
 */
export async function copyToClipboardModern(text) {
    if (!isClipboardAPIAvailable()) {
        return false;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('剪贴板复制失败:', err);
        return false;
    }
}

/**
 * 从剪贴板读取文本（现代方法）
 * @returns {Promise<string|null>} - 剪贴板内容，失败返回null
 */
export async function readFromClipboardModern() {
    if (!isClipboardAPIAvailable()) {
        return null;
    }
    
    try {
        const text = await navigator.clipboard.readText();
        return text;
    } catch (err) {
        console.error('读取剪贴板失败:', err);
        return null;
    }
}

/**
 * 复制文本到剪贴板（传统方法）
 * @param {string} text - 要复制的文本内容
 * @returns {boolean} - 复制成功返回true，失败返回false
 */
export function copyToClipboardLegacy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('复制失败:', err);
    } finally {
        document.body.removeChild(textarea);
    }
    return success;
}

/**
 * 智能复制到剪贴板 - 自动选择合适的方法
 * @param {string} text - 要复制的文本内容
 * @returns {Promise<boolean>} - 复制成功返回true，失败返回false
 */
export async function copyToClipboard(text) {
    if (isClipboardAPIAvailable()) {
        return await copyToClipboardModern(text);
    } else {
        return copyToClipboardLegacy(text);
    }
}

/**
 * 提取文本中的邮箱地址
 * @param {string} text 输入文本
 * @returns {Array} 提取的邮箱地址数组
 */
export function extractEmails(text) {
    if (!text || !text.trim()) return [];
    
    return [...new Set(text.match(REGEX_PATTERNS.emailRegex) || [])];
}

/**
 * 提取文本中的手机号码
 * @param {string} text 输入文本
 * @returns {Array} 提取的手机号码数组
 */
export function extractPhoneNumbers(text) {
    if (!text || !text.trim()) return [];
    
    return [...new Set(text.match(REGEX_PATTERNS.phoneRegex) || [])];
}

/**
 * 多格式分析功能 - 为UI提供统一的分析接口
 * @param {string} text 输入文本
 * @returns {Array} 包含各种检测结果的数组
 */
export function analyzeTextForMultipleFormats(text) {
    const results = [];
    
    if (!text || !text.trim()) return results;

    if (text.length > 10000) {
        console.warn('文本长度超过10000字符，仅进行基本分析以避免性能问题');
        return results;
    }

    const pathResults = processPath(text);
    if (pathResults) {
        results.push({
            type: '路径转换',
            data: pathResults
        });
    }

    const { extractedLinks } = processTextExtraction(text);
    if (extractedLinks.length > 0) {
        results.push({
            type: '链接提取',
            data: extractedLinks.map(url => ({ url }))
        });
    }

    const repoResult = processLinkGeneration(text);
    if (repoResult) {
        results.push({
            type: '仓库链接',
            data: repoResult.generatedLinks.map(url => ({ url }))
        });
        if (repoResult.originalGithubLink) {
            results.push({
                type: 'GitHub链接',
                data: [{ url: repoResult.originalGithubLink }]
            });
        }
    }

    if (text.length < 5000) {
        const multiFormat = processMultiFormat(text);
        
        if (multiFormat.emails.length > 0) {
            results.push({
                type: '邮箱地址',
                data: multiFormat.emails.map(email => ({ url: `mailto:${email}` }))
            });
        }

        if (multiFormat.phones.length > 0) {
            results.push({
                type: '电话号码',
                data: multiFormat.phones.map(phone => ({ url: `tel:${phone}` }))
            });
        }

        if (multiFormat.ips.length > 0) {
            results.push({
                type: 'IP地址',
                data: multiFormat.ips.map(ip => ({ url: `http://${ip}` }))
            });
        }
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
        'zh-word': '中文分词：基于增强的正向最大匹配算法，使用扩展词典，支持智能分词策略和结果优化',
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
        { value: 'zh-word', label: '中文分词', description: getSplitRuleDescription('zh-word') },
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
