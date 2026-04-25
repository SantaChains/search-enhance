/**
 * 统一日志管理系统
 * 功能：提供分级别的日志输出，支持生产环境静默模式
 * 入参：无
 * 出参：logger 实例
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

class Logger {
  constructor(prefix = '', defaultLevel = 'warn') {
    this.prefix = prefix;
    this.level = defaultLevel;
    this.enabled = true;
  }

  /**
   * 设置日志级别
   * @param {string} level - 日志级别 (debug|info|warn|error|none)
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  /**
   * 启用/禁用日志
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * 检查是否应该输出指定级别的日志
   * @param {string} level - 日志级别
   * @returns {boolean} 是否应该输出
   */
  shouldLog(level) {
    if (!this.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  /**
   * 格式化消息
   * @param {string} msg - 消息内容
   * @returns {string} 格式化后的消息
   */
  formatMessage(msg) {
    return this.prefix ? `${this.prefix} ${msg}` : msg;
  }

  /**
   * Debug 级别日志
   * @param {string} msg - 消息内容
   * @param  {...any} args - 额外参数
   */
  debug(msg, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${this.formatMessage(msg)}`, ...args);
    }
  }

  /**
   * Info 级别日志
   * @param {string} msg - 消息内容
   * @param  {...any} args - 额外参数
   */
  info(msg, ...args) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${this.formatMessage(msg)}`, ...args);
    }
  }

  /**
   * Warn 级别日志
   * @param {string} msg - 消息内容
   * @param  {...any} args - 额外参数
   */
  warn(msg, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${this.formatMessage(msg)}`, ...args);
    }
  }

  /**
   * Error 级别日志
   * @param {string} msg - 消息内容
   * @param  {...any} args - 额外参数
   */
  error(msg, ...args) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${this.formatMessage(msg)}`, ...args);
    }
  }

  /**
   * 创建带前缀的子日志器
   * @param {string} childPrefix - 子前缀
   * @returns {Logger} 新的 Logger 实例
   */
  child(childPrefix) {
    const fullPrefix = this.prefix ? `${this.prefix} ${childPrefix}` : childPrefix;
    const childLogger = new Logger(fullPrefix, this.level);
    childLogger.enabled = this.enabled;
    return childLogger;
  }
}

// 创建全局日志器实例
const globalLogger = new Logger('[Decide Search]', 'warn');

// 快捷方法
export const debug = (msg, ...args) => globalLogger.debug(msg, ...args);
export const info = (msg, ...args) => globalLogger.info(msg, ...args);
export const warn = (msg, ...args) => globalLogger.warn(msg, ...args);
export const error = (msg, ...args) => globalLogger.error(msg, ...args);

// 设置方法
export const setLogLevel = (level) => globalLogger.setLevel(level);
export const setLogEnabled = (enabled) => globalLogger.setEnabled(enabled);

// 创建子日志器
export const createLogger = (prefix) => globalLogger.child(prefix);

// 导出类和实例
export { Logger };
export default globalLogger;
