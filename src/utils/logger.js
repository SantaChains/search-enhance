/**
 * 日志工具模块
 * 提供统一的日志记录功能，支持不同级别和上下文
 */

// 日志级别
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// 配置
const config = {
    logLevel: LOG_LEVELS.INFO,
    enabled: true
};

/**
 * 日志记录器类
 */
export const logger = {
    /**
     * 设置日志级别
     * @param {string} level - 日志级别 (debug, info, warn, error)
     */
    setLevel(level) {
        const levelMap = {
            debug: LOG_LEVELS.DEBUG,
            info: LOG_LEVELS.INFO,
            warn: LOG_LEVELS.WARN,
            error: LOG_LEVELS.ERROR
        };
        config.logLevel = levelMap[level] || LOG_LEVELS.INFO;
    },
    
    /**
     * 启用或禁用日志
     * @param {boolean} enabled - 是否启用日志
     */
    setEnabled(enabled) {
        config.enabled = enabled;
    },
    
    /**
     * 调试日志
     * @param {string} message - 日志消息
     * @param {...any} args - 附加参数
     */
    debug(message, ...args) {
        if (config.enabled && config.logLevel <= LOG_LEVELS.DEBUG) {
            console.debug(`[SearchEnhance] DEBUG: ${message}`, ...args);
        }
    },
    
    /**
     * 信息日志
     * @param {string} message - 日志消息
     * @param {...any} args - 附加参数
     */
    info(message, ...args) {
        if (config.enabled && config.logLevel <= LOG_LEVELS.INFO) {
            console.info(`[SearchEnhance] INFO: ${message}`, ...args);
        }
    },
    
    /**
     * 警告日志
     * @param {string} message - 日志消息
     * @param {...any} args - 附加参数
     */
    warn(message, ...args) {
        if (config.enabled && config.logLevel <= LOG_LEVELS.WARN) {
            console.warn(`[SearchEnhance] WARN: ${message}`, ...args);
        }
    },
    
    /**
     * 错误日志
     * @param {string} message - 日志消息
     * @param {...any} args - 附加参数
     */
    error(message, ...args) {
        if (config.enabled && config.logLevel <= LOG_LEVELS.ERROR) {
            console.error(`[SearchEnhance] ERROR: ${message}`, ...args);
        }
    }
};

// 导出默认的logger实例
export default logger;