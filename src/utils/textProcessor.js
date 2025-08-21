// src/utils/textProcessor.js

/**
 * Enhanced Text Processing Utilities
 * Provides comprehensive text analysis and processing capabilities
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
 * Splits text based on a given delimiter.
 * @param {string} text The text to split.
 * @param {string} delimiter The splitting rule ('space', 'newline', 'zh-sentence', 'en-sentence', 'punctuation', 'word').
 * @returns {string[]} An array of split parts.
 */
export function splitText(text, delimiter = 'en-sentence') {
    if (!text) return [];
    
    switch (delimiter) {
        case 'space':
            return text.split(/\s+/).filter(Boolean);
        case 'newline':
            return text.split(/\n+/).filter(Boolean);
        case 'zh-sentence':
            // Match sequences of characters that are not sentence-ending punctuation, 
            // followed by optional sentence-ending punctuation.
            return text.match(/[^。！？]+[。！？]?/g) || [];
        case 'en-sentence':
            // Match sequences of characters that are not sentence-ending punctuation, 
            // followed by optional sentence-ending punctuation.
            return text.match(/[^.!?]+[.!?]?/g) || [];
        case 'punctuation':
            // Split the text by a variety of common punctuation marks.
            return text.split(/[,.!?;:，。！？；：]/).map(part => part.trim()).filter(Boolean);
        case 'word':
            // Split by non-word characters (\W+).
            return text.split(/\W+/).filter(Boolean);
        default:
            // Default to English sentence splitting if an unknown or unsupported delimiter is passed.
            return text.match(/[^.!?]+[.!?]?/g) || [];
    }
}

/**
 * Generates different path formats from a Windows path.
 * @param {string} path The input Windows path.
 * @returns {string[]|null} An array of path formats or null if not a valid path.
 */
export function processPath(path) {
    if (!path || !path.trim()) return null;
    
    // Strictly check for Windows path format, distinguishes between quoted and unquoted
    // Matches paths like: D:\Users\Jliu Pureey\Downloads\gitmine\Edge-Homepage\README.md
    // And quoted paths like: "C:\Program Files\Microsoft Office\Office16\WINWORD.EXE"
    
    // Check for path with quotes
    const matchWithQuotes = path.match(/^"([a-zA-Z]:\\[^"<>|?*]*)"$/);
    // Check for path without quotes 
    const matchWithoutQuotes = path.match(/^([a-zA-Z]:\\[^"<>|?*]*)$/);
    
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
    
    // 4. Alternative file URL format
    const fileUrlAlt = 'file://' + cleanPath.replace(/\\/g, '\\');

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
        originalGithubLink = `https://github.com/${userRepo}`;
    } else {
        // Check for known URLs
        try {
            const url = new URL(text);
            const hostname = url.hostname.replace('www.', '');
            if (knownDomains.includes(hostname)) {
                const pathParts = url.pathname.split('/').filter(Boolean);
                if (pathParts.length >= 2) {
                    userRepo = `${pathParts[0]}/${pathParts[1]}`;
                    // If the original URL is a GitHub link, store it
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