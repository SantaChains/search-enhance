// src/utils/analyzers/chineseAnalyzer.js
// 中文分析模式

import { fastCWS } from '../fastCWS.js';
import { isChineseOrEmoji } from './utils.js';

const REGEX = {
  chinesePunctuation: /[，。！？；：""''（）【】《》<>「」『』]/
};

const CONFIG = {
  useDictionary: true,
  useAlgorithm: true
};

/**
 * 中文分析模式
 * - 中英分离
 * - 空格、整句、符号分离
 * - 符号空格留在上字词尾
 * - 数字分格
 * - 剩余中文先查找字典，再调用算法
 */
export function chineseAnalyze(text) {
  if (!text || !text.trim()) return [];

  const result = [];
  const parts = [];
  let currentPart = '';
  let currentType = null;

  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i);
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    const isEnglish = /[a-zA-Z]/.test(char);
    const type = isEnglish ? 'english' : 'other';

    if (currentType !== type && currentPart) {
      parts.push({ type: currentType, content: currentPart });
      currentPart = '';
    }
    currentType = type;
    currentPart += char;
    i += charLength;
  }
  if (currentPart) {
    parts.push({ type: currentType, content: currentPart });
  }

  for (const { type, content: part } of parts) {
    if (type === 'english') {
      const words = part.split(/\s+/).filter(Boolean);
      result.push(...words);
    } else {
      let chinesePart = part;
      const punctuations = chinesePart.match(REGEX.chinesePunctuation) || [];
      for (const p of punctuations) {
        const pieces = chinesePart.split(p);
        chinesePart = pieces.join(' ');
      }

      const words = chinesePart.split(/\s+/).filter(Boolean);

      for (const word of words) {
        if (/^\d+$/.test(word)) {
          result.push(word);
        } else if (word.length > 0) {
          const tokens = chineseWordSegmentation(word, {
            useDictionary: CONFIG.useDictionary,
            useAlgorithm: CONFIG.useAlgorithm
          });
          result.push(...tokens);
        }
      }
    }
  }

  return result.filter((w) => w.length > 0);
}

function chineseWordSegmentation(text, options = {}) {
  if (!text || !text.trim()) return [];

  const useDict = options.useDictionary !== false;
  const useAlgo = options.useAlgorithm !== false;

  if (!useDict && !useAlgo) {
    return [text];
  }

  if (!useDict && useAlgo) {
    const result = [];
    for (let i = 0; i < text.length; ) {
      const codePoint = text.codePointAt(i);
      const char = String.fromCodePoint(codePoint);
      const charLength = char.length;
      if (isChineseOrEmoji(char)) {
        result.push(char);
      }
      i += charLength;
    }
    return result;
  }

  return fastCWS.cut(text, {
    removeStopWords: true,
    keepEnglish: false,
    keepNumber: false
  });
}
