// src/popup/main.js - 剪贴板历史优化版本

import { getSettings, saveSettings, DEFAULTS } from '../utils/storage.js';

import {
  isURL,
  splitText,
  copyToClipboard as copyTextToClipboard,
  extractEmails,
  extractPhoneNumbers,
  intelligentSegmentation,
  chineseAnalyze,
  englishAnalyze,
  codeAnalyze,
  aiAnalyze,
  sentenceAnalyze,
  halfSentenceAnalyze,
  charBreak,
  removeSymbolsAnalyze,
  randomAnalyze,
  multiRuleAnalyze,
  processPath,
  processLinkGeneration,
  processTextExtraction,
  analyzeTextForMultipleFormats,
} from '../utils/textProcessor.js';

import { applySingleRule } from '../utils/multiRuleAnalyzer.js';

import linkHistoryManager from '../utils/linkHistory.js';
import clipboardHistoryManager from '../utils/clipboardHistory.js';

const logger = {
  info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
  error: (message, ...args) => console.error(`[SearchBuddy] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args),
};

const ClipboardMode = {
  NORMAL: 'normal',
  BATCH: 'batch',
  EDIT: 'edit',
};

// 链接历史编辑模式
const LinkHistoryMode = {
  NORMAL: 'normal',
  EDIT: 'edit',
};

const appState = {
  settings: null,
  splitItemsState: [],
  clipboardMonitoring: false,
  lastClipboardContent: '',
  linkHistory: [],
  resizeObserver: null,
  multiFormatState: {
    originalText: '',
    processingHistory: [],
    currentIndex: -1,
  },
  clipboardHistory: [],
  clipboardHistoryVisible: false,
  clipboardMode: ClipboardMode.NORMAL,
  editingItemId: null,
  maxClipboardHistory: 100,
  backgroundPort: null,
  // 多规则分析状态
  multiRuleState: {
    originalText: '',
    processingHistory: [],
    currentIndex: -1,
  },
  // 链接历史编辑状态
  linkHistoryMode: LinkHistoryMode.NORMAL,
  editingLinkHistoryId: null,
  editingLinkHistoryOriginalUrl: null,
  // 链接历史筛选状态
  linkHistoryFilter: 'all',
  // 剪贴板历史筛选状态
  clipboardHistoryFilter: 'all',
};

const elements = {};

/**
 * 自动聚焦搜索输入框
 * 在侧边栏打开时自动将焦点设置到输入框
 */
function focusSearchInput() {
  if (!elements.search_input) {
    logger.warn('无法聚焦：search_input 元素不存在');
    return;
  }

  // 使用 setTimeout 确保 DOM 完全渲染后再聚焦
  setTimeout(() => {
    try {
      elements.search_input.focus();
      logger.info('搜索输入框已自动聚焦');
    } catch (error) {
      logger.error('聚焦输入框失败:', error);
    }
  }, 100);
}

/**
 * 检查是否有待切换的功能
 * 用于处理通过快捷键触发但 popup 未准备好时的功能切换
 */
async function checkPendingFeatureToggle() {
  try {
    const result = await chrome.storage.local.get('pendingFeatureToggle');
    if (result.pendingFeatureToggle) {
      // 清除待处理状态
      await chrome.storage.local.remove('pendingFeatureToggle');
      // 执行切换
      handleFeatureToggle(result.pendingFeatureToggle);
    }
  } catch (error) {
    logger.error('检查待切换功能失败:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Search Buddy 正在初始化...');

  try {
    initializeElements();
    appState.settings = await getSettings();
    appState.linkHistory = await linkHistoryManager.getHistory();
    await loadClipboardHistory();
    setupEventListeners();
    renderEngineSelect();
    await initClipboardMonitoringState();
    renderHistory();
    renderClipboardHistory();
    initializeTextareaAutoResize();
    initializeResponsiveLayout();

    // 初始化剪贴板权限面板
    initClipboardPermission();

    if (elements.switch_extract) {
      elements.switch_extract.checked = true;
      handleInputChange();
    }

    // 自动聚焦输入框
    focusSearchInput();

    // 检查是否有待切换的功能（通过快捷键触发）
    checkPendingFeatureToggle();

    logger.info('Search Buddy 初始化完成');
  } catch (error) {
    logger.error('初始化失败:', error);
    showNotification('初始化失败，请尝试刷新扩展', false);
  }
});

function initializeElements() {
  const elementIds = [
    'search-input',
    'search-btn',
    'engine-select',
    'switch-extract',
    'switch-link-gen',
    'switch-multi-format',
    'clipboard-btn',
    'clipboard-monitor-switch',
    'settings-btn',
    'extract-container',
    'link-gen-container',
    'multi-format-container',
    'path-conversion-tool',
    'path-conversion-result',
    'path-add-quote-btn',
    'path-reset-quote-btn',
    'link-extraction-result',
    'text-splitting-tool',
    'split-delimiter-select',
    'refresh-split-btn',
    'split-output-container',
    'copy-selected-btn',
    'copy-opt-space',
    'copy-opt-newline',
    'copy-opt-tab',
    'select-all-checkbox',
    'show-history-btn',
    'edit-history-btn',
    'clear-history-btn',
    'history-container',
    'history-search',
    'history-list',
    'clipboard-history-container',
    'clipboard-history-search',
    'clipboard-history-list',
    'clipboard-controls',
    'clipboard-permission-panel',
    'request-clipboard-permission-btn',
    'clipboard-action-panel',
    'read-clipboard-btn',
    'toggle-auto-monitor-btn',
    'export-clipboard-btn',
    'import-clipboard-btn',
    'clipboard-import-input',
    'clear-clipboard-btn',
    'clipboard-settings-btn',
    'show-clipboard-btn',
    'cancel-clipboard-settings',
    'save-clipboard-settings',
  ];

  elementIds.forEach((id) => {
    elements[id.replace(/-/g, '_')] = document.getElementById(id);
  });

  if (!elements.search_input || !elements.search_btn) {
    throw new Error('关键DOM元素缺失');
  }
}

function showNotification(message, isSuccess = true) {
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.background = isSuccess ? '#10b981' : '#ef4444';

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

function connectToBackground() {
  if (appState.backgroundPort) {
    try {
      appState.backgroundPort.disconnect();
    } catch (e) {
      // 忽略断开连接错误
    }
    appState.backgroundPort = null;
  }

  appState.backgroundPort = chrome.runtime.connect({
    name: `popup-${Date.now().toString(36)}`,
  });

  appState.backgroundPort.onMessage.addListener((message) => {
    handlePortMessage(message);
  });

  appState.backgroundPort.onDisconnect.addListener(() => {
    logger.info('与background的连接已断开');
    appState.backgroundPort = null;
  });

  logger.info('已建立与background的Port连接');
}

function handlePortMessage(message) {
  switch (message.action) {
    case 'clipboardChanged':
      if (
        message.content &&
        message.content.trim().length > 0 &&
        message.content !== appState.lastClipboardContent
      ) {
        appState.lastClipboardContent = message.content;

        if (elements.search_input) {
          elements.search_input.value = message.content;
          elements.search_input.isManuallyResized = false;
          handleTextareaInput();
          updateSearchControlsPosition();
        }

        addToClipboardHistory(message.content).catch((error) => {
          logger.error('添加到剪贴板历史失败:', error);
        });

        showNotification('检测到剪贴板内容变化');
      }
      break;

    case 'clipboardMonitoringToggled':
      appState.clipboardMonitoring = message.isActive;
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked = appState.clipboardMonitoring;
      }
      break;

    case 'stateResponse':
      appState.clipboardMonitoring = message.isActive;
      appState.lastClipboardContent = message.lastContent || '';
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked = appState.clipboardMonitoring;
      }
      break;
  }
}

async function toggleClipboardMonitoring() {
  appState.clipboardMonitoring = !appState.clipboardMonitoring;
  // 使用统一的存储键 globalMonitoringEnabled
  await chrome.storage.local.set({
    globalMonitoringEnabled: appState.clipboardMonitoring,
  });

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'toggleGlobalMonitoring',
    });
    logger.info('toggleGlobalMonitoring 响应:', response);
  } catch (error) {
    logger.warn('通知background失败:', error.message);
    // 即使background通信失败，也不影响本地状态
  }

  if (appState.clipboardMonitoring) {
    showNotification('剪贴板监控已启动');
  } else {
    showNotification('剪贴板监控已停止');
  }

  updateClipboardButtonState(appState.clipboardMonitoring);
}

async function initClipboardMonitoringState() {
  logger.info('开始初始化剪贴板监控状态...');
  try {
    // 先从本地存储读取状态
    const localResult = await chrome.storage.local.get('globalMonitoringEnabled');
    const localState = localResult.globalMonitoringEnabled !== false;
    logger.info('从本地存储读取的监控状态:', localState);

    let response = null;
    try {
      response = await chrome.runtime.sendMessage({
        action: 'getGlobalMonitoringState',
      });
      logger.info('从background获取状态成功:', response);
    } catch (bgError) {
      logger.warn('从background获取状态失败，使用本地状态:', bgError.message);
    }

    // 优先使用background返回的状态，否则使用本地状态
    appState.clipboardMonitoring = response?.isActive ?? localState;
    appState.lastClipboardContent = response?.lastContent || '';

    logger.info('最终监控状态:', appState.clipboardMonitoring);

    // 建立Port连接
    try {
      connectToBackground();
    } catch (portError) {
      logger.warn('建立Port连接失败:', portError.message);
    }

    if (appState.clipboardMonitoring && appState.lastClipboardContent) {
      if (elements.search_input && !elements.search_input.value) {
        elements.search_input.value = appState.lastClipboardContent;
        handleTextareaInput();
        updateSearchControlsPosition();
      }
    }

    updateClipboardButtonState(appState.clipboardMonitoring);

    if (elements.clipboard_monitor_switch) {
      elements.clipboard_monitor_switch.checked = appState.clipboardMonitoring;
    }

    logger.info(
      `初始化剪贴板监控完成: 状态=${appState.clipboardMonitoring}, 内容长度=${appState.lastClipboardContent?.length || 0}`
    );
  } catch (error) {
    logger.error('初始化剪贴板监控失败:', error);
    // 使用默认值
    appState.clipboardMonitoring = false;
    updateClipboardButtonState(false);
  }
}

function updateClipboardButtonState(isActive) {
  if (!elements.clipboard_btn) return;

  const statusIndicator = elements.clipboard_btn.querySelector('.clipboard-status');
  if (statusIndicator) {
    statusIndicator.classList.toggle('active', isActive);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.info('收到来自background的消息:', request);

  switch (request.action) {
    case 'clipboardChanged':
      if (
        request.content &&
        request.content.trim().length > 0 &&
        request.content !== appState.lastClipboardContent
      ) {
        appState.lastClipboardContent = request.content;

        if (elements.search_input) {
          elements.search_input.value = request.content;
          elements.search_input.isManuallyResized = false;
          handleTextareaInput();
          updateSearchControlsPosition();
        }

        addToClipboardHistory(request.content).catch((error) => {
          logger.error('添加到剪贴板历史失败:', error);
        });

        showNotification('检测到剪贴板内容变化');
      }
      break;

    case 'clipboardMonitoringToggled':
      appState.clipboardMonitoring = request.isActive;
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked = appState.clipboardMonitoring;
      }
      break;

    case 'toggleFeature':
      // 处理快捷键切换功能开关
      handleFeatureToggle(request.feature);
      break;

    case 'readClipboardFromShortcut':
      // 处理 Alt+J 快捷键读取剪贴板
      readSystemClipboard();
      break;

    default:
      break;
  }

  return true;
});

window.addEventListener('beforeunload', () => {
  logger.info('Popup正在关闭，清理资源...');

  if (appState.backgroundPort) {
    try {
      appState.backgroundPort.disconnect();
    } catch (e) {
      // 忽略断开连接错误
    }
    appState.backgroundPort = null;
  }
});

async function loadClipboardHistory() {
  try {
    appState.clipboardHistory = await clipboardHistoryManager.getHistory();
  } catch (error) {
    logger.error('加载剪贴板历史失败:', error);
    appState.clipboardHistory = [];
  }
}

async function addToClipboardHistory(text, source = 'clipboard') {
  try {
    const result = await clipboardHistoryManager.addItem(text, { source });
    if (result) {
      appState.clipboardHistory = await clipboardHistoryManager.getHistory();
      renderClipboardHistory();
    }
  } catch (error) {
    logger.error('添加剪贴板历史失败:', error);
  }
}

async function removeClipboardItem(id) {
  try {
    const result = await clipboardHistoryManager.removeItem(id);
    if (result) {
      appState.clipboardHistory = await clipboardHistoryManager.getHistory();
      renderClipboardHistory();
      showNotification('已删除');
    }
  } catch (error) {
    logger.error('删除剪贴板历史项失败:', error);
    showNotification('删除失败', false);
  }
}

async function clearClipboardHistory() {
  try {
    const result = await clipboardHistoryManager.clearHistory();
    if (result) {
      appState.clipboardHistory = [];
      renderClipboardHistory();
      showNotification('剪贴板历史已清空');
    }
  } catch (error) {
    logger.error('清空剪贴板历史失败:', error);
    showNotification('清空失败', false);
  }
}

async function exportClipboardHistory(format = 'json') {
  try {
    const result = await clipboardHistoryManager.exportHistory(format);
    if (result.success) {
      showNotification(`已导出 ${result.count} 条记录`);
    } else {
      showNotification('导出失败', false);
    }
  } catch (error) {
    logger.error('导出剪贴板历史失败:', error);
    showNotification('导出失败', false);
  }
}

async function importClipboardHistory(file, merge = true) {
  try {
    const result = await clipboardHistoryManager.importFromFile(file, {
      merge,
    });
    if (result.success) {
      appState.clipboardHistory = await clipboardHistoryManager.getHistory();
      renderClipboardHistory();
      showNotification(result.message);
    } else {
      showNotification(result.message || '导入失败', false);
    }
    return result;
  } catch (error) {
    logger.error('导入剪贴板历史失败:', error);
    showNotification('导入失败', false);
    return { success: false, error: error.message };
  }
}

async function updateClipboardSettings(settings) {
  try {
    const result = await clipboardHistoryManager.saveSettings(settings);
    if (result) {
      showNotification('设置已保存');
    }
    return result;
  } catch (error) {
    logger.error('保存剪贴板设置失败:', error);
    showNotification('保存设置失败', false);
    return false;
  }
}

async function getClipboardSettings() {
  try {
    return await clipboardHistoryManager.getSettings();
  } catch (error) {
    logger.error('获取剪贴板设置失败:', error);
    return { maxItems: 100, enabled: true, autoSave: true };
  }
}

/**
 * 处理剪贴板导入文件选择
 * @param {Event} event - 文件选择事件
 */
async function handleClipboardImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const result = await importClipboardHistory(file, true);
    if (result.success) {
      showNotification(result.message || '导入成功');
    } else {
      showNotification(result.message || '导入失败', false);
    }
  } catch (error) {
    logger.error('处理剪贴板导入失败:', error);
    showNotification('导入失败', false);
  }

  // 清空文件输入，允许再次选择同一文件
  event.target.value = '';
}

/**
 * 处理清空剪贴板历史
 */
async function handleClearClipboardHistory() {
  if (confirm('确定要清空所有剪贴板历史吗？此操作不可恢复。')) {
    try {
      const result = await clipboardHistoryManager.clearHistory();
      if (result) {
        appState.clipboardHistory = [];
        renderClipboardHistory();
        showNotification('剪贴板历史已清空');
      }
    } catch (error) {
      logger.error('清空剪贴板历史失败:', error);
      showNotification('清空失败', false);
    }
  }
}

/**
 * 显示剪贴板设置对话框
 */
async function showClipboardSettings() {
  // 显示设置面板
  const panel = document.getElementById('clipboard-settings-panel');
  if (panel) {
    panel.style.display = 'block';
    // 加载当前设置
    const settings = await getClipboardSettings();
    const enabledCheckbox = document.getElementById('clipboard-enabled');
    const autoSaveCheckbox = document.getElementById('clipboard-auto-save');
    const maxItemsInput = document.getElementById('clipboard-max-items');
    if (enabledCheckbox) enabledCheckbox.checked = settings.enabled !== false;
    if (autoSaveCheckbox) autoSaveCheckbox.checked = settings.autoSave !== false;
    if (maxItemsInput) maxItemsInput.value = settings.maxItems || 100;
  }
}

function hideClipboardSettings() {
  const panel = document.getElementById('clipboard-settings-panel');
  if (panel) {
    panel.style.display = 'none';
  }
}

async function saveClipboardSettings() {
  try {
    const enabledCheckbox = document.getElementById('clipboard-enabled');
    const autoSaveCheckbox = document.getElementById('clipboard-auto-save');
    const maxItemsInput = document.getElementById('clipboard-max-items');

    const settings = {
      enabled: enabledCheckbox ? enabledCheckbox.checked : true,
      autoSave: autoSaveCheckbox ? autoSaveCheckbox.checked : true,
      maxItems: maxItemsInput ? parseInt(maxItemsInput.value, 10) || 100 : 100,
    };

    await updateClipboardSettings(settings);
    hideClipboardSettings();
    showNotification('剪贴板设置已保存');
  } catch (error) {
    logger.error('保存剪贴板设置失败:', error);
    showNotification('保存失败', false);
  }
}

function toggleClipboardHistoryDisplay() {
  const container = document.getElementById('clipboard-history-container');
  const btn = document.getElementById('show-clipboard-btn');
  if (container) {
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    if (btn) {
      btn.innerHTML = isVisible
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg>历史'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="m9 5 7 7-7 7"/></svg>隐藏';
    }
    if (!isVisible) {
      renderClipboardHistory();
    }
  }
}

/**
 * 显示导出选项对话框
 * @returns {Promise<Object|null>} 导出选项或null（取消）
 */
async function showExportOptionsDialog() {
  return new Promise((resolve) => {
    // 创建对话框容器
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // 对话框内容
    dialog.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        min-width: 320px;
        max-width: 90%;
      ">
        <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #1f2937;">选择要导出的数据</h3>
        
        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
            <input type="checkbox" id="export-settings" checked style="margin-right: 10px; width: 18px; height: 18px;">
            <span style="font-size: 14px; color: #374151;">
              <strong>设置</strong> - 搜索引擎、用户偏好等
            </span>
          </label>
          
          <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
            <input type="checkbox" id="export-link-history" checked style="margin-right: 10px; width: 18px; height: 18px;">
            <span style="font-size: 14px; color: #374151;">
              <strong>链接历史</strong> - 搜索和访问的链接记录
            </span>
          </label>
          
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="export-clipboard-history" checked style="margin-right: 10px; width: 18px; height: 18px;">
            <span style="font-size: 14px; color: #374151;">
              <strong>剪贴板历史</strong> - 剪贴板内容记录
            </span>
          </label>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="export-cancel" style="
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            color: #6b7280;
          ">取消</button>
          <button id="export-confirm" style="
            padding: 8px 16px;
            border: none;
            background: #3b82f6;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">导出</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // 绑定事件
    dialog.querySelector('#export-cancel').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(null);
    });

    dialog.querySelector('#export-confirm').addEventListener('click', () => {
      const options = {
        settings: dialog.querySelector('#export-settings').checked,
        linkHistory: dialog.querySelector('#export-link-history').checked,
        clipboardHistory: dialog.querySelector('#export-clipboard-history').checked,
      };
      document.body.removeChild(dialog);
      resolve(options);
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
        resolve(null);
      }
    });
  });
}

function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 将本地路径转换为 file:// URL
 * @param {string} path - 本地路径
 * @returns {string|null} - file:// URL 或 null
 */
function convertPathToFileUrl(path) {
  if (!path) return null;

  // 检查是否是 URL（已经是 http/https/file 开头）
  if (/^(https?:|file:)/i.test(path)) {
    return path;
  }

  // Windows 路径处理 (D:\\path 或 D:/path)
  if (/^[a-zA-Z]:[\\/]/.test(path)) {
    // 将反斜杠转为正斜杠
    let normalizedPath = path.replace(/\\/g, '/');
    // 确保路径以 / 开头（Windows 盘符前加 /）
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    return 'file://' + normalizedPath;
  }

  // Unix/Linux/Mac 路径处理 (/home/user/...)
  if (path.startsWith('/')) {
    return 'file://' + path;
  }

  // 网络路径 (\\server\share)
  if (path.startsWith('\\\\')) {
    // 转换为 file://server/share 格式
    const normalizedPath = path.replace(/\\/g, '/');
    return 'file:' + normalizedPath;
  }

  return null;
}

/**
 * 打开路径 URL
 * @param {string} url - 要打开的 URL
 */
function openPathUrl(url) {
  if (!url) {
    showNotification('无效的路径', false);
    return;
  }

  try {
    // 使用 Chrome API 打开新标签页
    window.open(url, '_blank');
    showNotification('正在打开路径...');
  } catch (error) {
    logger.error('打开路径失败:', error);
    showNotification('打开路径失败', false);
  }
}

/**
 * 去除方括号及其中内容（支持嵌套）
 * @param {string} text - 输入文本
 * @returns {string} - 处理后的文本
 */
function removeBracketsAndContent(text) {
  if (!text) return '';

  let result = '';
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '[') {
      depth++;
      continue;
    }

    if (char === ']') {
      depth--;
      continue;
    }

    if (depth === 0) {
      result += char;
    }
  }

  // 清理多余的空格
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * 空格转义处理
 * 根据上下文选择不同的转义方式：
 * - URL 中的空格 -> %20
 * - Windows 路径中的空格 -> 保持原样或用引号包裹
 * - 其他情况 -> \ 转义或保持原样
 * @param {string} text - 输入文本
 * @returns {string} - 处理后的文本
 */
function escapeSpaces(text) {
  if (!text) return '';

  const lines = text.split('\n');

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // 检测是否是 URL
      if (/^https?:\/\//i.test(trimmed)) {
        // URL 中的空格转义为 %20
        return trimmed.replace(/ /g, '%20');
      }

      // 检测是否是 Windows 路径 (C:\\path 或 D:/path)
      if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
        // Windows 路径：如果包含空格，用引号包裹整个路径
        if (trimmed.includes(' ')) {
          return `"${trimmed}"`;
        }
        return trimmed;
      }

      // 检测是否是 Unix 路径 (/home/user)
      if (trimmed.startsWith('/')) {
        // Unix 路径：空格用 \ 转义
        return trimmed.replace(/ /g, '\\ ');
      }

      // 其他情况：空格用 \ 转义
      return trimmed.replace(/ /g, '\\ ');
    })
    .join('\n');
}

/**
 * 检测剪贴板内容类型
 * @param {string} text - 内容文本
 * @returns {string} - 类型: 'url', 'code', 'text'
 */
function detectClipboardContentType(text) {
  if (!text) return 'text';

  // 检测URL
  const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
  if (urlPattern.test(text.trim())) {
    return 'url';
  }

  // 检测代码特征
  const codePatterns = [
    /^(function|class|const|let|var|import|export|if|for|while|return)\s/m,
    /[{;}]\s*$/m,
    /^(def|class|import|from|if|for|while|return)\s/m,
    /```[\s\S]*```/,
    /^(public|private|protected|static|void|int|String)\s/m,
  ];
  if (codePatterns.some((pattern) => pattern.test(text))) {
    return 'code';
  }

  return 'text';
}

function renderClipboardHistory(searchTerm = '') {
  if (!elements.clipboard_history_list) return;

  // 过滤剪贴板历史
  let filteredHistory = appState.clipboardHistory;

  // 应用筛选标签
  const filter = appState.clipboardHistoryFilter || 'all';
  if (filter !== 'all') {
    filteredHistory = filteredHistory.filter((item) => {
      const text = item.text || '';
      const contentType = detectClipboardContentType(text);
      return contentType === filter;
    });
  }

  // 应用搜索
  if (searchTerm) {
    filteredHistory = filteredHistory.filter((item) => {
      const text = item.text || '';
      return text.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }

  if (filteredHistory.length === 0) {
    elements.clipboard_history_list.innerHTML = `<div class="empty-state"><p>${searchTerm ? '没有找到匹配的记录' : '暂无剪贴板历史'}</p><span>${searchTerm ? '请尝试其他搜索词' : '复制内容后将显示在这里'}</span></div>`;
    updateClipboardToolbar();
    return;
  }

  elements.clipboard_history_list.innerHTML = filteredHistory
    .map((item) => {
      const isSelected = isItemSelected(item.id);
      const isEditing =
        appState.clipboardMode === ClipboardMode.EDIT && appState.editingItemId === item.id;
      const showCheckbox = appState.clipboardMode === ClipboardMode.BATCH;

      if (isEditing) {
        return renderEditModeItem(item);
      } else {
        return renderNormalOrBatchItem(item, showCheckbox, isSelected);
      }
    })
    .join('');

  bindClipboardHistoryEvents();
  updateClipboardToolbar();
}

function renderNormalOrBatchItem(item, showCheckbox, isSelected) {
  const showActionBtns = appState.clipboardMode === ClipboardMode.NORMAL;
  const isBatchMode = appState.clipboardMode === ClipboardMode.BATCH;
  const truncatedText = truncateText(item.text, 150);

  return `
        <div class="history-item" data-id="${escapeHtml(String(item.id))}">
            <div class="clipboard-item-content">
                <div class="content-row">
                    <input type="checkbox" class="clipboard-checkbox"
                           data-id="${escapeHtml(String(item.id))}"
                           style="display: ${showCheckbox ? 'inline-block' : 'none'}"
                           ${isSelected ? 'checked' : ''}>
                    <div class="clipboard-text-content" data-id="${escapeHtml(String(item.id))}">${escapeHtml(truncatedText)}</div>
                    ${showActionBtns ? renderActionButtons(item.id, isBatchMode) : ''}
                </div>
                <div class="clipboard-meta">
                    <span class="timestamp">${formatRelativeTime(item.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderEditModeItem(item) {
  return `
        <div class="history-item editing" data-id="${escapeHtml(String(item.id))}">
            <div class="clipboard-item-content">
                <div class="edit-row">
                    <div class="edit-actions">
                        <button class="save-edit-btn btn-sm" data-id="${escapeHtml(String(item.id))}" title="保存">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                        </button>
                        <button class="cancel-edit-btn btn-sm" data-id="${escapeHtml(String(item.id))}" title="取消">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <textarea class="edit-textarea" data-id="${escapeHtml(String(item.id))}">${escapeHtml(item.text)}</textarea>
                </div>
            </div>
        </div>
    `;
}

function renderActionButtons(itemId, isBatchMode = false) {
  // 批量模式下不显示编辑按钮
  const safeId = escapeHtml(String(itemId));
  const editButton = isBatchMode
    ? ''
    : `
            <button class="edit-btn btn-sm" data-id="${safeId}" title="编辑">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
  `;

  return `
        <div class="item-actions">
            <button class="copy-btn btn-sm" data-id="${safeId}" title="复制">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
            </button>
            ${editButton}
        </div>
    `;
}

function bindClipboardHistoryEvents() {
  const list = elements.clipboard_history_list;
  if (!list) return;

  list.onclick = handleClipboardItemClick;
  list.onchange = handleClipboardItemChange;

  document.querySelectorAll('.save-edit-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      logger.info('保存按钮点击:', id);
      handleSaveEdit(id);
    };
  });

  document.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      logger.info('取消按钮点击');
      handleCancelEdit();
    };
  });
}

function handleClipboardItemClick(e) {
  const target = e.target;
  const closestBtn = target.closest('button');
  const closestItem = target.closest('.history-item');

  // 批量模式下点击文本框或内容区域切换勾选状态
  if (appState.clipboardMode === ClipboardMode.BATCH && closestItem) {
    const id = closestItem.dataset.id;
    const checkbox = closestItem.querySelector('.clipboard-checkbox');
    const isClickingCheckbox = target.classList.contains('clipboard-checkbox');

    // 如果点击的是复选框本身，让 change 事件处理
    if (isClickingCheckbox) return;

    // 切换勾选状态
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      if (checkbox.checked) {
        selectItem(id);
      } else {
        deselectItem(id);
      }
      updateBatchCounter();
    }
    return;
  }

  if (!closestBtn) return;

  const btnClass = closestBtn.className;
  const id = closestBtn.dataset.id;

  if (btnClass.includes('copy-btn')) {
    handleCopyItem(id);
    return;
  }

  if (btnClass.includes('edit-btn')) {
    enterEditMode(id);
    return;
  }

  if (btnClass.includes('delete-btn')) {
    handleDeleteItem(id);
    return;
  }
}

function handleClipboardItemChange(e) {
  if (!e.target.classList.contains('clipboard-checkbox')) return;

  const id = e.target.dataset.id;
  if (e.target.checked) {
    selectItem(id);
  } else {
    deselectItem(id);
  }
  updateBatchCounter();
}

function selectItem(id) {
  const checkbox = document.querySelector(`.clipboard-checkbox[data-id="${id}"]`);
  if (checkbox) checkbox.checked = true;
  updateBatchCounter();
}

function deselectItem(id) {
  const checkbox = document.querySelector(`.clipboard-checkbox[data-id="${id}"]`);
  if (checkbox) checkbox.checked = false;
  updateBatchCounter();
}

function isItemSelected(id) {
  const checkbox = document.querySelector(`.clipboard-checkbox[data-id="${id}"]`);
  return checkbox && checkbox.checked;
}

function clearSelection() {
  const checkboxes = document.querySelectorAll('.clipboard-checkbox');
  checkboxes.forEach((cb) => (cb.checked = false));
  updateBatchCounter();
}

function selectAllItems() {
  const checkboxes = document.querySelectorAll('.clipboard-checkbox');
  checkboxes.forEach((cb) => (cb.checked = true));
  updateBatchCounter();
}

function deselectAllItems() {
  clearSelection();
}

function getSelectedItemIds() {
  const checkboxes = document.querySelectorAll('.clipboard-checkbox:checked');
  return Array.from(checkboxes).map((cb) => cb.dataset.id);
}

function getSelectedClipboardItems() {
  const selectedIds = getSelectedItemIds();
  return appState.clipboardHistory.filter((item) => selectedIds.includes(item.id));
}

async function handleCopyItem(itemId) {
  const item = appState.clipboardHistory.find((item) => item.id === itemId);
  if (item) {
    try {
      await navigator.clipboard.writeText(item.text);
      showNotification('已复制到剪贴板');
    } catch (error) {
      logger.error('复制失败:', error);
      showNotification('复制失败', false);
    }
  }
}

async function handleDeleteItem(itemId) {
  if (confirm('确定要删除这条记录吗？')) {
    await removeClipboardItem(itemId);
  }
}

async function handleSaveEdit(itemId) {
  logger.info('保存编辑:', itemId);

  const textarea = document.querySelector(`.edit-textarea[data-id="${itemId}"]`);
  if (!textarea) {
    logger.error('未找到文本框');
    return;
  }

  const newText = textarea.value.trim();

  // 验证内容长度
  if (!newText) {
    showNotification('内容不能为空', false);
    return;
  }

  if (newText.length > 100000) {
    showNotification('内容过长，最多支持10万字符', false);
    return;
  }

  // 获取原内容
  const originalItem = appState.clipboardHistory.find((item) => item.id === itemId);
  const originalText = originalItem ? originalItem.text : '';

  // 如果内容没有变化，不处理
  if (newText === originalText.trim()) {
    showNotification('内容未修改');
    exitEditMode();
    return;
  }

  // 检查是否已存在相同内容的历史记录（排除当前编辑的项）
  const existingIndex = appState.clipboardHistory.findIndex(
    (item) => item.text === newText && item.id !== itemId
  );
  if (existingIndex !== -1) {
    showNotification('该内容已存在于历史记录中', false);
    exitEditMode();
    return;
  }

  try {
    // 编辑后新增一条历史记录
    await addToClipboardHistory(newText, 'edit');
    showNotification('已保存为新记录');
  } catch (error) {
    logger.error('保存编辑失败:', error);
    showNotification('保存失败', false);
  } finally {
    // 退出编辑模式并刷新界面
    exitEditMode();
  }
}

function handleCancelEdit() {
  exitEditMode();
}

function enterEditMode(itemId) {
  appState.editingItemId = itemId;
  setClipboardMode(ClipboardMode.EDIT);
}

function exitEditMode() {
  appState.editingItemId = null;
  setClipboardMode(ClipboardMode.NORMAL);
}

function setClipboardMode(mode) {
  const validModes = Object.values(ClipboardMode);
  if (!validModes.includes(mode)) {
    logger.error('无效的剪贴板模式:', mode);
    return;
  }

  const previousMode = appState.clipboardMode;
  appState.clipboardMode = mode;

  if (mode === ClipboardMode.NORMAL) {
    appState.editingItemId = null;
    clearSelection();
  } else if (mode === ClipboardMode.EDIT) {
    clearSelection();
  }

  renderClipboardHistory();
  updateClipboardToolbar();
  logger.info(`剪贴板模式切换: ${previousMode} → ${mode}`);
}

function enterBatchMode() {
  setClipboardMode(ClipboardMode.BATCH);
}

function exitBatchMode() {
  setClipboardMode(ClipboardMode.NORMAL);
}

function updateClipboardToolbar() {
  const controls = elements.clipboard_controls;
  if (!controls) return;

  const mode = appState.clipboardMode;
  const selectedCount = getSelectedItemIds().length;

  let buttonsHtml = '';

  if (mode === ClipboardMode.NORMAL) {
    buttonsHtml = `
            <button class="clipboard-action-btn" data-action="history">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                历史
            </button>
            <button class="clipboard-action-btn" data-action="batch">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                </svg>
                批量
            </button>
            <button class="clipboard-action-btn danger" data-action="clear">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                清空
            </button>
        `;
  } else if (mode === ClipboardMode.BATCH) {
    buttonsHtml = `
            <button class="clipboard-action-btn" data-action="cancel-batch">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m15 9-6 6"/>
                    <path d="m9 9 6 6"/>
                </svg>
                取消
            </button>
            <button class="clipboard-action-btn" data-action="select-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                全选
            </button>
            <button class="clipboard-action-btn ${selectedCount === 0 ? 'disabled' : ''}"
                    data-action="batch-copy" ${selectedCount === 0 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                复制(${selectedCount})
            </button>
            <button class="clipboard-action-btn danger ${selectedCount === 0 ? 'disabled' : ''}"
                    data-action="batch-delete" ${selectedCount === 0 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除(${selectedCount})
            </button>
        `;
  } else if (mode === ClipboardMode.EDIT) {
    buttonsHtml = `
            <button class="clipboard-action-btn" data-action="exit-edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                完成
            </button>
        `;
  }

  controls.innerHTML = buttonsHtml;
  bindToolbarEvents();
}

function bindToolbarEvents() {
  const controls = document.querySelector('.clipboard-controls');
  if (!controls) return;

  // 使用事件委托，避免重复绑定
  controls.addEventListener('click', handleToolbarButtonClick);
}

function handleToolbarButtonClick(e) {
  const btn = e.target.closest('.clipboard-action-btn');
  if (!btn) return;

  const action = btn.dataset.action;
  if (action) {
    handleToolbarAction(action);
  }
}

function handleToolbarAction(action) {
  switch (action) {
    case 'history':
      toggleClipboardHistory();
      break;
    case 'batch':
      enterBatchMode();
      break;
    case 'clear':
      clearClipboardHistory();
      break;
    case 'cancel-batch':
      exitBatchMode();
      break;
    case 'select-all':
      selectAllItems();
      break;
    case 'batch-copy':
      batchCopySelectedItems();
      break;
    case 'batch-delete':
      batchDeleteSelectedItems();
      break;
    case 'exit-edit':
      exitEditMode();
      break;
  }
}

async function batchDeleteSelectedItems() {
  const selectedItems = getSelectedClipboardItems();
  const deleteCount = selectedItems.length;

  if (deleteCount === 0) {
    showNotification('请先选择要删除的项', false);
    return;
  }

  if (confirm(`确定要删除选中的 ${deleteCount} 条记录吗？`)) {
    for (const item of selectedItems) {
      await clipboardHistoryManager.removeItem(item.id);
    }
    appState.clipboardHistory = await clipboardHistoryManager.getHistory();
    renderClipboardHistory();
    showNotification(`已删除 ${deleteCount} 条记录`);
  }
}

async function batchCopySelectedItems() {
  const selectedItems = getSelectedClipboardItems();

  if (selectedItems.length === 0) {
    showNotification('请先选择要复制的项目', false);
    return;
  }

  const textToCopy = selectedItems.map((item) => item.text).join('\n\n');

  try {
    await navigator.clipboard.writeText(textToCopy);
    showNotification(`已复制 ${selectedItems.length} 条记录`);
  } catch (error) {
    logger.error('批量复制失败:', error);
    showNotification('复制失败', false);
  }
}

function toggleClipboardHistory() {
  if (!elements.clipboard_history_container) return;

  appState.clipboardHistoryVisible = !appState.clipboardHistoryVisible;
  elements.clipboard_history_container.style.display = appState.clipboardHistoryVisible
    ? 'block'
    : 'none';
}

function updateBatchCounter() {
  updateClipboardToolbar();
}

function toggleBatchOperations() {
  if (appState.clipboardMode === ClipboardMode.BATCH) {
    exitBatchMode();
  } else {
    enterBatchMode();
  }
}

function batchSearchSelectedItems() {
  const selectedItems = getSelectedClipboardItems();

  if (selectedItems.length === 0) {
    showNotification('请先选择要搜索的项目', false);
    return;
  }

  const selectedTexts = selectedItems.map((item) => item.text);

  if (selectedTexts.length > 0) {
    elements.search_input.value = selectedTexts.join(' ');
    handleSearch();
    showNotification(`已将 ${selectedItems.length} 条记录添加到搜索框`);
  }
}

function renderEngineSelect() {
  if (!elements.engine_select || !appState.settings) return;

  elements.engine_select.innerHTML = '';

  appState.settings.searchEngines.forEach((engine) => {
    const option = document.createElement('option');
    option.value = engine.name;
    option.textContent = engine.name;
    if (engine.name === appState.settings.defaultEngine) {
      option.selected = true;
    }
    elements.engine_select.appendChild(option);
  });
}

function handleSearch() {
  const query = elements.search_input.value.trim();
  if (!query) return;

  if (isURL(query)) {
    window.open(query, '_blank');
    addToHistoryEnhanced(query);
    return;
  }

  let selectedEngineName = appState.settings.defaultEngine;
  if (elements.engine_select && elements.engine_select.value) {
    selectedEngineName = elements.engine_select.value;
  }

  const selectedEngine = appState.settings.searchEngines.find((e) => e.name === selectedEngineName);

  if (selectedEngine) {
    const searchUrl = selectedEngine.template.replace('%s', encodeURIComponent(query));
    window.open(searchUrl, '_blank');
    addToHistoryEnhanced(query);
  } else {
    showNotification('没有找到搜索引擎配置', false);
  }
}

async function addToHistoryEnhanced(item) {
  try {
    const isGithubRepo = isGitHubRepository(item);

    if (isGithubRepo.isRepo && isGithubRepo.githubUrl) {
      await linkHistoryManager.addLink(isGithubRepo.githubUrl, '', 'github_repo');
    } else {
      await linkHistoryManager.addLink(item, '', 'general');
    }

    appState.linkHistory = await linkHistoryManager.getHistory();
    renderHistory();
  } catch (error) {
    logger.error('添加历史记录失败:', error);
  }
}

function isGitHubRepository(url) {
  const repoPatterns = [
    /https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/zread\.ai\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/deepwiki\.com\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/context7\.com\/([^/]+)\/([^/?#]+)/,
  ];

  for (const pattern of repoPatterns) {
    const match = url.match(pattern);
    if (match) {
      const [, username, repo] = match;
      return {
        isRepo: true,
        username,
        repo,
        githubUrl: `https://github.com/${username}/${repo}`,
      };
    }
  }

  const simplePattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/;
  const simpleMatch = url.match(simplePattern);
  if (simpleMatch) {
    const [, username, repo] = simpleMatch;
    return {
      isRepo: true,
      username,
      repo,
      githubUrl: `https://github.com/${username}/${repo}`,
    };
  }

  return { isRepo: false };
}

function handleInputChange() {
  const text = elements.search_input.value;

  [
    elements.extract_container,
    elements.link_gen_container,
    elements.multi_format_container,
  ].forEach((panel) => {
    if (panel) panel.style.display = 'none';
  });

  if (!text.trim()) return;

  if (elements.switch_extract.checked) {
    elements.extract_container.style.display = 'block';
    renderExtractionUI(text);
  } else if (elements.switch_link_gen.checked) {
    elements.link_gen_container.style.display = 'block';
    renderLinkGenerationUI(text);
  } else if (elements.switch_multi_format.checked) {
    elements.multi_format_container.style.display = 'block';
    updateMultiFormatState(text);
    displayMultiFormatResult(text);
  }
}

function handleMultiFormatSwitchChange(checkbox) {
  const multiFormatContainer = document.getElementById('multi-format-container');
  if (multiFormatContainer) {
    if (checkbox.checked) {
      multiFormatContainer.style.display = 'block';
      if (elements.search_input && elements.search_input.value.trim()) {
        handleInputChange();
      }
    } else {
      multiFormatContainer.style.display = 'none';
    }
  }
}

function handleSwitchChange(activeSwitch, activePanelId) {
  logger.info(`开关变化: ${activeSwitch.id} 状态: ${activeSwitch.checked}`);

  if (activeSwitch.checked) {
    [elements.switch_extract, elements.switch_link_gen, elements.switch_multi_format].forEach(
      (sw) => {
        if (sw && sw !== activeSwitch) sw.checked = false;
      }
    );

    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = 'block';
    }
  } else {
    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = 'none';
    }
  }

  handleInputChange();
}

/**
 * 处理功能开关切换
 * @param {string} feature - 功能名称: extract, link_gen, multi_format
 */
function handleFeatureToggle(feature) {
  logger.info(`处理功能切换: ${feature}`);

  const featureMap = {
    extract: { checkbox: elements.switch_extract, containerId: 'extract-container' },
    link_gen: { checkbox: elements.switch_link_gen, containerId: 'link-gen-container' },
    multi_format: { checkbox: elements.switch_multi_format, containerId: 'multi-format-container' },
  };

  const featureConfig = featureMap[feature];
  if (!featureConfig || !featureConfig.checkbox) {
    logger.warn(`未知的功能: ${feature}`);
    return;
  }

  // 切换复选框状态
  const isChecked = featureConfig.checkbox.checked;

  // 如果当前已选中，则取消选中；否则选中并取消其他
  if (isChecked) {
    featureConfig.checkbox.checked = false;
  } else {
    // 取消其他所有开关
    Object.values(featureMap).forEach(({ checkbox }) => {
      if (checkbox) checkbox.checked = false;
    });
    // 选中当前开关
    featureConfig.checkbox.checked = true;
  }

  // 触发 change 事件
  const changeEvent = new Event('change', { bubbles: true });
  featureConfig.checkbox.dispatchEvent(changeEvent);

  // 调用对应的处理函数
  switch (feature) {
    case 'extract':
      handleSwitchChange(featureConfig.checkbox, 'extract-container');
      break;
    case 'link_gen':
      handleSwitchChange(featureConfig.checkbox, 'link-gen-container');
      break;
    case 'multi_format':
      handleMultiFormatSwitchChange(featureConfig.checkbox);
      break;
  }

  // 显示通知
  const featureNames = {
    extract: '提取和拆解',
    link_gen: '链接生成',
    multi_format: '多格式分析',
  };
  const status = featureConfig.checkbox.checked ? '已开启' : '已关闭';
  showNotification(`${featureNames[feature]} ${status}`);
}

/**
 * 存储当前路径结果和引号状态
 */
let currentPathResults = [];
let pathQuoteLevel = 0; // 引号层级，0表示无引号，1表示一层，2表示两层，以此类推

function renderExtractionUI(text) {
  if (
    !elements.path_conversion_tool ||
    !elements.link_extraction_result ||
    !elements.text_splitting_tool
  ) {
    logger.error('提取功能UI元素缺失');
    return;
  }

  const pathResults = processPath(text);

  // 始终显示拆词面板
  elements.text_splitting_tool.style.display = 'block';

  if (pathResults) {
    // 有路径时，同时显示路径转换工具和拆词面板
    elements.path_conversion_tool.style.display = 'block';
    elements.link_extraction_result.style.display = 'none';

    // 保存当前路径结果
    currentPathResults = pathResults;
    // 重置引号状态
    pathQuoteLevel = 0;

    // 渲染路径列表
    renderPathList();

    // 绑定添加引号按钮事件（支持多次点击增加层级）
    if (elements.path_add_quote_btn) {
      elements.path_add_quote_btn.onclick = () => {
        pathQuoteLevel++;
        renderPathList();
        showNotification(`已添加引号包裹 (层级: ${pathQuoteLevel})`);
      };
    }

    // 绑定重置按钮事件
    if (elements.path_reset_quote_btn) {
      elements.path_reset_quote_btn.onclick = () => {
        pathQuoteLevel = 0;
        renderPathList();
        showNotification('已重置引号操作');
      };
    }

    // 对原始文本进行拆词（不移除路径）
    renderSplittingTool(text);
  } else {
    elements.path_conversion_tool.style.display = 'none';
    elements.link_extraction_result.style.display = 'block';

    const { cleanedText, extractedLinks } = processTextExtraction(text);

    let linkHtml = '<h5>提取的链接</h5>';
    if (extractedLinks.length > 0) {
      extractedLinks.forEach((link) => addToHistoryEnhanced(link));
      linkHtml += extractedLinks
        .map((link) => {
          const safeLink = escapeHtml(link);
          return `<div class="link-item">
                <button class="copy-btn" data-link="${safeLink}">复制</button>
                <a href="${safeLink}" target="_blank">${safeLink}</a>
            </div>`;
        })
        .join('');
    } else {
      linkHtml += '<p>未找到链接。</p>';
    }
    elements.link_extraction_result.innerHTML = linkHtml;

    elements.link_extraction_result.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const link = e.target.dataset.link;
        copyToClipboard(link, e.target);
      });
    });

    renderSplittingTool(cleanedText);
  }
}

/**
 * 渲染路径列表
 * 根据 pathQuoteLevel 状态决定是否添加引号及层级
 */
function renderPathList() {
  if (!elements.path_conversion_result || currentPathResults.length === 0) return;

  elements.path_conversion_result.innerHTML = currentPathResults
    .map((p) => {
      const safePath = escapeHtml(p);
      // 根据引号层级添加引号
      const quotes = '"'.repeat(pathQuoteLevel);
      const displayPath = pathQuoteLevel > 0 ? `${quotes}${safePath}${quotes}` : safePath;
      const copyPath = pathQuoteLevel > 0 ? `${quotes}${p}${quotes}` : p;
      // 生成文件协议URL用于跳转
      const fileUrl = convertPathToFileUrl(p);
      return `<div class="path-item">
                <button class="path-copy-btn" data-path="${escapeHtml(copyPath)}">复制</button>
                ${fileUrl ? `<button class="path-open-btn" data-url="${escapeHtml(fileUrl)}">打开</button>` : ''}
                <pre>${displayPath}</pre>
            </div>`;
    })
    .join('');

  // 绑定复制按钮事件
  elements.path_conversion_result.querySelectorAll('.path-copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const path = e.target.dataset.path;
      copyToClipboard(path, e.target);
    });
  });

  // 绑定打开按钮事件
  elements.path_conversion_result.querySelectorAll('.path-open-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const url = e.target.dataset.url;
      openPathUrl(url);
    });
  });
}

function renderLinkGenerationUI(text) {
  if (!elements.link_gen_container) return;

  const linkGenResult = processLinkGeneration(text);
  let html = '';

  if (linkGenResult) {
    if (linkGenResult.originalGithubLink) {
      addToHistoryEnhanced(linkGenResult.originalGithubLink);
    }

    html =
      '<h5>生成的链接</h5>' +
      linkGenResult.generatedLinks
        .map((link) => {
          addToHistoryEnhanced(link);
          const safeLink = escapeHtml(link);
          return `<div class="link-item">
                <button class="copy-btn" data-link="${safeLink}">复制</button>
                <a href="${safeLink}" target="_blank">${safeLink}</a>
            </div>`;
        })
        .join('');

    html += `
            <div class="extract-buttons">
                <button id="extract-emails-btn" class="extract-btn">提取邮箱</button>
                <button id="extract-phones-btn" class="extract-btn">提取号码</button>
            </div>
            <div id="extract-results"></div>
        `;
  } else {
    html = '<p>请输入 "用户名/仓库名" 或已知的仓库URL。</p>';
  }

  elements.link_gen_container.innerHTML = html;

  elements.link_gen_container.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const link = e.target.dataset.link;
      copyToClipboard(link, e.target);
    });
  });

  const extractEmailsBtn = document.getElementById('extract-emails-btn');
  const extractPhonesBtn = document.getElementById('extract-phones-btn');

  if (extractEmailsBtn) {
    extractEmailsBtn.addEventListener('click', () => handleExtractEmails(text));
  }

  if (extractPhonesBtn) {
    extractPhonesBtn.addEventListener('click', () => handleExtractPhones(text));
  }
}

function handleExtractEmails(text) {
  const emails = extractEmails(text);
  displayExtractResults('邮箱地址', emails);
}

function handleExtractPhones(text) {
  const phones = extractPhoneNumbers(text);
  displayExtractResults('号码', phones);
}

function displayExtractResults(type, results) {
  const resultsContainer = document.getElementById('extract-results');
  if (!resultsContainer) return;

  if (results.length > 0) {
    let html = `<h5>提取的${type}</h5>`;
    html += results
      .map((item) => {
        return `<div class="extract-item">
                <button class="copy-btn" data-text="${item}">复制</button>
                <span>${item}</span>
            </div>`;
      })
      .join('');
    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const text = e.target.dataset.text;
        copyToClipboard(text, e.target);
      });
    });
  } else {
    resultsContainer.innerHTML = `<p>未找到${type}。</p>`;
  }
}

function renderMultiFormatAnalysis(text) {
  if (!elements.multi_format_container) return;

  const results = analyzeTextForMultipleFormats(text);

  elements.multi_format_container.innerHTML = '';

  if (results.length === 0) {
    elements.multi_format_container.innerHTML =
      '<div class="no-results">未检测到可处理的格式</div>';
    return;
  }

  results.forEach((result) => {
    const card = document.createElement('div');
    card.className = 'format-card';

    const safeType = escapeHtml(result.type);
    const safeTypeId = result.type.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    card.innerHTML = `
            <div class="format-header">${safeType}</div>
            <div class="format-controls">
                <button class="process-btn" data-type="${safeType}" data-original="${encodeURIComponent(text)}">单独处理</button>
            </div>
            <div class="format-content" id="format-${safeTypeId}"></div>
            <div class="format-processed-result" id="processed-${safeTypeId}"></div>
        `;

    const content = card.querySelector(`#format-${safeTypeId}`);

    if (result.type === '路径转换') {
      result.data.forEach((path) => {
        const safePath = escapeHtml(path);
        const item = document.createElement('div');
        item.className = 'path-item';
        item.innerHTML = `
                    <button class="copy-btn" data-path="${safePath}">复制</button>
                    <span class="path-text">${safePath}</span>
                `;
        content.appendChild(item);
      });
    } else if (['链接提取', '仓库链接', 'GitHub链接'].includes(result.type)) {
      result.data.forEach((linkObj) => {
        const linkUrl = linkObj.url || linkObj;
        addToHistoryEnhanced(linkUrl);
        const safeLinkUrl = escapeHtml(linkUrl);

        const item = document.createElement('div');
        item.className = 'link-item';
        item.innerHTML = `
                    <button class="copy-btn" data-link="${safeLinkUrl}">复制</button>
                    <a href="${safeLinkUrl}" target="_blank">${safeLinkUrl}</a>
                `;
        content.appendChild(item);
      });
    } else if (['邮箱地址', '电话号码', 'IP地址'].includes(result.type)) {
      result.data.forEach((item) => {
        const value = item.url || item;
        const displayValue = value.replace(/^(mailto:|tel:|http:\/\/)/, '');
        const safeValue = escapeHtml(value);
        const safeDisplayValue = escapeHtml(displayValue);
        const itemEl = document.createElement('div');
        itemEl.className = 'format-item';
        itemEl.innerHTML = `
                    <button class="copy-btn" data-value="${safeValue}">复制</button>
                    <span class="format-value">${safeDisplayValue}</span>
                `;
        content.appendChild(itemEl);
      });
    }

    elements.multi_format_container.appendChild(card);
  });

  elements.multi_format_container.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const text = e.target.dataset.path || e.target.dataset.link || e.target.dataset.value;
      copyToClipboard(text, e.target);
    });
  });
}

function updateMultiFormatState(text) {
  appState.multiFormatState.originalText = text;
  appState.multiFormatState.processingHistory = [text];
  appState.multiFormatState.currentIndex = 0;
  updateBackButtonState();
}

function displayMultiFormatResult(text) {
  const resultContainer = document.getElementById('multi-format-result');
  if (!resultContainer) return;

  resultContainer.innerHTML = text;
}

function updateBackButtonState() {
  const backButton = document.getElementById('back-to-previous');
  if (!backButton) return;

  backButton.disabled = appState.multiFormatState.currentIndex <= 0;
  if (backButton.disabled) {
    backButton.style.opacity = '0.5';
    backButton.style.cursor = 'not-allowed';
  } else {
    backButton.style.opacity = '1';
    backButton.style.cursor = 'pointer';
  }
}

function handleBackToPrevious() {
  if (appState.multiFormatState.currentIndex > 0) {
    appState.multiFormatState.currentIndex--;
    const previousResult =
      appState.multiFormatState.processingHistory[appState.multiFormatState.currentIndex];
    displayMultiFormatResult(previousResult);
    updateBackButtonState();
  }
}

/**
 * 处理拆分模式切换
 */
function handleSplitModeChange() {
  const mode = elements.split_delimiter_select.value;
  const multiRuleButtons = document.getElementById('multi-rule-buttons');
  const splitOutput = elements.split_output_container;

  if (mode === 'multi') {
    // 多规则模式
    if (multiRuleButtons) {
      multiRuleButtons.style.display = 'block';
    }

    // 初始化多规则模式
    const inputText = elements.search_input?.value?.trim();
    if (inputText) {
      initMultiRuleMode(inputText);
    } else {
      splitOutput.innerHTML = '<div class="no-results">请输入文本</div>';
    }
  } else {
    // 其他模式
    if (multiRuleButtons) {
      multiRuleButtons.style.display = 'none';
    }

    // 重置多规则状态
    appState.multiRuleState.processingHistory = [];
    appState.multiRuleState.currentIndex = -1;

    // 执行普通拆分
    if (elements.search_input && elements.search_input.value.trim()) {
      renderSplittingTool(elements.search_input.value);
    }
  }
}

async function handleCopyResult() {
  const resultContainer = document.getElementById('multi-format-result');
  if (!resultContainer) return;

  const resultText = resultContainer.innerText;
  if (!resultText) return;

  try {
    await copyTextToClipboard(resultText);
    showNotification('已复制到剪贴板');
  } catch (err) {
    logger.error('复制结果失败:', err);
    showNotification('复制失败', false);
  }
}

function handleSearchResult() {
  const resultContainer = document.getElementById('multi-format-result');
  if (!resultContainer) return;

  const resultText = resultContainer.innerText;
  if (!resultText) return;

  if (isURL(resultText)) {
    window.open(resultText, '_blank');
    addToHistoryEnhanced(resultText);
    return;
  }

  let selectedEngineName = appState.settings.defaultEngine;
  if (elements.engine_select && elements.engine_select.value) {
    selectedEngineName = elements.engine_select.value;
  }

  const selectedEngine = appState.settings.searchEngines.find((e) => e.name === selectedEngineName);

  if (selectedEngine) {
    const searchUrl = selectedEngine.template.replace('%s', encodeURIComponent(resultText));
    window.open(searchUrl, '_blank');
    addToHistoryEnhanced(resultText);
  } else {
    showNotification('没有找到搜索引擎配置', false);
  }
}

function handleFormatButtonClick(e) {
  const btn = e.target;
  const action = btn.dataset.action;
  const currentText =
    appState.multiFormatState.processingHistory[appState.multiFormatState.currentIndex] || '';

  if (!currentText) {
    const inputText = elements.search_input.value.trim();
    if (!inputText) {
      displayMultiFormatResult('请先在输入框中输入文本，然后点击下方按钮进行处理');
      return;
    }
    updateMultiFormatState(inputText);
    return;
  }

  let processedResult = currentText;

  switch (action) {
    case 'remove-chinese': {
      processedResult = currentText.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '');
      break;
    }
    case 'remove-non-url-chars': {
      processedResult = currentText
        .replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef<>{}|^`'"\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      break;
    }
    case 'convert-to-url-chars': {
      processedResult = encodeURIComponent(currentText);
      break;
    }
    case 'convert-period':
      processedResult = currentText.replace(/。/g, '.');
      break;
    case 'convert-slash-to-backslash':
      processedResult = currentText.replace(/\//g, '\\');
      break;
    case 'convert-backslash-to-slash':
      processedResult = currentText.replace(/\\/g, '/');
      break;
    case 'convert-slash-to-double':
      processedResult = currentText.replace(/\//g, (match, offset, string) => {
        const prevChar = string[offset - 1];
        const nextChar = string[offset + 1];
        if (prevChar !== '/' && nextChar !== '/') {
          return '//';
        }
        return match;
      });
      break;
    case 'remove-spaces':
      processedResult = currentText.replace(/\s+/g, '');
      break;
    case 'convert-backslash-to-double':
      processedResult = currentText.replace(/\\/g, (match, offset, string) => {
        const prevChar = string[offset - 1];
        const nextChar = string[offset + 1];
        if (prevChar !== '\\' && nextChar !== '\\') {
          return '\\\\';
        }
        return match;
      });
      break;
    case 'add-file-protocol':
      // 在每行路径前添加 file:///
      processedResult = currentText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          // 如果已经是 file:// 开头，不处理
          if (trimmed.startsWith('file://')) return line;
          // 如果是 Windows 路径或 Unix 路径，添加 file:///
          if (
            /^[a-zA-Z]:[\\/]/.test(trimmed) ||
            trimmed.startsWith('/') ||
            trimmed.startsWith('\\')
          ) {
            // 将反斜杠转为正斜杠
            const normalizedPath = trimmed.replace(/\\/g, '/');
            // 确保路径以 / 开头
            const pathWithSlash = normalizedPath.startsWith('/')
              ? normalizedPath
              : '/' + normalizedPath;
            return 'file://' + pathWithSlash;
          }
          return line;
        })
        .join('\n');
      break;
    case 'remove-brackets':
      // 去除 [] 及其中内容（包括嵌套的方括号）
      processedResult = removeBracketsAndContent(currentText);
      break;
    case 'escape-spaces':
      // 空格转义：将空格转换为 %20 或 \ 或引号包裹（根据上下文）
      processedResult = escapeSpaces(currentText);
      break;
    default:
      break;
  }

  if (processedResult !== currentText) {
    if (
      appState.multiFormatState.currentIndex <
      appState.multiFormatState.processingHistory.length - 1
    ) {
      appState.multiFormatState.processingHistory =
        appState.multiFormatState.processingHistory.slice(
          0,
          appState.multiFormatState.currentIndex + 1
        );
    }
    appState.multiFormatState.processingHistory.push(processedResult);
    appState.multiFormatState.currentIndex++;
    displayMultiFormatResult(processedResult);
    updateBackButtonState();
  }
}

function handleSingleFormatProcessing(e) {
  const btn = e.target;
  const formatType = btn.dataset.type;

  // 安全地解码URI，处理可能的异常
  let originalText;
  try {
    originalText = decodeURIComponent(btn.dataset.original);
  } catch (decodeError) {
    logger.error('解码原始文本失败:', decodeError);
    showNotification('处理失败：文本格式错误', false);
    return;
  }

  const safeTypeId = formatType.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
  const resultContainer = document.getElementById(`processed-${safeTypeId}`);

  if (!resultContainer) {
    logger.error('未找到结果容器:', safeTypeId);
    return;
  }

  resultContainer.innerHTML = '';

  let processedResult;
  switch (formatType) {
    case '路径转换':
      processedResult = processPath(originalText);
      break;
    case '链接提取':
      processedResult = processTextExtraction(originalText).extractedLinks;
      break;
    case '仓库链接':
    case 'GitHub链接':
      processedResult = processLinkGeneration(originalText)?.generatedLinks || [];
      break;
    case '邮箱地址': {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      processedResult = [...new Set(originalText.match(emailRegex) || [])];
      break;
    }
    case '电话号码': {
      const phoneRegex = /(?:\+86[\s-]?)?(?:1[3-9]\d{9}|0\d{2,3}[\s-]?\d{7,8})/g;
      processedResult = [...new Set(originalText.match(phoneRegex) || [])];
      break;
    }
    case 'IP地址': {
      const ipRegex =
        /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
      processedResult = [...new Set(originalText.match(ipRegex) || [])];
      break;
    }
    default:
      processedResult = [];
  }

  if (processedResult && processedResult.length > 0) {
    resultContainer.innerHTML = `
            <div class="processed-header">处理结果：</div>
            <div class="processed-content">
                ${formatProcessedResults(processedResult, formatType)}
            </div>
        `;

    resultContainer.querySelectorAll('.copy-btn').forEach((copyBtn) => {
      copyBtn.addEventListener('click', (copyEvent) => {
        const text =
          copyEvent.target.dataset.text ||
          copyEvent.target.dataset.link ||
          copyEvent.target.dataset.path;
        copyToClipboard(text, copyBtn);
      });
    });
  } else {
    resultContainer.innerHTML = '<div class="no-processed-results">未生成处理结果</div>';
  }
}

function formatProcessedResults(results, type) {
  if (!results || results.length === 0) {
    return '<div class="no-results">无结果</div>';
  }

  let html = '';

  switch (type) {
    case '路径转换':
      html = results
        .map(
          (path) => `
                <div class="processed-item">
                    <button class="copy-btn" data-path="${path}">复制</button>
                    <span class="processed-text">${path}</span>
                </div>
            `
        )
        .join('');
      break;
    case '链接提取':
    case '仓库链接':
    case 'GitHub链接':
      html = results
        .map(
          (link) => `
                <div class="processed-item">
                    <button class="copy-btn" data-link="${link}">复制</button>
                    <a href="${link}" target="_blank">${link}</a>
                </div>
            `
        )
        .join('');
      break;
    default:
      html = results
        .map(
          (item) => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${item}">复制</button>
                    <span class="processed-text">${item}</span>
                </div>
            `
        )
        .join('');
  }

  return html;
}

function renderSplittingTool(text) {
  if (!elements.split_delimiter_select || !elements.split_output_container) {
    logger.error('拆分工具UI元素缺失');
    return;
  }

  // 检查是否是多规则模式
  const multiRuleButtons = document.getElementById('multi-rule-buttons');
  if (multiRuleButtons && multiRuleButtons.style.display !== 'none') {
    // 多规则模式：使用当前状态的结果
    const currentResult = getMultiRuleCurrentResult();
    if (currentResult) {
      renderSplitItems(currentResult);
      return;
    }
  }

  const delimiter = elements.split_delimiter_select.value;
  splitText(text, delimiter).then((splitItems) => {
    renderSplitItems(splitItems);
  });
}

/**
 * 获取多规则当前结果
 */
function getMultiRuleCurrentResult() {
  if (appState.multiRuleState.currentIndex >= 0) {
    return appState.multiRuleState.processingHistory[appState.multiRuleState.currentIndex];
  }
  return null;
}

/**
 * 更新多规则状态
 * @param {Array} result - 处理结果
 * @param {string} rule - 应用的规则名称（可选）
 */
function updateMultiRuleState(result, rule = null) {
  // 如果当前不是最后一步，截断历史
  if (appState.multiRuleState.currentIndex < appState.multiRuleState.processingHistory.length - 1) {
    appState.multiRuleState.processingHistory = appState.multiRuleState.processingHistory.slice(
      0,
      appState.multiRuleState.currentIndex + 1
    );
    // 同时截断规则历史
    if (appState.multiRuleState.appliedRules) {
      appState.multiRuleState.appliedRules = appState.multiRuleState.appliedRules.slice(
        0,
        appState.multiRuleState.currentIndex
      );
    }
  }

  // 添加新结果
  appState.multiRuleState.processingHistory.push(result);
  appState.multiRuleState.currentIndex++;

  // 记录应用的规则
  if (!appState.multiRuleState.appliedRules) {
    appState.multiRuleState.appliedRules = [];
  }
  if (rule) {
    appState.multiRuleState.appliedRules.push(rule);
  }

  // 限制历史长度（最多10次）
  const maxHistory = 10;
  if (appState.multiRuleState.processingHistory.length > maxHistory) {
    appState.multiRuleState.processingHistory.shift();
    appState.multiRuleState.currentIndex--;
    if (appState.multiRuleState.appliedRules) {
      appState.multiRuleState.appliedRules.shift();
    }
  }

  // 更新返回按钮状态
  updateMultiRuleBackButton();
  // 更新历史显示
  updateMultiRuleHistoryDisplay();
}

/**
 * 处理多规则按钮点击
 */
function handleMultiRuleButtonClick(rule) {
  const currentText = getMultiRuleCurrentText();
  if (!currentText) {
    showNotification('请先输入文本', false);
    return;
  }

  const { result, hasConflict, conflictMessage } = applySingleRule(currentText, rule);

  if (hasConflict && conflictMessage) {
    showNotification(conflictMessage, false);
  }

  if (result && result.length > 0) {
    // 传入规则名称以便记录
    updateMultiRuleState(result, rule);
    renderSplitItems(result);
    showNotification(`已应用: ${getRuleName(rule)}`);
  }
}

/**
 * 获取多规则当前文本
 */
function getMultiRuleCurrentText() {
  if (appState.multiRuleState.currentIndex >= 0) {
    const current = appState.multiRuleState.processingHistory[appState.multiRuleState.currentIndex];
    // 使用空格连接数组元素，而不是直接拼接，以保持语义完整性
    return Array.isArray(current) ? current.join(' ') : current;
  }
  // 从输入框获取初始文本
  const inputText = elements.search_input?.value?.trim();
  if (inputText) {
    appState.multiRuleState.originalText = inputText;
    appState.multiRuleState.processingHistory = [inputText];
    appState.multiRuleState.currentIndex = 0;
    return inputText;
  }
  return null;
}

/**
 * 获取规则名称
 */
function getRuleName(rule) {
  const ruleNames = {
    symbolSplit: '符号分词',
    whitespaceSplit: '空格分词',
    newlineSplit: '换行分词',
    chineseEnglishSplit: '中英分词',
    uppercaseSplit: '大写分词',
    namingSplit: '命名分词',
    digitSplit: '数字分词',
    removeWhitespace: '去除空格',
    removeSymbols: '去除符号',
    removeChinese: '去除中文',
    removeEnglish: '去除英文',
    removeDigits: '去除数字',
  };
  return ruleNames[rule] || rule;
}

/**
 * 更新多规则操作历史显示
 */
function updateMultiRuleHistoryDisplay() {
  const historyList = document.getElementById('multi-rule-history-list');
  if (!historyList) return;

  // 获取应用过的规则列表（从索引1开始，因为0是原始文本）
  const appliedRules = [];
  for (let i = 1; i <= appState.multiRuleState.currentIndex; i++) {
    // 从处理历史中推断使用的规则
    // 这里我们使用一个简单的方法：记录每次点击的规则
    if (appState.multiRuleState.appliedRules && appState.multiRuleState.appliedRules[i - 1]) {
      appliedRules.push(appState.multiRuleState.appliedRules[i - 1]);
    }
  }

  if (appliedRules.length === 0) {
    historyList.textContent = '无';
    historyList.style.color = 'var(--text-secondary)';
  } else {
    historyList.textContent = appliedRules.map((r, i) => `${i + 1}.${getRuleName(r)}`).join(' → ');
    historyList.style.color = 'var(--primary)';
  }
}

/**
 * 多规则返回上一步（撤销）
 */
function handleMultiRuleBack() {
  if (appState.multiRuleState.currentIndex > 0) {
    appState.multiRuleState.currentIndex--;
    // 移除最后应用的规则
    if (appState.multiRuleState.appliedRules && appState.multiRuleState.appliedRules.length > 0) {
      appState.multiRuleState.appliedRules.pop();
    }
    const result = appState.multiRuleState.processingHistory[appState.multiRuleState.currentIndex];
    renderSplitItems(result);
    updateMultiRuleBackButton();
    updateMultiRuleHistoryDisplay();
    showNotification('已撤销上一步');
  }
}

/**
 * 多规则重置
 */
function handleMultiRuleReset() {
  appState.multiRuleState.processingHistory = [];
  appState.multiRuleState.currentIndex = -1;
  appState.multiRuleState.appliedRules = [];
  updateMultiRuleBackButton();
  updateMultiRuleHistoryDisplay();

  // 重新渲染初始文本
  const inputText = elements.search_input?.value?.trim();
  if (inputText) {
    appState.multiRuleState.originalText = inputText;
    appState.multiRuleState.processingHistory = [inputText];
    appState.multiRuleState.currentIndex = 0;
    renderSplitItems([inputText]);
    updateMultiRuleBackButton();
  } else {
    elements.split_output_container.innerHTML = '<div class="no-results">请输入文本</div>';
  }
  showNotification('已重置');
}

/**
 * 更新多规则返回按钮状态
 */
function updateMultiRuleBackButton() {
  const backBtn = document.getElementById('multi-rule-back-btn');
  if (backBtn) {
    backBtn.disabled = appState.multiRuleState.currentIndex <= 0;
  }
}

/**
 * 初始化多规则模式
 */
function initMultiRuleMode(text) {
  appState.multiRuleState.originalText = text;
  appState.multiRuleState.processingHistory = [text];
  appState.multiRuleState.currentIndex = 0;
  appState.multiRuleState.appliedRules = [];
  updateMultiRuleBackButton();
  updateMultiRuleHistoryDisplay();
  renderSplitItems([text]);
}

/**
 * 处理刷新按钮点击
 */
function handleRefreshSplit() {
  const inputText = elements.search_input?.value?.trim();
  if (!inputText) {
    showNotification('请先输入文本', false);
    return;
  }

  const mode = elements.split_delimiter_select?.value;

  switch (mode) {
    case 'random':
      // 随机分词：重新生成
      randomAnalyze(inputText).then((result) => {
        renderSplitItems(result);
        showNotification('随机分词已刷新');
      });
      break;

    case 'multi':
      // 多规则模式：重置到初始状态
      handleMultiRuleReset();
      showNotification('多规则模式已重置');
      break;

    default:
      // 其他模式：重新执行拆分
      renderSplittingTool(inputText);
      showNotification('已刷新');
      break;
  }
}

function renderSplitItems(splitItems) {
  appState.splitItemsState = splitItems.map((item) => ({
    text: item,
    selected: false,
  }));

  let html = '';
  const ITEMS_PER_ROW = 5;

  for (let i = 0; i < appState.splitItemsState.length; i += ITEMS_PER_ROW) {
    const rowItems = appState.splitItemsState.slice(i, i + ITEMS_PER_ROW);
    const rowNum = Math.floor(i / ITEMS_PER_ROW) + 1;

    html += `<div class="split-row">
            <div class="split-row-header">
                <input type="checkbox" class="split-row-checkbox" data-row-start-index="${i}">
                <span>第 ${rowNum} 行</span>
            </div>
            <div class="split-row-items">
                ${rowItems
                  .map(
                    (item, index) =>
                      `<div class="split-item" data-index="${i + index}">${item.text}</div>`
                  )
                  .join('')}
            </div>
        </div>`;
  }

  elements.split_output_container.innerHTML = html;
  addSplitItemListeners();

  if (elements.select_all_checkbox) {
    elements.select_all_checkbox.checked = false;
  }
}

function getSelectedRules() {
  const checkboxes = document.querySelectorAll(
    '#multi-rule-selection input[type="checkbox"]:checked'
  );
  return Array.from(checkboxes).map((cb) => cb.value);
}

function toggleMultiRuleSelection() {
  const checkbox = document.getElementById('enable-multi-rules');
  const container = document.getElementById('multi-rule-selection');

  if (checkbox && container) {
    container.style.display = checkbox.checked ? 'block' : 'none';

    if (elements.split_delimiter_select) {
      elements.split_delimiter_select.disabled = checkbox.checked;
    }

    if (elements.search_input && elements.search_input.value.trim()) {
      renderSplittingTool(elements.search_input.value);
    }
  }
}

function addSplitItemListeners() {
  document.querySelectorAll('.split-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      appState.splitItemsState[index].selected = !appState.splitItemsState[index].selected;
      e.target.classList.toggle('selected', appState.splitItemsState[index].selected);
    });
  });

  document.querySelectorAll('.split-row-checkbox').forEach((el) => {
    el.addEventListener('change', (e) => {
      const startIndex = parseInt(e.target.dataset.rowStartIndex);
      const endIndex = Math.min(startIndex + 5, appState.splitItemsState.length);

      for (let i = startIndex; i < endIndex; i++) {
        appState.splitItemsState[i].selected = e.target.checked;
        const item = document.querySelector(`.split-item[data-index="${i}"]`);
        if (item) {
          item.classList.toggle('selected', e.target.checked);
        }
      }
    });
  });
}

function renderHistory(searchTerm = '') {
  if (!elements.history_list || !appState.linkHistory) return;

  // 过滤历史记录
  let filteredHistory = appState.linkHistory;

  // 应用筛选标签
  const filter = appState.linkHistoryFilter || 'all';
  if (filter !== 'all') {
    filteredHistory = filteredHistory.filter((item) => {
      let url, isGithub;
      if (typeof item === 'string') {
        url = item;
        isGithub = url.includes('github.com');
      } else if (item && typeof item === 'object') {
        url = item.url || item.toString();
        isGithub = item.type === 'github' || item.isGitHubRepo || url.includes('github.com');
      }
      if (filter === 'github') return isGithub;
      if (filter === 'other') return !isGithub;
      return true;
    });
  }

  // 应用搜索
  if (searchTerm) {
    filteredHistory = filteredHistory.filter((item) => {
      let url, domain;
      if (typeof item === 'string') {
        url = item;
        try {
          const urlObj = new URL(url);
          domain = urlObj.hostname;
        } catch (e) {
          domain = '搜索查询';
        }
      } else if (item && typeof item === 'object') {
        url = item.url || item.toString();
        domain = item.domain || item.title || '未知域名';
      }
      const searchLower = searchTerm.toLowerCase();
      return (
        (url && url.toLowerCase().includes(searchLower)) ||
        (domain && domain.toLowerCase().includes(searchLower))
      );
    });
  }

  if (filteredHistory.length === 0) {
    elements.history_list.innerHTML = `
            <div class="empty-state">
                <p>${searchTerm ? '没有找到匹配的记录' : '暂无历史记录'}</p>
                <span>${searchTerm ? '请尝试其他搜索词' : '处理的链接将会显示在这里'}</span>
            </div>
        `;
    return;
  }

  elements.history_list.innerHTML = filteredHistory
    .map((item) => {
      let url, displayUrl, isGithub, domain, id;

      if (typeof item === 'string') {
        url = item;
        displayUrl = item;
        isGithub = url.includes('github.com');
        id = item;
        try {
          const urlObj = new URL(url);
          domain = urlObj.hostname;
        } catch (e) {
          domain = '搜索查询';
        }
      } else if (item && typeof item === 'object') {
        url = item.url || item.toString();
        displayUrl = item.unescapedUrl || url;
        isGithub =
          item.type === 'github' || item.isGitHubRepo || (url && url.includes('github.com'));
        domain = item.domain || item.title || '未知域名';
        id = item.id || item.url || String(Date.now());
      } else {
        return '';
      }

      if (!url || url.trim() === '') {
        return '';
      }

      // 确保id是字符串且不为空
      const safeId = id ? String(id) : String(Date.now());

      // 检查是否正在编辑此项
      const isEditing = appState.editingLinkHistoryId === safeId;

      // 编辑模式下添加editable类
      const editableClass =
        appState.linkHistoryMode === LinkHistoryMode.EDIT && !isEditing ? 'editable' : '';

      if (isEditing) {
        // 编辑模式UI - 卡片式设计
        return `
            <div class="history-item editing ${isGithub ? 'github-item' : 'other-item'}" data-id="${safeId}" data-url="${url}">
                <div class="history-content edit-mode">
                    <div class="edit-header">
                        <span class="edit-label">编辑链接</span>
                        <span class="edit-domain">${domain}</span>
                    </div>
                    <textarea class="edit-url-textarea" data-id="${safeId}" rows="3" placeholder="输入链接地址...">${url}</textarea>
                    <div class="edit-actions-row">
                        <button class="save-edit-btn btn-primary" data-id="${safeId}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            保存
                        </button>
                        <button class="cancel-edit-btn btn-secondary" data-id="${safeId}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            取消
                        </button>
                    </div>
                </div>
            </div>
        `;
      }

      // 编辑模式下禁用链接和按钮
      const isEditMode = appState.linkHistoryMode === LinkHistoryMode.EDIT;
      const linkHtml = isEditMode
        ? `<span class="history-link disabled">${displayUrl}</span>`
        : `<a href="${url}" target="_blank" class="history-link">${displayUrl}</a>`;
      const buttonsHtml = isEditMode
        ? '<button class="copy-btn btn-sm" disabled>复制</button><button class="remove-btn btn-sm" disabled>删除</button>'
        : `<button class="copy-btn btn-sm" data-link="${url}">复制</button><button class="remove-btn btn-sm" data-id="${safeId}" data-link="${url}">删除</button>`;

      return `
            <div class="history-item ${isGithub ? 'github-item' : 'other-item'} ${editableClass}" data-id="${safeId}" data-url="${url}">
                <div class="history-content">
                    ${linkHtml}
                    <span class="history-domain">${domain}</span>
                </div>
                <div class="history-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;
    })
    .filter((html) => html !== '')
    .join('');

  document.querySelectorAll('.history-item .copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const link = e.target.dataset.link;
      copyToClipboard(link, e.target);
    });
  });

  document.querySelectorAll('.history-item .remove-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const link = e.target.dataset.link;
      const id = e.target.dataset.id;
      if (confirm(`确定要删除这个历史记录吗？\n${link}`)) {
        try {
          if (id && id !== link) {
            await linkHistoryManager.removeItem(id);
          } else {
            const history = await linkHistoryManager.getHistory();
            const itemToRemove = history.find((item) => item.url === link);
            if (itemToRemove && itemToRemove.id) {
              await linkHistoryManager.removeItem(itemToRemove.id);
            }
          }

          appState.linkHistory = await linkHistoryManager.getHistory();
          renderHistory();
          showNotification('历史记录已删除');
        } catch (error) {
          logger.error('删除历史记录失败:', error);
          showNotification('删除失败', false);
        }
      }
    });
  });

  // 编辑模式下的历史项点击事件
  if (appState.linkHistoryMode === LinkHistoryMode.EDIT) {
    document.querySelectorAll('.history-item.editable').forEach((item) => {
      item.addEventListener('click', (e) => {
        // 如果点击的是按钮，不触发编辑
        if (e.target.closest('button')) return;
        const id = item.dataset.id;
        const url = item.dataset.url;
        startEditingLinkHistory(id, url);
      });
    });
  }

  // 保存编辑按钮事件
  document.querySelectorAll('.save-edit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const textarea = document.querySelector(`.edit-url-textarea[data-id="${id}"]`);
      if (textarea) {
        await saveLinkHistoryEdit(id, textarea.value);
      }
    });
  });

  // 取消编辑按钮事件
  document.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelLinkHistoryEdit();
    });
  });
}

/**
 * 切换链接历史编辑模式
 */
function toggleLinkHistoryEditMode() {
  if (appState.linkHistoryMode === LinkHistoryMode.NORMAL) {
    appState.linkHistoryMode = LinkHistoryMode.EDIT;
    elements.edit_history_btn.classList.add('active');
    elements.edit_history_btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      取消
    `;
    showNotification('点击历史项进行编辑');
  } else {
    appState.linkHistoryMode = LinkHistoryMode.NORMAL;
    appState.editingLinkHistoryId = null;
    appState.editingLinkHistoryOriginalUrl = null;
    elements.edit_history_btn.classList.remove('active');
    elements.edit_history_btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      编辑
    `;
  }
  renderHistory();
}

/**
 * 开始编辑链接历史项
 */
function startEditingLinkHistory(id, url) {
  appState.editingLinkHistoryId = id;
  appState.editingLinkHistoryOriginalUrl = url;
  renderHistory();
}

/**
 * 保存链接历史编辑
 */
async function saveLinkHistoryEdit(id, newUrl) {
  const originalUrl = appState.editingLinkHistoryOriginalUrl;

  // 如果没有修改，不新增内容
  if (newUrl.trim() === originalUrl) {
    cancelLinkHistoryEdit();
    showNotification('内容未修改');
    return;
  }

  try {
    // 删除旧项
    if (id && id !== originalUrl) {
      await linkHistoryManager.removeItem(id);
    } else {
      const history = await linkHistoryManager.getHistory();
      const itemToRemove = history.find((item) => {
        const itemUrl = typeof item === 'string' ? item : item.url;
        return itemUrl === originalUrl;
      });
      if (itemToRemove && itemToRemove.id) {
        await linkHistoryManager.removeItem(itemToRemove.id);
      }
    }

    // 添加新项到顶部
    await linkHistoryManager.addToHistory(newUrl.trim());

    // 重置编辑状态
    appState.editingLinkHistoryId = null;
    appState.editingLinkHistoryOriginalUrl = null;
    appState.linkHistoryMode = LinkHistoryMode.NORMAL;
    elements.edit_history_btn.classList.remove('active');
    elements.edit_history_btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      编辑
    `;

    // 刷新历史列表
    appState.linkHistory = await linkHistoryManager.getHistory();
    renderHistory();
    showNotification('已保存修改');
  } catch (error) {
    logger.error('保存链接历史编辑失败:', error);
    showNotification('保存失败', false);
  }
}

/**
 * 取消链接历史编辑
 */
function cancelLinkHistoryEdit() {
  appState.editingLinkHistoryId = null;
  appState.editingLinkHistoryOriginalUrl = null;
  appState.linkHistoryMode = LinkHistoryMode.NORMAL;
  elements.edit_history_btn.classList.remove('active');
  elements.edit_history_btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
    编辑
  `;
  renderHistory();
}

/**
 * 处理链接历史搜索
 */
function handleHistorySearch() {
  const searchTerm = elements.history_search.value.toLowerCase().trim();
  renderHistory(searchTerm);
}

/**
 * 处理剪贴板历史搜索
 */
function handleClipboardHistorySearch() {
  const searchTerm = elements.clipboard_history_search.value.toLowerCase().trim();
  renderClipboardHistory(searchTerm);
}

/**
 * 处理链接历史筛选
 */
function handleLinkHistoryFilter(e) {
  const filter = e.target.dataset.filter;
  if (!filter) return;

  // 更新标签激活状态
  document.querySelectorAll('#history-container .filter-tab').forEach((tab) => {
    tab.classList.remove('active');
  });
  e.target.classList.add('active');

  // 更新筛选状态
  appState.linkHistoryFilter = filter;

  // 重新渲染
  const searchTerm = elements.history_search
    ? elements.history_search.value.toLowerCase().trim()
    : '';
  renderHistory(searchTerm);
}

/**
 * 处理剪贴板历史筛选
 */
function handleClipboardHistoryFilter(e) {
  const filter = e.target.dataset.filter;
  if (!filter) return;

  // 更新标签激活状态
  document.querySelectorAll('#clipboard-history-container .filter-tab').forEach((tab) => {
    tab.classList.remove('active');
  });
  e.target.classList.add('active');

  // 更新筛选状态
  appState.clipboardHistoryFilter = filter;

  // 重新渲染
  const searchTerm = elements.clipboard_history_search
    ? elements.clipboard_history_search.value.toLowerCase().trim()
    : '';
  renderClipboardHistory(searchTerm);
}

async function copyToClipboard(text, button) {
  try {
    await copyTextToClipboard(text);
    showCopyFeedback(button);
    showNotification('已复制到剪贴板');
  } catch (err) {
    logger.error('复制失败:', err);
    showNotification('复制失败', false);
  }
}

function showCopyFeedback(button) {
  if (!button) return;

  const originalText = button.textContent;
  const originalBg = button.style.backgroundColor;

  button.textContent = '已复制!';
  button.style.backgroundColor = '#10b981';

  setTimeout(() => {
    if (button.parentNode) {
      button.textContent = originalText;
      button.style.backgroundColor = originalBg;
    }
  }, 1500);
}

function setupEventListeners() {
  logger.info('设置事件监听器...');

  if (elements.search_input) {
    elements.search_input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleSearch();
      else handleInputChange();
    });

    elements.search_input.addEventListener('input', handleTextareaInput);
  }

  if (elements.search_btn) {
    elements.search_btn.addEventListener('click', handleSearch);
  }

  if (elements.clipboard_btn) {
    elements.clipboard_btn.addEventListener('click', () => {
      toggleClipboardMonitoring();
    });
  }

  if (elements.settings_btn) {
    elements.settings_btn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage
        ? chrome.runtime.openOptionsPage()
        : window.open(chrome.runtime.getURL('src/settings/index.html'));
    });
  }

  setupSwitchContainerListeners();

  if (elements.refresh_split_btn) {
    elements.refresh_split_btn.addEventListener('click', handleRefreshSplit);
  }

  const multiRuleCheckbox = document.getElementById('enable-multi-rules');
  if (multiRuleCheckbox) {
    multiRuleCheckbox.addEventListener('change', toggleMultiRuleSelection);
  }

  document.addEventListener('change', (e) => {
    if (e.target.matches('#multi-rule-selection input[type="checkbox"]')) {
      if (elements.search_input && elements.search_input.value.trim()) {
        renderSplittingTool(elements.search_input.value);
      }
    }
  });

  if (elements.split_delimiter_select) {
    elements.split_delimiter_select.addEventListener('change', () => {
      handleSplitModeChange();
    });
  }

  // 多规则按钮事件
  const multiRuleButtons = document.querySelectorAll('#multi-rule-buttons .format-btn');
  multiRuleButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const rule = e.target.dataset.rule;
      if (rule) {
        handleMultiRuleButtonClick(rule);
      }
    });
  });

  // 多规则返回按钮
  const multiRuleBackBtn = document.getElementById('multi-rule-back-btn');
  if (multiRuleBackBtn) {
    multiRuleBackBtn.addEventListener('click', handleMultiRuleBack);
  }

  // 多规则重置按钮
  const multiRuleResetBtn = document.getElementById('multi-rule-reset-btn');
  if (multiRuleResetBtn) {
    multiRuleResetBtn.addEventListener('click', handleMultiRuleReset);
  }

  if (elements.copy_selected_btn) {
    elements.copy_selected_btn.addEventListener('click', handleCopySelected);
  }

  if (elements.select_all_checkbox) {
    elements.select_all_checkbox.addEventListener('change', handleSelectAll);
  }

  if (elements.path_quote_checkbox) {
    elements.path_quote_checkbox.addEventListener('change', () =>
      renderExtractionUI(elements.search_input ? elements.search_input.value : '')
    );
  }

  if (elements.show_history_btn) {
    elements.show_history_btn.addEventListener('click', toggleHistoryDisplay);
  }

  if (elements.edit_history_btn) {
    elements.edit_history_btn.addEventListener('click', toggleLinkHistoryEditMode);
  }

  if (elements.clear_history_btn) {
    elements.clear_history_btn.addEventListener('click', handleClearHistory);
  }

  // 链接历史搜索
  if (elements.history_search) {
    elements.history_search.addEventListener('input', handleHistorySearch);
  }

  // 链接历史筛选标签
  document.querySelectorAll('#history-container .filter-tab').forEach((tab) => {
    tab.addEventListener('click', handleLinkHistoryFilter);
  });

  // 剪贴板历史搜索
  if (elements.clipboard_history_search) {
    elements.clipboard_history_search.addEventListener('input', handleClipboardHistorySearch);
  }

  // 剪贴板历史筛选标签
  document.querySelectorAll('#clipboard-history-container .filter-tab').forEach((tab) => {
    tab.addEventListener('click', handleClipboardHistoryFilter);
  });

  // 剪贴板历史相关事件绑定
  if (elements.export_clipboard_btn) {
    elements.export_clipboard_btn.addEventListener('click', () => exportClipboardHistory('json'));
  }

  if (elements.import_clipboard_btn && elements.clipboard_import_input) {
    elements.import_clipboard_btn.addEventListener('click', () => {
      elements.clipboard_import_input.click();
    });
    elements.clipboard_import_input.addEventListener('change', handleClipboardImport);
  }

  if (elements.clear_clipboard_btn) {
    elements.clear_clipboard_btn.addEventListener('click', handleClearClipboardHistory);
  }

  if (elements.clipboard_settings_btn) {
    elements.clipboard_settings_btn.addEventListener('click', showClipboardSettings);
  }

  // 剪贴板显示/隐藏按钮
  if (elements.show_clipboard_btn) {
    elements.show_clipboard_btn.addEventListener('click', toggleClipboardHistoryDisplay);
  }

  // 剪贴板设置取消按钮
  if (elements.cancel_clipboard_settings) {
    elements.cancel_clipboard_settings.addEventListener('click', hideClipboardSettings);
  }

  // 剪贴板设置保存按钮
  if (elements.save_clipboard_settings) {
    elements.save_clipboard_settings.addEventListener('click', saveClipboardSettings);
  }

  setupTextareaResizeHandle();

  const formatButtons = document.querySelectorAll('.format-btn');
  formatButtons.forEach((btn) => {
    btn.addEventListener('click', handleFormatButtonClick);
  });

  const backButton = document.getElementById('back-to-previous');
  if (backButton) {
    backButton.addEventListener('click', handleBackToPrevious);
  }

  const copyResultButton = document.getElementById('copy-result-btn');
  if (copyResultButton) {
    copyResultButton.addEventListener('click', handleCopyResult);
  }

  const searchResultButton = document.getElementById('search-result-btn');
  if (searchResultButton) {
    searchResultButton.addEventListener('click', handleSearchResult);
  }

  // 绑定Alt+J快捷键读取剪贴板
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'j') {
      e.preventDefault();
      readSystemClipboard();
    }
  });

  logger.info('事件监听器设置完成');
}

function setupSwitchContainerListeners() {
  const switchContainers = document.querySelectorAll('.switch-container');

  switchContainers.forEach((container) => {
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    if (checkbox.id === 'switch-multi-format') {
      const multiFormatContainer = document.getElementById('multi-format-container');
      if (multiFormatContainer) {
        multiFormatContainer.style.display = checkbox.checked ? 'block' : 'none';
      }
    }

    container.addEventListener('click', (e) => {
      if (e.target === checkbox) return;

      checkbox.checked = !checkbox.checked;

      const changeEvent = new Event('change', { bubbles: true });
      checkbox.dispatchEvent(changeEvent);

      const switchType = container.dataset.switch;
      switch (switchType) {
        case 'extract':
          handleSwitchChange(checkbox, 'extract-container');
          break;
        case 'link-gen':
          handleSwitchChange(checkbox, 'link-gen-container');
          break;
        case 'multi-format':
          handleMultiFormatSwitchChange(checkbox);
          break;
      }
    });

    checkbox.addEventListener('change', () => {
      const switchType = container.dataset.switch;
      switch (switchType) {
        case 'extract':
          handleSwitchChange(checkbox, 'extract-container');
          break;
        case 'link-gen':
          handleSwitchChange(checkbox, 'link-gen-container');
          break;
        case 'multi-format':
          handleMultiFormatSwitchChange(checkbox);
          break;
      }
    });
  });
}

function initializeTextareaAutoResize() {
  if (!elements.search_input) return;
  adjustTextareaHeight();
}

function handleTextareaInput() {
  adjustTextareaHeight();
  handleInputChange();
  updateSearchControlsPosition();
}

function adjustTextareaHeight() {
  if (!elements.search_input) return;

  const textarea = elements.search_input;

  if (textarea.isManuallyResized) return;

  const maxHeight = window.innerHeight * 0.5;
  const minHeight = 32;

  textarea.classList.add('auto-resizing');
  textarea.style.height = 'auto';

  let newHeight = Math.max(minHeight, textarea.scrollHeight);
  newHeight = Math.min(newHeight, maxHeight);

  if (appState.clipboardMonitoring) {
    const expandedMaxHeight = Math.min(maxHeight * 1.2, window.innerHeight * 0.6);
    newHeight = Math.min(newHeight, expandedMaxHeight);
  }

  textarea.style.height = newHeight + 'px';

  if (textarea.scrollHeight > newHeight) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }

  setTimeout(() => {
    textarea.classList.remove('auto-resizing');
  }, 150);
}

function setupTextareaResizeHandle() {
  const handle = document.querySelector('.textarea-resize-handle');
  const textarea = elements.search_input;
  const container = document.querySelector('.search-input-container');

  if (!handle || !textarea || !container) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let animationFrame = null;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(textarea).height, 10);

    container.classList.add('resizing');
    document.body.style.cursor = 'nw-resize';
    document.body.style.userSelect = 'none';
    textarea.style.transition = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);

    e.preventDefault();
  });

  function handleMouseMove(e) {
    if (!isResizing) return;

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    animationFrame = requestAnimationFrame(() => {
      const deltaY = e.clientY - startY;
      const maxHeight = window.innerHeight * 0.5;
      const newHeight = Math.max(32, Math.min(maxHeight, startHeight + deltaY));

      textarea.style.height = newHeight + 'px';
      textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
      textarea.isManuallyResized = true;
      updateSearchControlsPosition();
    });
  }

  function handleMouseUp() {
    if (!isResizing) return;

    isResizing = false;

    container.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    setTimeout(() => {
      textarea.style.transition = '';
    }, 50);

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mouseleave', handleMouseUp);
  }
}

function updateSearchControlsPosition() {
  const searchControls = document.getElementById('search-controls');
  const container = document.getElementById('resizable-container');
  const textarea = elements.search_input;

  if (!searchControls || !container || !textarea) return;

  const containerWidth = container.offsetWidth;
  const textareaHeight = textarea.offsetHeight;
  const isNarrow = containerWidth < 480;
  const isTextareaExpanded = textareaHeight > 32;

  if (isNarrow || isTextareaExpanded) {
    searchControls.classList.add('below-input');
  } else {
    searchControls.classList.remove('below-input');
  }
}

function initializeResponsiveLayout() {
  // 如果已存在observer，先断开连接
  if (appState.resizeObserver) {
    appState.resizeObserver.disconnect();
  }

  appState.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;

      if (width < 480) {
        document.body.classList.add('narrow-layout');
        document.body.classList.remove('medium-layout', 'wide-layout');
      } else if (width < 768) {
        document.body.classList.add('medium-layout');
        document.body.classList.remove('narrow-layout', 'wide-layout');
      } else {
        document.body.classList.add('wide-layout');
        document.body.classList.remove('narrow-layout', 'medium-layout');
      }

      updateSearchControlsPosition();
    }
  });

  const container = document.getElementById('resizable-container');
  if (container) {
    appState.resizeObserver.observe(container);
  }

  updateSearchControlsPosition();
}

function handleCopySelected() {
  const selectedItems = appState.splitItemsState
    .filter((item) => item.selected)
    .map((item) => item.text);
  if (selectedItems.length === 0) {
    showNotification('未选择任何项目！', false);
    return;
  }

  let separator = '';
  if (elements.copy_opt_newline && elements.copy_opt_newline.checked) {
    separator = '\n';
  } else if (elements.copy_opt_tab && elements.copy_opt_tab.checked) {
    separator = '\t';
  } else if (elements.copy_opt_space && elements.copy_opt_space.checked) {
    separator = ' ';
  }

  const textToCopy = selectedItems.join(separator);
  copyToClipboard(textToCopy, elements.copy_selected_btn);
}

function handleSelectAll(e) {
  const isSelected = e.target.checked;
  appState.splitItemsState.forEach((item) => (item.selected = isSelected));
  document
    .querySelectorAll('.split-item')
    .forEach((el) => el.classList.toggle('selected', isSelected));
  document.querySelectorAll('.split-row-checkbox').forEach((cb) => (cb.checked = isSelected));
}

function toggleHistoryDisplay() {
  const container = elements.history_container;
  if (container) {
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    elements.show_history_btn.innerHTML = isVisible
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 历史'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg> 隐藏';
  }
}

async function handleClearHistory() {
  if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
    try {
      await linkHistoryManager.clearHistory();
      appState.linkHistory = [];
      renderHistory();
      showNotification('历史记录已清空');
    } catch (error) {
      logger.error('清空历史记录失败:', error);
      showNotification('清空失败', false);
    }
  }
}

// ============================================================================
// 剪贴板权限管理
// ============================================================================

/**
 * 检查剪贴板权限状态
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkClipboardPermission() {
  try {
    // 尝试读取剪贴板来检查权限
    await navigator.clipboard.readText();
    return true;
  } catch (error) {
    // 只在真正需要关注的情况下输出日志
    if (error.name === 'NotAllowedError') {
      // 权限被拒绝，这是预期的错误，不输出日志
      return false;
    }
    // 其他错误（如 Document not focused）也返回 false
    return false;
  }
}

/**
 * 更新权限面板显示状态
 */
async function updatePermissionPanel() {
  const hasPermission = await checkClipboardPermission();

  if (elements.clipboard_permission_panel) {
    elements.clipboard_permission_panel.style.display = hasPermission ? 'none' : 'block';
  }

  return hasPermission;
}

/**
 * 请求剪贴板权限
 */
async function requestClipboardPermission() {
  logger.info('请求剪贴板权限...');

  try {
    // 通过尝试读取剪贴板来触发权限请求
    await navigator.clipboard.readText();

    // 权限获取成功
    logger.info('剪贴板权限获取成功');
    showNotification('剪贴板权限已授予', true);

    // 更新UI
    await updatePermissionPanel();

    // 自动开启剪贴板监控
    if (!appState.clipboardMonitoring) {
      await toggleClipboardMonitoring();
    }

    return true;
  } catch (error) {
    logger.error('剪贴板权限获取失败:', error);

    if (error.name === 'NotAllowedError') {
      showNotification('剪贴板权限被拒绝，请在浏览器设置中手动开启', false);
    } else {
      showNotification('获取剪贴板权限失败: ' + error.message, false);
    }

    return false;
  }
}

/**
 * 从系统剪贴板读取内容（利用扩展权限，无需额外授权）
 */
async function readSystemClipboard() {
  logger.info('从系统剪贴板读取内容...');

  try {
    // 扩展页面有 clipboardRead 权限，可以直接读取
    const text = await navigator.clipboard.readText();

    if (!text || text.trim().length === 0) {
      showNotification('剪贴板为空', false);
      return null;
    }

    logger.info('读取到剪贴板内容，长度:', text.length);

    // 填充到搜索框
    if (elements.search_input) {
      elements.search_input.value = text;
      elements.search_input.isManuallyResized = false;
      handleTextareaInput();
      updateSearchControlsPosition();
      // 聚焦输入框
      elements.search_input.focus();
    }

    // 添加到剪贴板历史
    await addToClipboardHistory(text);

    showNotification('已读取剪贴板内容', true);
    return text;
  } catch (error) {
    logger.error('读取剪贴板失败:', error);

    if (error.name === 'NotAllowedError') {
      showNotification('无法读取剪贴板，请确保已授予权限', false);
    } else {
      showNotification('读取剪贴板失败: ' + error.message, false);
    }

    return null;
  }
}

/**
 * 切换自动监控模式
 */
async function toggleAutoMonitorMode() {
  logger.info('切换自动监控模式...');

  // 检查是否有权限
  const hasPermission = await checkClipboardPermission();

  if (!hasPermission) {
    // 显示权限请求面板
    if (elements.clipboard_permission_panel) {
      elements.clipboard_permission_panel.style.display = 'block';
    }
    showNotification('请先授予剪贴板权限以开启自动监控', false);
    return;
  }

  // 切换监控状态
  await toggleClipboardMonitoring();
}

/**
 * 初始化剪贴板权限相关功能
 */
function initClipboardPermission() {
  // 检查并显示权限面板
  updatePermissionPanel();

  // 绑定权限请求按钮
  if (elements.request_clipboard_permission_btn) {
    elements.request_clipboard_permission_btn.addEventListener('click', requestClipboardPermission);
  }

  // 绑定读取剪贴板按钮
  if (elements.read_clipboard_btn) {
    elements.read_clipboard_btn.addEventListener('click', readSystemClipboard);
  }

  // 绑定切换自动监控按钮
  if (elements.toggle_auto_monitor_btn) {
    elements.toggle_auto_monitor_btn.addEventListener('click', toggleAutoMonitorMode);
  }
}
