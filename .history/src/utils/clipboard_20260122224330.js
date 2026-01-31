/**
 * 剪贴板工具模块
 * 提供现代化的剪贴板操作，包含回退机制以支持旧浏览器
 */

import { logger } from './logger.js';
import { analyzeTextForMultipleFormats, batchProcessLinks, categorizeLinks } from './textProcessor.js';
import { segmenter } from './segmenter.js';

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本内容
 * @returns {Promise<boolean>} - 复制是否成功
 */
export async function copyToClipboard(text) {
    if (!text) {
        logger.error('复制失败：无效的文本内容');
        return false;
    }

    try {
        // 现代浏览器：使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            logger.info('使用 Clipboard API 复制成功');
            return true;
        }
        
        // 回退方案：使用 document.execCommand
        return await copyWithExecCommand(text);
    } catch (error) {
        logger.error('复制失败：', error);
        
        // 如果 Clipboard API 失败，尝试回退方案
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            logger.warn('Clipboard API 权限被拒绝，尝试回退方案');
            return await copyWithExecCommand(text);
        }
        
        return false;
    }
}

/**
 * 使用 document.execCommand 复制文本到剪贴板（回退方案）
 * @param {string} text - 要复制的文本内容
 * @returns {boolean} - 复制是否成功
 */
async function copyWithExecCommand(text) {
    try {
        // 创建临时 textarea 元素
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 设置样式防止页面闪烁
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.style.zIndex = '-1';
        
        // 添加到文档
        document.body.appendChild(textArea);
        
        // 选择并复制
        textArea.select();
        textArea.setSelectionRange(0, text.length); // 适配移动设备
        
        const success = document.execCommand('copy');
        
        // 清理临时元素
        document.body.removeChild(textArea);
        
        if (success) {
            logger.info('使用 document.execCommand 复制成功');
        } else {
            logger.error('使用 document.execCommand 复制失败');
        }
        
        return success;
    } catch (error) {
        logger.error('回退方案复制失败：', error);
        return false;
    }
}

/**
 * 从剪贴板读取文本
 * @returns {Promise<string|null>} - 剪贴板中的文本，失败返回 null
 */
export async function readFromClipboard() {
    try {
        // 现代浏览器：使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            logger.info('使用 Clipboard API 读取剪贴板成功');
            return text;
        }
        
        // 回退方案：使用 document.execCommand
        return await readWithExecCommand();
    } catch (error) {
        logger.error('读取剪贴板失败：', error);
        
        // 如果 Clipboard API 失败，尝试回退方案
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            logger.warn('Clipboard API 权限被拒绝，尝试回退方案');
            return await readWithExecCommand();
        }
        
        return null;
    }
}

/**
 * 从剪贴板读取文本并进行多格式分析
 * @returns {Promise<object|null>} - 包含原始文本和分析结果的对象，失败返回 null
 */
export async function readFromClipboardWithAnalysis() {
    try {
        const text = await readFromClipboard();
        if (!text) {
            return null;
        }
        
        // 进行多格式分析
        const analysisResults = analyzeTextForMultipleFormats(text);
        
        logger.info('读取剪贴板并分析成功，检测到', analysisResults.length, '种格式');
        
        return {
            originalText: text,
            analysisResults: analysisResults
        };
    } catch (error) {
        logger.error('读取剪贴板并分析失败：', error);
        return null;
    }
}

/**
 * 使用 document.execCommand 从剪贴板读取文本（回退方案）
 * @returns {string|null} - 剪贴板中的文本，失败返回 null
 */
async function readWithExecCommand() {
    try {
        // 创建临时 textarea 元素
        const textArea = document.createElement('textarea');
        
        // 设置样式防止页面闪烁
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.style.zIndex = '-1';
        
        // 添加到文档
        document.body.appendChild(textArea);
        
        // 选择并粘贴
        textArea.focus();
        const success = document.execCommand('paste');
        
        let text = null;
        if (success) {
            text = textArea.value;
            logger.info('使用 document.execCommand 读取剪贴板成功');
        } else {
            logger.error('使用 document.execCommand 读取剪贴板失败');
        }
        
        // 清理临时元素
        document.body.removeChild(textArea);
        
        return text;
    } catch (error) {
        logger.error('回退方案读取剪贴板失败：', error);
        return null;
    }
}

/**
 * 检查剪贴板权限
 * @returns {Promise<boolean>} - 是否有权限访问剪贴板
 */
export async function checkClipboardPermission() {
    try {
        // 检查浏览器是否支持权限 API
        if (navigator.permissions && navigator.permissions.query) {
            const permission = await navigator.permissions.query({ name: 'clipboard-read' });
            return permission.state === 'granted' || permission.state === 'prompt';
        }
        
        // 对于不支持权限 API 的浏览器，尝试访问剪贴板
        if (navigator.clipboard && navigator.clipboard.readText) {
            await navigator.clipboard.readText();
            return true;
        }
        
        // 其他情况：假设有权限（回退方案会处理失败情况）
        return true;
    } catch (error) {
        logger.warn('剪贴板权限检查失败：', error.message);
        return false;
    }
}

/**
 * 复制富文本到剪贴板（支持 HTML 格式）
 * @param {string} html - 要复制的 HTML 内容
 * @param {string} plainText - 纯文本回退内容
 * @returns {Promise<boolean>} - 复制是否成功
 */
export async function copyRichText(html, plainText) {
    if (!html && !plainText) {
        logger.error('复制失败：无效的富文本内容');
        return false;
    }

    try {
        // 现代浏览器：使用 Clipboard API 写入富文本
        if (navigator.clipboard && navigator.clipboard.write) {
            const textBlob = new Blob([plainText || html], { type: 'text/plain' });
            const htmlBlob = new Blob([html], { type: 'text/html' });
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': textBlob,
                    'text/html': htmlBlob
                })
            ]);
            
            logger.info('使用 Clipboard API 复制富文本成功');
            return true;
        }
        
        // 回退方案：使用 document.execCommand 复制纯文本
        return await copyToClipboard(plainText || html);
    } catch (error) {
        logger.error('复制富文本失败：', error);
        
        // 回退到纯文本复制
        return await copyToClipboard(plainText || html);
    }
}

/**
 * 增强的剪贴板内容分析
 * @param {string} text 剪贴板文本
 * @returns {object} 包含详细分析结果的对象
 */
export function enhancedClipboardAnalyzer(text) {
    if (!text || typeof text !== 'string') {
        return {
            type: 'empty',
            confidence: 1.0,
            details: {},
            links: [],
            segments: [],
            structuredData: {}
        };
    }
    
    const result = {
        type: 'unknown',
        confidence: 0.5,
        details: {
            hasLinks: false,
            hasPaths: false,
            hasEmails: false,
            hasPhones: false,
            hasCode: false,
            hasTable: false,
            hasChinese: false,
            hasEnglish: false
        },
        links: [],
        segments: [],
        structuredData: {}
    };
    
    // 1. 检测链接并使用新的增强分析
    const links = batchProcessLinks(text);
    if (links.length > 0) {
        result.details.hasLinks = true;
        result.type = 'links';
        result.confidence = 0.8;
        result.links = links;
        result.structuredData.links = links;
        
        // 分类链接
        result.structuredData.linkCategories = categorizeLinks(links);
    }
    
    // 2. 检测文件路径
    const pathRegex = /[a-zA-Z]:\\[^"<>|?*]+|\/[^"<>|?*]+/g;
    if (pathRegex.test(text)) {
        result.details.hasPaths = true;
        if (result.confidence < 0.7) {
            result.type = 'paths';
            result.confidence = 0.7;
        }
    }
    
    // 3. 检测邮箱
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(text)) {
        result.details.hasEmails = true;
    }
    
    // 4. 检测电话号码
    const phoneRegex = /(?:\+86[\-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[\-\s]?\d{7,8})/g;
    if (phoneRegex.test(text)) {
        result.details.hasPhones = true;
    }
    
    // 5. 检测代码
    const codeIndicators = [
        'function', 'const', 'let', 'var', 'if', 'for', 'while', 'return',
        'import', 'export', 'class', 'def', 'print', 'console.log'
    ];
    const codeCount = codeIndicators.filter(indicator => text.includes(indicator)).length;
    if (codeCount > 2) {
        result.details.hasCode = true;
        if (result.confidence < 0.8) {
            result.type = 'code';
            result.confidence = 0.8;
        }
    }
    
    // 6. 检测表格
    if (text.includes('\t') || (text.includes('|') && text.split('\n').length > 2)) {
        result.details.hasTable = true;
        if (result.confidence < 0.7) {
            result.type = 'table';
            result.confidence = 0.7;
        }
    }
    
    // 7. 检测语言
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    
    if (chineseCount > 0) {
        result.details.hasChinese = true;
    }
    if (englishCount > 0) {
        result.details.hasEnglish = true;
    }
    
    // 8. 智能文本分词
    if (result.type === 'unknown' || result.type === 'text') {
        if (chineseCount > englishCount) {
            result.type = 'chinese_text';
            result.confidence = 0.7;
            // 这里可以集成中文分词算法
        } else if (englishCount > 0) {
            result.type = 'english_text';
            result.confidence = 0.7;
        }
    }
    
    // 9. 文本分词
    try {
        const segments = await segmenter.segment(text, {
            enableCache: true,
            useWorker: text.length > 500
        });
        result.segments = segments;
        result.structuredData.segments = segments;
    } catch (error) {
        logger.error('分词失败:', error);
        result.segments = [];
        result.structuredData.segments = [];
    }
    
    // 10. 结构化数据提取
    result.structuredData.contentType = result.type;
    result.structuredData.confidence = result.confidence;
    result.structuredData.details = result.details;
    
    // 11. 内容长度分析
    result.structuredData.length = text.length;
    result.structuredData.lineCount = text.split('\n').length;
    
    return result;
}

/**
 * 优化的剪贴板监控处理
 * @param {string} text 剪贴板文本
 * @param {object} options 处理选项
 * @returns {Promise<object>} 处理结果
 */
export async function optimizedClipboardProcessor(text, options = {}) {
    const {
        enableLinkAnalysis = true,
        enableTextSegmentation = true,
        enableContentClassification = true,
        maxProcessingTime = 1000 // 最大处理时间（毫秒）
    } = options;
    
    // 性能监控
    const startTime = performance.now();
    
    const result = {
        original: text,
        processed: text,
        analysis: null,
        processingTime: 0,
        errors: []
    };
    
    try {
        // 1. 内容分析
        if (enableContentClassification) {
            result.analysis = enhancedClipboardAnalyzer(text);
        }
        
        // 2. 文本处理
        if (enableTextSegmentation && result.analysis) {
            // 根据内容类型选择合适的处理策略
            if (result.analysis.type === 'links') {
                // 链接处理
                result.processed = text;
            } else if (result.analysis.type === 'code') {
                // 代码处理
                result.processed = text;
            } else if (result.analysis.type === 'table') {
                // 表格处理
                result.processed = text;
            }
        }
        
    } catch (error) {
        logger.error('剪贴板处理失败:', error);
        result.errors.push(error.message);
    }
    
    // 记录处理时间
    result.processingTime = performance.now() - startTime;
    
    return result;
}

/**
 * 增强的剪贴板读取与分析
 * @param {object} options 分析选项
 * @returns {Promise<object|null>} 包含原始文本和增强分析结果的对象，失败返回 null
 */
export async function readFromClipboardWithEnhancedAnalysis(options = {}) {
    try {
        const text = await readFromClipboard();
        if (!text) {
            return null;
        }
        
        // 进行增强分析
        const analysisResults = analyzeTextForMultipleFormats(text);
        const enhancedAnalysis = enhancedClipboardAnalyzer(text);
        const optimizedResult = await optimizedClipboardProcessor(text, options);
        
        logger.info('读取剪贴板并增强分析成功');
        
        return {
            originalText: text,
            analysisResults: analysisResults,
            enhancedAnalysis: enhancedAnalysis,
            optimizedResult: optimizedResult
        };
    } catch (error) {
        logger.error('读取剪贴板并增强分析失败：', error);
        return null;
    }
}
