/**
 * 统一通知管理器
 * 功能: 统一管理所有通知，避免重复显示
 * 入参: 无
 * 出参: NotificationManager 实例
 */

class NotificationManager {
  constructor() {
    this.lastNotification = null;
    this.lastNotificationTime = 0;
    this.debounceMs = 1000; // 1秒内相同通知不重复显示
  }

  /**
   * 检查是否应该显示通知（去重）
   * 入参: message - 通知消息
   * 出参: boolean - 是否应该显示
   */
  shouldShow(message) {
    const now = Date.now();
    if (this.lastNotification === message && now - this.lastNotificationTime < this.debounceMs) {
      return false;
    }
    this.lastNotification = message;
    this.lastNotificationTime = now;
    return true;
  }

  /**
   * 显示通知（带去重）
   * 入参:
   *   - message: 消息内容
   *   - type: 类型 (success, error, warning, info)
   *   - context: 显示上下文 (popup, content, background)
   */
  show(message, type = 'info', context = 'auto') {
    if (!this.shouldShow(message)) {
      console.log('[通知去重] 跳过重复通知:', message);
      return;
    }

    // 根据上下文决定如何显示
    switch (context) {
      case 'popup':
        this.showInPopup(message, type);
        break;
      case 'content':
        this.showInContent(message, type);
        break;
      case 'background':
        this.showFromBackground(message, type);
        break;
      case 'auto':
      default:
        this.autoShow(message, type);
        break;
    }
  }

  /**
   * 自动选择显示位置
   */
  autoShow(message, type) {
    // 如果在 popup 中，显示在 popup
    if (typeof document !== 'undefined' && document.getElementById('popup-root')) {
      this.showInPopup(message, type);
      return;
    }

    // 如果在 content script 中，显示在页面
    if (typeof window !== 'undefined' && window.location?.href) {
      this.showInContent(message, type);
      return;
    }

    // 否则通过 background 转发
    this.showFromBackground(message, type);
  }

  /**
   * 在 popup 中显示通知
   */
  showInPopup(message, type) {
    const notification = document.getElementById('notification');
    if (!notification) {
      console.log('[Popup通知]', message);
      return;
    }
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3000);
  }

  /**
   * 在 content script 中显示通知
   */
  showInContent(message, type) {
    // 使用 content script 的通知系统
    if (window.__decideSearchGlobal?.showNotification) {
      window.__decideSearchGlobal.showNotification(message, type);
    } else {
      console.log('[Content通知]', message);
    }
  }

  /**
   * 从 background 发送通知
   */
  showFromBackground(message, type) {
    // 发送给所有 tabs
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs
          .sendMessage(tabs[0].id, {
            action: 'showNotification',
            message,
            type
          })
          .catch(() => {});
      }
    });
  }

  /**
   * 清除通知记录（用于测试）
   */
  clear() {
    this.lastNotification = null;
    this.lastNotificationTime = 0;
  }
}

export const notificationManager = new NotificationManager();
