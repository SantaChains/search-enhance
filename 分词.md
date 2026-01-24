# 中文拆词、剪贴板与文本分析实现指南

## 1. 中文拆词

### 1.1 概念介绍
中文拆词（分词）是将连续的中文文本按照一定规则切分成有意义的词语序列的过程。与英文天然以空格分隔不同，中文词语之间没有明显的分隔符，因此分词是中文文本处理的基础步骤。

### 1.2 实现方法
- **基于词典的分词**：利用已有的词典，通过字符串匹配的方式进行分词
- **基于统计的分词**：利用统计模型（如HMM、CRF等）分析词语出现的概率
- **基于深度学习的分词**：使用神经网络模型（如BERT、Transformer等）进行分词

### 1.3 代码示例
使用jieba.js库实现中文分词：

```javascript
// 引入jieba分词库
const jieba = require('nodejieba');

/**
 * 中文文本分词函数
 * @param {string} text - 待分词的中文文本
 * @returns {Array} - 分词结果数组
 */
function chineseSegmentation(text) {
    // 初始化jieba分词
    jieba.load();
    
    // 执行分词
    const result = jieba.cut(text);
    
    // 关闭jieba分词
    jieba.release();
    
    return result;
}

/**
 * 中文文本分词（带词性标注）
 * @param {string} text - 待分词的中文文本
 * @returns {Array} - 分词结果数组，每个元素包含词语和词性
 */
function chineseSegmentationWithPos(text) {
    // 初始化jieba分词
    jieba.load();
    
    // 执行分词并标注词性
    const result = jieba.cutWithTag(text);
    
    // 关闭jieba分词
    jieba.release();
    
    return result;
}

// 使用示例
const text = "中文分词是中文文本处理的基础步骤";
console.log("分词结果:", chineseSegmentation(text));
console.log("分词结果(带词性):", chineseSegmentationWithPos(text));
```

## 2. 剪贴板操作

### 2.1 概念介绍
剪贴板是操作系统提供的一个临时存储区域，用于在不同应用程序之间传递数据。JavaScript可以通过Clipboard API或传统方法实现对剪贴板的读写操作。

### 2.2 实现方法
- **现代方法**：使用`navigator.clipboard` API，支持Promise，需要HTTPS环境
- **传统方法**：使用`document.execCommand('copy')`和`document.execCommand('paste')`，兼容性较好

### 2.3 代码示例

```javascript
/**
 * 复制文本到剪贴板（现代方法）
 * @param {string} text - 要复制的文本内容
 * @returns {Promise<boolean>} - 复制成功返回true，失败返回false
 */
async function copyToClipboardModern(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('复制失败:', err);
        return false;
    }
}

/**
 * 从剪贴板读取文本（现代方法）
 * @returns {Promise<string|null>} - 剪贴板内容，失败返回null
 */
async function readFromClipboardModern() {
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
function copyToClipboardLegacy(text) {
    // 创建临时textarea元素
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // 设置样式，避免影响页面布局
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    
    // 添加到DOM并选中内容
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        // 执行复制命令
        const success = document.execCommand('copy');
        return success;
    } catch (err) {
        console.error('复制失败:', err);
        return false;
    } finally {
        // 清理临时元素
        document.body.removeChild(textarea);
    }
}

/**
 * 处理粘贴事件
 * @param {Event} event - 粘贴事件对象
 * @returns {string|null} - 粘贴的文本内容，失败返回null
 */
function handlePasteEvent(event) {
    const clipboardData = event.clipboardData || window.clipboardData;
    if (clipboardData) {
        return clipboardData.getData('text');
    }
    return null;
}

// 事件监听示例
document.addEventListener('paste', (event) => {
    const pastedText = handlePasteEvent(event);
    console.log('粘贴的内容:', pastedText);
});
```

## 3. 文本分析

### 3.1 概念介绍
文本分析是对文本数据进行提取、转换、分析和可视化的过程，包括文本统计、关键词提取、情感分析等多种技术。

### 3.2 实现方法
- **基本统计**：字符数、词数、行数等统计
- **关键词提取**：基于TF-IDF或TextRank等算法
- **情感分析**：使用预训练模型或规则进行情感判断
- **文本分类**：将文本归类到预定义类别

### 3.3 代码示例

```javascript
/**
 * 文本基本统计函数
 * @param {string} text - 待分析的文本
 * @returns {Object} - 包含各种统计指标的对象
 */
function textStatistics(text) {
    // 去除首尾空白字符
    const trimmedText = text.trim();
    
    // 统计字符数（含空格）
    const charCount = text.length;
    
    // 统计字符数（不含空格）
    const charCountNoSpaces = text.replace(/\s/g, '').length;
    
    // 统计词数（简单按空格分割）
    const wordCount = trimmedText ? trimmedText.split(/\s+/).length : 0;
    
    // 统计行数
    const lineCount = text.split('\n').length;
    
    // 统计段落数（连续换行视为段落分隔）
    const paragraphCount = text.split(/\n\s*\n/).length;
    
    // 统计句子数（简单按句号、问号、感叹号分割）
    const sentenceCount = trimmedText ? trimmedText.split(/[。？！.!?]/).filter(s => s.trim()).length : 0;
    
    return {
        charCount,
        charCountNoSpaces,
        wordCount,
        lineCount,
        paragraphCount,
        sentenceCount
    };
}

/**
 * 关键词提取函数（基于词频）
 * @param {string} text - 待分析的文本
 * @param {number} topN - 返回前N个关键词
 * @returns {Array} - 关键词数组，每个元素包含词语和词频
 */
function extractKeywords(text, topN = 5) {
    // 简单分词（实际项目中应使用专业分词库）
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    // 计算词频
    const wordFreq = {};
    for (const word of words) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    // 按词频排序并返回前N个
    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN);
}

/**
 * 文本相似度计算（余弦相似度）
 * @param {string} text1 - 第一个文本
 * @param {string} text2 - 第二个文本
 * @returns {number} - 相似度值（0-1之间）
 */
function textSimilarity(text1, text2) {
    // 简单分词
    const words1 = text1.toLowerCase().match(/\b\w+\b/g) || [];
    const words2 = text2.toLowerCase().match(/\b\w+\b/g) || [];
    
    // 创建词袋
    const wordSet = new Set([...words1, ...words2]);
    
    // 计算词频向量
    const vector1 = Array.from(wordSet).map(word => words1.filter(w => w === word).length);
    const vector2 = Array.from(wordSet).map(word => words2.filter(w => w === word).length);
    
    // 计算点积
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    
    // 计算向量长度
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    // 计算余弦相似度
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
}

// 使用示例
const sampleText = `JavaScript是一种广泛使用的编程语言，主要用于Web开发。
它可以在浏览器端运行，也可以在服务器端通过Node.js运行。
JavaScript具有动态类型、面向对象等特性，是现代Web开发的核心技术之一。`;

console.log("文本统计:", textStatistics(sampleText));
console.log("关键词提取:", extractKeywords(sampleText));
console.log("文本相似度:", textSimilarity(sampleText, "JavaScript是Web开发的核心技术"));
```

## 4. 综合应用示例

下面是一个结合中文拆词、剪贴板操作和文本分析的综合应用示例：

```javascript
/**
 * 从剪贴板获取文本并进行分词和分析
 * @returns {Promise<Object>} - 包含剪贴板文本、分词结果和分析结果的对象
 */
async function analyzeClipboardText() {
    // 从剪贴板读取文本
    const clipboardText = await readFromClipboardModern();
    
    if (!clipboardText) {
        return { error: '剪贴板为空或读取失败' };
    }
    
    // 执行中文分词
    const segmentationResult = chineseSegmentation(clipboardText);
    
    // 执行文本统计
    const stats = textStatistics(clipboardText);
    
    // 提取关键词
    const keywords = extractKeywords(clipboardText, 10);
    
    return {
        originalText: clipboardText,
        segmentation: segmentationResult,
        statistics: stats,
        keywords: keywords
    };
}

/**
 * 将分析结果复制到剪贴板
 * @param {Object} analysisResult - 分析结果对象
 * @returns {Promise<boolean>} - 复制成功返回true，失败返回false
 */
async function copyAnalysisResult(analysisResult) {
    // 格式化分析结果
    const formattedResult = `原始文本:\n${analysisResult.originalText}\n\n` +
                          `分词结果:\n${analysisResult.segmentation.join(' / ')}\n\n` +
                          `文本统计:\n字符数: ${analysisResult.statistics.charCount}\n` +
                          `词数: ${analysisResult.statistics.wordCount}\n` +
                          `行数: ${analysisResult.statistics.lineCount}\n\n` +
                          `关键词:\n${analysisResult.keywords.map(([word, freq]) => `${word}: ${freq}`).join('\n')}`;
    
    // 复制到剪贴板
    return await copyToClipboardModern(formattedResult);
}

// 使用示例
async function main() {
    // 分析剪贴板文本
    const result = await analyzeClipboardText();
    
    if (result.error) {
        console.error(result.error);
        return;
    }
    
    console.log("分析结果:", result);
    
    // 将分析结果复制回剪贴板
    const copySuccess = await copyAnalysisResult(result);
    if (copySuccess) {
        console.log("分析结果已复制到剪贴板");
    } else {
        console.error("复制分析结果失败");
    }
}

// 绑定到按钮点击事件
document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', main);
    }
});
```

## 5. 总结

中文拆词、剪贴板操作和文本分析是Web开发中常见的功能需求，通过合理的实现方法和工具库，可以高效地完成这些任务。

- **中文拆词**：推荐使用jieba.js等成熟的分词库，提供准确的分词结果
- **剪贴板操作**：优先使用现代的Clipboard API，同时提供传统方法作为降级方案
- **文本分析**：根据需求选择合适的分析方法，从简单统计到复杂的情感分析

在实际项目中，应根据具体需求选择合适的实现方式，并考虑浏览器兼容性、性能等因素。随着人工智能技术的发展，越来越多的文本处理任务可以通过预训练模型来完成，如BERT、GPT等，这些模型在文本理解和生成方面表现出了优异的性能。