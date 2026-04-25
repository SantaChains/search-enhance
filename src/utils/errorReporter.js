/**
 * 错误上报和管理工具
 * 功能：收集、分类和上报错误信息
 * 入参：无
 * 出参：errorReporter 实例
 */

import { createLogger } from './logger.js';

const logger = createLogger('[ErrorReporter]');

// 错误类型定义
const ERROR_TYPES = {
  NETWORK: 'network',
  STORAGE: 'storage',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  RUNTIME: 'runtime',
  UNKNOWN: 'unknown'
};

// 错误严重级别
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// 错误存储器
const errorStorage = {
  errors: [],
  maxErrors: 50,
  lastReportTime: null
};

// 配置
const CONFIG = {
  autoReport: false, // 是否自动上报（扩展中暂不启用）
  maxErrors: 50,
  dedupeWindow: 5000, // 5 秒内去重
  reportEndpoint: null // 上报端点（可选）
};

/**
 * 错误去重检查
 * @param {string} errorMessage - 错误消息
 * @param {string} errorType - 错误类型
 * @returns {boolean} 是否应该跳过
 */
function shouldSkipDuplicate(errorMessage, errorType) {
  const now = Date.now();
  const recentErrors = errorStorage.errors.filter((e) => now - e.timestamp < CONFIG.dedupeWindow);

  return recentErrors.some((e) => e.message === errorMessage && e.type === errorType);
}

/**
 * 记录错误
 * @param {Error|string} error - 错误对象或消息
 * @param {string} context - 错误发生的上下文
 * @param {object} metadata - 额外元数据
 */
export function captureError(error, context, metadata = {}) {
  const errorObj = {
    id: generateErrorId(),
    timestamp: Date.now(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    type: classifyError(error),
    severity: classifySeverity(error),
    context,
    metadata: {
      userAgent: navigator.userAgent,
      url: window?.location?.href || 'extension',
      ...metadata
    },
    reported: false
  };

  // 去重检查
  if (shouldSkipDuplicate(errorObj.message, errorObj.type)) {
    logger.debug('跳过重复错误:', errorObj.message);
    return errorObj.id;
  }

  // 存储错误
  errorStorage.errors.push(errorObj);

  // 限制存储数量
  if (errorStorage.errors.length > errorStorage.maxErrors) {
    errorStorage.errors.shift();
  }

  // 记录日志
  logError(errorObj);

  // 自动上报（如果启用）
  if (CONFIG.autoReport && CONFIG.reportEndpoint) {
    reportError(errorObj).catch(() => {});
  }

  return errorObj.id;
}

/**
 * 异步包装器，自动捕获错误
 * @param {Function} fn - 异步函数
 * @param {string} context - 上下文
 * @param {object} metadata - 元数据
 * @returns {Promise} 包装后的 Promise
 */
export async function withErrorCapture(fn, context, metadata = {}) {
  try {
    return await fn();
  } catch (error) {
    captureError(error, context, metadata);
    throw error;
  }
}

/**
 * 获取错误统计
 * @returns {object} 错误统计信息
 */
export function getErrorStats() {
  const now = Date.now();
  const recentErrors = errorStorage.errors.filter(
    (e) => now - e.timestamp < 3600000 // 1 小时内
  );

  const byType = {};
  const bySeverity = {};

  recentErrors.forEach((error) => {
    byType[error.type] = (byType[error.type] || 0) + 1;
    bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
  });

  return {
    total: errorStorage.errors.length,
    recent: recentErrors.length,
    byType,
    bySeverity,
    lastErrorTime:
      errorStorage.errors.length > 0
        ? errorStorage.errors[errorStorage.errors.length - 1].timestamp
        : null
  };
}

/**
 * 获取错误列表
 * @param {number} limit - 限制数量
 * @param {string} filter - 过滤条件（type 或 severity）
 * @returns {Array} 错误列表
 */
export function getErrors(limit = 10, filter = null) {
  let errors = [...errorStorage.errors];

  if (filter) {
    errors = errors.filter((e) => e.type === filter || e.severity === filter);
  }

  errors.sort((a, b) => b.timestamp - a.timestamp);
  return errors.slice(0, limit);
}

/**
 * 清空错误存储
 */
export function clearErrors() {
  errorStorage.errors = [];
  logger.info('错误存储已清空');
}

/**
 * 分类错误类型
 * @param {Error} error - 错误对象
 * @returns {string} 错误类型
 */
function classifyError(error) {
  if (!(error instanceof Error)) {
    return ERROR_TYPES.UNKNOWN;
  }

  const message = error.message.toLowerCase();

  // 网络错误
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    error.name === 'NetworkError'
  ) {
    return ERROR_TYPES.NETWORK;
  }

  // 存储错误
  if (
    message.includes('storage') ||
    message.includes('quota') ||
    error.name === 'QuotaExceededError'
  ) {
    return ERROR_TYPES.STORAGE;
  }

  // 权限错误
  if (
    message.includes('permission') ||
    message.includes('denied') ||
    error.name === 'NotAllowedError'
  ) {
    return ERROR_TYPES.PERMISSION;
  }

  // 验证错误
  if (message.includes('invalid') || message.includes('validation') || error.name === 'TypeError') {
    return ERROR_TYPES.VALIDATION;
  }

  return ERROR_TYPES.RUNTIME;
}

/**
 * 分类错误严重级别
 * @param {Error} error - 错误对象
 * @returns {string} 严重级别
 */
function classifySeverity(error) {
  if (!(error instanceof Error)) {
    return SEVERITY_LEVELS.LOW;
  }

  const errorType = classifyError(error);

  // 严重错误
  if ([ERROR_TYPES.STORAGE, ERROR_TYPES.PERMISSION].includes(errorType)) {
    return SEVERITY_LEVELS.HIGH;
  }

  // 网络错误通常是中级
  if (errorType === ERROR_TYPES.NETWORK) {
    return SEVERITY_LEVELS.MEDIUM;
  }

  // 其他为低级
  return SEVERITY_LEVELS.LOW;
}

/**
 * 记录错误日志
 * @param {object} errorObj - 错误对象
 */
function logError(errorObj) {
  const logFn = errorObj.severity === SEVERITY_LEVELS.CRITICAL ? logger.error : logger.warn;

  logFn(`[${errorObj.type}] ${errorObj.message}`, {
    context: errorObj.context,
    severity: errorObj.severity
  });
}

/**
 * 上报错误到远程服务器
 * @param {object} errorObj - 错误对象
 */
async function reportError(errorObj) {
  if (!CONFIG.reportEndpoint) {
    return;
  }

  try {
    const response = await fetch(CONFIG.reportEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errors: [errorObj],
        timestamp: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version
      })
    });

    if (response.ok) {
      errorObj.reported = true;
      logger.info('错误已上报:', errorObj.id);
    }
  } catch (e) {
    logger.debug('错误上报失败:', e.message);
  }
}

/**
 * 生成错误 ID
 * @returns {string} 错误 ID
 */
function generateErrorId() {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 更新配置
 * @param {object} newConfig - 新配置
 */
export function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

/**
 * 获取配置
 * @returns {object} 当前配置
 */
export function getConfig() {
  return { ...CONFIG };
}

// 导出常量
export { ERROR_TYPES, SEVERITY_LEVELS };

// 导出单例
export const errorReporter = {
  captureError,
  withErrorCapture,
  getErrorStats,
  getErrors,
  clearErrors,
  updateConfig,
  getConfig
};

export default errorReporter;
