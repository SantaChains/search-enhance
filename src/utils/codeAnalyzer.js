/**
 * 代码分析器 - Code Analyzer
 *
 * 功能：
 * - Python 代码分析：缩进栈算法，按行组合代码块
 * - C++ 代码分析：成对符号匹配，处理花括号
 * - 整句识别：宏定义、引入语句、函数声明
 *
 * 缩进栈算法（Python）：
 * 1. 维护缩进栈：记录每一层的缩进空格数
 * 2. 行分类：
 *    - 空行：跳过或作为分隔标记
 *    - 缩进增加：推入新栈层，开启新代码块
 *    - 缩进不变：延续当前代码块
 *    - 缩进减少：弹出栈层直到匹配，归属于匹配的父级块
 * 3. 组合规则：同一栈层内的连续行组合为逻辑块
 * 4. 函数体识别：包含 `:` 的行作为块头，后续同栈层行为体
 *
 * 代码类型检测：
 * - if (text.includes('{') || text.includes('}')) → cpp_brace
 * - else if (lines.some(line => line.trim().endsWith(':'))) → python_indent
 * - else → line_based（退化为整句分析）
 */

// ============================================================================
// 成对符号定义
// ============================================================================

const PAIRS = [
  { open: '(', close: ')', nested: true },
  { open: '"', close: '"', nested: false },
  { open: "'", close: "'", nested: false },
  { open: '{', close: '}', nested: true },
  { open: '[', close: ']', nested: true },
  { open: '<', close: '>', nested: true },
  { open: '`', close: '`', nested: false },
  { open: '«', close: '»', nested: true },
];

// ============================================================================
// 工具函数
// ============================================================================

function trimLines(text) {
  return text.split(/[\r\n]+/).map(line => line.trim()).filter(line => line);
}

function getIndent(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function isCompleteBracketPair(text) {
  const stack = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    for (let j = PAIRS.length - 1; j >= 0; j--) {
      const pair = PAIRS[j];
      if (text.substring(i).startsWith(pair.open)) {
        if (pair.nested) {
          stack.push(pair.close);
        }
        i += pair.open.length;
        break;
      }

      if (text.substring(i).startsWith(pair.close)) {
        if (stack.length > 0 && stack[stack.length - 1] === pair.close) {
          stack.pop();
        }
        i += pair.close.length;
        break;
      }

      if (j === 0) i++;
    }
  }

  return stack.length === 0;
}

function extractMaxBracket(text) {
  let bestStart = -1;
  let bestEnd = -1;
  let maxDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const pair = PAIRS.find(p => text.substring(i).startsWith(p.open));
    if (!pair) continue;

    const openIdx = i;
    const closeChar = pair.close;
    const nested = pair.nested;
    let depth = 0;
    let j = i + pair.open.length;

    while (j < text.length) {
      if (text.substring(j).startsWith(pair.open)) {
        if (nested) depth++;
        j += pair.open.length;
      } else if (text[j] === closeChar) {
        if (depth === 0) {
          const candidate = text.substring(openIdx, j + closeChar.length);
          if (isCompleteBracketPair(candidate)) {
            const candidateDepth = (candidate.match(/\(/g) || []).length;
            if (candidateDepth > maxDepth) {
              maxDepth = candidateDepth;
              bestStart = openIdx;
              bestEnd = j + closeChar.length;
            }
          }
          break;
        } else {
          depth--;
          j++;
        }
      } else {
        j++;
      }
    }
  }

  if (bestStart >= 0) {
    return {
      text: text.substring(0, bestStart).trim(),
      bracket: text.substring(bestStart, bestEnd).trim(),
      rest: text.substring(bestEnd).trim()
    };
  }

  return null;
}

// ============================================================================
// 整句识别（宏定义、引入语句、声明）
// ============================================================================

function isCppPreprocessor(line) {
  return /^\s*#\s*(define|include|ifdef|ifndef|endif|else|if|pragma)\b/.test(line);
}

function isImportStatement(line) {
  return /^\s*(import|from|require|using|include)\s+[\w.]+/.test(line);
}

function isDeclaration(line) {
  const declPatterns = [
    /^\s*(typedef\s+)?struct\s+\w+\s*\{/,
    /^\s*(typedef\s+)?class\s+\w+/,
    /^\s*(public|private|protected):\s*$/,
    /^\s*(virtual\s+)?[\w:*&\s]+\s+\w+\s*\([^)]*\)\s*(const)?\s*\{?\s*$/,
    /^\s*(def|function|func)\s+[\w]+\s*\([^)]*\)\s*:\s*$/,
    /^\s*[\w]+\s*=\s*function\s*\(/,
    /^\s*[\w]+\s*=\s*\(/,
  ];

  return declPatterns.some(pattern => pattern.test(line));
}

// ============================================================================
// Python 代码分析 - 缩进栈算法
// ============================================================================

function analyzePythonCode(text) {
  const rawLines = text.split(/[\r\n]+/);
  const lines = rawLines.map(line => line.trimRight()).filter(line => line.trim());
  
  if (lines.length === 0) return [text];

  const result = [];
  const indentStack = [0]; // 初始化缩进栈，0 表示顶层
  let currentBlock = "";
  let currentBlockIndent = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const indent = getIndent(line);
    const trimmedLine = line.trim();

    // 跳过空行
    if (!trimmedLine) continue;

    // 识别整句（导入语句）
    if (isImportStatement(line)) {
      if (currentBlock.trim()) {
        result.push(currentBlock.trim());
      }
      result.push(trimmedLine);
      currentBlock = "";
      currentBlockIndent = indent;
      continue;
    }

    // 处理缩进变化
    if (indent < indentStack[indentStack.length - 1]) {
      // 缩进减少：需要弹出栈直到匹配
      while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
      }
      
      // 如果当前块缩进大于等于新栈顶，输出当前块
      if (currentBlock.trim() && currentBlockIndent >= indentStack[indentStack.length - 1]) {
        result.push(currentBlock.trim());
        currentBlock = "";
      }
      currentBlockIndent = indent;
    } else if (indent > indentStack[indentStack.length - 1]) {
      // 缩进增加：推入新栈层
      indentStack.push(indent);
      currentBlockIndent = indent;
    }

    // 识别块头（以冒号结尾但不是双冒号）
    if (trimmedLine.endsWith(':') && !trimmedLine.endsWith('::')) {
      if (currentBlock.trim()) {
        result.push(currentBlock.trim());
      }
      currentBlock = trimmedLine;
      currentBlockIndent = indent;
      // 推入新栈层表示进入新块
      if (indentStack[indentStack.length - 1] < indent) {
        indentStack.push(indent);
      }
      continue;
    }

    // 组合当前行
    if (currentBlock) {
      currentBlock += " " + trimmedLine;
    } else {
      currentBlock = trimmedLine;
      currentBlockIndent = indent;
    }

    // 检查下一行缩进来决定是否输出当前块
    const nextLine = lines[lineIndex + 1];
    if (nextLine) {
      const nextIndent = getIndent(nextLine);
      // 如果下一行缩进小于等于当前块缩进，输出当前块
      if (nextIndent <= currentBlockIndent && !nextLine.trim().endsWith(':')) {
        if (currentBlock.trim()) {
          result.push(currentBlock.trim());
        }
        currentBlock = "";
      }
    }
  }

  // 输出剩余的块
  if (currentBlock.trim()) {
    result.push(currentBlock.trim());
  }

  return result.length > 0 ? result : lines;
}

// ============================================================================
// C++ 代码分析 - 成对符号匹配
// ============================================================================

function analyzeCppCode(text) {
  const lines = trimLines(text);
  if (lines.length === 0) return [text];

  const result = [];
  let currentChunk = "";
  let braceDepth = 0;
  let parenDepth = 0;
  let inPreprocessor = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 预处理器指令整行保留
    if (isCppPreprocessor(line)) {
      if (currentChunk.trim()) {
        result.push(currentChunk.trim());
      }
      result.push(trimmedLine);
      currentChunk = "";
      continue;
    }

    // 导入语句
    if (isImportStatement(line)) {
      if (currentChunk.trim()) {
        result.push(currentChunk.trim());
      }
      result.push(trimmedLine);
      currentChunk = "";
      continue;
    }

    // 统计括号深度
    let i = 0;
    while (i < line.length) {
      if (line[i] === '{') braceDepth++;
      else if (line[i] === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (line[i] === '(') parenDepth++;
      else if (line[i] === ')') parenDepth = Math.max(0, parenDepth - 1);
      i++;
    }

    // 添加当前行
    if (currentChunk) {
      currentChunk += " " + trimmedLine;
    } else {
      currentChunk = trimmedLine;
    }

    // 花括号闭合时输出
    if (braceDepth === 0 && parenDepth === 0) {
      // 尝试提取最大成对符号块
      const extracted = extractMaxBracket(currentChunk);
      if (extracted && extracted.text && extracted.bracket) {
        if (extracted.text) result.push(extracted.text);
        result.push(extracted.bracket);
      } else if (currentChunk.trim()) {
        result.push(currentChunk.trim());
      }
      currentChunk = "";
    }
  }

  // 输出剩余
  if (currentChunk.trim()) {
    const extracted = extractMaxBracket(currentChunk);
    if (extracted && extracted.text && extracted.bracket) {
      if (extracted.text) result.push(extracted.text);
      result.push(extracted.bracket);
    } else {
      result.push(currentChunk.trim());
    }
  }

  return result.length > 0 ? result : lines;
}

// ============================================================================
// 代码类型检测与主入口
// ============================================================================

function detectCodeType(text) {
  const lines = text.split(/[\r\n]+/).filter(l => l.trim());

  if (lines.some(line => line.includes('{') || line.includes('}'))) {
    return 'cpp_brace';
  }

  if (lines.some(line => line.trim().endsWith(':') && !line.trim().endsWith('::'))) {
    return 'python_indent';
  }

  return 'line_based';
}

/**
 * 代码分析主函数
 * @param {string} text 输入代码文本
 * @returns {Array} 分块结果
 */
export function codeAnalyze(text) {
  if (!text || !text.trim()) return [];

  const codeType = detectCodeType(text);

  switch (codeType) {
    case 'cpp_brace':
      return analyzeCppCode(text);
    case 'python_indent':
      return analyzePythonCode(text);
    default:
      return trimLines(text);
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  analyzeCppCode,
  analyzePythonCode,
  detectCodeType,
  isCppPreprocessor,
  isImportStatement,
  isDeclaration,
};

export default codeAnalyze;
