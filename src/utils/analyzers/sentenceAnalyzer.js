// src/utils/analyzers/sentenceAnalyzer.js
// 整句/半句分析模式

/**
 * 整句分析模式
 * 用换行和表示结束的标点分割文本，保留所有内容
 */
export function sentenceAnalyze(text) {
  if (!text || !text.trim()) return [];

  const regex = /([\n。！？!?]+)/;
  const parts = text.split(regex);

  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (regex.test(part) && result.length > 0) {
      result[result.length - 1] += part;
    } else {
      result.push(part);
    }
  }

  return result.filter((s) => s.length > 0);
}

/**
 * 半句分析模式
 * 使用换行和主要结束标点分割文本
 */
export function halfSentenceAnalyze(text) {
  if (!text || !text.trim()) return [];

  const regex = /([\n。！？；;]+)/;
  const parts = text.split(regex);

  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (regex.test(part) && result.length > 0) {
      result[result.length - 1] += part;
    } else {
      result.push(part);
    }
  }

  return result.filter((s) => s.length > 0);
}
