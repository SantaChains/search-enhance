// src/utils/analyzers/utils.js
// 分析器通用工具函数

export function isEmoji(char) {
  const code = char.codePointAt(0);
  return (
    (code >= 0x1f300 && code <= 0x1f9ff) ||
    (code >= 0x1f600 && code <= 0x1f64f) ||
    (code >= 0x1f680 && code <= 0x1f6ff) ||
    (code >= 0x1f1e0 && code <= 0x1f1ff) ||
    (code >= 0x2600 && code <= 0x26ff) ||
    (code >= 0x2700 && code <= 0x27bf) ||
    (code >= 0x1f900 && code <= 0x1f9ff)
  );
}

export function isChinese(char) {
  const code = char.codePointAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0x2a700 && code <= 0x2b73f) ||
    (code >= 0x2b740 && code <= 0x2b81f)
  );
}

export function isChineseOrEmoji(char) {
  return isChinese(char) || isEmoji(char);
}

export function removeDuplicates(arr) {
  return [...new Set(arr)];
}

export function splitNaming(word) {
  const result = [];
  let buffer = '';

  for (let i = 0; i < word.length; i++) {
    const char = word[i];

    if (/[A-Z]/.test(char)) {
      const uppercaseSeq = word.slice(i).match(/^[A-Z]+/);
      if (uppercaseSeq && uppercaseSeq[0].length >= 2) {
        if (buffer) {
          result.push(buffer);
          buffer = '';
        }
        const seq = uppercaseSeq[0];
        if (word[i + seq.length] && /[a-z]/.test(word[i + seq.length])) {
          const lastUpper = seq.slice(0, -1);
          const nextUpper = seq.slice(-1);
          if (lastUpper) result.push(lastUpper);
          buffer = nextUpper;
        } else {
          buffer += seq;
        }
        i += uppercaseSeq[0].length - 1;
        continue;
      }
    }

    if (buffer && /[a-z]/.test(buffer[buffer.length - 1]) && /[A-Z]/.test(char)) {
      result.push(buffer);
      buffer = char;
      continue;
    }

    if (char === '_' || char === '-') {
      if (buffer) {
        result.push(buffer);
        buffer = '';
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
