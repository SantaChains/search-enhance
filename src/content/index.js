// 全局剪贴板监控 Content Script
// 在每个网页中运行剪贴板轮询，实现全局监控

// 配置 - 国家级性能优化
const CLIPBOARD_CONFIG = {
  POLL_INTERVAL: 2000, // 优化: 从1000ms改为2000ms，减少CPU占用
  STORAGE_KEY: 'globalClipboardContent',
  STORAGE_VERSION: 'globalClipboardVersion',
  NOTIFICATION_DURATION: 3000,
  MAX_CONTENT_LENGTH: 50000,
  STORAGE_DEBOUNCE_MS: 5000, // 新增: storage写入防抖5秒
  MAX_RETRY_ATTEMPTS: 3 // 新增: 最大重试次数
};

// 状态 - 增加防抖相关状态
const appState = {
  isMonitoring: false,
  lastContent: '',
  lastVersion: '',
  pollTimer: null,
  port: null,
  notificationId: null,
  initialized: false,
  permissionDenied: false,
  permissionWarningShown: false,
  storageDebounceTimer: null, // 新增: storage防抖定时器
  pendingStorageData: null // 新增: 待写入的storage数据
};

// 日志工具
const logger = {
  info: (msg, ...args) => console.log(`[Decide Search-Global] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[Decide Search-Global] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[Decide Search-Global] ${msg}`, ...args),
  debug: (msg, ...args) => {
    // 仅在调试模式下输出
    if (window.__decideSearchDebug) {
      console.debug(`[Decide Search-Global] ${msg}`, ...args);
    }
  }
};

// 检查剪贴板权限是否可用
async function isClipboardAvailable() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({
          name: 'clipboard-read'
        });
        if (result.state === 'denied') return false;
        if (result.state === 'granted') return true;
      } catch {
        // 某些浏览器不支持 clipboard-read 权限查询
      }
    }
    await navigator.clipboard.readText();
    return true;
  } catch {
    return false;
  }
}

// 申请剪贴板权限
async function requestClipboardPermission() {
  logger.info('用户主动申请剪贴板权限');
  appState.permissionDenied = false;
  appState.permissionWarningShown = false;

  try {
    await navigator.clipboard.readText();
    logger.info('剪贴板权限申请成功');

    // 如果当前在监控模式，重新启动轮询
    if (appState.isMonitoring) {
      const started = await startPolling();
      if (started) {
        showNotification('剪贴板权限已授予，监控已恢复', 'success');
      } else {
        showNotification('权限已授予但启动监控失败', 'warning');
      }
    } else {
      showNotification('剪贴板权限已授予', 'success');
    }

    // 通知 background 权限已恢复
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleGlobalMonitoring',
        isActive: appState.isMonitoring
      });
    } catch {}

    return { success: true, isMonitoring: appState.isMonitoring };
  } catch (err) {
    logger.error('剪贴板权限申请失败:', err);
    showNotification('剪贴板权限申请失败，请在浏览器设置中手动授权', 'error');
    return { success: false, error: err.message };
  }
}

// 轮询剪贴板内容 - 国家级性能优化版
async function pollClipboard() {
  if (!appState.isMonitoring || appState.permissionDenied) return;

  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.trim().length === 0) return;
    if (text.length > CLIPBOARD_CONFIG.MAX_CONTENT_LENGTH) return;

    // 只与本地状态比较，避免频繁读取 storage
    if (text === appState.lastContent) return;

    const newVersion = generateVersion();
    appState.lastContent = text;
    appState.lastVersion = newVersion;

    // 优化: 防抖写入 storage，减少IO操作
    debouncedStorageSave(text, newVersion);

    // 通知 background (使用Port，比storage更快)
    await notifyBackground(text, newVersion);
    showNotification('剪贴板内容已更新', 'success');
    logger.info('剪贴板内容变化', text.substring(0, 50) + '...');
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      // Document is not focused 是正常情况，不处理
      if (err.message && err.message.includes('Document is not focused')) {
        logger.debug('文档未聚焦，跳过本次轮询');
        return;
      }

      appState.permissionDenied = true;
      logger.warn('剪贴板权限被拒绝，停止自动监控');
      stopPolling();
      appState.isMonitoring = false;

      // 优化: 立即写入关键状态变更
      await chrome.storage.local.set({ globalMonitoringEnabled: false });

      showNotification('剪贴板权限被拒绝，点击按钮重新申请', 'warning');

      // 通知 background 权限被拒绝
      try {
        await chrome.runtime.sendMessage({
          action: 'clipboardMonitoringToggled',
          isActive: false
        });
      } catch {}
    } else {
      logger.warn('读取剪贴板失败:', err.message);
    }
  }
}

// 新增: 防抖 storage 写入函数
function debouncedStorageSave(content, version) {
  // 清除之前的定时器
  if (appState.storageDebounceTimer) {
    clearTimeout(appState.storageDebounceTimer);
  }

  // 保存待写入数据
  appState.pendingStorageData = {
    [CLIPBOARD_CONFIG.STORAGE_KEY]: content,
    [CLIPBOARD_CONFIG.STORAGE_VERSION]: version
  };

  // 设置新的定时器
  appState.storageDebounceTimer = setTimeout(async () => {
    if (appState.pendingStorageData) {
      try {
        await chrome.storage.local.set(appState.pendingStorageData);
        appState.pendingStorageData = null;
        logger.debug('Storage写入完成(防抖)');
      } catch (err) {
        logger.error('Storage写入失败:', err);
      }
    }
  }, CLIPBOARD_CONFIG.STORAGE_DEBOUNCE_MS);
}

// 新增: 强制立即写入 storage (用于页面卸载等关键时机)
async function flushStorage() {
  if (appState.storageDebounceTimer) {
    clearTimeout(appState.storageDebounceTimer);
    appState.storageDebounceTimer = null;
  }
  if (appState.pendingStorageData) {
    try {
      await chrome.storage.local.set(appState.pendingStorageData);
      appState.pendingStorageData = null;
      logger.info('Storage强制写入完成');
    } catch (err) {
      logger.error('Storage强制写入失败:', err);
    }
  }
}

// 生成版本号
function generateVersion() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 通知 background 剪贴板变化
async function notifyBackground(content, version) {
  const message = {
    action: 'clipboardChanged',
    content: content,
    version: version,
    source: 'content-script'
  };

  if (appState.port && appState.port.name) {
    try {
      appState.port.postMessage(message);
      return;
    } catch {
      appState.port = null;
    }
  }

  try {
    await chrome.runtime.sendMessage(message);
  } catch {}
}

// 启动轮询
async function startPolling() {
  if (appState.pollTimer) clearInterval(appState.pollTimer);

  if (appState.permissionDenied) {
    logger.info('剪贴板权限之前被拒绝，跳过启动监控');
    return false;
  }

  const available = await isClipboardAvailable();

  if (!available) {
    appState.permissionDenied = true;
    appState.isMonitoring = false;
    await chrome.storage.local.set({ globalMonitoringEnabled: false });

    if (appState.initialized && !appState.permissionWarningShown) {
      appState.permissionWarningShown = true;
      showNotification('剪贴板权限被拒绝，点击按钮重新申请', 'warning');
    }
    return false;
  }

  appState.permissionDenied = false;
  appState.permissionWarningShown = false;

  try {
    const storageData = await chrome.storage.local.get([CLIPBOARD_CONFIG.STORAGE_KEY]);
    appState.lastContent = storageData[CLIPBOARD_CONFIG.STORAGE_KEY] || '';
  } catch {}

  appState.pollTimer = setInterval(pollClipboard, CLIPBOARD_CONFIG.POLL_INTERVAL);
  logger.info('剪贴板监控已启动');
  return true;
}

// 停止轮询
function stopPolling() {
  if (appState.pollTimer) {
    clearInterval(appState.pollTimer);
    appState.pollTimer = null;
  }
  logger.info('全局剪贴板监控已停止');
}

// 连接到 background
function connectToBackground() {
  if (appState.port) {
    try {
      appState.port.disconnect();
    } catch {}
  }

  try {
    appState.port = chrome.runtime.connect({
      name: `global-clipboard-${Date.now().toString(36)}`
    });

    appState.port.onMessage.addListener((message) => {
      handlePortMessage(message);
    });

    appState.port.onDisconnect.addListener(() => {
      logger.info('与background的连接断开');
      appState.port = null;

      if (appState.isMonitoring) {
        setTimeout(() => {
          if (appState.isMonitoring) connectToBackground();
        }, 2000);
      }
    });

    logger.info('已建立与background的连接');
  } catch {}
}

// 处理 Port 消息
async function handlePortMessage(message) {
  switch (message.action) {
    case 'clipboardMonitoringToggled':
      // 避免重复触发
      if (appState.isMonitoring !== message.isActive) {
        await handleMonitoringToggle(message.isActive, false);
      }
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
        } catch {}
      }
      break;

    case 'stateResponse':
      // 从 background 获取的初始状态
      if (message.isActive !== undefined && appState.isMonitoring !== message.isActive) {
        await handleMonitoringToggle(message.isActive, false);
      }
      if (message.lastContent && !appState.lastContent) {
        appState.lastContent = message.lastContent;
        appState.lastVersion = message.lastVersion;
      }
      break;
  }
}

// 处理监控状态切换
async function handleMonitoringToggle(isActive, notify = true) {
  if (appState.isMonitoring === isActive && appState.initialized) return true;

  if (isActive) {
    appState.permissionDenied = false;
    appState.permissionWarningShown = false;
    logger.info('用户主动开启监控，重置权限状态');
  }

  appState.isMonitoring = isActive;

  if (isActive) {
    // 先连接 background，再启动轮询
    connectToBackground();
    const started = await startPolling();
    if (!started) {
      appState.isMonitoring = false;
      // 启动失败时断开连接
      if (appState.port) {
        try {
          appState.port.disconnect();
        } catch {}
        appState.port = null;
      }
      return false;
    }
  } else {
    stopPolling();
    // 关闭监控时断开连接
    if (appState.port) {
      try {
        appState.port.disconnect();
      } catch {}
      appState.port = null;
    }
  }

  if (notify) {
    if (isActive) {
      showNotification('全局剪贴板监控已开启', 'success');
    } else {
      showNotification('全局剪贴板监控已关闭', 'info');
    }
  }

  return true;
}

// 切换监控状态
async function toggleMonitoring() {
  const newState = !appState.isMonitoring;

  // 先应用状态（不显示通知，因为下面会显示）
  await chrome.storage.local.set({
    globalMonitoringEnabled: newState
  });

  // 应用状态变更
  await handleMonitoringToggle(newState, true);

  if (newState) {
    setTimeout(async () => {
      await pollClipboard();
    }, 100);
  }

  // 通知 background 状态已变更
  try {
    await chrome.runtime.sendMessage({
      action: 'toggleGlobalMonitoring',
      isActive: newState,
      source: 'content-script'
    });
  } catch {}

  logger.info(`Alt+K切换监控: ${newState ? '开启' : '关闭'}`);
  return newState;
}

// 显示通知 - 国家级性能优化版 (使用对象池)
const notificationPool = {
  element: null,
  isShowing: false,
  hideTimer: null
};

function showNotification(message, type = 'info') {
  if (!document.body) return;

  // 优化: 复用已有元素，减少DOM操作
  let notification = notificationPool.element;

  if (!notification) {
    // 首次创建
    notification = document.createElement('div');
    notification.id = 'search-buddy-global-notification';
    addAnimationStyles();

    // 事件委托，避免重复绑定
    notification.onclick = (e) => {
      if (e.target.classList.contains('sb-close')) {
        e.stopPropagation();
      }
      removeNotification();
    };

    notificationPool.element = notification;
  }

  // 清除之前的定时器
  if (notificationPool.hideTimer) {
    clearTimeout(notificationPool.hideTimer);
  }

  // 更新内容
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  notification.innerHTML = `
    <span class="sb-icon">${icons[type] || icons.info}</span>
    <span class="sb-message">${escapeHtml(message)}</span>
    <span class="sb-close">×</span>
  `;

  // 应用样式 (使用classList代替style.cssText，性能更好)
  notification.className = 'sb-notification sb-show';
  notification.dataset.type = type;

  // 添加到DOM (如果未添加)
  if (!notification.parentNode) {
    try {
      document.body.appendChild(notification);
    } catch {
      return;
    }
  }

  notificationPool.isShowing = true;

  // 设置自动隐藏
  notificationPool.hideTimer = setTimeout(
    removeNotification,
    CLIPBOARD_CONFIG.NOTIFICATION_DURATION
  );
}

// 获取背景颜色
function getBgColor(type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  return colors[type] || colors.info;
}

// 添加动画样式 - 优化版 (使用CSS类代替style.cssText)
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
    .sb-notification {
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
      max-width: 320px;
      word-break: break-word;
      color: white;
      cursor: pointer;
    }
    .sb-notification[data-type="success"] { background: #10b981; }
    .sb-notification[data-type="error"] { background: #ef4444; }
    .sb-notification[data-type="warning"] { background: #f59e0b; }
    .sb-notification[data-type="info"] { background: #3b82f6; }
    .sb-notification.sb-show {
      animation: sb-slide-in 0.3s ease-out;
    }
    .sb-notification.sb-hide {
      animation: sb-slide-out 0.3s ease-in;
    }
    .sb-notification .sb-close {
      margin-left: 8px;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    .sb-notification .sb-close:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
}

// 移除通知 - 优化版 (配合对象池)
function removeNotification() {
  const notification = notificationPool.element;
  if (notification && notification.parentNode) {
    notification.className = 'sb-notification sb-hide';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      notificationPool.isShowing = false;
    }, 300);
  }
  if (notificationPool.hideTimer) {
    clearTimeout(notificationPool.hideTimer);
    notificationPool.hideTimer = null;
  }
}

// HTML 转义
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'toggleGlobalMonitoring':
          if (request.isActive !== undefined && request.isActive !== appState.isMonitoring) {
            // 如果是从 content script 自己发送的，不显示通知（已经显示过了）
            const shouldNotify = request.source !== 'content-script';
            await handleMonitoringToggle(request.isActive, shouldNotify);
          }
          sendResponse({ success: true, isActive: appState.isMonitoring });
          break;

        case 'clipboardMonitoringToggled':
          // 从其他来源（如popup）触发的状态变更
          if (appState.isMonitoring !== request.isActive) {
            await handleMonitoringToggle(request.isActive, false);
          }
          sendResponse({ success: true });
          break;

        case 'forceClipboardCheck':
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
            lastVersion: appState.lastVersion
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

        case 'getSelectedText': {
          const selection = window.getSelection();
          const text = selection ? selection.toString().trim() : '';
          sendResponse({ text });
          break;
        }

        case 'syncState':
          if (request.content !== undefined) appState.lastContent = request.content;
          if (request.version !== undefined) appState.lastVersion = request.version;
          sendResponse({ success: true });
          break;

        case 'requestClipboardPermission':
          const result = await requestClipboardPermission();
          sendResponse(result);
          break;

        default:
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

// 初始化
async function initialize() {
  logger.info('Global clipboard monitor 初始化开始');

  try {
    let isEnabled = true;
    let lastContent = '';

    // 首先尝试从 background 获取状态
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getGlobalMonitoringState'
      });
      if (response) {
        isEnabled = response.isActive ?? true;
        lastContent = response.lastContent || '';
        logger.info('从background获取状态成功', { isEnabled, lastContentLen: lastContent.length });
      }
    } catch (err) {
      logger.warn('无法从background获取状态，使用本地存储', err?.message || '');
    }

    // 如果 background 不可用，从本地存储读取
    if (!lastContent) {
      const result = await chrome.storage.local.get([
        'globalMonitoringEnabled',
        CLIPBOARD_CONFIG.STORAGE_KEY
      ]);
      // 只有当 background 不可用时才覆盖 isEnabled
      if (!appState.initialized) {
        isEnabled = result.globalMonitoringEnabled !== false;
      }
      lastContent = result[CLIPBOARD_CONFIG.STORAGE_KEY] || '';
      logger.info('从storage读取状态:', { isEnabled, lastContentLen: lastContent.length });
    }

    // 先设置 lastContent，再启动监控
    if (lastContent) {
      appState.lastContent = lastContent;
      logger.info('已加载最近的剪贴板内容，长度:', appState.lastContent.length);
    }

    // 启动监控（如果需要）
    await handleMonitoringToggle(isEnabled, false);

    appState.initialized = true;
    logger.info('初始化完成，监控状态:', appState.isMonitoring);

    // 如果监控开启但权限不可用，提示用户
    if (isEnabled) {
      const available = await isClipboardAvailable();
      if (!available) {
        showNotification('请授予剪贴板权限以启用监控', 'warning');
      }
    }
  } catch (error) {
    logger.error('初始化失败', error);
  }

  // 通知 background content script 已就绪
  try {
    await chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      hasMonitoring: appState.isMonitoring
    });
  } catch {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 页面卸载时清理资源 - 优化版
window.addEventListener('beforeunload', () => {
  logger.info('页面卸载，清理资源');
  stopPolling();

  // 优化: 强制写入 pending 的 storage 数据
  flushStorage();

  if (appState.port) {
    try {
      appState.port.disconnect();
      appState.port = null;
    } catch {}
  }

  removeNotification();
});

// 暴露全局接口用于调试
window.__decideSearchGlobal = {
  getState: () => ({ ...appState }),
  toggle: toggleMonitoring,
  showNotification: showNotification
};

// 快捷键由 Background Script 通过 Manifest 统一处理
// Content Script 不重复监听，避免冲突
