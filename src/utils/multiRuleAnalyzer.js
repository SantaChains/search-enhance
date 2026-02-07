/**
 * 多规则组合分析器 - Multi-Rule Analyzer
 *
 * 功能：
 * - 11个独立规则：符号分词、空格分词、换行分词、中英分词、大写分词、命名分词、数字分词、去除空格、去除符号、去除中文、去除英文
 * - 互斥组：同一组内只能选一个
 * - 依赖关系：选A必须选B
 * - 处理顺序：分词规则在前，去除规则在后
 * - "去除符号"+"符号分词"同时启用时，文本保持在去除符号，相当于不操作
 *
 * 规则说明：
 * - 符号分词：符号放在上词尾，除非是成对符号的前一个
 * - 空格分词：放前一词词尾
 * - 换行分词：放前一词词尾
 * - 中英分词：分离中文和英文
 * - 大写分词：将每个大写字母分成一格
 * - 命名分词：各类命名法分格（驼峰、蛇形等）
 * - 数字分词：数字单独分出来
 * - 去除空格：去除所有空格
 * - 去除符号：去除所有符号
 * - 去除中文：去除所有中文字符
 * - 去除英文：去除所有英文字符
 */

import { getSettings } from "./storage.js";

// ============================================================================
// 配置
// ============================================================================

let CONFIG = {
  namingRemoveSymbol: true, // 命名分词是否去除符号
};

export function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

export function getConfig() {
  return { ...CONFIG };
}

// ============================================================================
// 规则定义
// ============================================================================

export const RULES = {
  // 分词规则
  symbolSplit: {
    name: "符号分词",
    description: "符号放在上词尾，除非是成对符号的前一个",
    group: "split",
    order: 1,
  },
  whitespaceSplit: {
    name: "空格分词",
    description: "放前一词词尾",
    group: "split",
    order: 2,
  },
  newlineSplit: {
    name: "换行分词",
    description: "换行放前一词词尾",
    group: "split",
    order: 3,
  },
  chineseEnglishSplit: {
    name: "中英分词",
    description: "分离中文和英文",
    group: "split",
    order: 4,
  },
  uppercaseSplit: {
    name: "大写分词",
    description: "将每个大写字母分成一格，与命名分词不同",
    group: "split",
    order: 5,
  },
  namingSplit: {
    name: "命名分词",
    description: "各类命名法分格（驼峰、蛇形等）",
    group: "split",
    order: 6,
    dependsOn: ["uppercaseSplit"],
  },
  digitSplit: {
    name: "数字分词",
    description: "数字单独分出来",
    group: "split",
    order: 7,
  },

  // 去除规则
  removeWhitespace: {
    name: "去除空格",
    description: "去除所有空格",
    group: "remove",
    order: 8,
  },
  removeSymbols: {
    name: "去除符号",
    description: "去除所有符号",
    group: "remove",
    order: 9,
    conflictsWith: ["symbolSplit"],
  },
  removeChinese: {
    name: "去除中文",
    description: "去除所有中文字符",
    group: "remove",
    order: 10,
  },
  removeEnglish: {
    name: "去除英文",
    description: "去除所有英文字符",
    group: "remove",
    order: 11,
  },
};

// ============================================================================
// 互斥组定义
// ============================================================================

const MUTEX_GROUPS = {
  // 去除类规则互斥（可选多个，但通常去留一类）
  removeGroup: [
    "removeWhitespace",
    "removeSymbols",
    "removeChinese",
    "removeEnglish",
  ],
};

// ============================================================================
// 依赖关系定义
// ============================================================================

const DEPENDENCIES = {
  // 命名分词需要大写分词
  namingSplit: ["uppercaseSplit"],
  // 注意：removeSymbols 不再依赖 symbolSplit，这是错误的逻辑
  // 去除符号和符号分词是互斥的，不应有依赖关系
};

// ============================================================================
// 工具函数
// ============================================================================

function flattenArray(arr) {
  return arr
    .flat(Infinity)
    .filter((item) => item && typeof item === "string" && item.length > 0);
}

// ============================================================================
// 分词规则实现
// ============================================================================

/**
 * 符号分词规则
 * 符号放在上词尾，除非是成对符号的前一个
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applySymbolSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;

    const pairs = [
      { open: "(", close: ")", nested: true },
      { open: "[", close: "]", nested: true },
      { open: "{", close: "}", nested: true },
      { open: "<", close: ">", nested: true },
      { open: '"', close: '"', nested: false },
      { open: "'", close: "'", nested: false },
      { open: "`", close: "`", nested: false },
      { open: "«", close: "»", nested: true },
    ];

    const result = [];
    let buffer = "";
    let i = 0;

    while (i < text.length) {
      let matched = false;

      for (const pair of pairs) {
        if (text.substring(i).startsWith(pair.open)) {
          if (buffer) {
            result.push(buffer);
            buffer = "";
          }

          // 检查是否是成对符号的前一个
          const remaining = text.substring(i + pair.open.length);
          let isFirstOfPair = true;

          for (const p of pairs) {
            if (remaining.startsWith(p.open)) {
              isFirstOfPair = false;
              break;
            }
          }

          if (!isFirstOfPair) {
            buffer += pair.open;
          } else {
            result.push(pair.open);
          }

          i += pair.open.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        buffer += text[i];
        i++;
      }
    }

    if (buffer) {
      result.push(buffer);
    }

    return result.filter((s) => s.length > 0);
  });
}

/**
 * 空格分词规则
 * 放前一词词尾
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyWhitespaceSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.split(/(\s+)/).filter(Boolean);
  });
}

/**
 * 换行分词规则
 * 放前一词词尾
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyNewlineSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.split(/(\n|\r\n|\r)/).filter(Boolean);
  });
}

/**
 * 中英分词规则
 * 分离中文和英文
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyChineseEnglishSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.split(/([a-zA-Z]+|[\u4e00-\u9fa5]+)/).filter(Boolean);
  });
}

/**
 * 大写分词规则
 * 将每个大写字母分开，与命名分词不同
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyUppercaseSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.split(/(?=[A-Z])/).filter((s) => s.length > 0);
  });
}

/**
 * 命名分词规则
 * 各类命名法分格（驼峰、蛇形、 kabab）
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyNamingSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;

    let processed = text;

    if (CONFIG.namingRemoveSymbol) {
      processed = processed.replace(/[_\-]/g, " ");
    }

    const parts = processed.split(/[_\-\s]+/).filter(Boolean);

    return parts.flatMap((part) => {
      const tokens = [];

      // 检测驼峰边界
      let buffer = "";
      for (let i = 0; i < part.length; i++) {
        const char = part[i];
        const nextChar = part[i + 1];

        if (/[a-z]/.test(buffer[buffer.length - 1]) && /[A-Z]/.test(char)) {
          if (buffer) {
            tokens.push(buffer);
            buffer = char;
          } else {
            buffer += char;
          }
        } else if (
          /[A-Z]/.test(char) &&
          /[A-Z]/.test(nextChar) &&
          nextChar &&
          /[a-z]/.test(part[i + 2])
        ) {
          buffer += char;
        } else {
          buffer += char;
        }
      }

      if (buffer) {
        tokens.push(buffer);
      }

      return tokens.filter((t) => t.length > 0);
    });
  });
}

/**
 * 数字分词规则
 * 数字单独分出来
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyDigitSplit(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.split(/(\d+)/).filter(Boolean);
  });
}

// ============================================================================
// 去除规则实现
// ============================================================================

/**
 * 去除空格规则
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyRemoveWhitespace(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.replace(/\s+/g, "");
  });
}

/**
 * 去除符号规则
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyRemoveSymbols(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.replace(/[^\w\s\u4e00-\u9fa5]/g, "");
  });
}

/**
 * 去除中文规则
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyRemoveChinese(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.replace(/[\u4e00-\u9fa5]/g, "");
  });
}

/**
 * 去除英文规则
 * @param {Array} input 输入数组
 * @returns {Array} 处理结果
 */
export function applyRemoveEnglish(input) {
  return input.map((text) => {
    if (!text || typeof text !== "string") return text;
    return text.replace(/[a-zA-Z]+/g, "");
  });
}

// ============================================================================
// 依赖与互斥处理
// ============================================================================

/**
 * 处理依赖关系
 * 选A必须选B
 * @param {Array} rules 原始规则列表
 * @returns {Array} 处理后的规则列表
 */
export function resolveDependencies(rules) {
  let result = [...rules];

  for (const [rule, deps] of Object.entries(DEPENDENCIES)) {
    if (result.includes(rule)) {
      for (const dep of deps) {
        if (!result.includes(dep)) {
          result.push(dep);
        }
      }
    }
  }

  return [...new Set(result)];
}

/**
 * 检测并处理互斥冲突
 * "去除符号" + "符号分词" 同时启用时，文本保持在去除符号
 * @param {Array} rules 规则列表
 * @returns {object} { rules, conflictAction }
 */
export function checkMutexConflicts(rules) {
  const hasRemoveSymbols = rules.includes("removeSymbols");
  const hasSymbolSplit = rules.includes("symbolSplit");

  if (hasRemoveSymbols && hasSymbolSplit) {
    return {
      rules: rules.filter((r) => r !== "symbolSplit"),
      conflictAction: "skipSymbolSplit",
      message: "去除符号与符号分词冲突，跳过符号分词",
    };
  }

  return { rules, conflictAction: null };
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 多规则组合分词
 * @param {string} text 输入文本
 * @param {Array} rules 启用的规则列表
 * @returns {Promise<object>} 处理结果 { result, rules, conflicts }
 */
export async function multiRuleAnalyze(text, rules = []) {
  if (!text || !text.trim()) {
    return { result: [], rules: [], conflicts: [] };
  }

  const settings = await getSettings();
  const ts = settings.tokenizerSettings || {};

  if (ts.namingRemoveSymbol !== undefined) {
    CONFIG.namingRemoveSymbol = ts.namingRemoveSymbol;
  }

  let currentRules = [...rules];
  const conflicts = [];

  // 处理互斥冲突
  const mutexResult = checkMutexConflicts(currentRules);
  currentRules = mutexResult.rules;
  if (mutexResult.conflictAction) {
    conflicts.push({
      rule: "symbolSplit",
      action: "skipped",
      reason: mutexResult.message,
    });
  }

  // 处理依赖关系
  currentRules = resolveDependencies(currentRules);

  let result = [text];

  // 分词规则（按顺序执行）
  const splitRules = currentRules.filter((r) => RULES[r]?.group === "split");
  splitRules.sort((a, b) => (RULES[a]?.order || 0) - (RULES[b]?.order || 0));

  for (const rule of splitRules) {
    switch (rule) {
      case "symbolSplit":
        result = applySymbolSplit(result);
        break;
      case "whitespaceSplit":
        result = applyWhitespaceSplit(result);
        break;
      case "newlineSplit":
        result = applyNewlineSplit(result);
        break;
      case "chineseEnglishSplit":
        result = applyChineseEnglishSplit(result);
        break;
      case "uppercaseSplit":
        result = applyUppercaseSplit(result);
        break;
      case "namingSplit":
        result = applyNamingSplit(result);
        break;
      case "digitSplit":
        result = applyDigitSplit(result);
        break;
    }
    result = flattenArray(result);
  }

  // 去除规则（按顺序执行）
  const removeRules = currentRules.filter((r) => RULES[r]?.group === "remove");
  removeRules.sort((a, b) => (RULES[a]?.order || 0) - (RULES[b]?.order || 0));

  for (const rule of removeRules) {
    switch (rule) {
      case "removeWhitespace":
        result = applyRemoveWhitespace(result);
        break;
      case "removeSymbols":
        result = applyRemoveSymbols(result);
        break;
      case "removeChinese":
        result = applyRemoveChinese(result);
        break;
      case "removeEnglish":
        result = applyRemoveEnglish(result);
        break;
    }
    result = flattenArray(result);
  }

  result = result.filter(
    (item) => item && typeof item === "string" && item.length > 0,
  );

  return {
    result,
    rules: currentRules,
    conflicts,
    stats: {
      inputLength: text.length,
      outputCount: result.length,
      avgLength:
        result.length > 0 ? Math.round(text.length / result.length) : 0,
    },
  };
}

/**
 * 快速分词（仅返回结果数组）
 * @param {string} text 输入文本
 * @param {Array} rules 启用的规则列表
 * @returns {Promise<Array>} 分词结果
 */
export async function quickAnalyze(text, rules = []) {
  const { result } = await multiRuleAnalyze(text, rules);
  return result;
}

/**
 * 应用单个规则
 * 用于按钮式交互，每次只应用一个规则
 * @param {string|Array} input 输入文本或数组
 * @param {string} rule 规则名称
 * @returns {object} 处理结果 { result, hasConflict, conflictMessage }
 */
export function applySingleRule(input, rule) {
  if (!input) {
    return { result: [], hasConflict: false, conflictMessage: null };
  }

  // 确保输入是数组
  let result = Array.isArray(input) ? input : [input];
  let hasConflict = false;
  let conflictMessage = null;

  // 检查矛盾情况
  if (rule === "symbolSplit") {
    // 检查是否已经去除了符号
    const hasRemoveSymbols = result.some((text) => {
      if (typeof text !== "string") return false;
      // 如果文本中已经没有符号了，说明已经执行过去除符号
      return !/[^\w\s\u4e00-\u9fa5]/.test(text);
    });
    if (hasRemoveSymbols) {
      hasConflict = true;
      conflictMessage = "文本已去除符号，符号分词无效果";
    }
  }

  // 应用规则
  switch (rule) {
    case "symbolSplit":
      result = applySymbolSplit(result);
      break;
    case "whitespaceSplit":
      result = applyWhitespaceSplit(result);
      break;
    case "newlineSplit":
      result = applyNewlineSplit(result);
      break;
    case "chineseEnglishSplit":
      result = applyChineseEnglishSplit(result);
      break;
    case "uppercaseSplit":
      result = applyUppercaseSplit(result);
      break;
    case "namingSplit":
      result = applyNamingSplit(result);
      break;
    case "digitSplit":
      result = applyDigitSplit(result);
      break;
    case "removeWhitespace":
      result = applyRemoveWhitespace(result);
      break;
    case "removeSymbols":
      result = applyRemoveSymbols(result);
      break;
    case "removeChinese":
      result = applyRemoveChinese(result);
      break;
    case "removeEnglish":
      result = applyRemoveEnglish(result);
      break;
    default:
      return {
        result,
        hasConflict: false,
        conflictMessage: `未知规则: ${rule}`,
      };
  }

  result = flattenArray(result);
  result = result.filter(
    (item) => item && typeof item === "string" && item.length > 0,
  );

  return { result, hasConflict, conflictMessage };
}

// ============================================================================
// 导出
// ============================================================================

// 注意：所有函数和常量已在前面单独导出，此处不再重复导出
