// src/utils/textProcessor.js

/**
 * 文本处理工具模块
 *
 * 功能：
 * - 多种互斥分析模式：智能分析、中文分析、英文分析、代码分析、AI分析、整句分析、去除符号、字符断行、随机分词
 * - 多规则组合系统：符号分词、空格/换行分词、中英分词、大写分词、命名分词、数字分词、去除规则
 * - 词典算法开关配置
 */

import { fastCWS } from "./fastCWS.js";
import { getSettings } from "./storage.js";
import { aiAnalyzePipeline } from "./aiAdapter.js";
import { codeAnalyze as analyzeCode } from "./codeAnalyzer.js";
import { randomAnalyze as randomSplit } from "./randomAnalyzer.js";
import { multiRuleAnalyze as analyzeMultiRules } from "./multiRuleAnalyzer.js";

// ============================================================================
// 预编译正则表达式
// ============================================================================

const REGEX = {
  // 字符类型 - 不使用g标志，避免lastIndex问题
  chineseChar: /[\u4e00-\u9fa5]/,
  englishChar: /[a-zA-Z]/,
  digitChar: /\d+/,
  whitespace: /\s+/,

  // 标点符号（用于智能分析）
  punctuation: /[，。！？；：""''（）【】《》<>「」『』,.!?;:'"()\[\]{}–—-]/,

  // 中文标点（用于中文分析）
  chinesePunctuation: /[，。！？；：""''（）【】《》<>「」『』]/,

  // 句子分割
  englishSentence: /[^.!?]+[.!?]?/,
  chineseSentence: /[。！？；]/,
  commaSplit: /,\s+/,

  // 代码命名（用于英文分析）
  camelCase: /[a-z][A-Z]/g,
  snakeCase: /[a-z]+_[a-z]+/g,
  kebabCase: /[a-z]+-[a-z]+/g,
  uppercaseSequence: /^[A-Z]{2,}/,
  uppercaseSplit: /^([A-Z]+)([A-Z][a-z])/,

  // URL相关（用于AI分析）
  url: /(?:https?:\/\/|www\.)[^\s<>"']+/gi,

  // 辅助
  empty: /^\s*$/,
  shortWord: /^[a-zA-Z]{1,2}$/,
};

// ============================================================================
// 全局配置
// ============================================================================

const CONFIG = {
  // 中文分析开关
  useDictionary: true,
  useAlgorithm: true,

  // 混沌分词配置
  chaosMinTokens: 3,
  chaosMaxTokens: 10,

  // 随机分词配置
  randomMinLength: 1,
  randomMaxLength: 10,

  // 命名分词配置
  namingRemoveSymbols: true,

  // 字符断行配置
  lineCharLimit: 100,
};

/**
 * 更新配置
 * @param {object} newConfig 新配置
 */
export function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

/**
 * 获取当前配置
 * @returns {object} 当前配置
 */
export function getConfig() {
  return { ...CONFIG };
}

// ============================================================================
// 工具函数
// ============================================================================

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeDuplicates(arr) {
  return [...new Set(arr)];
}

function filterEmpty(arr) {
  return arr.filter((item) => item && item.trim().length > 0);
}

// ============================================================================
// 英文分词器（用于英文分析）
// ============================================================================

/**
 * 拆分驼峰命名和蛇形命名
 * DarkSoul -> Dark Soul
 * dark_soul -> dark soul
 * dark-soul -> dark soul
 * DARKSOUL -> 不拆
 * DarkSOUL -> Dark SOUL
 * HTTPSConnection -> HTTPSConnection
 * XMLHttpRequest -> XMLHttp Request
 * @param {string} word 单词
 * @returns {Array} 拆分结果
 */
function splitNaming(word) {
  const result = [];
  let buffer = "";

  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const nextChar = word[i + 1];

    // 检测大写字母序列结束
    if (/[A-Z]/.test(char)) {
      const uppercaseSeq = word.slice(i).match(/^[A-Z]+/);
      if (uppercaseSeq && uppercaseSeq[0].length >= 2) {
        if (buffer) {
          result.push(buffer);
          buffer = "";
        }
        const seq = uppercaseSeq[0];
        // 检查后面是否接着小写字母
        if (word[i + seq.length] && /[a-z]/.test(word[i + seq.length])) {
          // 最后一个大写字母后有内容，需要拆分
          const lastUpper = seq.slice(0, -1);
          const nextUpper = seq.slice(-1);
          if (lastUpper) result.push(lastUpper);
          buffer = nextUpper;
        } else {
          // 纯大写序列，不拆分
          buffer += seq;
        }
        i += uppercaseSeq[0].length - 1;
        continue;
      }
    }

    // 检测小写字母后接大写字母（驼峰边界）
    if (
      buffer &&
      /[a-z]/.test(buffer[buffer.length - 1]) &&
      /[A-Z]/.test(char)
    ) {
      result.push(buffer);
      buffer = char;
      continue;
    }

    // 检测下划线和横杠
    if (char === "_" || char === "-") {
      if (buffer) {
        result.push(buffer);
        buffer = "";
      }
      continue;
    }

    buffer += char;
  }

  if (buffer) {
    result.push(buffer);
  }

  return result.filter((w) => w.length > 0);
}

// ============================================================================
// 智能分析模式（默认启用）
// ============================================================================

/**
 * 智能分析模式
 * - 英文单词分格
 * - 中文整句分格
 * - 连着的数字一格
 * - 去除空格
 * - 每个标点占一格
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function smartAnalyze(text) {
  if (!text || !text.trim()) return [];

  const result = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // 跳过空白字符
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // 标点符号单独成格
    if (REGEX.punctuation.test(char)) {
      result.push(char);
      i++;
      continue;
    }

    // 中文字符：整句收集直到遇到非中文字符
    if (REGEX.chineseChar.test(char)) {
      let chineseSegment = "";
      while (i < text.length && REGEX.chineseChar.test(text[i])) {
        chineseSegment += text[i];
        i++;
      }
      if (chineseSegment) {
        result.push(chineseSegment);
      }
      continue;
    }

    // 数字：连续数字作为一格
    if (/\d/.test(char)) {
      let number = "";
      while (i < text.length && /\d/.test(text[i])) {
        number += text[i];
        i++;
      }
      if (number) {
        result.push(number);
      }
      continue;
    }

    // 英文字母：按单词分格
    if (/[a-zA-Z]/.test(char)) {
      let word = "";
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        word += text[i];
        i++;
      }
      if (word) {
        result.push(word);
      }
      continue;
    }

    // 其他字符单独处理
    result.push(char);
    i++;
  }

  return result.filter((w) => w.length > 0);
}

// ============================================================================
// 中文分析模式
// ============================================================================

/**
 * 中文分析模式
 * - 中英分离
 * - 空格、整句、符号分离
 * - 符号空格留在上字词尾
 * - 数字分格
 * - 剩余中文先查找字典，再调用算法（可开关）
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function chineseAnalyze(text) {
  if (!text || !text.trim()) return [];

  let result = [];

  // 中英分离
  const parts = text.split(/([a-zA-Z]+)/).filter(Boolean);

  for (const part of parts) {
    if (/^[a-zA-Z]+$/.test(part)) {
      // 英文部分：空格分词，符号空格留在上字词尾
      const words = part.split(/\s+/).filter(Boolean);
      result.push(...words);
    } else {
      // 中文部分
      let chinesePart = part;

      // 符号分离，符号留在上字词尾
      // 使用 match 获取所有匹配的标点符号
      const punctuations = chinesePart.match(REGEX.chinesePunctuation) || [];
      for (const p of punctuations) {
        const pieces = chinesePart.split(p);
        chinesePart = pieces.join(" ");
      }

      // 空格分词
      const words = chinesePart.split(/\s+/).filter(Boolean);

      for (const word of words) {
        if (/^\d+$/.test(word)) {
          // 数字分格
          result.push(word);
        } else if (word.length > 0) {
          // 剩余中文：先查找字典，再调用算法
          const tokens = chineseWordSegmentation(word, {
            useDictionary: CONFIG.useDictionary,
            useAlgorithm: CONFIG.useAlgorithm,
          });
          result.push(...tokens);
        }
      }
    }
  }

  return result.filter((w) => w.length > 0);
}

/**
 * 中文分词（供中文分析模式使用，使用 fastCWS 引擎）
 * @param {string} text 输入文本
 * @param {object} options 选项
 * @returns {Array} 分词结果
 */
function chineseWordSegmentation(text, options = {}) {
  if (!text || !text.trim()) return [];

  const useDict = options.useDictionary !== false;
  const useAlgo = options.useAlgorithm !== false;

  if (!useDict && !useAlgo) {
    return [text];
  }

  if (!useDict && useAlgo) {
    const result = [];
    for (const char of text) {
      if (char.charCodeAt(0) >= 0x4e00 && char.charCodeAt(0) <= 0x9fff) {
        result.push(char);
      }
    }
    return result;
  }

  return fastCWS.cut(text, {
    removeStopWords: true,
    keepEnglish: false,
    keepNumber: false,
  });
}

// ============================================================================
// 英文分析模式
// ============================================================================

/**
 * 英文分析模式
 * - 中英分离
 * - 空格、符号、整句分离
 * - 符号空格留在上字词尾
 * - 数字分格
 * - 英文单词如果是类似命名如"DarkSoul"、"dark_soul"、"dark-soul"都分成"dark"、"soul"
 * - 但是"DARKSOUL"大写字母连续的不拆
 * - DarkSOUL处理成Dark SOUL
 * - HTTPSConnection处理成HTTPSConnection
 * - XMLHttpRequest为XMLHttp Request
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function englishAnalyze(text) {
  if (!text || !text.trim()) return [];

  let result = [];

  // 中英分离
  const parts = text.split(/([\u4e00-\u9fa5]+)/).filter(Boolean);

  for (const part of parts) {
    if (/[\u4e00-\u9fa5]/.test(part)) {
      // 中文部分：直接保留
      const noSpace = part.replace(/\s+/g, "");
      if (noSpace) result.push(noSpace);
    } else {
      // 英文部分
      let englishPart = part;

      // 符号分离，符号空格留在上字词尾
      const symbols = /[,.!?;:'"()\[\]{}–—-]/g;
      englishPart = englishPart.replace(symbols, " $&");

      // 空格分词
      const words = englishPart.split(/\s+/).filter(Boolean);

      for (const word of words) {
        // 数字分格
        if (/^\d+$/.test(word)) {
          result.push(word);
          continue;
        }

        // 符号已经在上面处理过了，这里只处理命名分词
        const cleanWord = word.replace(/[,.!?;:'"()\[\]{}–—-]/g, "");
        if (!cleanWord) continue;

        // 命名分词
        const tokens = splitNaming(cleanWord);
        // 符号空格留在上字词尾
        for (const token of tokens) {
          const symbolMatch = word.match(/[,.!?;:'"()\[\]{}–—-]+$/);
          if (symbolMatch && token === tokens[tokens.length - 1]) {
            result.push(token + symbolMatch[0]);
          } else {
            result.push(token);
          }
        }
      }
    }
  }

  return result.filter((w) => w.length > 0);
}

// ============================================================================
// 代码分析模式
// ============================================================================

/**
 * 代码分析模式
 * 根据代码类型自动选择分析方式：
 * - cpp_brace：C++/含{}符号，使用成对符号匹配
 * - python_indent：Python/含:行，使用缩进栈算法
 * - line_based：退化为按行分析
 *
 * 整句识别：
 * - 宏定义（#define, #include等）
 * - 导入语句（import, from, require等）
 * - 函数声明与定义
 *
 * 函数体识别：
 * - 成对符号 () {} [] '' "" <> `` 分成最大块，内部不拆
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function codeAnalyze(text) {
  if (!text || !text.trim()) return [];
  return analyzeCode(text);
}

// ============================================================================
// 字符断行模式
// ============================================================================

/**
 * 字符断行模式
 * 智能断行：先找charLimit前面的第一个空格/换行/符号，
 * 如果找不到或找到的片段>50字，则硬断行
 * @param {string} text 输入文本
 * @param {number} charLimit 每行字符数
 * @returns {Array} 分词结果
 */
export function charBreak(text, charLimit = CONFIG.lineCharLimit) {
  if (!text || !text.trim()) return [];

  const result = [];
  let remaining = text;
  const MIN_SEGMENT_LENGTH = 50; // 最小片段长度，小于此值则硬断行

  while (remaining.length > charLimit) {
    // 在charLimit位置向前查找第一个分隔符（空格、换行、标点）
    let breakPoint = -1;
    const searchStart = Math.min(charLimit, remaining.length);
    const searchEnd = Math.max(0, searchStart - charLimit); // 最多向前搜索charLimit个字符

    for (let i = searchStart - 1; i >= searchEnd; i--) {
      const char = remaining[i];
      // 检查是否是分隔符：空格、换行、或标点符号
      if (
        /\s/.test(char) ||
        /[，。！？；：""''（）【】《》<>「」『』,!?;:'"()\[\]{}–—-]/.test(char)
      ) {
        breakPoint = i + 1; // 在分隔符后断行
        break;
      }
    }

    // 如果找到分隔符且片段长度>=最小长度，则在此处断行
    if (breakPoint > 0 && breakPoint >= MIN_SEGMENT_LENGTH) {
      result.push(remaining.substring(0, breakPoint));
      remaining = remaining.substring(breakPoint);
    } else {
      // 否则硬断行
      result.push(remaining.substring(0, charLimit));
      remaining = remaining.substring(charLimit);
    }
  }

  if (remaining) {
    result.push(remaining);
  }

  return result;
}

// ============================================================================
// AI分析模式
// ============================================================================

/**
 * AI分析模式
 * 1. 链接识别阶段：提取所有URL模式（http://, https://, ftp://等）
 * 2. 疑似链接识别：域名模式（example.com, example.org等）
 * 3. 上下文补全阶段：根据最近完整链接的协议头补全疑似链接
 * 4. 文本重组阶段：将原文本中的链接位置替换为占位符
 * 5. 严格分词阶段：对非链接文本进行标准分词
 * 6. 输出排序：链接片段（按出现顺序）→ 补全链接 → 分词结果
 * @param {string} text 输入文本
 * @returns {Promise<Array>} 分词结果
 */
export async function aiAnalyze(text) {
  if (!text || !text.trim()) return [];

  try {
    const settings = await getSettings();
    const ts = settings.tokenizerSettings || {};

    // 检查AI是否启用
    if (ts.aiEnabled !== true) {
      console.log("AI分析已禁用，使用智能分析");
      return smartAnalyze(text);
    }

    const protocol = ts.aiDefaultProtocol || "https://";
    const enableStrictTokenization = true;

    const result = await aiAnalyzePipeline(text, {
      protocol,
      enableStrictTokenization,
      provider: ts.aiProvider || "openai",
      baseURL: ts.aiBaseURL || "",
      apiKey: ts.aiApiKey || "",
      model: ts.aiModel || "",
    });

    if (
      result &&
      result.tokenizedResult &&
      Array.isArray(result.tokenizedResult)
    ) {
      return result.tokenizedResult.filter(
        (item) => typeof item === "string" && item.length > 0,
      );
    }

    return smartAnalyze(text);
  } catch (error) {
    console.error("AI分析失败，回退到智能分析:", error);
    return smartAnalyze(text);
  }
}

// ============================================================================
// 整句分析模式
// ============================================================================

/**
 * 整句分析模式
 * 用换行和表示结束的标点分割文本，保留所有内容（包括空格和标点）
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function sentenceAnalyze(text) {
  if (!text || !text.trim()) return [];

  // 使用换行和结束标点分割：换行符、句号、感叹号、问号
  const sentences = text.split(/[\n。！？!?]+/);

  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 半句分析模式
 * 使用标点、空格、换行分割文本
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function halfSentenceAnalyze(text) {
  if (!text || !text.trim()) return [];

  // 使用标点、空格、换行分割
  const parts = text.split(
    /[\s，。！？；：""''（）【】《》<>「」『』,!?;:'"()\[\]{}–—-]+/,
  );

  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ============================================================================
// 去除符号模式
// ============================================================================

/**
 * 去除符号模式
 * 先按符号分格，再去除符号，再按整句、空格、换行分离，再中、英、数字分离
 * @param {string} text 输入文本
 * @returns {Array} 分词结果
 */
export function removeSymbolsAnalyze(text) {
  if (!text || !text.trim()) return [];

  let result = [];

  // 按符号分格
  const parts = text.split(REGEX.punctuation);

  for (const part of parts) {
    if (!part.trim()) continue;

    // 去除符号后，按整句、空格、换行分离
    let cleaned = part
      .replace(/[,.!?;:'"()\[\]{}–—-]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) continue;

    // 中、英、数字分离
    const segments = cleaned.split(/([a-zA-Z]+|\d+)/).filter(Boolean);
    for (const seg of segments) {
      if (seg.trim()) {
        result.push(seg.trim());
      }
    }
  }

  return result.filter((w) => w.length > 0);
}

// ============================================================================
// 随机分词模式
// ============================================================================

/**
 * 随机分词模式
 * - 将所有字符随机分成设定长度的字符串（1-10字符）
 * - 从头到尾处理，支持刷新重跑，结果每次不同
 * - 结果不保存到历史栈，不可回溯
 * @param {string} text 输入文本
 * @param {object} options 配置选项
 * @returns {Array} 随机分词结果
 */
export async function randomAnalyze(text, options = {}) {
  if (!text || !text.trim()) return [];

  const settings = await getSettings();
  const ts = settings.tokenizerSettings || {};

  const minLen = ts.randomMinLen || CONFIG.randomMinLength;
  const maxLen = ts.randomMaxLen || CONFIG.randomMaxLength;

  return randomSplit(text, {
    minLength: options.minLength ?? minLen,
    maxLength: options.maxLength ?? maxLen,
  });
}

// ============================================================================
// 多规则组合系统
// ============================================================================

/**
 * 多规则组合分词
 * 支持11个独立规则，分词规则在前，去除规则在后
 * 互斥处理："去除符号"+"符号分词"同时启用时，跳过符号分词
 * 依赖关系：命名分词→大写分词
 * @param {string} text 输入文本
 * @param {Array} rules 启用的规则列表
 * @returns {Promise<Array>} 分词结果
 */
export async function multiRuleAnalyze(text, rules = []) {
  if (!text || !text.trim()) return [];

  const { result } = await analyzeMultiRules(text, rules);
  return result;
}

// ============================================================================
// splitText 主函数
// ============================================================================

/**
 * 智能文本分割
 * 根据模式类型选择不同的分词策略
 * @param {string} text 输入文本
 * @param {string} mode 分词模式
 * @param {object} options 分词选项
 * @returns {Promise<Array>} 分割结果
 */
export async function splitText(text, mode = "smart", options = {}) {
  if (!text || !text.trim()) return [];

  const charLimit = options.charLimit || CONFIG.lineCharLimit;

  switch (mode) {
    case "smart":
      return smartAnalyze(text);

    case "chinese":
      return chineseAnalyze(text);

    case "english":
      return englishAnalyze(text);

    case "code":
      return codeAnalyze(text);

    case "ai":
      return await aiAnalyze(text);

    case "sentence":
      return sentenceAnalyze(text);

    case "halfSentence":
      return halfSentenceAnalyze(text);

    case "charBreak":
      return charBreak(text, charLimit);

    case "removeSymbols":
      return removeSymbolsAnalyze(text);

    case "random":
      return await randomAnalyze(text, options);

    case "multi":
      return multiRuleAnalyze(text, options.rules || []);

    default:
      return smartAnalyze(text);
  }
}

// ============================================================================
// 公共API
// ============================================================================

export function isURL(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function extractEmails(text) {
  if (!text || !text.trim()) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  return removeDuplicates(text.match(emailRegex) || []);
}

export function extractPhoneNumbers(text) {
  if (!text || !text.trim()) return [];
  const phoneRegex = /(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g;
  return removeDuplicates(text.match(phoneRegex) || []);
}

export function isClipboardAPIAvailable() {
  return !!(
    navigator.clipboard &&
    navigator.clipboard.writeText &&
    navigator.clipboard.readText
  );
}

export async function copyToClipboard(text) {
  if (!isClipboardAPIAvailable()) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("剪贴板复制失败:", err);
    return false;
  }
}

export async function readFromClipboard() {
  if (!isClipboardAPIAvailable()) return null;

  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error("读取剪贴板失败:", err);
    return null;
  }
}

// ============================================================================
// 分析模式配置
// ============================================================================

export const ANALYZE_MODES = {
  smart: {
    name: "智能分析",
    description: "默认启用，英文单词分格，中文整句分格，数字、标点分格",
    exclusive: true,
    options: [],
  },
  chinese: {
    name: "中文分析",
    description: "中英分离，数字分格，剩余中文查字典后算法分词",
    exclusive: true,
    options: ["useDictionary", "useAlgorithm"],
  },
  english: {
    name: "英文分析",
    description: "中英分离，空格符号分格，命名法分词",
    exclusive: true,
    options: [],
  },
  code: {
    name: "代码分析",
    description: "C++/Python代码结构分析，函数体识别",
    exclusive: true,
    options: [],
  },
  ai: {
    name: "AI分析",
    description: "链接识别补全，智能分词",
    exclusive: true,
    options: [],
  },
  sentence: {
    name: "整句分析",
    description: "用换行和结束标点分割，保留所有内容",
    exclusive: true,
    options: ["sentenceMode"],
  },
  halfSentence: {
    name: "半句分析",
    description: "使用标点、空格、换行分割文本",
    exclusive: true,
    options: [],
  },
  removeSymbols: {
    name: "去除符号",
    description: "去除所有符号后分词",
    exclusive: true,
    options: [],
  },
  charBreak: {
    name: "字符断行",
    description: "按设定字符数硬断行",
    exclusive: true,
    options: ["charLimit"],
  },
  random: {
    name: "随机分词",
    description: "随机分词，结果不保存到历史栈",
    exclusive: true,
    options: ["randomMinLength", "randomMaxLength"],
  },
};

export const MULTI_RULES = {
  symbolSplit: {
    name: "符号分词",
    description: "符号放在上词词尾，除非是成对符号的前一个",
    group: "split",
  },
  whitespaceSplit: {
    name: "空格分词",
    description: "空格放前一词词尾",
    group: "split",
  },
  newlineSplit: {
    name: "换行分词",
    description: "换行放前一词词尾",
    group: "split",
  },
  chineseEnglishSplit: {
    name: "中英分词",
    description: "分离中文和英文",
    group: "split",
  },
  uppercaseSplit: {
    name: "大写分词",
    description: "将每个大写字母分成一格",
    group: "split",
  },
  namingSplit: {
    name: "命名分词",
    description: "各类命名法分格（驼峰、蛇形等）",
    group: "split",
    dependsOn: ["uppercaseSplit"],
  },
  digitSplit: {
    name: "数字分词",
    description: "数字单独分出来",
    group: "split",
  },
  removeWhitespace: {
    name: "去除空格",
    description: "去除所有空格",
    group: "remove",
  },
  removeSymbols: {
    name: "去除符号",
    description: "去除所有符号",
    group: "remove",
    dependsOn: ["symbolSplit"],
  },
  removeChinese: {
    name: "去除中文",
    description: "去除所有中文字符",
    group: "remove",
  },
  removeEnglish: {
    name: "去除英文",
    description: "去除所有英文字符",
    group: "remove",
  },
  removeDigits: {
    name: "去除数字",
    description: "去除所有数字",
    group: "remove",
  },
};

// ============================================================================
// 辅助函数：路径处理
// ============================================================================

export function processPath(text) {
  const pathPatterns = [
    /"[^"]*:[\\/][^"]*"/g,
    /'[^']*:[\\/][^']*'/g,
    /[a-zA-Z]:[\\/][^\s<>"|?*]+/g,
    /(?:\/[\\/]?(?:home|Users|usr)[\\/][^\s<>"|?*]+)/g,
  ];

  let paths = [];
  for (const pattern of pathPatterns) {
    const matches = text.match(pattern) || [];
    paths = [...paths, ...matches];
  }

  if (paths.length === 0) {
    return null;
  }

  return paths.map((p) => p.replace(/^["']|["']$/g, ""));
}

// ============================================================================
// 辅助函数：链接提取
// ============================================================================

export function processTextExtraction(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const links = text.match(urlRegex) || [];

  let cleanedText = text;
  for (const link of links) {
    cleanedText = cleanedText.replace(link, "");
  }

  return {
    cleanedText: cleanedText.trim(),
    extractedLinks: [...new Set(links)],
  };
}

// ============================================================================
// 辅助函数：GitHub仓库链接生成
// ============================================================================

export function processLinkGeneration(input) {
  const githubPattern = /github\.com[/:]([\w-]+)\/([\w.-]+)/i;
  const simplePattern = /^([\w-]+)\/([\w.-]+)$/;

  let username, repo;

  const githubMatch = input.match(githubPattern);
  if (githubMatch) {
    [, username, repo] = githubMatch;
    repo = repo.replace(/\.git$/, "");
  } else {
    const simpleMatch = input.match(simplePattern);
    if (simpleMatch) {
      [, username, repo] = simpleMatch;
    }
  }

  if (!username || !repo) {
    return null;
  }

  const originalUrl = `https://github.com/${username}/${repo}`;
  const zreadUrl = `https://zread.ai/${username}/${repo}`;
  const deepwikiUrl = `https://deepwiki.com/${username}/${repo}`;
  const context7Url = `https://context7.com/${username}/${repo}`;

  return {
    originalGithubLink: originalUrl,
    generatedLinks: [originalUrl, zreadUrl, deepwikiUrl, context7Url],
  };
}

// ============================================================================
// 辅助函数：多格式分析
// ============================================================================

export function analyzeTextForMultipleFormats(text) {
  const results = [];

  const urls = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  if (urls.length > 0) {
    results.push({ type: "链接提取", data: [...new Set(urls)] });
  }

  const emails =
    text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
  if (emails.length > 0) {
    results.push({ type: "邮箱地址", data: [...new Set(emails)] });
  }

  const phones =
    text.match(/(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g) || [];
  if (phones.length > 0) {
    results.push({ type: "电话号码", data: [...new Set(phones)] });
  }

  const ips =
    text.match(
      /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g,
    ) || [];
  if (ips.length > 0) {
    results.push({ type: "IP地址", data: [...new Set(ips)] });
  }

  const paths = processPath(text);
  if (paths) {
    results.push({ type: "路径转换", data: paths });
  }

  const githubPattern = /github\.com[/:]([\w-]+)\/([\w.-]+)/i;
  if (githubPattern.test(text)) {
    const linkGen = processLinkGeneration(text);
    if (linkGen) {
      results.push({ type: "GitHub链接", data: linkGen.generatedLinks });
    }
  }

  const dates = text.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g) || [];
  if (dates.length > 0) {
    results.push({ type: "日期", data: [...new Set(dates)] });
  }

  return results;
}

// ============================================================================
// 辅助函数：获取可用分词规则
// ============================================================================

export function getAvailableSplitRules() {
  return [
    { value: "smart", label: "智能分析" },
    { value: "chinese", label: "中文分析" },
    { value: "english", label: "英文分析" },
    { value: "code", label: "代码分析" },
    { value: "ai", label: "AI分析" },
    { value: "sentence", label: "整句分析" },
    { value: "charBreak", label: "字符断行" },
    { value: "removeSymbols", label: "去除符号" },
    { value: "random", label: "随机分词" },
    { value: "multi", label: "多规则组合" },
  ];
}

// ============================================================================
// 辅助函数：智能分词
// ============================================================================

export function intelligentSegmentation(text) {
  return smartAnalyze(text);
}

// ============================================================================
// 辅助函数：内容类型检测
// ============================================================================

export function detectContentType(text) {
  if (!text || !text.trim()) {
    return { type: "empty", confidence: 1, features: {} };
  }

  const features = {
    hasUrl: /https?:\/\//i.test(text),
    hasEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(text),
    hasPath: /[a-zA-Z]:[\\/]|\/(?:home|Users|usr)[\\/]/i.test(text),
    hasRepo: /[\w-]+\/[\w-]+/.test(text),
    chineseCount: (text.match(/[\u4e00-\u9fa5]/g) || []).length,
    englishCount: (text.match(/[a-zA-Z]+/g) || []).length,
  };

  const totalChars = text.length;
  const chineseRatio = features.chineseCount / totalChars;
  const englishRatio = features.englishCount / totalChars;

  let type = "mixed_text";
  let confidence = 0.5;

  if (features.hasUrl && !features.hasEmail) {
    type = "url_collection";
    confidence = 0.9;
  } else if (features.hasEmail) {
    type = "contact_info";
    confidence = 0.9;
  } else if (features.hasRepo) {
    type = "repository";
    confidence = 0.85;
  } else if (features.hasPath) {
    type = "file_path";
    confidence = 0.8;
  } else if (chineseRatio > 0.5) {
    type = "chinese_text";
    confidence = Math.min(0.95, chineseRatio + 0.3);
  } else if (englishRatio > 0.5) {
    type = "english_text";
    confidence = Math.min(0.95, englishRatio + 0.3);
  }

  return { type, confidence, features };
}
