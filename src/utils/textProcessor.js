// src/utils/textProcessor.js
// 文本处理工具模块 - 精简版

import { getSettings } from './storage.js';
import { aiAnalyzePipeline } from './aiAdapter.js';
import { codeAnalyze as analyzeCode } from './codeAnalyzer.js';
import { randomAnalyze as randomSplit } from './randomAnalyzer.js';
import { multiRuleAnalyze as analyzeMultiRules, applySingleRule } from './multiRuleAnalyzer.js';
import {
  smartAnalyze,
  chineseAnalyze,
  englishAnalyze,
  sentenceAnalyze,
  halfSentenceAnalyze,
  charBreak,
  removeSymbolsAnalyze,
  removeDuplicates,
  splitNaming,
  isChineseOrEmoji
} from './analyzers/index.js';

const CONFIG = {
  useDictionary: true,
  useAlgorithm: true,
  chaosMinTokens: 3,
  chaosMaxTokens: 10,
  randomMinLength: 1,
  randomMaxLength: 10,
  namingRemoveSymbols: true,
  lineCharLimit: 100
};

export function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

export function getConfig() {
  return { ...CONFIG };
}

export async function aiAnalyze(text) {
  if (!text || !text.trim()) return [];

  try {
    const settings = await getSettings();
    const ts = settings.tokenizerSettings || {};

    if (ts.aiEnabled !== true) {
      return smartAnalyze(text);
    }

    const protocol = ts.aiDefaultProtocol || 'https://';
    const result = await aiAnalyzePipeline(text, {
      protocol,
      enableStrictTokenization: true,
      provider: ts.aiProvider || 'openai',
      baseURL: ts.aiBaseURL || '',
      apiKey: ts.aiApiKey || '',
      model: ts.aiModel || ''
    });

    if (result?.tokenizedResult && Array.isArray(result.tokenizedResult)) {
      return result.tokenizedResult.filter((item) => typeof item === 'string' && item.length > 0);
    }

    return smartAnalyze(text);
  } catch (error) {
    return smartAnalyze(text);
  }
}

export function codeAnalyze(text) {
  if (!text || !text.trim()) return [];
  return analyzeCode(text);
}

export async function randomAnalyze(text, options = {}) {
  if (!text || !text.trim()) return [];

  const settings = await getSettings();
  const ts = settings.tokenizerSettings || {};

  const minLen = ts.randomMinLen || CONFIG.randomMinLength;
  const maxLen = ts.randomMaxLen || CONFIG.randomMaxLength;

  return randomSplit(text, {
    minLength: options.minLength ?? minLen,
    maxLength: options.maxLength ?? maxLen
  });
}

export async function multiRuleAnalyze(text, rules = []) {
  if (!text || !text.trim()) return [];
  const { result } = await analyzeMultiRules(text, rules);
  return result;
}

export async function splitText(text, mode = 'smart', options = {}) {
  if (!text || !text.trim()) return [];

  const charLimit = options.charLimit || CONFIG.lineCharLimit;

  const modeMap = {
    smart: () => smartAnalyze(text),
    chinese: () => chineseAnalyze(text),
    english: () => englishAnalyze(text),
    code: () => codeAnalyze(text),
    ai: () => aiAnalyze(text),
    sentence: () => sentenceAnalyze(text),
    halfSentence: () => halfSentenceAnalyze(text),
    charBreak: () => charBreak(text, charLimit),
    removeSymbols: () => removeSymbolsAnalyze(text),
    random: () => randomAnalyze(text, options),
    multi: () => multiRuleAnalyze(text, options.rules || [])
  };

  const handler = modeMap[mode] || modeMap.smart;
  return handler();
}

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
  return !!(navigator.clipboard?.writeText && navigator.clipboard?.readText);
}

export async function copyToClipboard(text) {
  if (!isClipboardAPIAvailable()) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function readFromClipboard() {
  if (!isClipboardAPIAvailable()) return null;
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

export const ANALYZE_MODES = {
  smart: { name: '智能分析', description: '默认启用，英文单词分格，中文整句分格', exclusive: true },
  chinese: { name: '中文分析', description: '中英分离，数字分格', exclusive: true },
  english: { name: '英文分析', description: '中英分离，命名法分词', exclusive: true },
  code: { name: '代码分析', description: 'C++/Python代码结构分析', exclusive: true },
  ai: { name: 'AI分析', description: '链接识别补全，智能分词', exclusive: true },
  sentence: { name: '整句分析', description: '用换行和结束标点分割', exclusive: true },
  halfSentence: { name: '半句分析', description: '使用标点、空格、换行分割', exclusive: true },
  removeSymbols: { name: '去除符号', description: '去除所有符号后分词', exclusive: true },
  charBreak: { name: '字符断行', description: '按设定字符数硬断行', exclusive: true },
  random: { name: '随机分词', description: '随机分词，结果不保存', exclusive: true }
};

export const MULTI_RULES = {
  symbolSplit: { name: '符号分词', description: '符号放在上词词尾', group: 'split' },
  whitespaceSplit: { name: '空格分词', description: '空格放前一词词尾', group: 'split' },
  newlineSplit: { name: '换行分词', description: '换行放前一词词尾', group: 'split' },
  chineseEnglishSplit: { name: '中英分词', description: '分离中文和英文', group: 'split' },
  uppercaseSplit: { name: '大写分词', description: '将每个大写字母分成一格', group: 'split' },
  namingSplit: { name: '命名分词', description: '各类命名法分格', group: 'split' },
  digitSplit: { name: '数字分词', description: '数字单独分出来', group: 'split' },
  removeWhitespace: { name: '去除空格', description: '去除所有空格', group: 'remove' },
  removeSymbols: { name: '去除符号', description: '去除所有符号', group: 'remove' },
  removeChinese: { name: '去除中文', description: '去除所有中文字符', group: 'remove' },
  removeEnglish: { name: '去除英文', description: '去除所有英文字符', group: 'remove' },
  removeDigits: { name: '去除数字', description: '去除所有数字', group: 'remove' }
};

export function processPath(text) {
  if (!text || !text.trim()) return null;

  const pathPatterns = [
    { type: 'url', regex: /https?:\/\/[^\s<>"{}|^`[\]]+/gi },
    { type: 'file', regex: /file:\/\/[^\s<>"{}|^`[\]]+/gi },
    { type: 'browser_protocol', regex: /(?:chrome|about|edge|firefox):\/\/[^\s<>"{}|^`[\]]+/gi },
    { type: 'windows_quoted', regex: /"[a-zA-Z]:[\\/][^"]*"/g },
    { type: 'windows_quoted_single', regex: /'[a-zA-Z]:[\\/][^']*'/g },
    { type: 'windows', regex: /(?<![a-zA-Z])[a-zA-Z]:[\\/][^<>"|?*]*/g },
    {
      type: 'unix',
      regex: /(?:\/[\\/]?(?:home|Users|usr|etc|var|opt|tmp|bin|lib|mnt|media)[\\/][^<>"|?*]*)/g
    },
    { type: 'unix_general', regex: /\/(?:[^<>"|?*\s]+\/)*[^<>"|?*\s]*/g },
    { type: 'unc', regex: /\\\\[^<>"|?*]+/g }
  ];

  const allMatches = [];

  for (const { type, regex } of pathPatterns) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      allMatches.push({ type, path: match[0], index: match.index, length: match[0].length });
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  const uniquePaths = [];
  const seen = new Set();

  for (const item of allMatches) {
    let cleaned = item.path;

    switch (item.type) {
      case 'windows_quoted':
      case 'windows_quoted_single':
        cleaned = cleaned.slice(1, -1);
        break;
      default:
        cleaned = cleaned.trim().replace(/[<>"|?*]+$/, '');
    }

    if (!cleaned || cleaned.length < 2) continue;
    if (seen.has(cleaned)) continue;

    const isOverlapping = uniquePaths.some((p) => {
      const existingStart = text.indexOf(p);
      const existingEnd = existingStart + p.length;
      return (
        (item.index >= existingStart && item.index < existingEnd) ||
        (item.index + item.length > existingStart && item.index + item.length <= existingEnd)
      );
    });

    if (!isOverlapping) {
      seen.add(cleaned);
      uniquePaths.push(cleaned);
    }
  }

  return uniquePaths.length > 0 ? uniquePaths : null;
}

export function processTextExtraction(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const links = text.match(urlRegex) || [];

  let cleanedText = text;
  for (const link of links) {
    cleanedText = cleanedText.replace(link, '');
  }

  return {
    cleanedText: cleanedText.trim(),
    extractedLinks: [...new Set(links)]
  };
}

export function processLinkGeneration(input) {
  const githubPattern = /github\.com[/:]([\w-]+)\/([\w.-]+)/i;
  const simplePattern = /^([\w-]+)\/([\w.-]+)$/;

  let username, repo;

  const githubMatch = input.match(githubPattern);
  if (githubMatch) {
    [, username, repo] = githubMatch;
    repo = repo.replace(/\.git$/, '');
  } else {
    const simpleMatch = input.match(simplePattern);
    if (simpleMatch) {
      [, username, repo] = simpleMatch;
    }
  }

  if (!username || !repo) return null;

  const originalUrl = `https://github.com/${username}/${repo}`;
  return {
    originalGithubLink: originalUrl,
    generatedLinks: [
      originalUrl,
      `https://zread.ai/${username}/${repo}`,
      `https://deepwiki.com/${username}/${repo}`,
      `https://context7.com/${username}/${repo}`
    ]
  };
}

export function analyzeTextForMultipleFormats(text) {
  const results = [];

  const urls = text.match(/https?:\/\/[^\s<>"{}|\\^`[]+/gi) || [];
  if (urls.length > 0) results.push({ type: '链接提取', data: [...new Set(urls)] });

  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
  if (emails.length > 0) results.push({ type: '邮箱地址', data: [...new Set(emails)] });

  const phones = text.match(/(?:\+86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})/g) || [];
  if (phones.length > 0) results.push({ type: '电话号码', data: [...new Set(phones)] });

  const ips =
    text.match(
      /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g
    ) || [];
  if (ips.length > 0) results.push({ type: 'IP地址', data: [...new Set(ips)] });

  const paths = processPath(text);
  if (paths) results.push({ type: '路径转换', data: paths });

  const githubPattern = /github\.com[/:]([\w-]+)\/([\w.-]+)/i;
  if (githubPattern.test(text)) {
    const linkGen = processLinkGeneration(text);
    if (linkGen) results.push({ type: 'GitHub链接', data: linkGen.generatedLinks });
  }

  const dates = text.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g) || [];
  if (dates.length > 0) results.push({ type: '日期', data: [...new Set(dates)] });

  return results;
}

export function getAvailableSplitRules() {
  return [
    { value: 'smart', label: '智能分析' },
    { value: 'chinese', label: '中文分析' },
    { value: 'english', label: '英文分析' },
    { value: 'code', label: '代码分析' },
    { value: 'ai', label: 'AI分析' },
    { value: 'sentence', label: '整句分析' },
    { value: 'charBreak', label: '字符断行' },
    { value: 'removeSymbols', label: '去除符号' },
    { value: 'random', label: '随机分词' },
    { value: 'multi', label: '多规则组合' }
  ];
}

export function intelligentSegmentation(text) {
  return smartAnalyze(text);
}

export function detectContentType(text) {
  if (!text || !text.trim()) {
    return { type: 'empty', confidence: 1, features: {} };
  }

  const features = {
    hasUrl: /https?:\/\//i.test(text),
    hasEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(text),
    hasPath: /[a-zA-Z]:[\\/]|\/(?:home|Users|usr)[\\/]/i.test(text),
    hasRepo: /[\w-]+\/[\w-]+/.test(text),
    chineseCount: (() => {
      let count = 0;
      for (let i = 0; i < text.length; ) {
        const codePoint = text.codePointAt(i);
        const char = String.fromCodePoint(codePoint);
        if (isChineseOrEmoji(char)) count++;
        i += char.length;
      }
      return count;
    })(),
    englishCount: (text.match(/[a-zA-Z]+/g) || []).length
  };

  const totalChars = text.length;
  const chineseRatio = features.chineseCount / totalChars;
  const englishRatio = features.englishCount / totalChars;

  let type = 'mixed_text';
  let confidence = 0.5;

  if (features.hasUrl && !features.hasEmail) {
    type = 'url_collection';
    confidence = 0.9;
  } else if (features.hasEmail) {
    type = 'contact_info';
    confidence = 0.9;
  } else if (features.hasRepo) {
    type = 'repository';
    confidence = 0.85;
  } else if (features.hasPath) {
    type = 'file_path';
    confidence = 0.8;
  } else if (chineseRatio > 0.5) {
    type = 'chinese_text';
    confidence = Math.min(0.95, chineseRatio + 0.3);
  } else if (englishRatio > 0.5) {
    type = 'english_text';
    confidence = Math.min(0.95, englishRatio + 0.3);
  }

  return { type, confidence, features };
}

export { applySingleRule, splitNaming, isChineseOrEmoji };
