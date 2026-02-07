// src/popup/main.js - 剪贴板历史优化版本

import { getSettings, saveSettings, DEFAULTS } from "../utils/storage.js";

import {
  isURL,
  processTextExtraction,
  splitText,
  processPath,
  processLinkGeneration,
  analyzeTextForMultipleFormats,
  chineseWordSegmentation,
  copyToClipboard as copyTextToClipboard,
  extractEmails,
  extractPhoneNumbers,
} from "../utils/textProcessor.js";

import linkHistoryManager from "../utils/linkHistory.js";

const logger = {
  info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
  error: (message, ...args) =>
    console.error(`[SearchBuddy] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args),
};

const ClipboardMode = {
  NORMAL: "normal",
  BATCH: "batch",
  EDIT: "edit",
};

let appState = {
  settings: null,
  splitItemsState: [],
  clipboardMonitoring: false,
  lastClipboardContent: "",
  linkHistory: [],
  multiFormatState: {
    originalText: "",
    processingHistory: [],
    currentIndex: -1,
  },
  clipboardHistory: [],
  clipboardHistoryVisible: false,
  clipboardMode: ClipboardMode.NORMAL,
  editingItemId: null,
  maxClipboardHistory: 100,
  backgroundPort: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  logger.info("Search Buddy 正在初始化...");

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

    logger.info("Search Buddy 初始化完成");
  } catch (error) {
    logger.error("初始化失败:", error);
    showNotification("初始化失败，请尝试刷新扩展", false);
  }
});

function initializeElements() {
  const elementIds = [
    "search-input",
    "search-btn",
    "engine-select",
    "switch-extract",
    "switch-link-gen",
    "switch-multi-format",
    "clipboard-btn",
    "settings-btn",
    "extract-container",
    "link-gen-container",
    "multi-format-container",
    "path-conversion-tool",
    "path-quote-checkbox",
    "path-conversion-result",
    "link-extraction-result",
    "text-splitting-tool",
    "split-delimiter-select",
    "refresh-split-btn",
    "split-output-container",
    "copy-selected-btn",
    "copy-opt-space",
    "copy-opt-newline",
    "copy-opt-tab",
    "select-all-checkbox",
    "show-history-btn",
    "export-history-btn",
    "clear-history-btn",
    "history-container",
    "history-search",
    "history-list",
    "clipboard-history-container",
    "clipboard-history-list",
    "clipboard-controls",
    "clipboard-permission-panel",
    "request-clipboard-permission-btn",
    "clipboard-action-panel",
    "read-clipboard-btn",
    "toggle-auto-monitor-btn",
  ];

  elementIds.forEach((id) => {
    elements[id.replace(/-/g, "_")] = document.getElementById(id);
  });

  if (!elements.search_input || !elements.search_btn) {
    throw new Error("关键DOM元素缺失");
  }
}

function showNotification(message, isSuccess = true) {
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.textContent = message;
  notification.style.background = isSuccess ? "#10b981" : "#ef4444";

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
    } catch (e) {}
    appState.backgroundPort = null;
  }

  appState.backgroundPort = chrome.runtime.connect({
    name: `popup-${Date.now().toString(36)}`,
  });

  appState.backgroundPort.onMessage.addListener((message) => {
    handlePortMessage(message);
  });

  appState.backgroundPort.onDisconnect.addListener(() => {
    logger.info("与background的连接已断开");
    appState.backgroundPort = null;
  });

  logger.info("已建立与background的Port连接");
}

function handlePortMessage(message) {
  switch (message.action) {
    case "clipboardChanged":
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
          logger.error("添加到剪贴板历史失败:", error);
        });

        showNotification("检测到剪贴板内容变化");
      }
      break;

    case "clipboardMonitoringToggled":
      appState.clipboardMonitoring = message.isActive;
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked =
          appState.clipboardMonitoring;
      }
      break;

    case "stateResponse":
      appState.clipboardMonitoring = message.isActive;
      appState.lastClipboardContent = message.lastContent || "";
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked =
          appState.clipboardMonitoring;
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
      action: "toggleGlobalMonitoring",
    });
    logger.info("toggleGlobalMonitoring 响应:", response);
  } catch (error) {
    logger.warn("通知background失败:", error.message);
    // 即使background通信失败，也不影响本地状态
  }

  if (appState.clipboardMonitoring) {
    showNotification("剪贴板监控已启动");
  } else {
    showNotification("剪贴板监控已停止");
  }

  updateClipboardButtonState(appState.clipboardMonitoring);
}

async function initClipboardMonitoringState() {
  logger.info("开始初始化剪贴板监控状态...");
  try {
    // 先从本地存储读取状态
    const localResult = await chrome.storage.local.get(
      "globalMonitoringEnabled",
    );
    const localState = localResult.globalMonitoringEnabled !== false;
    logger.info("从本地存储读取的监控状态:", localState);

    let response = null;
    try {
      response = await chrome.runtime.sendMessage({
        action: "getGlobalMonitoringState",
      });
      logger.info("从background获取状态成功:", response);
    } catch (bgError) {
      logger.warn("从background获取状态失败，使用本地状态:", bgError.message);
    }

    // 优先使用background返回的状态，否则使用本地状态
    appState.clipboardMonitoring = response?.isActive ?? localState;
    appState.lastClipboardContent = response?.lastContent || "";

    logger.info("最终监控状态:", appState.clipboardMonitoring);

    // 建立Port连接
    try {
      connectToBackground();
    } catch (portError) {
      logger.warn("建立Port连接失败:", portError.message);
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
      `初始化剪贴板监控完成: 状态=${appState.clipboardMonitoring}, 内容长度=${appState.lastClipboardContent?.length || 0}`,
    );
  } catch (error) {
    logger.error("初始化剪贴板监控失败:", error);
    // 使用默认值
    appState.clipboardMonitoring = false;
    updateClipboardButtonState(false);
  }
}

function updateClipboardButtonState(isActive) {
  if (!elements.clipboard_btn) return;

  const statusIndicator =
    elements.clipboard_btn.querySelector(".clipboard-status");
  if (statusIndicator) {
    statusIndicator.classList.toggle("active", isActive);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.info("收到来自background的消息:", request);

  switch (request.action) {
    case "clipboardChanged":
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
          logger.error("添加到剪贴板历史失败:", error);
        });

        showNotification("检测到剪贴板内容变化");
      }
      break;

    case "clipboardMonitoringToggled":
      appState.clipboardMonitoring = request.isActive;
      updateClipboardButtonState(appState.clipboardMonitoring);

      if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked =
          appState.clipboardMonitoring;
      }
      break;

    default:
      break;
  }

  return true;
});

window.addEventListener("beforeunload", () => {
  logger.info("Popup正在关闭，清理资源...");

  if (appState.backgroundPort) {
    try {
      appState.backgroundPort.disconnect();
    } catch (e) {}
    appState.backgroundPort = null;
  }
});

async function loadClipboardHistory() {
  try {
    const settings = await getSettings();
    appState.clipboardHistory = settings.clipboardHistory || [];
  } catch (error) {
    logger.error("加载剪贴板历史失败:", error);
    appState.clipboardHistory = [];
  }
}

async function saveClipboardHistory() {
  try {
    if (appState.clipboardHistory.length > appState.maxClipboardHistory) {
      appState.clipboardHistory = appState.clipboardHistory.slice(
        0,
        appState.maxClipboardHistory,
      );
    }

    await saveSettings({
      ...appState.settings,
      clipboardHistory: appState.clipboardHistory,
    });
  } catch (error) {
    logger.error("保存剪贴板历史失败:", error);
  }
}

async function addToClipboardHistory(text) {
  if (!text || text.trim() === "") return;

  // 检查是否已存在相同内容
  const existingIndex = appState.clipboardHistory.findIndex(
    (item) => item.text === text,
  );
  if (existingIndex !== -1) {
    // 已存在则不添加，保持原有记录
    return;
  }

  const newRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text: text,
    timestamp: new Date().toISOString(),
  };

  appState.clipboardHistory.unshift(newRecord);
  await saveClipboardHistory();
  renderClipboardHistory();
}

function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderClipboardHistory() {
  if (!elements.clipboard_history_list) return;

  if (appState.clipboardHistory.length === 0) {
    elements.clipboard_history_list.innerHTML =
      '<div class="empty-state"><p>暂无剪贴板历史</p><span>复制内容后将显示在这里</span></div>';
    updateClipboardToolbar();
    return;
  }

  elements.clipboard_history_list.innerHTML = appState.clipboardHistory
    .map((item) => {
      const isSelected = isItemSelected(item.id);
      const isEditing =
        appState.clipboardMode === ClipboardMode.EDIT &&
        appState.editingItemId === item.id;
      const showCheckbox = appState.clipboardMode === ClipboardMode.BATCH;

      if (isEditing) {
        return renderEditModeItem(item);
      } else {
        return renderNormalOrBatchItem(item, showCheckbox, isSelected);
      }
    })
    .join("");

  bindClipboardHistoryEvents();
  updateClipboardToolbar();
}

function renderNormalOrBatchItem(item, showCheckbox, isSelected) {
  const showActionBtns = appState.clipboardMode === ClipboardMode.NORMAL;
  const isBatchMode = appState.clipboardMode === ClipboardMode.BATCH;
  const truncatedText = truncateText(item.text, 150);

  return `
        <div class="history-item" data-id="${item.id}">
            <div class="clipboard-item-content">
                <div class="content-row">
                    <input type="checkbox" class="clipboard-checkbox"
                           data-id="${item.id}"
                           style="display: ${showCheckbox ? "inline-block" : "none"}"
                           ${isSelected ? "checked" : ""}>
                    <div class="clipboard-text-content" data-id="${item.id}">${escapeHtml(truncatedText)}</div>
                    ${showActionBtns ? renderActionButtons(item.id, isBatchMode) : ""}
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
        <div class="history-item editing" data-id="${item.id}">
            <div class="clipboard-item-content">
                <div class="edit-row">
                    <div class="edit-actions">
                        <button class="save-edit-btn btn-sm" data-id="${item.id}" title="保存">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                        </button>
                        <button class="cancel-edit-btn btn-sm" data-id="${item.id}" title="取消">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <textarea class="edit-textarea" data-id="${item.id}">${escapeHtml(item.text)}</textarea>
                </div>
            </div>
        </div>
    `;
}

function renderActionButtons(itemId, isBatchMode = false) {
  // 批量模式下不显示编辑按钮
  const editButton = isBatchMode
    ? ""
    : `
            <button class="edit-btn btn-sm" data-id="${itemId}" title="编辑">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </button>
  `;

  return `
        <div class="item-actions">
            <button class="copy-btn btn-sm" data-id="${itemId}" title="复制">
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

  document.querySelectorAll(".save-edit-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      logger.info("保存按钮点击:", id);
      handleSaveEdit(id);
    };
  });

  document.querySelectorAll(".cancel-edit-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      logger.info("取消按钮点击");
      handleCancelEdit();
    };
  });
}

function handleClipboardItemClick(e) {
  const target = e.target;
  const closestBtn = target.closest("button");

  if (!closestBtn) return;

  const btnClass = closestBtn.className;
  const id = closestBtn.dataset.id;

  if (btnClass.includes("copy-btn")) {
    handleCopyItem(id);
    return;
  }

  if (btnClass.includes("edit-btn")) {
    enterEditMode(id);
    return;
  }

  if (btnClass.includes("delete-btn")) {
    handleDeleteItem(id);
    return;
  }
}

function handleClipboardItemChange(e) {
  if (!e.target.classList.contains("clipboard-checkbox")) return;

  const id = e.target.dataset.id;
  if (e.target.checked) {
    selectItem(id);
  } else {
    deselectItem(id);
  }
  updateBatchCounter();
}

function selectItem(id) {
  const checkbox = document.querySelector(
    `.clipboard-checkbox[data-id="${id}"]`,
  );
  if (checkbox) checkbox.checked = true;
  updateBatchCounter();
}

function deselectItem(id) {
  const checkbox = document.querySelector(
    `.clipboard-checkbox[data-id="${id}"]`,
  );
  if (checkbox) checkbox.checked = false;
  updateBatchCounter();
}

function isItemSelected(id) {
  const checkbox = document.querySelector(
    `.clipboard-checkbox[data-id="${id}"]`,
  );
  return checkbox && checkbox.checked;
}

function clearSelection() {
  const checkboxes = document.querySelectorAll(".clipboard-checkbox");
  checkboxes.forEach((cb) => (cb.checked = false));
  updateBatchCounter();
}

function selectAllItems() {
  const checkboxes = document.querySelectorAll(".clipboard-checkbox");
  checkboxes.forEach((cb) => (cb.checked = true));
  updateBatchCounter();
}

function deselectAllItems() {
  clearSelection();
}

function getSelectedItemIds() {
  const checkboxes = document.querySelectorAll(".clipboard-checkbox:checked");
  return Array.from(checkboxes).map((cb) => cb.dataset.id);
}

function getSelectedClipboardItems() {
  const selectedIds = getSelectedItemIds();
  return appState.clipboardHistory.filter((item) =>
    selectedIds.includes(item.id),
  );
}

async function handleCopyItem(itemId) {
  const item = appState.clipboardHistory.find((item) => item.id === itemId);
  if (item) {
    try {
      await navigator.clipboard.writeText(item.text);
      showNotification("已复制到剪贴板");
    } catch (error) {
      logger.error("复制失败:", error);
      showNotification("复制失败", false);
    }
  }
}

async function handleDeleteItem(itemId) {
  if (confirm("确定要删除这条记录吗？")) {
    appState.clipboardHistory = appState.clipboardHistory.filter(
      (item) => item.id !== itemId,
    );
    await saveClipboardHistory();
    renderClipboardHistory();
    showNotification("已删除");
  }
}

async function handleSaveEdit(itemId) {
  logger.info("保存编辑:", itemId);

  const textarea = document.querySelector(
    `.edit-textarea[data-id="${itemId}"]`,
  );
  if (!textarea) {
    logger.error("未找到文本框");
    return;
  }

  const newText = textarea.value.trim();
  if (!newText) {
    showNotification("内容不能为空", false);
    return;
  }

  // 获取原内容
  const originalItem = appState.clipboardHistory.find(
    (item) => item.id === itemId,
  );
  const originalText = originalItem ? originalItem.text : "";

  // 如果内容没有变化，不处理
  if (newText === originalText.trim()) {
    showNotification("内容未修改");
    exitEditMode();
    return;
  }

  // 检查是否已存在相同内容的历史记录
  const existingIndex = appState.clipboardHistory.findIndex(
    (item) => item.text === newText,
  );
  if (existingIndex !== -1) {
    showNotification("该内容已存在于历史记录中", false);
    exitEditMode();
    return;
  }

  // 编辑后新增一条历史记录，排在最前面
  const newRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text: newText,
    timestamp: new Date().toISOString(),
  };

  appState.clipboardHistory.unshift(newRecord);
  await saveClipboardHistory();
  showNotification("已保存为新记录");

  // 退出编辑模式并刷新界面
  exitEditMode();
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
    logger.error("无效的剪贴板模式:", mode);
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

  let buttonsHtml = "";

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
            <button class="clipboard-action-btn ${selectedCount === 0 ? "disabled" : ""}"
                    data-action="batch-copy" ${selectedCount === 0 ? "disabled" : ""}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                复制(${selectedCount})
            </button>
            <button class="clipboard-action-btn danger ${selectedCount === 0 ? "disabled" : ""}"
                    data-action="batch-delete" ${selectedCount === 0 ? "disabled" : ""}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除(${selectedCount})
            </button>
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
  const controls = document.querySelector(".clipboard-controls");
  if (!controls) return;

  controls.querySelectorAll(".clipboard-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      handleToolbarAction(action);
    });
  });
}

function handleToolbarAction(action) {
  switch (action) {
    case "history":
      toggleClipboardHistory();
      break;
    case "batch":
      enterBatchMode();
      break;
    case "clear":
      clearClipboardHistory();
      break;
    case "cancel-batch":
      exitBatchMode();
      break;
    case "select-all":
      selectAllItems();
      break;
    case "batch-copy":
      batchCopySelectedItems();
      break;
    case "batch-delete":
      batchDeleteSelectedItems();
      break;
    case "exit-edit":
      exitEditMode();
      break;
  }
}

async function batchDeleteSelectedItems() {
  const selectedItems = getSelectedClipboardItems();
  const deleteCount = selectedItems.length;

  if (deleteCount === 0) {
    showNotification("请先选择要删除的项", false);
    return;
  }

  if (confirm(`确定要删除选中的 ${deleteCount} 条记录吗？`)) {
    const selectedIds = new Set(selectedItems.map((item) => item.id));
    appState.clipboardHistory = appState.clipboardHistory.filter(
      (item) => !selectedIds.has(item.id),
    );
    await saveClipboardHistory();
    renderClipboardHistory();
    showNotification(`已删除 ${deleteCount} 条记录`);
  }
}

async function batchCopySelectedItems() {
  const selectedItems = getSelectedClipboardItems();

  if (selectedItems.length === 0) {
    showNotification("请先选择要复制的项目", false);
    return;
  }

  const textToCopy = selectedItems.map((item) => item.text).join("\n\n");

  try {
    await navigator.clipboard.writeText(textToCopy);
    showNotification(`已复制 ${selectedItems.length} 条记录`);
  } catch (error) {
    logger.error("批量复制失败:", error);
    showNotification("复制失败", false);
  }
}

async function clearClipboardHistory() {
  if (confirm("确定要清空所有剪贴板历史吗？")) {
    appState.clipboardHistory = [];
    await saveClipboardHistory();
    renderClipboardHistory();
    showNotification("已清空剪贴板历史");
  }
}

function toggleClipboardHistory() {
  if (!elements.clipboard_history_container) return;

  appState.clipboardHistoryVisible = !appState.clipboardHistoryVisible;
  elements.clipboard_history_container.style.display =
    appState.clipboardHistoryVisible ? "block" : "none";
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
    showNotification("请先选择要搜索的项目", false);
    return;
  }

  const selectedTexts = selectedItems.map((item) => item.text);

  if (selectedTexts.length > 0) {
    elements.search_input.value = selectedTexts.join(" ");
    handleSearch();
    showNotification(`已将 ${selectedItems.length} 条记录添加到搜索框`);
  }
}

function renderEngineSelect() {
  if (!elements.engine_select || !appState.settings) return;

  elements.engine_select.innerHTML = "";

  appState.settings.searchEngines.forEach((engine) => {
    const option = document.createElement("option");
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
    window.open(query, "_blank");
    addToHistoryEnhanced(query);
    return;
  }

  let selectedEngineName = appState.settings.defaultEngine;
  if (elements.engine_select && elements.engine_select.value) {
    selectedEngineName = elements.engine_select.value;
  }

  const selectedEngine = appState.settings.searchEngines.find(
    (e) => e.name === selectedEngineName,
  );

  if (selectedEngine) {
    const searchUrl = selectedEngine.template.replace(
      "%s",
      encodeURIComponent(query),
    );
    window.open(searchUrl, "_blank");
    addToHistoryEnhanced(query);
  } else {
    showNotification("没有找到搜索引擎配置", false);
  }
}

async function addToHistoryEnhanced(item) {
  try {
    const isGithubRepo = isGitHubRepository(item);

    if (isGithubRepo.isRepo && isGithubRepo.githubUrl) {
      await linkHistoryManager.addLink(
        isGithubRepo.githubUrl,
        "",
        "github_repo",
      );
    } else {
      await linkHistoryManager.addLink(item, "", "general");
    }

    appState.linkHistory = await linkHistoryManager.getHistory();
    renderHistory();
  } catch (error) {
    logger.error("添加历史记录失败:", error);
  }
}

function isGitHubRepository(url) {
  const repoPatterns = [
    /https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+)/,
    /https?:\/\/zread\.ai\/([^\/]+)\/([^\/\?#]+)/,
    /https?:\/\/deepwiki\.com\/([^\/]+)\/([^\/\?#]+)/,
    /https?:\/\/context7\.com\/([^\/]+)\/([^\/\?#]+)/,
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
    if (panel) panel.style.display = "none";
  });

  if (!text.trim()) return;

  if (elements.switch_extract.checked) {
    elements.extract_container.style.display = "block";
    renderExtractionUI(text);
  } else if (elements.switch_link_gen.checked) {
    elements.link_gen_container.style.display = "block";
    renderLinkGenerationUI(text);
  } else if (elements.switch_multi_format.checked) {
    elements.multi_format_container.style.display = "block";
    updateMultiFormatState(text);
    displayMultiFormatResult(text);
  }
}

function handleMultiFormatSwitchChange(checkbox) {
  const multiFormatContainer = document.getElementById(
    "multi-format-container",
  );
  if (multiFormatContainer) {
    if (checkbox.checked) {
      multiFormatContainer.style.display = "block";
      if (elements.search_input && elements.search_input.value.trim()) {
        handleInputChange();
      }
    } else {
      multiFormatContainer.style.display = "none";
    }
  }
}

function handleSwitchChange(activeSwitch, activePanelId) {
  logger.info(`开关变化: ${activeSwitch.id} 状态: ${activeSwitch.checked}`);

  if (activeSwitch.checked) {
    [
      elements.switch_extract,
      elements.switch_link_gen,
      elements.switch_multi_format,
    ].forEach((sw) => {
      if (sw && sw !== activeSwitch) sw.checked = false;
    });

    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = "block";
    }
  } else {
    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      activePanel.style.display = "none";
    }
  }

  handleInputChange();
}

function renderExtractionUI(text) {
  if (
    !elements.path_conversion_tool ||
    !elements.link_extraction_result ||
    !elements.text_splitting_tool
  ) {
    logger.error("提取功能UI元素缺失");
    return;
  }

  const pathResults = processPath(text);

  if (pathResults) {
    elements.path_conversion_tool.style.display = "block";
    elements.link_extraction_result.style.display = "none";
    elements.text_splitting_tool.style.display = "none";

    const useQuotes = elements.path_quote_checkbox
      ? elements.path_quote_checkbox.checked
      : false;
    if (elements.path_conversion_result) {
      elements.path_conversion_result.innerHTML = pathResults
        .map((p) => {
          const quotedPath = useQuotes ? `"${p}"` : p;
          return `<div class="path-item">
                    <button class="path-copy-btn" data-path="${p}">复制</button>
                    <pre>${quotedPath}</pre>
                </div>`;
        })
        .join("");

      elements.path_conversion_result
        .querySelectorAll(".path-copy-btn")
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const path = e.target.dataset.path;
            const textToCopy =
              elements.path_quote_checkbox &&
              elements.path_quote_checkbox.checked
                ? `"${path}"`
                : path;
            copyToClipboard(textToCopy, e.target);
          });
        });
    }
  } else {
    elements.path_conversion_tool.style.display = "none";
    elements.link_extraction_result.style.display = "block";
    elements.text_splitting_tool.style.display = "block";

    const { cleanedText, extractedLinks } = processTextExtraction(text);

    let linkHtml = "<h5>提取的链接</h5>";
    if (extractedLinks.length > 0) {
      extractedLinks.forEach((link) => addToHistoryEnhanced(link));
      linkHtml += extractedLinks
        .map(
          (link) => `<div class="link-item">
                <button class="copy-btn" data-link="${link}">复制</button>
                <a href="${link}" target="_blank">${link}</a>
            </div>`,
        )
        .join("");
    } else {
      linkHtml += "<p>未找到链接。</p>";
    }
    elements.link_extraction_result.innerHTML = linkHtml;

    elements.link_extraction_result
      .querySelectorAll(".copy-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const link = e.target.dataset.link;
          copyToClipboard(link, e.target);
        });
      });

    renderSplittingTool(cleanedText);
  }
}

function renderLinkGenerationUI(text) {
  if (!elements.link_gen_container) return;

  const linkGenResult = processLinkGeneration(text);
  let html = "";

  if (linkGenResult) {
    if (linkGenResult.originalGithubLink) {
      addToHistoryEnhanced(linkGenResult.originalGithubLink);
    }

    html =
      `<h5>生成的链接</h5>` +
      linkGenResult.generatedLinks
        .map((link) => {
          addToHistoryEnhanced(link);
          return `<div class="link-item">
                <button class="copy-btn" data-link="${link}">复制</button>
                <a href="${link}" target="_blank">${link}</a>
            </div>`;
        })
        .join("");

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

  elements.link_gen_container.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const link = e.target.dataset.link;
      copyToClipboard(link, e.target);
    });
  });

  const extractEmailsBtn = document.getElementById("extract-emails-btn");
  const extractPhonesBtn = document.getElementById("extract-phones-btn");

  if (extractEmailsBtn) {
    extractEmailsBtn.addEventListener("click", () => handleExtractEmails(text));
  }

  if (extractPhonesBtn) {
    extractPhonesBtn.addEventListener("click", () => handleExtractPhones(text));
  }
}

function handleExtractEmails(text) {
  const emails = extractEmails(text);
  displayExtractResults("邮箱地址", emails);
}

function handleExtractPhones(text) {
  const phones = extractPhoneNumbers(text);
  displayExtractResults("号码", phones);
}

function displayExtractResults(type, results) {
  const resultsContainer = document.getElementById("extract-results");
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
      .join("");
    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
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

  elements.multi_format_container.innerHTML = "";

  if (results.length === 0) {
    elements.multi_format_container.innerHTML =
      '<div class="no-results">未检测到可处理的格式</div>';
    return;
  }

  results.forEach((result) => {
    const card = document.createElement("div");
    card.className = "format-card";

    card.innerHTML = `
            <div class="format-header">${result.type}</div>
            <div class="format-controls">
                <button class="process-btn" data-type="${result.type}" data-original="${encodeURIComponent(text)}">单独处理</button>
            </div>
            <div class="format-content" id="format-${result.type.replace(/\s+/g, "-")}"></div>
            <div class="format-processed-result" id="processed-${result.type.replace(/\s+/g, "-")}"></div>
        `;

    const content = card.querySelector(
      `#format-${result.type.replace(/\s+/g, "-")}`,
    );

    if (result.type === "路径转换") {
      result.data.forEach((path) => {
        const item = document.createElement("div");
        item.className = "path-item";
        item.innerHTML = `
                    <button class="copy-btn" data-path="${path}">复制</button>
                    <span class="path-text">${path}</span>
                `;
        content.appendChild(item);
      });
    } else if (["链接提取", "仓库链接", "GitHub链接"].includes(result.type)) {
      result.data.forEach((linkObj) => {
        const linkUrl = linkObj.url || linkObj;
        addToHistoryEnhanced(linkUrl);

        const item = document.createElement("div");
        item.className = "link-item";
        item.innerHTML = `
                    <button class="copy-btn" data-link="${linkUrl}">复制</button>
                    <a href="${linkUrl}" target="_blank">${linkUrl}</a>
                `;
        content.appendChild(item);
      });
    } else if (["邮箱地址", "电话号码", "IP地址"].includes(result.type)) {
      result.data.forEach((item) => {
        const value = item.url || item;
        const displayValue = value.replace(/^(mailto:|tel:|http:\/\/)/, "");
        const itemEl = document.createElement("div");
        itemEl.className = "format-item";
        itemEl.innerHTML = `
                    <button class="copy-btn" data-value="${value}">复制</button>
                    <span class="format-value">${displayValue}</span>
                `;
        content.appendChild(itemEl);
      });
    }

    elements.multi_format_container.appendChild(card);
  });

  elements.multi_format_container
    .querySelectorAll(".copy-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const text =
          e.target.dataset.path ||
          e.target.dataset.link ||
          e.target.dataset.value;
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
  const resultContainer = document.getElementById("multi-format-result");
  if (!resultContainer) return;

  resultContainer.innerHTML = text;
}

function updateBackButtonState() {
  const backButton = document.getElementById("back-to-previous");
  if (!backButton) return;

  backButton.disabled = appState.multiFormatState.currentIndex <= 0;
  if (backButton.disabled) {
    backButton.style.opacity = "0.5";
    backButton.style.cursor = "not-allowed";
  } else {
    backButton.style.opacity = "1";
    backButton.style.cursor = "pointer";
  }
}

function handleBackToPrevious() {
  if (appState.multiFormatState.currentIndex > 0) {
    appState.multiFormatState.currentIndex--;
    const previousResult =
      appState.multiFormatState.processingHistory[
        appState.multiFormatState.currentIndex
      ];
    displayMultiFormatResult(previousResult);
    updateBackButtonState();
  }
}

async function handleCopyResult() {
  const resultContainer = document.getElementById("multi-format-result");
  if (!resultContainer) return;

  const resultText = resultContainer.innerText;
  if (!resultText) return;

  try {
    await copyTextToClipboard(resultText);
    showNotification("已复制到剪贴板");
  } catch (err) {
    logger.error("复制结果失败:", err);
    showNotification("复制失败", false);
  }
}

function handleSearchResult() {
  const resultContainer = document.getElementById("multi-format-result");
  if (!resultContainer) return;

  const resultText = resultContainer.innerText;
  if (!resultText) return;

  if (isURL(resultText)) {
    window.open(resultText, "_blank");
    addToHistoryEnhanced(resultText);
    return;
  }

  let selectedEngineName = appState.settings.defaultEngine;
  if (elements.engine_select && elements.engine_select.value) {
    selectedEngineName = elements.engine_select.value;
  }

  const selectedEngine = appState.settings.searchEngines.find(
    (e) => e.name === selectedEngineName,
  );

  if (selectedEngine) {
    const searchUrl = selectedEngine.template.replace(
      "%s",
      encodeURIComponent(resultText),
    );
    window.open(searchUrl, "_blank");
    addToHistoryEnhanced(resultText);
  } else {
    showNotification("没有找到搜索引擎配置", false);
  }
}

function handleFormatButtonClick(e) {
  const btn = e.target;
  const action = btn.dataset.action;
  const currentText =
    appState.multiFormatState.processingHistory[
      appState.multiFormatState.currentIndex
    ] || "";

  if (!currentText) {
    const inputText = elements.search_input.value.trim();
    if (!inputText) {
      displayMultiFormatResult(
        "请先在输入框中输入文本，然后点击下方按钮进行处理",
      );
      return;
    }
    updateMultiFormatState(inputText);
    return;
  }

  let processedResult = currentText;

  switch (action) {
    case "remove-chinese":
      processedResult = currentText.replace(
        /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g,
        "",
      );
      break;
    case "remove-non-url-chars":
      processedResult = currentText
        .replace(
          /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef<>{}\|^`\'"\s]+/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim();
      break;
    case "convert-to-url-chars":
      processedResult = encodeURIComponent(currentText);
      break;
    case "convert-period":
      processedResult = currentText.replace(/。/g, ".");
      break;
    case "convert-slash-to-backslash":
      processedResult = currentText.replace(/\//g, "\\");
      break;
    case "convert-backslash-to-slash":
      processedResult = currentText.replace(/\\/g, "/");
      break;
    case "convert-slash-to-double":
      processedResult = currentText.replace(/\//g, (match, offset, string) => {
        const prevChar = string[offset - 1];
        const nextChar = string[offset + 1];
        if (prevChar !== "/" && nextChar !== "/") {
          return "//";
        }
        return match;
      });
      break;
    case "remove-spaces":
      processedResult = currentText.replace(/\s+/g, "");
      break;
    case "convert-backslash-to-double":
      processedResult = currentText.replace(/\\/g, (match, offset, string) => {
        const prevChar = string[offset - 1];
        const nextChar = string[offset + 1];
        if (prevChar !== "\\" && nextChar !== "\\") {
          return "\\\\";
        }
        return match;
      });
      break;
    case "add-file-protocol":
      // 在每行路径前添加 file:///
      processedResult = currentText
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          // 如果已经是 file:// 开头，不处理
          if (trimmed.startsWith("file://")) return line;
          // 如果是 Windows 路径或 Unix 路径，添加 file:///
          if (
            /^[a-zA-Z]:[\\/]/.test(trimmed) ||
            trimmed.startsWith("/") ||
            trimmed.startsWith("\\")
          ) {
            // 将反斜杠转为正斜杠
            const normalizedPath = trimmed.replace(/\\/g, "/");
            // 确保路径以 / 开头
            const pathWithSlash = normalizedPath.startsWith("/")
              ? normalizedPath
              : "/" + normalizedPath;
            return "file://" + pathWithSlash;
          }
          return line;
        })
        .join("\n");
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
          appState.multiFormatState.currentIndex + 1,
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
  const originalText = decodeURIComponent(btn.dataset.original);
  const resultContainer = document.getElementById(
    `processed-${formatType.replace(/\s+/g, "-")}`,
  );

  resultContainer.innerHTML = "";

  let processedResult;
  switch (formatType) {
    case "路径转换":
      processedResult = processPath(originalText);
      break;
    case "链接提取":
      processedResult = processTextExtraction(originalText).extractedLinks;
      break;
    case "仓库链接":
    case "GitHub链接":
      processedResult =
        processLinkGeneration(originalText)?.generatedLinks || [];
      break;
    case "邮箱地址":
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      processedResult = [...new Set(originalText.match(emailRegex) || [])];
      break;
    case "电话号码":
      const phoneRegex =
        /(?:\+86[\s-]?)?(?:1[3-9]\d{9}|0\d{2,3}[\s-]?\d{7,8})/g;
      processedResult = [...new Set(originalText.match(phoneRegex) || [])];
      break;
    case "IP地址":
      const ipRegex =
        /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
      processedResult = [...new Set(originalText.match(ipRegex) || [])];
      break;
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

    resultContainer.querySelectorAll(".copy-btn").forEach((copyBtn) => {
      copyBtn.addEventListener("click", (copyEvent) => {
        const text =
          copyEvent.target.dataset.text ||
          copyEvent.target.dataset.link ||
          copyEvent.target.dataset.path;
        copyToClipboard(text, copyBtn);
      });
    });
  } else {
    resultContainer.innerHTML =
      '<div class="no-processed-results">未生成处理结果</div>';
  }
}

function formatProcessedResults(results, type) {
  if (!results || results.length === 0) {
    return '<div class="no-results">无结果</div>';
  }

  let html = "";

  switch (type) {
    case "路径转换":
      html = results
        .map(
          (path) => `
                <div class="processed-item">
                    <button class="copy-btn" data-path="${path}">复制</button>
                    <span class="processed-text">${path}</span>
                </div>
            `,
        )
        .join("");
      break;
    case "链接提取":
    case "仓库链接":
    case "GitHub链接":
      html = results
        .map(
          (link) => `
                <div class="processed-item">
                    <button class="copy-btn" data-link="${link}">复制</button>
                    <a href="${link}" target="_blank">${link}</a>
                </div>
            `,
        )
        .join("");
      break;
    default:
      html = results
        .map(
          (item) => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${item}">复制</button>
                    <span class="processed-text">${item}</span>
                </div>
            `,
        )
        .join("");
  }

  return html;
}

function renderSplittingTool(text) {
  if (!elements.split_delimiter_select || !elements.split_output_container) {
    logger.error("拆分工具UI元素缺失");
    return;
  }

  let delimiter = elements.split_delimiter_select.value;

  const multiRuleCheckbox = document.getElementById("enable-multi-rules");
  if (multiRuleCheckbox && multiRuleCheckbox.checked) {
    const selectedRules = getSelectedRules();
    if (selectedRules.length > 0) {
      delimiter = selectedRules;
    }
  }

  const splitItems = splitText(text, delimiter);

  appState.splitItemsState = splitItems.map((item) => ({
    text: item,
    selected: false,
  }));

  let html = "";
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
                      `<div class="split-item" data-index="${i + index}">${item.text}</div>`,
                  )
                  .join("")}
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
    '#multi-rule-selection input[type="checkbox"]:checked',
  );
  return Array.from(checkboxes).map((cb) => cb.value);
}

function toggleMultiRuleSelection() {
  const checkbox = document.getElementById("enable-multi-rules");
  const container = document.getElementById("multi-rule-selection");

  if (checkbox && container) {
    container.style.display = checkbox.checked ? "block" : "none";

    if (elements.split_delimiter_select) {
      elements.split_delimiter_select.disabled = checkbox.checked;
    }

    if (elements.search_input && elements.search_input.value.trim()) {
      renderSplittingTool(elements.search_input.value);
    }
  }
}

function addSplitItemListeners() {
  document.querySelectorAll(".split-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index);
      appState.splitItemsState[index].selected =
        !appState.splitItemsState[index].selected;
      e.target.classList.toggle(
        "selected",
        appState.splitItemsState[index].selected,
      );
    });
  });

  document.querySelectorAll(".split-row-checkbox").forEach((el) => {
    el.addEventListener("change", (e) => {
      const startIndex = parseInt(e.target.dataset.rowStartIndex);
      const endIndex = Math.min(
        startIndex + 5,
        appState.splitItemsState.length,
      );

      for (let i = startIndex; i < endIndex; i++) {
        appState.splitItemsState[i].selected = e.target.checked;
        const item = document.querySelector(`.split-item[data-index="${i}"]`);
        if (item) {
          item.classList.toggle("selected", e.target.checked);
        }
      }
    });
  });
}

function renderHistory() {
  if (!elements.history_list || !appState.linkHistory) return;

  if (appState.linkHistory.length === 0) {
    elements.history_list.innerHTML = `
            <div class="empty-state">
                <p>暂无历史记录</p>
                <span>处理的链接将会显示在这里</span>
            </div>
        `;
    return;
  }

  elements.history_list.innerHTML = appState.linkHistory
    .map((item) => {
      let url, displayUrl, isGithub, domain, id;

      if (typeof item === "string") {
        url = item;
        displayUrl = item;
        isGithub = url.includes("github.com");
        id = item;
        try {
          const urlObj = new URL(url);
          domain = urlObj.hostname;
        } catch (e) {
          domain = "搜索查询";
        }
      } else if (item && typeof item === "object") {
        url = item.url || item.toString();
        displayUrl = item.unescapedUrl || url;
        isGithub =
          item.type === "github" ||
          item.isGitHubRepo ||
          (url && url.includes("github.com"));
        domain = item.domain || item.title || "未知域名";
        id = item.id;
      } else {
        return "";
      }

      if (!url || url.trim() === "") {
        return "";
      }

      return `
            <div class="history-item ${isGithub ? "github-item" : "other-item"}">
                <div class="history-content">
                    <a href="${url}" target="_blank" class="history-link">${displayUrl}</a>
                    <span class="history-domain">${domain}</span>
                </div>
                <div class="history-actions">
                    <button class="copy-btn btn-sm" data-link="${url}">复制</button>
                    <button class="remove-btn btn-sm" data-id="${id}" data-link="${url}">删除</button>
                </div>
            </div>
        `;
    })
    .filter((html) => html !== "")
    .join("");

  document.querySelectorAll(".history-item .copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const link = e.target.dataset.link;
      copyToClipboard(link, e.target);
    });
  });

  document.querySelectorAll(".history-item .remove-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
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
          showNotification("历史记录已删除");
        } catch (error) {
          logger.error("删除历史记录失败:", error);
          showNotification("删除失败", false);
        }
      }
    });
  });
}

async function copyToClipboard(text, button) {
  try {
    await copyTextToClipboard(text);
    showCopyFeedback(button);
    showNotification("已复制到剪贴板");
  } catch (err) {
    logger.error("复制失败:", err);
    showNotification("复制失败", false);
  }
}

function showCopyFeedback(button) {
  if (!button) return;

  const originalText = button.textContent;
  const originalBg = button.style.backgroundColor;

  button.textContent = "已复制!";
  button.style.backgroundColor = "#10b981";

  setTimeout(() => {
    if (button.parentNode) {
      button.textContent = originalText;
      button.style.backgroundColor = originalBg;
    }
  }, 1500);
}

function setupEventListeners() {
  logger.info("设置事件监听器...");

  if (elements.search_input) {
    elements.search_input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleSearch();
      else handleInputChange();
    });

    elements.search_input.addEventListener("input", handleTextareaInput);
  }

  if (elements.search_btn) {
    elements.search_btn.addEventListener("click", handleSearch);
  }

  if (elements.clipboard_btn) {
    elements.clipboard_btn.addEventListener("click", () => {
      toggleClipboardMonitoring();
    });
  }

  if (elements.settings_btn) {
    elements.settings_btn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage
        ? chrome.runtime.openOptionsPage()
        : window.open(chrome.runtime.getURL("src/settings/index.html"));
    });
  }

  setupSwitchContainerListeners();

  if (elements.refresh_split_btn) {
    elements.refresh_split_btn.addEventListener("click", () =>
      renderSplittingTool(
        elements.search_input ? elements.search_input.value : "",
      ),
    );
  }

  const multiRuleCheckbox = document.getElementById("enable-multi-rules");
  if (multiRuleCheckbox) {
    multiRuleCheckbox.addEventListener("change", toggleMultiRuleSelection);
  }

  document.addEventListener("change", (e) => {
    if (e.target.matches('#multi-rule-selection input[type="checkbox"]')) {
      if (elements.search_input && elements.search_input.value.trim()) {
        renderSplittingTool(elements.search_input.value);
      }
    }
  });

  if (elements.split_delimiter_select) {
    elements.split_delimiter_select.addEventListener("change", () => {
      if (elements.search_input && elements.search_input.value.trim()) {
        renderSplittingTool(elements.search_input.value);
      }
    });
  }

  if (elements.copy_selected_btn) {
    elements.copy_selected_btn.addEventListener("click", handleCopySelected);
  }

  if (elements.select_all_checkbox) {
    elements.select_all_checkbox.addEventListener("change", handleSelectAll);
  }

  if (elements.path_quote_checkbox) {
    elements.path_quote_checkbox.addEventListener("change", () =>
      renderExtractionUI(
        elements.search_input ? elements.search_input.value : "",
      ),
    );
  }

  if (elements.show_history_btn) {
    elements.show_history_btn.addEventListener("click", toggleHistoryDisplay);
  }

  if (elements.export_history_btn) {
    elements.export_history_btn.addEventListener("click", exportHistory);
  }

  if (elements.clear_history_btn) {
    elements.clear_history_btn.addEventListener("click", handleClearHistory);
  }

  setupTextareaResizeHandle();

  const formatButtons = document.querySelectorAll(".format-btn");
  formatButtons.forEach((btn) => {
    btn.addEventListener("click", handleFormatButtonClick);
  });

  const backButton = document.getElementById("back-to-previous");
  if (backButton) {
    backButton.addEventListener("click", handleBackToPrevious);
  }

  const copyResultButton = document.getElementById("copy-result-btn");
  if (copyResultButton) {
    copyResultButton.addEventListener("click", handleCopyResult);
  }

  const searchResultButton = document.getElementById("search-result-btn");
  if (searchResultButton) {
    searchResultButton.addEventListener("click", handleSearchResult);
  }

  logger.info("事件监听器设置完成");
}

function setupSwitchContainerListeners() {
  const switchContainers = document.querySelectorAll(".switch-container");

  switchContainers.forEach((container) => {
    const checkbox = container.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    if (checkbox.id === "switch-multi-format") {
      const multiFormatContainer = document.getElementById(
        "multi-format-container",
      );
      if (multiFormatContainer) {
        multiFormatContainer.style.display = checkbox.checked
          ? "block"
          : "none";
      }
    }

    container.addEventListener("click", (e) => {
      if (e.target === checkbox) return;

      checkbox.checked = !checkbox.checked;

      const changeEvent = new Event("change", { bubbles: true });
      checkbox.dispatchEvent(changeEvent);

      const switchType = container.dataset.switch;
      switch (switchType) {
        case "extract":
          handleSwitchChange(checkbox, "extract-container");
          break;
        case "link-gen":
          handleSwitchChange(checkbox, "link-gen-container");
          break;
        case "multi-format":
          handleMultiFormatSwitchChange(checkbox);
          break;
      }
    });

    checkbox.addEventListener("change", () => {
      const switchType = container.dataset.switch;
      switch (switchType) {
        case "extract":
          handleSwitchChange(checkbox, "extract-container");
          break;
        case "link-gen":
          handleSwitchChange(checkbox, "link-gen-container");
          break;
        case "multi-format":
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

  textarea.classList.add("auto-resizing");
  textarea.style.height = "auto";

  let newHeight = Math.max(minHeight, textarea.scrollHeight);
  newHeight = Math.min(newHeight, maxHeight);

  if (appState.clipboardMonitoring) {
    const expandedMaxHeight = Math.min(
      maxHeight * 1.2,
      window.innerHeight * 0.6,
    );
    newHeight = Math.min(newHeight, expandedMaxHeight);
  }

  textarea.style.height = newHeight + "px";

  if (textarea.scrollHeight > newHeight) {
    textarea.style.overflowY = "auto";
  } else {
    textarea.style.overflowY = "hidden";
  }

  setTimeout(() => {
    textarea.classList.remove("auto-resizing");
  }, 150);
}

function setupTextareaResizeHandle() {
  const handle = document.querySelector(".textarea-resize-handle");
  const textarea = elements.search_input;
  const container = document.querySelector(".search-input-container");

  if (!handle || !textarea || !container) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let animationFrame = null;

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = parseInt(
      document.defaultView.getComputedStyle(textarea).height,
      10,
    );

    container.classList.add("resizing");
    document.body.style.cursor = "nw-resize";
    document.body.style.userSelect = "none";
    textarea.style.transition = "none";

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseUp);

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

      textarea.style.height = newHeight + "px";
      textarea.style.overflowY = newHeight >= maxHeight ? "auto" : "hidden";
      textarea.isManuallyResized = true;
      updateSearchControlsPosition();
    });
  }

  function handleMouseUp() {
    if (!isResizing) return;

    isResizing = false;

    container.classList.remove("resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    setTimeout(() => {
      textarea.style.transition = "";
    }, 50);

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("mouseleave", handleMouseUp);
  }
}

function updateSearchControlsPosition() {
  const searchControls = document.getElementById("search-controls");
  const container = document.getElementById("resizable-container");
  const textarea = elements.search_input;

  if (!searchControls || !container || !textarea) return;

  const containerWidth = container.offsetWidth;
  const textareaHeight = textarea.offsetHeight;
  const isNarrow = containerWidth < 480;
  const isTextareaExpanded = textareaHeight > 32;

  if (isNarrow || isTextareaExpanded) {
    searchControls.classList.add("below-input");
  } else {
    searchControls.classList.remove("below-input");
  }
}

function initializeResponsiveLayout() {
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const width = entry.contentRect.width;

      if (width < 480) {
        document.body.classList.add("narrow-layout");
        document.body.classList.remove("medium-layout", "wide-layout");
      } else if (width < 768) {
        document.body.classList.add("medium-layout");
        document.body.classList.remove("narrow-layout", "wide-layout");
      } else {
        document.body.classList.add("wide-layout");
        document.body.classList.remove("narrow-layout", "medium-layout");
      }

      updateSearchControlsPosition();
    }
  });

  const container = document.getElementById("resizable-container");
  if (container) {
    resizeObserver.observe(container);
  }

  updateSearchControlsPosition();
}

function handleCopySelected() {
  const selectedItems = appState.splitItemsState
    .filter((item) => item.selected)
    .map((item) => item.text);
  if (selectedItems.length === 0) {
    showNotification("未选择任何项目！", false);
    return;
  }

  let separator = "";
  if (elements.copy_opt_newline && elements.copy_opt_newline.checked) {
    separator = "\n";
  } else if (elements.copy_opt_tab && elements.copy_opt_tab.checked) {
    separator = "\t";
  } else if (elements.copy_opt_space && elements.copy_opt_space.checked) {
    separator = " ";
  }

  const textToCopy = selectedItems.join(separator);
  copyToClipboard(textToCopy, elements.copy_selected_btn);
}

function handleSelectAll(e) {
  const isSelected = e.target.checked;
  appState.splitItemsState.forEach((item) => (item.selected = isSelected));
  document
    .querySelectorAll(".split-item")
    .forEach((el) => el.classList.toggle("selected", isSelected));
  document
    .querySelectorAll(".split-row-checkbox")
    .forEach((cb) => (cb.checked = isSelected));
}

function toggleHistoryDisplay() {
  const container = elements.history_container;
  if (container) {
    const isVisible = container.style.display !== "none";
    container.style.display = isVisible ? "none" : "block";
    elements.show_history_btn.innerHTML = isVisible
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 历史'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg> 隐藏';
  }
}

async function exportHistory() {
  try {
    const history = await getHistory();
    const exportData = {
      history,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `search-buddy-history-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showNotification("历史记录已导出");
  } catch (error) {
    logger.error("导出历史记录失败:", error);
    showNotification("导出失败", false);
  }
}

async function handleClearHistory() {
  if (confirm("确定要清空所有历史记录吗？此操作不可恢复。")) {
    try {
      await linkHistoryManager.clearHistory();
      appState.linkHistory = [];
      renderHistory();
      showNotification("历史记录已清空");
    } catch (error) {
      logger.error("清空历史记录失败:", error);
      showNotification("清空失败", false);
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
    if (error.name === "NotAllowedError") {
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
    elements.clipboard_permission_panel.style.display = hasPermission
      ? "none"
      : "block";
  }

  return hasPermission;
}

/**
 * 请求剪贴板权限
 */
async function requestClipboardPermission() {
  logger.info("请求剪贴板权限...");

  try {
    // 通过尝试读取剪贴板来触发权限请求
    await navigator.clipboard.readText();

    // 权限获取成功
    logger.info("剪贴板权限获取成功");
    showNotification("剪贴板权限已授予", true);

    // 更新UI
    await updatePermissionPanel();

    // 自动开启剪贴板监控
    if (!appState.clipboardMonitoring) {
      await toggleClipboardMonitoring();
    }

    return true;
  } catch (error) {
    logger.error("剪贴板权限获取失败:", error);

    if (error.name === "NotAllowedError") {
      showNotification("剪贴板权限被拒绝，请在浏览器设置中手动开启", false);
    } else {
      showNotification("获取剪贴板权限失败: " + error.message, false);
    }

    return false;
  }
}

/**
 * 从系统剪贴板读取内容（利用扩展权限，无需额外授权）
 */
async function readSystemClipboard() {
  logger.info("从系统剪贴板读取内容...");

  try {
    // 扩展页面有 clipboardRead 权限，可以直接读取
    const text = await navigator.clipboard.readText();

    if (!text || text.trim().length === 0) {
      showNotification("剪贴板为空", false);
      return null;
    }

    logger.info("读取到剪贴板内容，长度:", text.length);

    // 填充到搜索框
    if (elements.search_input) {
      elements.search_input.value = text;
      elements.search_input.isManuallyResized = false;
      handleTextareaInput();
      updateSearchControlsPosition();
    }

    // 添加到剪贴板历史
    await addToClipboardHistory(text);

    showNotification("已读取剪贴板内容", true);
    return text;
  } catch (error) {
    logger.error("读取剪贴板失败:", error);

    if (error.name === "NotAllowedError") {
      showNotification("无法读取剪贴板，请确保已授予权限", false);
    } else {
      showNotification("读取剪贴板失败: " + error.message, false);
    }

    return null;
  }
}

/**
 * 切换自动监控模式
 */
async function toggleAutoMonitorMode() {
  logger.info("切换自动监控模式...");

  // 检查是否有权限
  const hasPermission = await checkClipboardPermission();

  if (!hasPermission) {
    // 显示权限请求面板
    if (elements.clipboard_permission_panel) {
      elements.clipboard_permission_panel.style.display = "block";
    }
    showNotification("请先授予剪贴板权限以开启自动监控", false);
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
    elements.request_clipboard_permission_btn.addEventListener(
      "click",
      requestClipboardPermission,
    );
  }

  // 绑定读取剪贴板按钮
  if (elements.read_clipboard_btn) {
    elements.read_clipboard_btn.addEventListener("click", readSystemClipboard);
  }

  // 绑定切换自动监控按钮
  if (elements.toggle_auto_monitor_btn) {
    elements.toggle_auto_monitor_btn.addEventListener(
      "click",
      toggleAutoMonitorMode,
    );
  }
}
