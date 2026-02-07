/**
 * 随机分词器 - Random Analyzer
 *
 * 功能：
 * - 将所有字符随机分成设定长度的字符串（1-10字符）
 * - 从头到尾处理，支持刷新重跑，结果每次不同
 * - 结果不保存到历史栈，不可回溯
 *
 * 随机分词配置（来自全局设置）：
 * - randomMinLength: 最小分词长度（默认1）
 * - randomMaxLength: 最大分词长度（默认10）
 * - chaosMinTokens: 最小分词数量（默认3，用于检测是否需要重新分配）
 */

// ============================================================================
// 配置
// ============================================================================

let CONFIG = {
  randomMinLength: 1,
  randomMaxLength: 10,
  chaosMinTokens: 3,
};

/**
 * 更新配置
 * @param {object} newConfig 新配置
 */
export function updateRandomConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

/**
 * 获取当前配置
 * @returns {object} 当前配置
 */
export function getRandomConfig() {
  return { ...CONFIG };
}

// ============================================================================
// Fisher-Yates 洗牌算法
// ============================================================================

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// 随机分词核心算法
// ============================================================================

function getRandomLength() {
  return Math.floor(
    Math.random() * (CONFIG.randomMaxLength - CONFIG.randomMinLength + 1)
  ) + CONFIG.randomMinLength;
}

/**
 * 随机分词主函数
 * @param {string} text 输入文本
 * @param {object} options 配置选项
 * @returns {Array} 随机分词结果
 */
export function randomAnalyze(text, options = {}) {
  if (!text || !text.trim()) return [];

  const minLen = options.minLength ?? CONFIG.randomMinLength;
  const maxLen = options.maxLength ?? CONFIG.randomMaxLength;
  const minTokens = options.minTokens ?? CONFIG.chaosMinTokens;

  // 保留所有字符（包括空格、换行等），保持原始顺序
  const chars = text.split('');

  // 随机分词（保持字符原始顺序，只随机决定切割位置）
  const result = [];
  let i = 0;
  const currentMaxLen = Math.min(maxLen, chars.length);

  while (i < chars.length) {
    // 随机决定当前分词的长度
    const remainingChars = chars.length - i;
    const availableMaxLen = Math.min(currentMaxLen, remainingChars);
    
    // 确保至少能分出 minTokens 个词
    const remainingTokensNeeded = Math.max(1, minTokens - result.length);
    const maxAllowedLen = Math.floor(remainingChars / remainingTokensNeeded);
    const actualMaxLen = Math.min(availableMaxLen, Math.max(minLen, maxAllowedLen));
    
    const length = Math.floor(
      Math.random() * (actualMaxLen - minLen + 1)
    ) + minLen;
    
    const chunk = chars.slice(i, i + length).join('');
    if (chunk) result.push(chunk);
    i += length;
  }

  // 如果分词数量太少，重新分配
  if (result.length < minTokens && chars.length >= minTokens * minLen) {
    return redistribute(chars, minTokens, minLen, maxLen);
  }

  return result;
}

/**
 * 重新分配算法（当分词数量不足时）
 * @param {Array} chars 字符数组
 * @param {number} minTokens 最小分词数量
 * @param {number} minLen 最小长度
 * @param {number} maxLen 最大长度
 * @returns {Array} 重新分配后的结果
 */
function redistribute(chars, minTokens, minLen, maxLen) {
  const targetChunkSize = Math.ceil(chars.length / minTokens);
  const actualChunkSize = Math.max(minLen, Math.min(maxLen, targetChunkSize));

  const result = [];
  for (let i = 0; i < chars.length; i += actualChunkSize) {
    const chunk = chars.slice(i, i + actualChunkSize).join('');
    if (chunk) result.push(chunk);
  }

  return result;
}

/**
 * 生成随机种子（用于调试或特定场景）
 * @returns {string} 随机种子
 */
export function generateRandomSeed() {
  return Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// 导出
// ============================================================================

// 注意：randomAnalyze 已在第70行导出，此处不再重复导出
