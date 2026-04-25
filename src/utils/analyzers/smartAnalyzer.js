// src/utils/analyzers/smartAnalyzer.js
// 智能分析模式

import { isChineseOrEmoji } from './utils.js';

const REGEX = {
  punctuation: /[，。！？；：""''（）【】《》<>「」『』,!?;:'"()[]{}–—-]/
};

/**
 * 智能分析模式
 * - 英文单词分格
 * - 中文整句分格
 * - 连着的数字一格
 * - 去除空格
 * - 每个标点占一格
 */
export function smartAnalyze(text) {
  if (!text || !text.trim()) return [];

  const result = [];
  let i = 0;

  const paths = [];
  const pathRegexes = [
    { type: 'url', regex: /https?:\/\/[^\s<>"{}|^`\[\]]+/gi },
    { type: 'file', regex: /file:\/\/[^\s<>"{}|^`\[\]]+/gi },
    { type: 'browser_protocol', regex: /(?:chrome|about|edge|firefox):\/\/[^\s<>"{}|^`\[\]]+/gi },
    { type: 'windows', regex: /(?<![a-zA-Z])[a-zA-Z]:[\\/][^<>"|?*]*/g },
    { type: 'unix', regex: /(?:\/[\\/]?(?:home|Users|usr|etc|var|opt|tmp)[\\/][^<>"|?*]*)/g }
  ];

  for (const { regex } of pathRegexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      paths.push({ start: match.index, end: match.index + match[0].length, content: match[0] });
    }
  }

  paths.sort((a, b) => a.start - b.start);

  const mergedPaths = [];
  for (const path of paths) {
    const last = mergedPaths[mergedPaths.length - 1];
    if (last && path.start < last.end) {
      if (path.end - path.start > last.end - last.start) {
        mergedPaths[mergedPaths.length - 1] = path;
      }
    } else {
      mergedPaths.push(path);
    }
  }

  while (i < text.length) {
    const currentPath = mergedPaths.find((p) => i >= p.start && i < p.end);
    if (currentPath) {
      result.push(currentPath.content);
      i = currentPath.end;
      continue;
    }

    const codePoint = text.codePointAt(i);
    const char = String.fromCodePoint(codePoint);
    const charLength = char.length;

    if (/\s/.test(char)) {
      i += charLength;
      continue;
    }

    if (REGEX.punctuation.test(char)) {
      result.push(char);
      i += charLength;
      continue;
    }

    if (isChineseOrEmoji(char)) {
      let chineseSegment = '';
      while (i < text.length) {
        const cp = text.codePointAt(i);
        const ch = String.fromCodePoint(cp);
        const len = ch.length;
        if (isChineseOrEmoji(ch)) {
          chineseSegment += ch;
          i += len;
        } else {
          break;
        }
      }
      if (chineseSegment) {
        result.push(chineseSegment);
      }
      continue;
    }

    if (/\d/.test(char)) {
      let number = '';
      while (i < text.length && /\d/.test(text[i])) {
        number += text[i];
        i++;
      }
      if (number) {
        result.push(number);
      }
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      let word = '';
      while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        word += text[i];
        i++;
      }
      if (word) {
        result.push(word);
      }
      continue;
    }

    result.push(char);
    i += charLength;
  }

  return result.filter((w) => w.length > 0);
}
