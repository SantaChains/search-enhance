// src/utils/analyzers/removeSymbolsAnalyzer.js
// 去除符号模式

import { isChineseOrEmoji } from './utils.js';

const REGEX = {
  punctuation: /[，。！？；：""''（）【】《》<>「」『』,!?;:'"()[]{}–—-]/
};

/**
 * 去除符号模式
 * 先按符号分格，再去除符号，再按整句、空格、换行分离
 */
export function removeSymbolsAnalyze(text) {
  if (!text || !text.trim()) return [];

  const result = [];
  const parts = [];
  let currentPart = '';

  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i);
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    if (REGEX.punctuation.test(char)) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
    } else {
      currentPart += char;
    }
    i += charLength;
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  for (const part of parts) {
    if (!part.trim()) continue;

    let cleaned = '';
    for (let i = 0; i < part.length; ) {
      const codePoint = part.codePointAt(i);
      const char = String.fromCodePoint(codePoint);
      const charLength = char.length;
      if (!/[,.!?;:'"()[]{}–—-]/.test(char)) {
        cleaned += char;
      }
      i += charLength;
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    if (!cleaned) continue;

    const segments = [];
    let currentSeg = '';
    let currentSegType = null;

    for (let i = 0; i < cleaned.length; ) {
      const codePoint = cleaned.codePointAt(i);
      const char = String.fromCodePoint(codePoint);
      const charLength = char.length;

      let type = null;
      if (/[a-zA-Z]/.test(char)) type = 'english';
      else if (/\d/.test(char)) type = 'digit';
      else if (isChineseOrEmoji(char)) type = 'chinese';

      if (type !== currentSegType && currentSeg) {
        segments.push(currentSeg);
        currentSeg = '';
      }
      currentSegType = type;
      if (type) {
        currentSeg += char;
      } else if (currentSeg) {
        segments.push(currentSeg);
        currentSeg = '';
        currentSegType = null;
      }
      i += charLength;
    }
    if (currentSeg) {
      segments.push(currentSeg);
    }

    for (const seg of segments) {
      if (seg.trim()) {
        result.push(seg.trim());
      }
    }
  }

  return result.filter((w) => w.length > 0);
}
