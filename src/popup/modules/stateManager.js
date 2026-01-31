// src/popup/modules/stateManager.js
// 状态管理模块

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[StateManager] ${message}`, ...args),
    error: (message, ...args) => console.error(`[StateManager] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[StateManager] ${message}`, ...args)
};

class StateManager {
    constructor() {
        this.state = {
            settings: null,
            splitItemsState: [],
            clipboardMonitoring: false,
            lastClipboardContent: '',
            clipboardInterval: null,
            linkHistory: [],
            // 多格式分析状态
            multiFormatState: {
                originalText: '',
                processingHistory: [],
                currentIndex: -1
            },
            // 剪贴板历史状态
            clipboardHistory: [],
            clipboardHistoryVisible: false,
            clipboardBatchMode: false,
            maxClipboardHistory: 100,
            selectedItems: new Set() // 批量选择的项目ID集合
        };
        this.listeners = new Map();
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前状态
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 获取状态的特定部分
     * @param {string} key - 状态键
     * @returns {*} 状态值
     */
    get(key) {
        return this.state[key];
    }

    /**
     * 设置状态
     * @param {string} key - 状态键
     * @param {*} value - 状态值
     */
    set(key, value) {
        if (this.state[key] !== value) {
            this.state[key] = value;
            this.notify(key, value);
        }
    }

    /**
     * 批量更新状态
     * @param {Object} updates - 状态更新对象
     */
    update(updates) {
        let hasChanges = false;
        const changedKeys = [];
        
        Object.entries(updates).forEach(([key, value]) => {
            if (this.state[key] !== value) {
                this.state[key] = value;
                hasChanges = true;
                changedKeys.push(key);
            }
        });
        
        if (hasChanges) {
            changedKeys.forEach(key => {
                this.notify(key, this.state[key]);
            });
        }
    }

    /**
     * 重置状态
     * @param {Object} newState - 新状态
     */
    reset(newState) {
        this.state = { ...this.state, ...newState };
        Object.keys(newState).forEach(key => {
            this.notify(key, newState[key]);
        });
    }

    /**
     * 订阅状态变更
     * @param {string} key - 状态键
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        
        this.listeners.get(key).add(callback);
        
        // 返回取消订阅函数
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    /**
     * 通知状态变更
     * @param {string} key - 状态键
     * @param {*} value - 新值
     */
    notify(key, value) {
        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(callback => {
                try {
                    callback(value);
                } catch (error) {
                    logger.error(`状态变更回调执行失败 [${key}]:`, error);
                }
            });
        }
        
        // 通知全局监听器
        const globalListeners = this.listeners.get('*');
        if (globalListeners) {
            globalListeners.forEach(callback => {
                try {
                    callback(key, value);
                } catch (error) {
                    logger.error('全局状态变更回调执行失败:', error);
                }
            });
        }
    }

    /**
     * 订阅所有状态变更
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribeAll(callback) {
        if (!this.listeners.has('*')) {
            this.listeners.set('*', new Set());
        }
        
        this.listeners.get('*').add(callback);
        
        // 返回取消订阅函数
        return () => {
            this.listeners.get('*')?.delete(callback);
        };
    }

    /**
     * 从存储加载状态
     * @returns {Promise<void>}
     */
    async loadFromStorage() {
        try {
            // 这里可以根据需要从 chrome.storage 加载状态
            const { lastClipboardContent, clipboardMonitoring } = await chrome.storage.local.get(['lastClipboardContent', 'clipboardMonitoring']);
            
            if (lastClipboardContent) {
                this.set('lastClipboardContent', lastClipboardContent);
            }
            
            if (clipboardMonitoring !== undefined) {
                this.set('clipboardMonitoring', clipboardMonitoring);
            }
            
            logger.info('状态已从存储加载');
        } catch (error) {
            logger.error('从存储加载状态失败:', error);
        }
    }

    /**
     * 保存状态到存储
     * @param {Array<string>} keys - 要保存的状态键数组
     * @returns {Promise<void>}
     */
    async saveToStorage(keys) {
        try {
            const data = {};
            keys.forEach(key => {
                data[key] = this.state[key];
            });
            
            await chrome.storage.local.set(data);
            logger.info('状态已保存到存储:', keys);
        } catch (error) {
            logger.error('保存状态到存储失败:', error);
        }
    }

    /**
     * 清空状态
     */
    clear() {
        const keys = Object.keys(this.state);
        this.state = {
            settings: null,
            splitItemsState: [],
            clipboardMonitoring: false,
            lastClipboardContent: '',
            clipboardInterval: null,
            linkHistory: [],
            multiFormatState: {
                originalText: '',
                processingHistory: [],
                currentIndex: -1
            },
            clipboardHistory: [],
            clipboardHistoryVisible: false,
            clipboardBatchMode: false,
            maxClipboardHistory: 100,
            selectedItems: new Set()
        };
        
        keys.forEach(key => {
            this.notify(key, this.state[key]);
        });
    }
}

// 导出单例
export default new StateManager();
