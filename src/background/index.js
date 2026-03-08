// src/background/index.js

import clipboardHistoryManager from '../utils/clipboardHistory.js';
import { isBrowserHomePage } from '../utils/commonUtils.js';

/**
 * Decide Search Background Script
 * Manages global clipboard monitoring and state synchronization
 *
 * 功能：
 * - 全局剪贴板监控协调
 * - 状态持久化
 * - 多tab同步
 * - 快捷键处理
 * - 剪贴板历史保存
 */

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  STORAGE_KEYS: {
    GLOBAL_MONITORING: 'globalMonitoringEnabled',
    CLIPBOARD_CONTENT: 'globalClipboardContent',
    CLIPBOARD_VERSION: 'globalClipboardVersion',
    LAST_CLIPBOARD_CONTENT: 'lastClipboardContent',
    MONITORING_ENABLED: 'monitoringEnabled' // 统一存储键
  },
  DEFAULT_MONITORING: true
};

// ============================================================================
// 状态
// ============================================================================

const appState = {
  isMonitoring: CONFIG.DEFAULT_MONITORING,
  lastContent: '',
  activeTabs: new Map(),
  lastBroadcastVersion: '',
  cleanupInterval: null,
  sidePanelOpenWindows: new Set(),
  initialized: false
};

// ============================================================================
// 日志
// ============================================================================

const logger = {
  info: (msg, ...args) => {
    console.log(`[Decide Search-BG] ${msg}`, ...args);
  },
  error: (msg, ...args) => console.error(`[Decide Search-BG] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[Decide Search-BG] ${msg}`, ...args)
};

// ============================================================================
// 存储管理
// ============================================================================

async function loadState() {
  try {
    const result = await chrome.storage.local.get([
      CONFIG.STORAGE_KEYS.GLOBAL_MONITORING,
      CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT,
      CONFIG.STORAGE_KEYS.CLIPBOARD_VERSION
    ]);

    appState.isMonitoring =
      result[CONFIG.STORAGE_KEYS.GLOBAL_MONITORING] ?? CONFIG.DEFAULT_MONITORING;
    appState.lastContent = result[CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT] || '';

    logger.info(`加载状态: 监控=${appState.isMonitoring}, 内容长度=${appState.lastContent.length}`);
  } catch (error) {
    logger.error('加载状态失败:', error);
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      [CONFIG.STORAGE_KEYS.GLOBAL_MONITORING]: appState.isMonitoring,
      [CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT]: appState.lastContent
    });
  } catch (error) {
    logger.error('保存状态失败:', error);
  }
}

// ============================================================================
// 剪贴板变化处理
// ============================================================================

async function handleClipboardChange(content, version, source = 'background') {
  if (content === appState.lastContent && version === appState.lastBroadcastVersion) {
    return { success: true, duplicate: true };
  }

  appState.lastContent = content;
  appState.lastBroadcastVersion = version;

  // 保存到storage
  await chrome.storage.local.set({
    [CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT]: content,
    [CONFIG.STORAGE_KEYS.CLIPBOARD_VERSION]: version
  });

  // 保存到剪贴板历史
  try {
    const settings = await clipboardHistoryManager.getSettings();
    if (settings.enabled && settings.autoSave) {
      await clipboardHistoryManager.addItem(content, { source });
      logger.info(`剪贴板内容已保存到历史记录 (来源: ${source})`);
    }
  } catch (error) {
    logger.error('保存剪贴板历史失败:', error);
  }

  // 广播到所有active tabs和popup
  await broadcastToAllTabs({
    action: 'clipboardChanged',
    content: content,
    version: version,
    source: source
  });

  logger.info(`剪贴板变化已广播 (来源: ${source}): ${content.substring(0, 50)}...`);
  return { success: true };
}

/**
 * 广播消息到所有active tabs和扩展组件
 */
async function broadcastToAllTabs(message) {
  // 通过Port发送给已连接的content scripts
  const ports = Array.from(appState.activeTabs.values());
  const disconnectedTabs = [];

  ports.forEach(({ port }, tabId) => {
    try {
      port.postMessage(message);
    } catch (e) {
      logger.warn('发送消息失败:', e.message);
      disconnectedTabs.push(tabId);
    }
  });

  // 清理断开的连接
  disconnectedTabs.forEach((tabId) => {
    appState.activeTabs.delete(tabId);
  });

  // 同时通过sendMessage广播给所有监听器（包括popup）
  try {
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // 可能没有接收者，忽略错误
  }
}

/**
 * 切换全局监控状态
 */
async function toggleMonitoring() {
  appState.isMonitoring = !appState.isMonitoring;

  await saveState();

  // 广播状态变化
  broadcastToAllTabs({
    action: 'clipboardMonitoringToggled',
    isActive: appState.isMonitoring
  });

  logger.info(`全局监控切换: ${appState.isMonitoring ? '开启' : '关闭'}`);

  return appState.isMonitoring;
}

// ============================================================================
// Port连接管理
// ============================================================================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('global-clipboard-') || port.name.startsWith('popup-')) {
    const tabId = port.name.replace(/^(global-clipboard-|popup-)/, '');

    appState.activeTabs.set(tabId, { port, monitoring: appState.isMonitoring });

    logger.info(`Port连接: ${port.name}, 当前连接数: ${appState.activeTabs.size}`);

    port.onMessage.addListener((message) => {
      handlePortMessage(message, port, tabId);
    });

    port.onDisconnect.addListener(() => {
      appState.activeTabs.delete(tabId);
      logger.info(`Port断开: ${port.name}, 当前连接数: ${appState.activeTabs.size}`);
    });
  }
});

function handlePortMessage(message, port, _tabId) {
  switch (message.action) {
  case 'clipboardChanged':
    handleClipboardChange(message.content, message.version, 'content-script');
    break;

  case 'getState':
    port.postMessage({
      action: 'stateResponse',
      isActive: appState.isMonitoring,
      lastContent: appState.lastContent,
      lastVersion: appState.lastBroadcastVersion
    });
    break;

  case 'pong':
    // 心跳响应
    break;
  }
}

// ============================================================================
// 消息处理
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
    case 'toggleGlobalMonitoring': {
      const newState = await toggleMonitoring();
      sendResponse({ success: true, isActive: newState });
      break;
    }

    case 'getGlobalMonitoringState':
      sendResponse({
        isActive: appState.isMonitoring,
        lastContent: appState.lastContent
      });
      break;

    case 'clipboardChanged': {
      const result = await handleClipboardChange(request.content, request.version, 'message');
      sendResponse(result);
      break;
    }

    case 'contentScriptReady':
      // Content script准备就绪，发送当前状态
      sendResponse({
        success: true,
        isMonitoring: appState.isMonitoring,
        lastContent: appState.lastContent
      });
      break;

    case 'openSidePanel': {
      if (!sender.tab?.windowId) {
        logger.warn('openSidePanel: 缺少 windowId');
        sendResponse({ success: false, error: 'Missing windowId' });
        break;
      }
      try {
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
        sendResponse({ success: true });
      } catch (e) {
        logger.error('打开侧边栏失败:', e.message);
        sendResponse({ success: false, error: e.message });
      }
      break;
    }

    case 'showNotification':
      // 转发到content script显示通知
      if (sender.tab?.id) {
        try {
          await chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showNotification',
            message: request.message,
            type: request.type
          });
          logger.info('通知已转发到content script');
        } catch (e) {
          logger.warn('转发通知失败:', e.message);
        }
      } else {
        logger.warn('无法转发通知：sender.tab.id 不存在');
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
    }
  })();

  return true;
});

// ============================================================================
// 快捷键处理
// ============================================================================

/**
 * 检测当前标签页是否为浏览器主页
 * @param {Object} tab - Chrome标签页对象
 * @returns {boolean} 是否为浏览器主页
 */
function isTabBrowserHomePage(tab) {
  if (!tab || !tab.url) return false;

  // 检查是否为浏览器内部页面
  const internalProtocols = ['chrome:', 'chrome-extension:', 'about:', 'edge:', 'file:'];
  const url = tab.url.toLowerCase();

  for (const protocol of internalProtocols) {
    if (url.startsWith(protocol)) {
      return true;
    }
  }

  // 检查是否为新标签页（空白页）
  if (url === 'about:blank' || url === '') {
    return true;
  }

  return false;
}

/**
 * 检查侧边栏是否打开
 * @param {number} windowId - 窗口ID
 * @returns {boolean} 侧边栏是否打开
 */
function isSidePanelOpen(windowId) {
  return appState.sidePanelOpenWindows.has(windowId);
}

/**
 * 打开或关闭侧边栏（切换模式）
 * @param {number} windowId - 窗口ID
 * @returns {Promise<boolean>} 侧边栏是否打开
 */
async function openSidePanelWithAction(windowId) {
  if (!windowId) {
    logger.warn('openSidePanelWithAction: 缺少 windowId');
    return false;
  }

  try {
    const isOpen = isSidePanelOpen(windowId);

    if (isOpen) {
      await chrome.sidePanel.close({ windowId });
      logger.info('侧边栏已关闭');
      return false;
    } else {
      await chrome.sidePanel.open({ windowId });
      await chrome.storage.local.set({ focusInputOnOpen: true });
      logger.info('侧边栏已打开，设置聚焦输入框标记');
      return true;
    }
  } catch (e) {
    logger.error('侧边栏切换失败:', e.message);
    return false;
  }
}

/**
 * 读取剪贴板到侧边栏（如果侧边栏已打开则直接读取，否则打开侧边栏后读取）
 * @param {number} windowId - 窗口ID
 * @returns {Promise<void>}
 */
async function readClipboardToSidePanel(windowId) {
  if (!windowId) {
    logger.warn('readClipboardToSidePanel: 缺少 windowId');
    return;
  }

  try {
    await chrome.storage.local.set({ readClipboardOnOpen: true });
    logger.info('已设置读取剪贴板标记');

    const isOpen = isSidePanelOpen(windowId);

    if (!isOpen) {
      await chrome.sidePanel.open({ windowId });
      logger.info('侧边栏已打开');
    }
  } catch (e) {
    logger.error('读取剪贴板到侧边栏失败:', e.message);
  }
}

// 监听侧边栏打开事件
chrome.sidePanel.onOpened?.addListener?.((info) => {
  if (info?.windowId) {
    appState.sidePanelOpenWindows.add(info.windowId);
    logger.info(`侧边栏打开，窗口ID: ${info.windowId}`);
  }
});

// 监听侧边栏关闭事件
chrome.sidePanel.onClosed?.addListener?.((info) => {
  if (info?.windowId) {
    appState.sidePanelOpenWindows.delete(info.windowId);
    logger.info(`侧边栏关闭，窗口ID: ${info.windowId}`);
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  logger.info('========================================');
  logger.info(`收到快捷键命令: "${command}"`);

  // 检查 tab 对象是否存在
  if (!tab) {
    logger.error('Tab对象为null，无法执行快捷键');
    return;
  }

  logger.info(`Tab信息: ID=${tab.id}, URL=${tab.url}, WindowID=${tab.windowId}`);

  // 检查是否为浏览器内部页面
  if (isTabBrowserHomePage(tab)) {
    logger.info(`在浏览器内部页面 (${tab.url})，快捷键不执行`);
    return;
  }

  try {
    logger.info('开始执行快捷键处理...');

    switch (command) {
    case 'toggle_clipboard_monitoring': {
      logger.info('执行: toggle_clipboard_monitoring (Alt+K)');
      const newState = await toggleMonitoring();

      // 发送通知到当前标签页
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showNotification',
            message: `全局剪贴板监控已${newState ? '开启' : '关闭'}`,
            type: newState ? 'success' : 'info'
          });
        } catch (e) {
          logger.warn('无法发送通知到标签页:', e.message);
        }

        // 如果开启监控，立即检测剪贴板
        if (newState) {
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'forceClipboardCheck'
              });
            } catch (e) {
              // 忽略错误
            }
          }, 200);
        }
      }
      break;
    }

    case '_execute_action': {
      logger.info('执行: _execute_action (Alt+L)');
      const isOpen = await openSidePanelWithAction(tab.windowId);
      logger.info(`侧边栏状态: ${isOpen ? '打开' : '关闭'}`);

      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showNotification',
            message: `侧边栏已${isOpen ? '打开' : '关闭'}`,
            type: isOpen ? 'success' : 'info'
          });
        } catch (e) {
          logger.warn('无法发送通知到标签页:', e.message);
        }
      }
      break;
    }

    case 'open_side_panel_and_read': {
      logger.info('执行: open_side_panel_and_read (Alt+J)');
      await readClipboardToSidePanel(tab.windowId);
      logger.info('已设置读取剪贴板标记');

      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showNotification',
            message: '已读取剪贴板',
            type: 'success'
          });
        } catch (e) {
          logger.warn('无法发送通知到标签页:', e.message);
        }
      }
      break;
    }

    default: {
      logger.warn(`未知的快捷键命令: "${command}"`);
      break;
    }
    }
  } catch (error) {
    logger.error(`处理快捷键命令失败: ${error.message}`);
  }

  logger.info('快捷键处理完成');
  logger.info('========================================');
});

// ============================================================================
// 初始化
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    // 设置侧边栏行为
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

    // 加载状态
    await loadState();

    if (details.reason === 'install') {
      logger.info('首次安装，默认开启全局监控');
    }
  } catch (error) {
    logger.error('初始化失败:', error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('Service Worker启动');
  await loadState();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ============================================================================
// 清理孤立连接
// ============================================================================

function startCleanupInterval() {
  if (appState.cleanupInterval) {
    clearInterval(appState.cleanupInterval);
  }

  appState.cleanupInterval = setInterval(() => {
    if (appState.activeTabs.size > 0) {
      const validTabs = new Map();
      appState.activeTabs.forEach((value, key) => {
        try {
          if (value.port && value.port.sender) {
            validTabs.set(key, value);
          }
        } catch (e) {
          // 连接无效，不保留
        }
      });
      appState.activeTabs = validTabs;
    }
  }, 30000);
}

// 启动清理定时器
startCleanupInterval();

// 监听扩展挂起事件，清理资源
chrome.runtime.onSuspend.addListener(() => {
  if (appState.cleanupInterval) {
    clearInterval(appState.cleanupInterval);
    appState.cleanupInterval = null;
  }
});

logger.info('Background script加载完成');
