// src/utils/analyzers/englishAnalyzer.js
// 英文分析模式

import { isChineseOrEmoji, splitNaming } from './utils.js';

/**
 * 英文分析模式
 * - 中英分离
 * - 空格、符号、整句分离
 * - 符号空格留在上字词尾
 * - 数字分格
 * - 命名法分词
 */
export function englishAnalyze(text) {
  if (!text || !text.trim()) return [];

  const result = [];
  const parts = [];
  let currentPart = '';
  let currentType = null;

  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i);
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    const isCJK = isChineseOrEmoji(char);
    const type = isCJK ? 'chinese' : 'english';

    if (currentType !== type && currentPart) {
      parts.push(currentPart);
      currentPart = '';
    }
    currentType = type;
    currentPart += char;
    i += charLength;
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  for (const part of parts) {
    if (isChineseOrEmoji(part[0])) {
      const noSpace = part.replace(/\s+/g, '');
      if (noSpace) result.push(noSpace);
    } else {
      let englishPart = part;
      const symbols = /[,.!?;:'"()[]{}–—-]/g;
      englishPart = englishPart.replace(symbols, ' $&');

      const words = englishPart.split(/\s+/).filter(Boolean);

      for (const word of words) {
        if (/^\d+$/.test(word)) {
          result.push(word);
          continue;
        }

        const cleanWord = word.replace(/[,.!?;:'"()[]{}–—-]/g, '');
        if (!cleanWord) continue;

        const tokens = splitNaming(cleanWord);
        for (const token of tokens) {
          const symbolMatch = word.match(/[,.!?;:'"()[]{}–—-]+$/);
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
