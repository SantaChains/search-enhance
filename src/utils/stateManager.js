/**
 * 统一状态管理模块
 * 提供跨组件状态同步和管理功能
 */

class StateManager {
  constructor() {
    this.listeners = new Map();
    this.state = {};
    this.storageKeys = {
      MONITORING: 'globalMonitoringEnabled',
      CLIPBOARD_CONTENT: 'globalClipboardContent',
      CLIPBOARD_VERSION: 'globalClipboardVersion'
    };
  }

  /**
   * 初始化状态
   */
  async init() {
    try {
      const result = await chrome.storage.local.get(Object.values(this.storageKeys));
      this.state = {
        monitoringEnabled: result[this.storageKeys.MONITORING] !== false,
        clipboardContent: result[this.storageKeys.CLIPBOARD_CONTENT] || '',
        clipboardVersion: result[this.storageKeys.CLIPBOARD_VERSION] || ''
      };
      return this.state;
    } catch (error) {
      console.error('状态初始化失败:', error);
      return this.getDefaultState();
    }
  }

  /**
   * 获取默认状态
   */
  getDefaultState() {
    return {
      monitoringEnabled: true,
      clipboardContent: '',
      clipboardVersion: ''
    };
  }

  /**
   * 获取当前状态
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 更新状态
   */
  async setState(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };

    try {
      const storageUpdates = {};
      if (updates.monitoringEnabled !== undefined) {
        storageUpdates[this.storageKeys.MONITORING] = updates.monitoringEnabled;
      }
      if (updates.clipboardContent !== undefined) {
        storageUpdates[this.storageKeys.CLIPBOARD_CONTENT] = updates.clipboardContent;
      }
      if (updates.clipboardVersion !== undefined) {
        storageUpdates[this.storageKeys.CLIPBOARD_VERSION] = updates.clipboardVersion;
      }

      if (Object.keys(storageUpdates).length > 0) {
        await chrome.storage.local.set(storageUpdates);
      }
    } catch (error) {
      console.error('状态保存失败:', error);
      this.state = prevState;
      return false;
    }

    this.notifyListeners(updates, prevState);
    return true;
  }

  /**
   * 订阅状态变化
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  /**
   * 通知监听器
   */
  notifyListeners(updates, prevState) {
    for (const [key, value] of Object.entries(updates)) {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach((callback) => {
          try {
            callback(value, prevState[key]);
          } catch (error) {
            console.error(`状态监听器执行失败 [${key}]:`, error);
          }
        });
      }
    }

    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach((callback) => {
        try {
          callback(updates, prevState);
        } catch (error) {
          console.error('全局状态监听器执行失败:', error);
        }
      });
    }
  }

  /**
   * 同步到background
   */
  async syncToBackground(action, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        action,
        ...data
      });
      return response;
    } catch (error) {
      console.error('同步到background失败:', error);
      return null;
    }
  }

  /**
   * 重置状态
   */
  async reset() {
    const defaultState = this.getDefaultState();
    await this.setState(defaultState);
    return defaultState;
  }
}

/**
 * 剪贴板监控管理器
 */
class ClipboardMonitor {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.pollInterval = null;
    this.isPolling = false;
    this.lastContent = '';
    this.listeners = new Set();
  }

  /**
   * 开始监控
   */
  async start(pollInterval = 1000) {
    if (this.isPolling) return true;

    try {
      await this.checkPermission();
      this.isPolling = true;
      this.lastContent = this.stateManager.getState().clipboardContent || '';

      this.pollInterval = setInterval(() => this.poll(), pollInterval);
      return true;
    } catch (error) {
      console.error('启动剪贴板监控失败:', error);
      this.isPolling = false;
      return false;
    }
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  /**
   * 检查权限
   */
  async checkPermission() {
    try {
      await navigator.clipboard.readText();
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('CLIPBOARD_PERMISSION_DENIED');
      }
      return true;
    }
  }

  /**
   * 轮询剪贴板
   */
  async poll() {
    if (!this.isPolling) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== this.lastContent) {
        const newVersion = this.generateVersion();
        this.lastContent = text;

        await this.stateManager.setState({
          clipboardContent: text,
          clipboardVersion: newVersion
        });

        this.notifyListeners({
          content: text,
          version: newVersion
        });
      }
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        this.stop();
        this.notifyListeners({ error: 'PERMISSION_DENIED' }, true);
      }
    }
  }

  /**
   * 生成版本号
   */
  generateVersion() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 订阅变化
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 通知监听器
   */
  notifyListeners(data, isError = false) {
    this.listeners.forEach((callback) => {
      try {
        callback(data, isError);
      } catch (error) {
        console.error('剪贴板监听器执行失败:', error);
      }
    });
  }
}

/**
 * 消息总线 - 跨组件通信
 */
class MessageBus {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * 发送消息
   */
  async send(action, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({ action, ...data });
      return response;
    } catch (error) {
      console.error('消息发送失败:', error);
      return null;
    }
  }

  /**
   * 订阅消息
   */
  on(action, handler) {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, new Set());
    }
    this.handlers.get(action).add(handler);

    const chromeHandler = (request, sender, sendResponse) => {
      if (request.action === action) {
        handler(request, sender, sendResponse);
      }
    };

    chrome.runtime.onMessage.addListener(chromeHandler);

    return () => {
      this.handlers.get(action).delete(handler);
      chrome.runtime.onMessage.removeListener(chromeHandler);
    };
  }

  /**
   * 广播消息到所有组件
   */
  async broadcast(action, data = {}) {
    try {
      await chrome.runtime.sendMessage({ action, ...data });
    } catch (error) {
      // 忽略广播错误
    }
  }
}

/**
 * 统一错误处理器
 */
class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
  }

  /**
   * 记录错误
   */
  log(error, context = {}) {
    const errorEntry = {
      message: error.message || String(error),
      stack: error.stack || '',
      context,
      timestamp: new Date().toISOString()
    };

    this.errorLog.push(errorEntry);

    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    console.error('[ErrorHandler]', errorEntry);
  }

  /**
   * 获取错误日志
   */
  getLog() {
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  clear() {
    this.errorLog = [];
  }

  /**
   * 全局错误捕获
   */
  setupGlobalHandler() {
    window.onerror = (message, source, lineno, colno, error) => {
      this.log(error || new Error(String(message)), {
        source,
        lineno,
        colno,
        type: 'unhandled'
      });
      return false;
    };

    window.onunhandledrejection = (event) => {
      this.log(event.reason || new Error('Unhandled Promise Rejection'), {
        type: 'unhandledPromise'
      });
    };
  }
}

// 导出单例实例
const stateManager = new StateManager();
const messageBus = new MessageBus();
const errorHandler = new ErrorHandler();

export { stateManager, messageBus, errorHandler, StateManager, ClipboardMonitor, MessageBus, ErrorHandler };

export default {
  stateManager,
  messageBus,
  errorHandler
};
