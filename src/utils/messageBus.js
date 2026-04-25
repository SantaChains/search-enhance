/**
 * 统一消息总线
 * 功能: 统一管理所有组件间通信，简化通信逻辑
 * 入参: 无
 * 出参: MessageBus 实例
 */

class MessageBus {
  constructor() {
    this.listeners = new Map();
    this.port = null;
    this.setupListeners();
  }

  /**
   * 设置消息监听
   */
  setupListeners() {
    // 监听 sendMessage
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 保持通道开放
    });

    // 监听 Port 连接
    chrome.runtime.onConnect.addListener((port) => {
      this.handlePortConnect(port);
    });
  }

  /**
   * 处理消息
   */
  async handleMessage(message, sender, sendResponse) {
    const { action, ...data } = message;
    const handlers = this.listeners.get(action);

    if (handlers) {
      try {
        const results = await Promise.all(handlers.map((handler) => handler(data, sender)));
        sendResponse({ success: true, results });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: '无处理程序' });
    }
  }

  /**
   * 处理 Port 连接
   */
  handlePortConnect(port) {
    this.port = port;

    port.onMessage.addListener((message) => {
      const { action, ...data } = message;
      const handlers = this.listeners.get(action);

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(data, { port: true });
          } catch (e) {
            console.error('Port 消息处理失败:', e);
          }
        });
      }
    });

    port.onDisconnect.addListener(() => {
      this.port = null;
    });
  }

  /**
   * 订阅消息
   * 入参: action - 消息类型, handler - 处理函数
   * 出参: unsubscribe 函数
   */
  on(action, handler) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, []);
    }
    this.listeners.get(action).push(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = this.listeners.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  /**
   * 发送消息（sendMessage）
   */
  async send(action, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        action,
        ...data
      });
      return response;
    } catch (error) {
      console.error('发送消息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 广播消息（通过 Port）
   */
  broadcast(action, data = {}) {
    if (this.port) {
      try {
        this.port.postMessage({ action, ...data });
      } catch (e) {
        console.error('广播消息失败:', e);
      }
    }
  }

  /**
   * 发送给指定标签页
   */
  async sendToTab(tabId, action, data = {}) {
    try {
      await chrome.tabs.sendMessage(tabId, { action, ...data });
    } catch (e) {
      console.error('发送给标签页失败:', e);
    }
  }
}

export const messageBus = new MessageBus();
