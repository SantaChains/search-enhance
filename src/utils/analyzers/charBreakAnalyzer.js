// src/utils/analyzers/charBreakAnalyzer.js
// 字符断行模式

const CONFIG = {
  lineCharLimit: 100
};

/**
 * 字符断行模式
 * 智能断行：先找charLimit前面的第一个空格/换行/符号
 */
export function charBreak(text, charLimit = CONFIG.lineCharLimit) {
  if (!text || !text.trim()) return [];

  const result = [];
  const remaining = text;
  const MIN_SEGMENT_LENGTH = 50;

  function toCodePoints(str) {
    const codePoints = [];
    for (let i = 0; i < str.length; ) {
      const codePoint = str.codePointAt(i);
      codePoints.push(String.fromCodePoint(codePoint));
      i += codePoint > 0xffff ? 2 : 1;
    }
    return codePoints;
  }

  function fromCodePoints(codePoints, start, end) {
    return codePoints.slice(start, end).join('');
  }

  let codePoints = toCodePoints(remaining);

  while (codePoints.length > charLimit) {
    let breakPoint = -1;
    const searchStart = Math.min(charLimit, codePoints.length);
    const searchEnd = Math.max(0, searchStart - charLimit);

    for (let i = searchStart - 1; i >= searchEnd; i--) {
      const char = codePoints[i];
      if (
        /\s/.test(char) ||
        /[，。！？；：""''（）【】《》<>「」『』,!?;:'"()[]{}–—-]/.test(char)
      ) {
        breakPoint = i + 1;
        break;
      }
    }

    if (breakPoint > 0 && breakPoint >= MIN_SEGMENT_LENGTH) {
      result.push(fromCodePoints(codePoints, 0, breakPoint));
      codePoints = codePoints.slice(breakPoint);
    } else {
      result.push(fromCodePoints(codePoints, 0, charLimit));
      codePoints = codePoints.slice(charLimit);
    }
  }

  if (codePoints.length > 0) {
    result.push(codePoints.join(''));
  }

  return result;
}
