// src/content/index.js

/**
 * Global Clipboard Monitor Content Script
 * 在每个网页中运行剪贴板轮询，实现全局监控
 *
 * 功能：
 * - 全局剪贴板监控（无需打开侧边栏）
 * - 消息气泡通知
 * - 自动同步剪贴板内容到background
 */

// ============================================================================
// 配置
// ============================================================================

const CLIPBOARD_CONFIG = {
  POLL_INTERVAL: 1000,
  STORAGE_KEY: 'globalClipboardContent',
  STORAGE_VERSION: 'globalClipboardVersion',
  NOTIFICATION_DURATION: 3000,
  MAX_CONTENT_LENGTH: 50000,
};

// ============================================================================
// 状态
// ============================================================================

const appState = {
  isMonitoring: false,
  lastContent: '',
  lastVersion: '',
  pollTimer: null,
  port: null,
  notificationId: null,
  initialized: false,
  permissionDenied: false, // 标记权限是否被拒绝
  permissionWarningShown: false, // 标记是否已经显示过权限警告
};

// ============================================================================
// 日志
// ============================================================================

const logger = {
  info: (msg, ...args) => console.log(`[SearchBuddy-Global] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[SearchBuddy-Global] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[SearchBuddy-Global] ${msg}`, ...args),
};

// ============================================================================
// 剪贴板轮询
// ============================================================================

/**
 * 检查剪贴板权限是否可用
 * 使用轻量级方式检查，避免频繁触发权限提示
 * @returns {Promise<boolean>} 权限是否可用
 */
async function isClipboardAvailable() {
  try {
    // 先检查权限状态（如果浏览器支持）
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({
        name: 'clipboard-read',
      });
      if (result.state === 'denied') {
        return false;
      }
      // 如果已授权，直接返回true
      if (result.state === 'granted') {
        return true;
      }
    }

    // 尝试读取剪贴板来验证权限
    await navigator.clipboard.readText();
    return true;
  } catch (e) {
    // 静默处理权限检查失败，不输出日志
    return false;
  }
}

async function pollClipboard() {
  if (!appState.isMonitoring) {
    return;
  }

  // 如果之前已经检测到权限错误，不再重复尝试
  if (appState.permissionDenied) {
    return;
  }

  try {
    const text = await navigator.clipboard.readText();

    if (!text || text.trim().length === 0) {
      return;
    }

    if (text.length > CLIPBOARD_CONFIG.MAX_CONTENT_LENGTH) {
      return;
    }

    const storageData = await chrome.storage.local.get([
      CLIPBOARD_CONFIG.STORAGE_KEY,
      CLIPBOARD_CONFIG.STORAGE_VERSION,
    ]);

    const storedContent = storageData[CLIPBOARD_CONFIG.STORAGE_KEY] || '';

    const isNewContent = text !== storedContent && text !== appState.lastContent;

    if (isNewContent) {
      const newVersion = generateVersion();

      appState.lastContent = text;
      appState.lastVersion = newVersion;

      await chrome.storage.local.set({
        [CLIPBOARD_CONFIG.STORAGE_KEY]: text,
        [CLIPBOARD_CONFIG.STORAGE_VERSION]: newVersion,
      });

      await notifyBackground(text, newVersion);

      showNotification('剪贴板内容已更新', 'success');

      logger.info('剪贴板内容变化:', text.substring(0, 50) + '...');
    }
  } catch (err) {
    // 处理权限错误
    if (err.name === 'NotAllowedError') {
      // 检查是否是 "Document is not focused" 错误
      if (err.message && err.message.includes('Document is not focused')) {
        // 页面失去焦点时的正常错误，完全静默处理，不记录任何日志
        return;
      }

      // 真正的权限被拒绝错误
      appState.permissionDenied = true;
      logger.warn('剪贴板权限被拒绝，停止自动监控');

      // 停止轮询
      stopPolling();
      appState.isMonitoring = false;

      // 保存状态到 storage
      await chrome.storage.local.set({ globalMonitoringEnabled: false });

      // 显示一次性提示
      showNotification('剪贴板权限被拒绝，点击按钮重新申请', 'warning');

      // 通知 background 状态变化
      try {
        await chrome.runtime.sendMessage({
          action: 'clipboardMonitoringToggled',
          isActive: false,
        });
      } catch (e) {
        // 忽略错误
      }
    }
    // 其他错误静默处理，不输出日志
  }
}

function generateVersion() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function notifyBackground(content, version) {
  const message = {
    action: 'clipboardChanged',
    content: content,
    version: version,
    source: 'content-script',
  };

  // 优先通过Port发送
  if (appState.port && appState.port.name) {
    try {
      appState.port.postMessage(message);
    } catch (e) {
      logger.warn('Port消息发送失败:', e.message);
    }
  }

  // 同时通过sendMessage发送，确保background能收到
  try {
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // 忽略错误
  }
}

async function startPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
  }

  // 如果之前权限被拒绝，不再自动尝试
  if (appState.permissionDenied) {
    logger.info('剪贴板权限之前被拒绝，跳过启动监控');
    return false;
  }

  const available = await isClipboardAvailable();

  if (!available) {
    // 权限不可用，标记为拒绝状态
    appState.permissionDenied = true;
    appState.isMonitoring = false;

    // 更新 storage
    await chrome.storage.local.set({ globalMonitoringEnabled: false });

    // 只显示一次提示
    if (appState.initialized && !appState.permissionWarningShown) {
      appState.permissionWarningShown = true;
      showNotification('剪贴板权限被拒绝，点击按钮重新申请', 'warning');
    }
    return false;
  }

  // 权限可用，清除拒绝标记
  appState.permissionDenied = false;
  appState.permissionWarningShown = false;

  try {
    const storageData = await chrome.storage.local.get([CLIPBOARD_CONFIG.STORAGE_KEY]);
    appState.lastContent = storageData[CLIPBOARD_CONFIG.STORAGE_KEY] || '';
  } catch (e) {
    logger.warn('加载初始状态失败:', e.message);
  }

  appState.pollTimer = setInterval(pollClipboard, CLIPBOARD_CONFIG.POLL_INTERVAL);
  logger.info('剪贴板监控已启动');
  return true;
}

function stopPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
    appState.pollTimer = null;
  }
  logger.info('全局剪贴板监控已停止');
}

// ============================================================================
// Port连接
// ============================================================================

function connectToBackground() {
  if (appState.port) {
    try {
      appState.port.disconnect();
    } catch (e) {
      // 忽略断开连接错误
    }
  }

  try {
    appState.port = chrome.runtime.connect({
      name: `global-clipboard-${Date.now().toString(36)}`,
    });

    appState.port.onMessage.addListener((message) => {
      handlePortMessage(message);
    });

    appState.port.onDisconnect.addListener(() => {
      logger.info('与background的连接断开');
      appState.port = null;

      if (appState.isMonitoring) {
        setTimeout(() => {
          if (appState.isMonitoring) {
            connectToBackground();
          }
        }, 2000);
      }
    });

    logger.info('已建立与background的连接');
  } catch (e) {
    logger.warn('连接background失败:', e.message);
  }
}

function handlePortMessage(message) {
  switch (message.action) {
    case 'clipboardMonitoringToggled':
      handleMonitoringToggle(message.isActive, false);
      break;

    case 'syncContent':
      if (message.content !== appState.lastContent) {
        appState.lastContent = message.content;
        appState.lastVersion = message.version;
      }
      break;

    case 'ping':
      if (appState.port) {
        try {
          appState.port.postMessage({ action: 'pong' });
        } catch (e) {
          // 忽略发送错误
        }
      }
      break;
  }
}

// ============================================================================
// 监控控制
// ============================================================================

async function handleMonitoringToggle(isActive, notify = true) {
  if (appState.isMonitoring === isActive && appState.initialized) {
    return true;
  }

  // 如果用户主动开启监控，重置权限拒绝状态
  if (isActive) {
    appState.permissionDenied = false;
    appState.permissionWarningShown = false;
    logger.info('用户主动开启监控，重置权限状态');
  }

  appState.isMonitoring = isActive;

  if (isActive) {
    connectToBackground();
    const started = await startPolling();
    // 如果启动失败（权限问题），恢复状态
    if (!started) {
      appState.isMonitoring = false;
      return false;
    }
  } else {
    stopPolling();
  }

  if (notify) {
    if (isActive) {
      showNotification('全局剪贴板监控已开启', 'success');
    } else {
      showNotification('全局剪贴板监控已关闭', 'info');
    }
  }

  logger.info('=== handleMonitoringToggle 结束 ===');
  return true;
}

async function toggleMonitoring() {
  appState.isMonitoring = !appState.isMonitoring;

  await chrome.storage.local.set({
    globalMonitoringEnabled: appState.isMonitoring,
  });

  handleMonitoringToggle(appState.isMonitoring, true);

  // 如果开启监控，立即执行一次剪贴板检测
  if (appState.isMonitoring) {
    setTimeout(async () => {
      await pollClipboard();
    }, 100);
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'toggleGlobalMonitoring',
      isActive: appState.isMonitoring,
    });
  } catch (e) {
    logger.warn('同步状态失败:', e.message);
  }

  logger.info(`Alt+K切换监控: ${appState.isMonitoring ? '开启' : '关闭'}`);

  return appState.isMonitoring;
}

// ============================================================================
// 通知
// ============================================================================

function showNotification(message, type = 'info') {
  logger.info('=== showNotification 开始 ===');
  logger.info('消息:', message, '类型:', type);

  removeNotification();

  if (!document.body) {
    logger.error('document.body 不存在，无法显示通知');
    return;
  }

  const notification = document.createElement('div');
  notification.id = 'search-buddy-global-notification';
  notification.dataset.type = type;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  notification.innerHTML = `
        <span class="sb-icon">${icons[type] || icons.info}</span>
        <span class="sb-message">${escapeHtml(message)}</span>
        <span class="sb-close">×</span>
    `;

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: sb-slide-in 0.3s ease-out;
        max-width: 320px;
        word-break: break-word;
        background: ${getBgColor(type)};
        color: white;
        cursor: pointer;
    `;

  const closeBtn = notification.querySelector('.sb-close');
  closeBtn.style.cssText = `
        margin-left: 8px;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;
    `;
  closeBtn.onmouseover = () => (closeBtn.style.opacity = '1');
  closeBtn.onmouseout = () => (closeBtn.style.opacity = '0.8');
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    removeNotification();
  };

  notification.onclick = () => removeNotification();

  addAnimationStyles();

  try {
    document.body.appendChild(notification);
    appState.notificationId = notification.id;
    logger.info('通知元素已添加到DOM');
  } catch (e) {
    logger.error('添加通知到DOM失败:', e);
    return;
  }

  setTimeout(removeNotification, CLIPBOARD_CONFIG.NOTIFICATION_DURATION);
  logger.info('=== showNotification 结束 ===');
}

function getBgColor(type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
  return colors[type] || colors.info;
}

function addAnimationStyles() {
  if (document.querySelector('#sb-global-animation-style')) return;

  const style = document.createElement('style');
  style.id = 'sb-global-animation-style';
  style.textContent = `
        @keyframes sb-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes sb-slide-out {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
  document.head.appendChild(style);
}

function removeNotification() {
  const notification = document.getElementById('search-buddy-global-notification');
  if (notification) {
    notification.style.animation = 'sb-slide-out 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
    appState.notificationId = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// 消息监听
// ============================================================================

/**
 * 消息监听处理函数
 * 处理来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'toggleGlobalMonitoring':
          // 避免重复切换，因为toggleMonitoring已经会切换状态
          if (request.isActive !== undefined && request.isActive !== appState.isMonitoring) {
            await handleMonitoringToggle(request.isActive, true);
          }
          sendResponse({ success: true, isActive: appState.isMonitoring });
          break;

        case 'forceClipboardCheck':
          // 强制立即检测剪贴板
          if (appState.isMonitoring) {
            await pollClipboard();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: '监控未开启' });
          }
          break;

        case 'getMonitoringState':
          sendResponse({
            isActive: appState.isMonitoring,
            lastContent: appState.lastContent,
            lastVersion: appState.lastVersion,
          });
          break;

        case 'clipboardChanged':
          if (request.content !== appState.lastContent) {
            appState.lastContent = request.content;
            if (appState.initialized) {
              showNotification('剪贴板内容已更新', 'success');
            }
          }
          sendResponse({ success: true });
          break;

        case 'showNotification':
          showNotification(request.message, request.type);
          sendResponse({ success: true });
          break;

        case 'syncState':
          if (request.content !== undefined) {
            appState.lastContent = request.content;
          }
          if (request.version !== undefined) {
            appState.lastVersion = request.version;
          }
          sendResponse({ success: true });
          break;

        default:
          // 未知消息类型
          sendResponse({ success: false, error: '未知消息类型' });
          break;
      }
    } catch (error) {
      logger.error('消息处理失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

// ============================================================================
// 键盘快捷键
// ============================================================================

/**
 * 处理键盘快捷键
 * Alt+K: 切换剪贴板监控
 * Alt+L: 打开侧边栏
 */
document.addEventListener('keydown', async (event) => {
  // Alt+K: 切换剪贴板监控
  if (event.altKey && event.key.toLowerCase() === 'k' && !event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await toggleMonitoring();
    } catch (error) {
      logger.error('切换监控失败:', error);
    }
    return;
  }

  // Alt+L: 打开侧边栏
  if (event.altKey && event.key.toLowerCase() === 'l' && !event.ctrlKey && !event.shiftKey) {
    event.preventDefault();
    try {
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
    } catch (e) {
      logger.warn('打开侧边栏失败:', e.message);
    }
    return;
  }

  // Alt+J: 读取剪贴板并打开侧边栏
  if (event.altKey && event.key.toLowerCase() === 'j' && !event.ctrlKey && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    try {
      // 先打开侧边栏
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
      // 通知 popup 读取剪贴板
      await chrome.runtime.sendMessage({ action: 'readClipboardFromShortcut' });
      showNotification('已读取剪贴板内容', 'info');
    } catch (e) {
      logger.warn('读取剪贴板失败:', e.message);
    }
    return;
  }

  // Alt+1: 切换提取和拆解功能
  if (event.altKey && event.key === '1' && !event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
      await chrome.runtime.sendMessage({
        action: 'toggleFeature',
        feature: 'extract',
      });
      showNotification('提取和拆解功能切换', 'info');
    } catch (e) {
      logger.warn('切换提取功能失败:', e.message);
    }
    return;
  }

  // Alt+2: 切换链接生成功能
  if (event.altKey && event.key === '2' && !event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
      await chrome.runtime.sendMessage({
        action: 'toggleFeature',
        feature: 'link_gen',
      });
      showNotification('链接生成功能切换', 'info');
    } catch (e) {
      logger.warn('切换链接生成功能失败:', e.message);
    }
    return;
  }

  // Alt+3: 切换多格式分析功能
  if (event.altKey && event.key === '3' && !event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await chrome.runtime.sendMessage({ action: 'openSidePanel' });
      await chrome.runtime.sendMessage({
        action: 'toggleFeature',
        feature: 'multi_format',
      });
      showNotification('多格式分析功能切换', 'info');
    } catch (e) {
      logger.warn('切换多格式分析功能失败:', e.message);
    }
    return;
  }
});

// ============================================================================
// 初始化
// ============================================================================

/**
 * 初始化剪贴板监控
 * 加载存储的状态并启动监控（如果启用）
 */
async function initialize() {
  logger.info('========================================');
  logger.info('Global clipboard monitor 初始化开始');
  logger.info('========================================');

  try {
    // 从存储读取监控状态
    const result = await chrome.storage.local.get('globalMonitoringEnabled');
    logger.info('从storage读取 globalMonitoringEnabled:', result.globalMonitoringEnabled);

    const isEnabled = result.globalMonitoringEnabled !== false;
    logger.info('计算后的启用状态:', isEnabled);

    // 应用监控状态
    await handleMonitoringToggle(isEnabled, false);

    // 加载最近的剪贴板内容
    const contentResult = await chrome.storage.local.get(CLIPBOARD_CONFIG.STORAGE_KEY);
    if (contentResult[CLIPBOARD_CONFIG.STORAGE_KEY]) {
      appState.lastContent = contentResult[CLIPBOARD_CONFIG.STORAGE_KEY];
      logger.info('已加载最近的剪贴板内容，长度:', appState.lastContent.length);
    } else {
      logger.info('storage中没有剪贴板内容');
    }

    // 标记初始化完成
    appState.initialized = true;
    logger.info('初始化完成，appState.initialized = true');

    // 如果监控已启用，检查权限状态
    if (isEnabled) {
      const available = await isClipboardAvailable();
      if (!available) {
        showNotification('请授予剪贴板权限以启用监控', 'warning');
      }
    }
  } catch (error) {
    logger.error('初始化失败:', error);
  }

  // 通知background script content script已就绪
  try {
    await chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      hasMonitoring: appState.isMonitoring,
    });
  } catch (e) {
    // 忽略错误，background可能未准备好
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// ============================================================================
// 清理
// ============================================================================

// ============================================================================
// 页面生命周期管理
// ============================================================================

/**
 * 页面卸载时清理资源
 */
window.addEventListener('beforeunload', () => {
  logger.info('页面卸载，清理资源...');

  // 停止剪贴板轮询
  stopPolling();

  // 断开与background的连接
  if (appState.port) {
    try {
      appState.port.disconnect();
      appState.port = null;
    } catch (e) {
      // 忽略断开连接的错误
    }
  }

  // 移除通知
  removeNotification();
});

/**
 * 暴露全局接口用于调试
 */
window.__searchBuddyGlobal = {
  getState: () => ({ ...appState }),
  toggle: toggleMonitoring,
  showNotification: showNotification,
};
