// src/utils/textProcessor.js

/**
 * Enhanced Text Processing Utilities
 * Provides comprehensive text analysis and processing capabilities
 * 
 * 特性：
 * - 可扩展的规则引擎系统
 * - 智能内容类型检测
 * - 高性能中文分词
 * - 流水线式处理架构
 */

// ============================================================================
// 词典常量
// ============================================================================

const COMMON_WORDS = new Set([
    '中文', '分词', '算法', '轻量级', '正向', '最大', '匹配', '文本', '处理',
    '浏览器', '扩展', '功能', '工具', '智能', '搜索', '体验', '用户', '开发',
    '字符', '数组', '函数', '方法', '返回', '结果', '参数', '长度', '循环',
    '判断', '过滤', '空格', '标点', '符号', '分割', '提取', '转换', '类型',
    '检测', '识别', '内容', '句子', '词语', '语言', '混合', '列表', '项目',
    '代码', '命名', '包裹', '路径', '链接', '仓库', '分析', '分类', '规则',
    '说明', '选择', '适合', '场景', '语义', '单元', '序号', '标记', '引号',
    '括号', '书名号', '换行', '单词', '多行', '片段', '接口', '统一', '生成',
    '邮箱', '电话', '地址', '系统', '平台', '框架', '库', '应用', '程序',
    '数据', '信息', '知识', '资源', '服务', '产品', '技术', '方案', '网络',
    '软件', '硬件', '性能', '优化', '安全', '前端', '后端', '全栈', '测试',
    '部署', '维护', '版本', '控制', 'Git', 'JavaScript', 'TypeScript',
    'HTML', 'CSS', 'React', 'Vue', 'Node.js', 'API', 'HTTP', 'HTTPS',
    'URL', 'JSON', 'XML', 'DOM', '数据库', '缓存'
]);

const MEANINGLESS_WORDS = new Set([
    '的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '且',
    '然后', '因为', '所以', '可以', '可能', '应该', '需要', '必须',
    '如何', '什么', '为什么', '哪里', '时候', '这个', '那个', '这里',
    '那里', '自己', '其他', '另外', '还是', '就是', '只有', '只是'
]);

const PROTECTED_PHRASES = new Set([
    '北京大学', '清华大学', '中国科学院', 'HTTP', 'HTTPS', 'API', 'URL',
    'JSON', 'XML', 'JavaScript', 'TypeScript', 'GitHub', 'Google',
    'Microsoft', 'Apple', 'Amazon', 'Facebook', 'Netflix'
]);

// ============================================================================
// 预编译正则表达式（优化版本）
// ============================================================================

const REGEX = {
    // URL相关
    url: {
        extraction: /(?:https?:\/\/|www\.)[^\s<>"']+/gi,
        comprehensive: /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)/gi
    },
    // 字符类型
    chineseChar: /[\u4e00-\u9fa5]/g,
    chinesePunctuation: /[，。！？；：""''（）【】《》<>「」『』]/g,
    englishChar: /[a-zA-Z]/g,
    digitChar: /\d/g,
    whitespace: /\s+/g,
    // 句子分割
    englishSentence: /[^.!?]+[.!?]?/g,
    chineseSentence: /[。！？；]/g,
    commaSplit: /,\s+/g,
    chineseComma: /[，、]/g,
    // 代码命名
    camelCase: /[a-z][A-Z]/g,
    snakeCase: /[a-z]+_[a-z]+/g,
    kebabCase: /[a-z]+-[a-z]+/g,
    uppercaseSequence: /^[A-Z]{2,}/,
    uppercaseSplit: /^([A-Z]+)([A-Z][a-z])/,
    functionCall: /\w+\([^)]*\)/g,
    // 列表检测
    listPatterns: [
        /^\d+[.)]\s*(.+)$/,
        /^[一二三四五六七八九十]+[、.]\s*(.+)$/,
        /^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$/,
        /^[a-zA-Z][.)]\s*(.+)$/,
        /^[-*•·▸▸]\s*(.+)$/
    ],
    // 包裹符号
    wrappedContent: /([""''（）()【】《》<>「」『』])([^\1]+)\1/g,
    squareBrackets: /\[[^\]]*\]/g,
    // 格式提取
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    phone: /(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g,
    ip: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    date: /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}年\d{1,2}月\d{1,2}日/g,
    number: /\d+(?:\.\d+)?%?/g,
    repo: /\b[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\b/g,
    path: /(?:[a-zA-Z]:[\\/]|[\\/])[^\s<>"|?*]+|~\/[^\s<>"|?*]+/g,
    // 路径处理
    pathWithQuotes: /^"([^"]+)"$/,
    pathWithoutQuotes: /^([a-zA-Z]:\\[^"<>|?*]*)$/,
    // 辅助
    shortWord: /^[a-zA-Z]{1,2}$/,
    empty: /^\s*$/,
    nonEnglish: /[^a-zA-Z0-9\s]/g
};

// ============================================================================
// 规则引擎系统
// ============================================================================

class RuleEngine {
    constructor() {
        this.rules = new Map();
        this.hooks = [];
    }

    registerRule(category, rule) {
        if (!this.rules.has(category)) {
            this.rules.set(category, []);
        }
        this.rules.get(category).push(rule);
        return this;
    }

    registerHook(hook) {
        this.hooks.push(hook);
        return this;
    }

    runHooks(stage, context) {
        for (const hook of this.hooks) {
            if (hook.stage === stage) {
                hook.fn(context);
            }
        }
        return context;
    }

    getRules(category) {
        return this.rules.get(category) || [];
    }

    hasRules(category) {
        return this.rules.has(category) && this.rules.get(category).length > 0;
    }
}

// 创建全局规则引擎实例
const engine = new RuleEngine();

// ============================================================================
// 内容类型检测规则
// ============================================================================

engine.registerRule('contentType', {
    id: 'detect-list',
    name: '列表检测',
    priority: 100,
    match: (text) => REGEX.listPatterns.some(p => p.test(text)),
    getType: () => 'list'
});

engine.registerRule('contentType', {
    id: 'detect-code',
    name: '代码检测',
    priority: 90,
    match: (text) => REGEX.camelCase.test(text) || 
                   REGEX.snakeCase.test(text) || 
                   REGEX.functionCall.test(text),
    getType: () => 'code'
});

engine.registerRule('contentType', {
    id: 'detect-wrapped',
    name: '包裹内容检测',
    priority: 80,
    match: (text) => REGEX.wrappedContent.test(text),
    getType: () => 'wrapped'
});

engine.registerRule('contentType', {
    id: 'detect-language',
    name: '语言比例检测',
    priority: 10,
    match: (text) => true,
    getType: (text) => {
        const chinese = (text.match(REGEX.chineseChar) || []).length;
        const english = (text.match(REGEX.englishChar) || []).length;
        const chinesePunct = (text.match(REGEX.chinesePunctuation) || []).length;
        
        if (chinese > 0 && english > 0) {
            return chinesePunct > 0 ? 'mixed-zh' : 'mixed';
        } else if (chinese > english) {
            return 'chinese';
        } else if (english > 0) {
            return 'english';
        }
        return 'unknown';
    }
});

// ============================================================================
// 分割规则
// ============================================================================

const SPLIT_RULES = {
    'auto': {
        name: '智能分析',
        split: (text, type) => {
            const splitter = SPLIT_RULES[type] || SPLIT_RULES['english-sentence'];
            return splitter.split(text);
        }
    },
    'english-sentence': {
        name: '英文句子',
        split: (text) => {
            const sentences = text.match(REGEX.englishSentence) || [];
            return sentences
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .flatMap(s => s.length > 100 
                    ? s.split(REGEX.commaSplit).map(p => p.trim()).filter(Boolean)
                    : s
                );
        }
    },
    'chinese-sentence': {
        name: '中文句子',
        split: (text) => {
            const sentences = text.split(REGEX.chineseSentence);
            return sentences
                .map(s => s.trim())
                .filter(s => s.length > 1)
                .flatMap(s => s.length > 50
                    ? s.split(REGEX.chineseComma).map(p => p.trim()).filter(p => p.length > 1)
                    : s
                );
        }
    },
    'mixed-sentence': {
        name: '中英混合',
        split: (text) => {
            const segments = text.split(/(?=[\u4e00-\u9fa5，。！？；])|(?=[a-zA-Z])/);
            return segments
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }
    },
    'code-naming': {
        name: '代码命名',
        split: (text) => {
            const tokens = text.split(/\s+/).filter(Boolean);
            const result = [];
            
            for (const token of tokens) {
                result.push(...splitToken(token));
            }
            
            return result.filter(t => t.length > 0);
        }
    },
    'list-items': {
        name: '列表项目',
        split: (text) => {
            const lines = text.split(/[\r\n]+/);
            const items = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                let matched = false;
                for (const pattern of REGEX.listPatterns) {
                    const match = trimmed.match(pattern);
                    if (match) {
                        items.push(match[1].trim());
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    items.push(trimmed);
                }
            }
            
            return items;
        }
    },
    'wrapped-content': {
        name: '包裹内容',
        split: (text) => {
            const result = [];
            let match;
            const regex = new RegExp(REGEX.wrappedContent);
            
            while ((match = regex.exec(text)) !== null) {
                const content = match[2].trim();
                if (content) {
                    result.push(content);
                }
            }
            
            return result.length > 0 ? result : [text];
        }
    },
    'whitespace': {
        name: '空格分隔',
        split: (text) => text.split(/\s+/).filter(Boolean)
    },
    'newline': {
        name: '换行分隔',
        split: (text) => text.split(/[\r\n]+/).filter(Boolean)
    },
    'punctuation': {
        name: '标点分隔',
        split: (text) => text.split(/[,.!?;:，！？；：]+/).filter(s => s.trim().length > 0)
    }
};

function splitToken(token) {
    const result = [];
    
    if (REGEX.camelCase.test(token)) {
        const parts = token.split(/(?=[A-Z])/);
        result.push(...parts);
    } else if (token.includes('_')) {
        result.push(...token.split('_'));
    } else if (token.includes('-')) {
        result.push(...token.split('-'));
    } else if (REGEX.functionCall.test(token)) {
        const match = token.match(/(\w+)\(([^)]*)\)/);
        if (match) {
            result.push(match[1]);
            if (match[2].trim()) {
                result.push(...match[2].split(',').map(p => p.trim()));
            }
        }
    } else {
        result.push(token);
    }
    
    return result.filter(t => t.length > 0);
}

// ============================================================================
// 分词引擎（优化版本）
// ============================================================================

class Tokenizer {
    constructor(dictionary = COMMON_WORDS) {
        this.dictionary = dictionary;
        this.maxWordLength = 5;
        this.cache = new Map();
    }

    setDictionary(dictionary) {
        this.dictionary = dictionary;
        this.cache.clear();
    }

    setMaxWordLength(length) {
        this.maxWordLength = length;
        this.cache.clear();
    }

    tokenize(text, options = {}) {
        if (!text || !text.trim()) return [];
        
        const cacheKey = text + JSON.stringify(options);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const useDict = options.useDictionary !== false;
        const removeStopWords = options.removeStopWords !== false;
        const mergeShort = options.mergeShort !== false;
        
        const result = this.maximumMatching(
            text.trim(),
            useDict ? this.dictionary : null,
            removeStopWords
        );
        
        const processed = mergeShort ? this.mergeShortWords(result) : result;
        
        this.cache.set(cacheKey, processed);
        return processed;
    }

    maximumMatching(text, dictionary, removeStopWords) {
        const result = [];
        let index = 0;
        const length = text.length;
        
        while (index < length) {
            let matched = false;
            let wordLength = Math.min(this.maxWordLength, length - index);
            
            while (wordLength > 0) {
                const word = text.substring(index, index + wordLength);
                
                if (dictionary && dictionary.has(word)) {
                    result.push(word);
                    index += wordLength;
                    matched = true;
                    break;
                }
                
                if (wordLength === 1) {
                    if (!removeStopWords || !MEANINGLESS_WORDS.has(word)) {
                        result.push(word);
                    }
                    index++;
                    matched = true;
                    break;
                }
                
                wordLength--;
            }
            
            if (!matched) {
                index++;
            }
        }
        
        return result;
    }

    mergeShortWords(words) {
        if (words.length < 2) return words;
        
        const result = [];
        let i = 0;
        
        while (i < words.length) {
            if (i < words.length - 1) {
                const current = words[i];
                const next = words[i + 1];
                
                if (current.length === 1 && next.length === 1) {
                    const combined = current + next;
                    if (!MEANINGLESS_WORDS.has(combined)) {
                        result.push(combined);
                        i += 2;
                        continue;
                    }
                }
            }
            
            result.push(words[i]);
            i++;
        }
        
        return result;
    }

    clearCache() {
        this.cache.clear();
    }
}

// 创建全局分词器实例
const tokenizer = new Tokenizer();

// ============================================================================
// 智能内容检测器
// ============================================================================

class ContentDetector {
    constructor() {
        this.patterns = {
            url: REGEX.url.extraction,
            email: REGEX.email,
            phone: REGEX.phone,
            ip: REGEX.ip,
            date: REGEX.date,
            number: REGEX.number,
            repo: REGEX.repo,
            path: REGEX.path
        };
    }

    detect(text) {
        if (!text || !text.trim()) {
            return { type: 'empty', confidence: 1, features: {} };
        }
        
        const features = this.extractFeatures(text);
        const type = this.classify(features);
        
        return {
            type,
            confidence: this.calculateConfidence(features, type),
            features,
            suggestions: this.generateSuggestions(features, type)
        };
    }

    extractFeatures(text) {
        return {
            hasUrl: this.patterns.url.test(text),
            hasEmail: this.patterns.email.test(text),
            hasPhone: this.patterns.phone.test(text),
            hasIp: this.patterns.ip.test(text),
            hasDate: this.patterns.date.test(text),
            hasNumber: (this.patterns.number.test(text)),
            hasRepo: this.patterns.repo.test(text),
            hasPath: this.patterns.path.test(text),
            chineseCount: (text.match(REGEX.chineseChar) || []).length,
            englishCount: (text.match(REGEX.englishChar) || []).length,
            digitCount: (text.match(REGEX.digitChar) || []).length,
            length: text.length,
            lineCount: text.split(/[\r\n]+/).length
        };
    }

    classify(features) {
        if (features.hasUrl && features.englishCount > features.chineseCount) {
            return 'url_collection';
        }
        if (features.hasEmail) {
            return 'contact_info';
        }
        if (features.hasRepo && !features.hasUrl) {
            return 'code_repos';
        }
        if (features.hasPath) {
            return 'file_paths';
        }
        if (features.chineseCount > features.englishCount * 2) {
            return 'chinese_text';
        }
        if (features.englishCount > features.chineseCount * 2) {
            return 'english_text';
        }
        if (features.englishCount > 0 && features.chineseCount > 0) {
            return 'mixed_text';
        }
        return 'unknown';
    }

    calculateConfidence(features, type) {
        let confidence = 0.5;
        
        switch (type) {
            case 'url_collection':
                confidence = features.hasUrl ? 0.9 : 0.3;
                break;
            case 'contact_info':
                confidence = features.hasEmail ? 0.95 : 0.3;
                break;
            case 'code_repos':
                confidence = features.hasRepo ? 0.85 : 0.3;
                break;
            case 'file_paths':
                confidence = features.hasPath ? 0.8 : 0.3;
                break;
            case 'chinese_text':
                confidence = features.chineseCount > features.englishCount 
                    ? 0.7 + (features.chineseCount / (features.length || 1)) * 0.3 
                    : 0.5;
                break;
            case 'english_text':
                confidence = features.englishCount > features.chineseCount
                    ? 0.7 + (features.englishCount / (features.length || 1)) * 0.3
                    : 0.5;
                break;
        }
        
        return Math.min(1, confidence);
    }

    generateSuggestions(features, type) {
        const suggestions = [];
        
        switch (type) {
            case 'url_collection':
                suggestions.push('检测到链接，可以批量打开或验证');
                break;
            case 'contact_info':
                suggestions.push('检测到邮箱地址，可以批量发送邮件');
                break;
            case 'code_repos':
                suggestions.push('检测到代码仓库，可以生成各平台链接');
                break;
            case 'file_paths':
                suggestions.push('检测到文件路径，可以转换格式或批量处理');
                break;
            case 'chinese_text':
                suggestions.push('中文文本，可以进行分词或翻译');
                break;
            case 'english_text':
                suggestions.push('英文文本，可以进行语法检查或翻译');
                break;
        }
        
        return suggestions;
    }
}

// 创建全局检测器实例
const detector = new ContentDetector();

// ============================================================================
// 工具函数
// ============================================================================

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeCreateRegex(pattern, flags = 'g') {
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        console.error('正则创建失败:', pattern, e);
        return null;
    }
}

function removeDuplicates(arr) {
    return [...new Set(arr)];
}

function filterEmpty(arr) {
    return arr.filter(item => item && item.trim().length > 0);
}

function truncate(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================================================
// 公共API
// ============================================================================

/**
 * 检测字符串是否为有效URL
 * @param {string} str 
 * @returns {boolean}
 */
export function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * 智能断行处理长文本
 * 超过100字符时优先在标点/空格处断行，否则硬断行
 * @param {string} text 输入文本
 * @returns {string[]} 断行后的文本数组
 */
function smartLineBreak(text) {
    if (!text || text.length <= 100) {
        return text ? [text] : [];
    }

    const result = [];
    let remaining = text;

    while (remaining.length > 100) {
        // 在前100个字符中找最后一个标点或空格
        const first100 = remaining.substring(0, 100);
        const rest = remaining.substring(100);

        // 在first100中找最后一个断行点（标点或空格）
        // 标点包括：.,;:!?，。；：！？
        let breakPoint = -1;
        for (let i = first100.length - 1; i >= 0; i--) {
            const char = first100[i];
            if (/[.,;:!?，。；：！？\s]/.test(char)) {
                breakPoint = i;
                break;
            }
        }

        // 如果找到断行点，且剩余字符不少于50，则在此断行
        if (breakPoint > 0 && remaining.length - breakPoint >= 50) {
            result.push(remaining.substring(0, breakPoint + 1));
            remaining = remaining.substring(breakPoint + 1).trimStart();
        } else {
            // 硬断行在100字符处
            result.push(remaining.substring(0, 100));
            remaining = remaining.substring(100);
        }
    }

    // 添加剩余部分
    if (remaining.length > 0) {
        result.push(remaining);
    }

    return result;
}

/**
 * 提取和处理文本
 * @param {string} text 输入文本
 * @returns {object} 处理结果
 */
export function processTextExtraction(text) {
    if (!text || !text.trim()) {
        return { cleanedText: '', extractedLinks: [] };
    }

    const trimmedText = text.trim();
    const urlRegex = REGEX.url.extraction;

    const links = [];
    let match;
    const seenUrls = new Set();
    const urlRegexCopy = new RegExp(urlRegex);

    while ((match = urlRegexCopy.exec(trimmedText)) !== null) {
        const url = match[0];
        if (seenUrls.has(url)) continue;

        try {
            const testUrl = url.startsWith('http') ? url : 'http://' + url;
            new URL(testUrl);
            seenUrls.add(url);
            // 对长链接进行智能断行处理
            const brokenLines = smartLineBreak(url);
            links.push(...brokenLines);
        } catch {
            // 无效URL，跳过
        }
    }

    let cleaned = trimmedText;

    if (seenUrls.size > 0) {
        const pattern = Array.from(seenUrls).map(u => escapeRegExp(u)).join('|');
        cleaned = cleaned.replace(new RegExp(pattern, 'gi'), ' ');
    }

    cleaned = cleaned
        .replace(REGEX.chineseChar, '')
        .replace(REGEX.chinesePunctuation, '.')
        .replace(REGEX.squareBrackets, '')
        .replace(REGEX.nonEnglish, ' ')
        .replace(REGEX.whitespace, ' ')
        .trim();

    return { cleanedText: cleaned, extractedLinks: links };
}

/**
 * 智能文本分割
 * @param {string} text 输入文本
 * @param {string|Array} delimiter 分隔规则
 * @returns {Array} 分割结果
 */
export function splitText(text, delimiter = 'english-sentence') {
    if (!text || !text.trim()) return [];
    
    const delimiters = Array.isArray(delimiter) ? delimiter : [delimiter];
    let results = [text.trim()];
    
    for (const ruleName of delimiters) {
        const rule = SPLIT_RULES[ruleName] || SPLIT_RULES['english-sentence'];
        const newResults = [];
        
        for (const segment of results) {
            const splitResult = rule.split(segment);
            newResults.push(...splitResult);
        }
        
        results = newResults;
    }
    
    return filterEmpty(removeDuplicates(results))
        .map(s => s.trim())
        .filter(s => s.length >= 1 && s.length <= 200);
}

/**
 * 中文智能分词
 * @param {string} text 输入文本
 * @param {object} options 分词选项
 * @returns {Array} 分词结果
 */
export function chineseWordSegmentation(text, options = {}) {
    if (!text || !text.trim()) return [];
    
    const maxWordLength = options.maxWordLength || 5;
    const useDictionary = options.useDictionary !== false;
    
    tokenizer.setMaxWordLength(maxWordLength);
    if (useDictionary) {
        tokenizer.setDictionary(COMMON_WORDS);
    }
    
    return tokenizer.tokenize(text, {
        useDictionary,
        removeStopWords: options.removeStopWords !== false,
        mergeShort: options.mergeShort !== false
    });
}

/**
 * 智能分词（根据文本长度自动调整策略）
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function intelligentSegmentation(text) {
    if (!text || !text.trim()) return [];
    
    const length = text.trim().length;
    
    if (length < 10) {
        return chineseWordSegmentation(text, { maxWordLength: 3, useDictionary: false });
    } else if (length < 100) {
        return chineseWordSegmentation(text, { maxWordLength: 4 });
    } else {
        return chineseWordSegmentation(text, { maxWordLength: 5 });
    }
}

/**
 * 检测内容类型
 * @param {string} text 输入文本
 * @returns {object} 检测结果
 */
export function detectContentType(text) {
    return detector.detect(text);
}

/**
 * 多格式分析
 * @param {string} text 输入文本
 * @returns {object} 分析结果
 */
export function processMultiFormat(text) {
    if (!text || !text.trim()) {
        return {
            urls: [], paths: [], emails: [], phones: [],
            repos: [], ips: [], dates: [], numbers: [], chineseText: [], englishText: []
        };
    }
    
    if (text.length > 5000) {
        console.warn('文本过长，仅进行基本分析');
    }
    
    return {
        urls: removeDuplicates((text.match(REGEX.url.comprehensive) || []).map(u => 
            u.startsWith('www.') ? 'http://' + u : u
        )),
        paths: removeDuplicates(text.match(REGEX.path) || []),
        emails: removeDuplicates(text.match(REGEX.email) || []),
        phones: removeDuplicates(text.match(REGEX.phone) || []),
        repos: removeDuplicates(text.match(REGEX.repo) || []),
        ips: removeDuplicates(text.match(REGEX.ip) || []),
        dates: removeDuplicates(text.match(REGEX.date) || []),
        numbers: removeDuplicates((text.match(REGEX.number) || []).filter(n => n.length > 2)),
        chineseText: removeDuplicates((text.match(/[\u4e00-\u9fa5]+/g) || []).filter(t => t.length > 1)),
        englishText: removeDuplicates((text.match(/[a-zA-Z]+/g) || []).filter(t => t.length > 2))
    };
}

/**
 * 文本分类
 * @param {string} text 输入文本
 * @returns {object} 分类结果
 */
export function classifyText(text) {
    const detection = detectContentType(text);
    const multiFormat = processMultiFormat(text);
    
    return {
        type: detection.type,
        confidence: detection.confidence,
        suggestions: detection.suggestions,
        features: detection.features
    };
}

/**
 * 处理Windows路径
 * @param {string} path 路径字符串
 * @returns {Array|null} 路径格式数组
 */
export function processPath(path) {
    if (!path || !path.trim()) return null;
    
    const input = path.trim();
    let cleanPath = null;
    
    const withQuotes = input.match(REGEX.pathWithQuotes);
    const withoutQuotes = input.match(REGEX.pathWithoutQuotes);
    
    if (withQuotes) {
        cleanPath = withQuotes[1];
    } else if (withoutQuotes) {
        cleanPath = withoutQuotes[1];
    } else {
        return null;
    }
    
    return [
        cleanPath,
        'file:///' + cleanPath.replace(/\\/g, '/'),
        cleanPath.replace(/\\/g, '\\\\'),
        'file:///' + encodeURI(cleanPath.replace(/\\/g, '/'))
    ];
}

/**
 * 处理仓库链接生成
 * @param {string} text 输入文本
 * @returns {object|null} 链接生成结果
 */
export function processLinkGeneration(text) {
    if (!text || !text.trim()) return null;
    
    const input = text.trim();
    let userRepo = null;
    let originalGithubLink = null;
    
    const KNOWN_DOMAINS = ['github.com', 'zread.ai', 'deepwiki.com', 'context7.com'];
    const LINK_TEMPLATES = {
        github: 'https://github.com/{repo}',
        zread: 'https://zread.ai/{repo}',
        deepwiki: 'https://deepwiki.com/{repo}',
        context7: 'https://context7.com/{repo}'
    };
    
    try {
        const url = new URL(input);
        const hostname = url.hostname.replace('www.', '');
        
        if (KNOWN_DOMAINS.includes(hostname)) {
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                let repoName = parts[1];
                if (repoName.endsWith('.git')) {
                    repoName = repoName.slice(0, -4);
                }
                userRepo = `${parts[0]}/${repoName}`;
                if (hostname === 'github.com') {
                    originalGithubLink = input;
                }
            }
        }
    } catch {
        const repoMatch = input.match(/^\/?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)\/?$/);
        if (repoMatch) {
            userRepo = `${repoMatch[1]}/${repoMatch[2]}`;
        } else {
            const embeddedMatch = input.match(/(?:https?:\/\/[^\/]+\/)?\s*([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
            if (embeddedMatch) {
                userRepo = `${embeddedMatch[1]}/${embeddedMatch[2]}`;
            }
        }
    }
    
    if (userRepo) {
        return {
            originalGithubLink,
            generatedLinks: Object.values(LINK_TEMPLATES).map(t => t.replace('{repo}', userRepo))
        };
    }
    
    return null;
}

/**
 * 多格式分析UI展示
 * @param {string} text 输入文本
 * @returns {Array} 分析结果数组
 */
export function analyzeTextForMultipleFormats(text) {
    const results = [];
    
    if (!text || !text.trim()) return results;
    
    const pathResult = processPath(text);
    if (pathResult) {
        results.push({ type: '路径转换', data: pathResult });
    }
    
    const { extractedLinks } = processTextExtraction(text);
    if (extractedLinks.length > 0) {
        results.push({ type: '链接提取', data: extractedLinks.map(u => ({ url: u })) });
    }
    
    const repoResult = processLinkGeneration(text);
    if (repoResult) {
        results.push({ type: '仓库链接', data: repoResult.generatedLinks.map(u => ({ url: u })) });
        if (repoResult.originalGithubLink) {
            results.push({ type: 'GitHub链接', data: [{ url: repoResult.originalGithubLink }] });
        }
    }
    
    if (text.length < 5000) {
        const multiFormat = processMultiFormat(text);
        
        if (multiFormat.emails.length > 0) {
            results.push({ type: '邮箱地址', data: multiFormat.emails.map(e => ({ url: `mailto:${e}` })) });
        }
        if (multiFormat.phones.length > 0) {
            results.push({ type: '电话号码', data: multiFormat.phones.map(p => ({ url: `tel:${p}` })) });
        }
        if (multiFormat.ips.length > 0) {
            results.push({ type: 'IP地址', data: multiFormat.ips.map(ip => ({ url: `http://${ip}` })) });
        }
    }
    
    return results;
}

/**
 * 提取邮箱地址
 * @param {string} text 输入文本
 * @returns {Array} 邮箱数组
 */
export function extractEmails(text) {
    if (!text || !text.trim()) return [];
    return removeDuplicates(text.match(REGEX.email) || []);
}

/**
 * 提取电话号码
 * @param {string} text 输入文本
 * @returns {Array} 电话号码数组
 */
export function extractPhoneNumbers(text) {
    if (!text || !text.trim()) return [];
    return removeDuplicates(text.match(REGEX.phone) || []);
}

/**
 * 获取分割规则列表
 * @returns {Array} 规则列表
 */
export function getAvailableSplitRules() {
    return Object.entries(SPLIT_RULES).map(([value, rule]) => ({
        value,
        label: rule.name,
        description: getRuleDescription(value)
    }));
}

/**
 * 获取规则说明
 * @param {string} ruleName 规则名称
 * @returns {string} 规则说明
 */
export function getRuleDescription(ruleName) {
    const descriptions = {
        'auto': '智能分析：根据内容类型自动选择最适合的分隔方式',
        'english-sentence': '英文句子：按句号、感叹号、问号拆分，长句按逗号进一步拆分',
        'chinese-sentence': '中文句子：按中文标点拆分，长句按顿号、逗号拆分',
        'mixed-sentence': '中英混合：按语言边界智能拆分',
        'code-naming': '代码命名：识别驼峰、蛇形等命名法并拆分',
        'list-items': '列表项目：提取有序和无序列表的内容',
        'wrapped-content': '包裹内容：提取引号、括号等包裹的内容',
        'whitespace': '空格分隔：按空格拆分单词',
        'newline': '换行分隔：按换行符拆分',
        'punctuation': '标点分隔：按中英文标点符号拆分'
    };
    
    return descriptions[ruleName] || '未知规则';
}

// ============================================================================
// 剪贴板相关API（保持兼容性）
// ============================================================================

export function isClipboardAPIAvailable() {
    return !!(navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.readText);
}

export async function copyToClipboard(text) {
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

export async function readFromClipboard() {
    if (!isClipboardAPIAvailable()) {
        return null;
    }
    
    try {
        return await navigator.clipboard.readText();
    } catch (err) {
        console.error('读取剪贴板失败:', err);
        return null;
    }
}

// ============================================================================
// 规则引擎导出（供高级使用）
// ============================================================================

export { RuleEngine, Tokenizer, ContentDetector, engine, tokenizer, detector };
