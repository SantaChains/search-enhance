/**
 * 工具模块统一导出
 * 功能：集中导出所有工具模块，简化导入路径
 * 入参：无
 * 出参：各模块导出
 */

// 存储管理
export {
  getSettings,
  saveSettings,
  STORAGE_KEYS,
  checkStorageQuota,
  autoCleanupStorage
} from './storage.js';

// 剪贴板历史
export { clipboardHistoryManager } from './clipboardHistory.js';

// 链接历史
export { linkHistoryManager } from './linkHistory.js';

// 文本处理
export { processTextExtraction, processTextInput } from './textProcessor.js';

// 多规则分析
export { multiRuleAnalyzer } from './multiRuleAnalyzer.js';

// AI 适配器
export { aiAdapter, validateBaseURL } from './aiAdapter.js';

// 分析器
export {
  smartAnalyze,
  chineseAnalyze,
  englishAnalyze,
  sentenceAnalyze,
  halfSentenceAnalyze,
  charBreak,
  removeSymbolsAnalyze
} from './analyzers/index.js';

// 中文分词
export { tokenize } from './fastCWS.js';

// 代码分析
export { codeAnalyze as analyzeCode } from './codeAnalyzer.js';

// 导入导出
export { exportImportSchema } from './exportImportSchema.js';

// Token 历史
export { tokenHistoryManager } from './tokenHistory.js';

// 通用工具
export {
  generateId,
  debounce,
  throttle,
  formatDate,
  formatRelativeTime,
  escapeHtml,
  copyToClipboard,
  readFromClipboard,
  isBrowserHomePage,
  truncate,
  deepClone,
  isEmpty
} from './commonUtils.js';

// 日志管理
export { logger, createLogger, setLogLevel, setLogEnabled } from './logger.js';

// 性能监控
export {
  performanceMonitor,
  startTimer,
  endTimer,
  getPerformanceReport,
  METRICS
} from './performanceMonitor.js';

// 错误上报
export {
  errorReporter,
  captureError,
  withErrorCapture,
  getErrorStats,
  ERROR_TYPES
} from './errorReporter.js';
