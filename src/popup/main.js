// src/popup/main.js
// Popup主入口 - 匹配新UI版本

import { getSettings } from '../utils/storage.js';
import {
  splitText,
  processPath,
  processLinkGeneration,
  analyzeTextForMultipleFormats,
  ANALYZE_MODES
} from '../utils/textProcessor.js';
import linkHistoryManager from '../utils/linkHistory.js';
import clipboardHistoryManager from '../utils/clipboardHistory.js';

// 全局状态
const state = {
  searchEngines: [],
  currentText: '',
  splitTokens: [],
  selectedTokens: new Set(),
  multiFormatHistory: [],
  multiFormatHistoryIndex: -1,
  multiRuleSequence: [],
  clipboardSettings: { enabled: true, autoSave: true, maxItems: 100 },
  linkHistoryFilter: 'all',
  clipboardFilter: 'all',
  isClipboardMonitoring: false
};

// DOM元素缓存
const elements = {};

// 初始化DOM元素引用
function initElements() {
  // 搜索相关
  elements.searchInput = document.getElementById('search-input');
  elements.engineSelect = document.getElementById('engine-select');
  elements.searchBtn = document.getElementById('search-btn');

  // 头部按钮
  elements.clipboardBtn = document.getElementById('clipboard-btn');
  elements.settingsBtn = document.getElementById('settings-btn');

  // 功能开关
  elements.switchExtract = document.getElementById('switch-extract');
  elements.switchLinkGen = document.getElementById('switch-link-gen');
  elements.switchMultiFormat = document.getElementById('switch-multi-format');

  // 结果容器
  elements.extractContainer = document.getElementById('extract-container');
  elements.linkGenContainer = document.getElementById('link-gen-container');
  elements.multiFormatContainer = document.getElementById('multi-format-container');

  // 提取功能元素
  elements.pathConversionTool = document.getElementById('path-conversion-tool');
  elements.pathConversionResult = document.getElementById('path-conversion-result');
  elements.pathAddQuoteBtn = document.getElementById('path-add-quote-btn');
  elements.pathResetQuoteBtn = document.getElementById('path-reset-quote-btn');
  elements.linkExtractionResult = document.getElementById('link-extraction-result');
  elements.textSplittingTool = document.getElementById('text-splitting-tool');
  elements.splitDelimiterSelect = document.getElementById('split-delimiter-select');
  elements.splitOutputContainer = document.getElementById('split-output-container');
  elements.refreshSplitBtn = document.getElementById('refresh-split-btn');
  elements.copySelectedBtn = document.getElementById('copy-selected-btn');
  elements.selectAllCheckbox = document.getElementById('select-all-checkbox');
  elements.copyOptSpace = document.getElementById('copy-opt-space');
  elements.copyOptNewline = document.getElementById('copy-opt-newline');
  elements.copyOptTab = document.getElementById('copy-opt-tab');

  // 多规则组合元素
  elements.multiRuleButtons = document.getElementById('multi-rule-buttons');
  elements.multiRuleHistory = document.getElementById('multi-rule-history-list');
  elements.multiRuleBackBtn = document.getElementById('multi-rule-back-btn');
  elements.multiRuleResetBtn = document.getElementById('multi-rule-reset-btn');

  // 链接生成元素
  elements.linkGenResult = document.getElementById('link-gen-result');

  // 多格式分析元素
  elements.multiFormatResult = document.getElementById('multi-format-result');
  elements.originalText = document.getElementById('original-text');
  elements.backToPrevious = document.getElementById('back-to-previous');
  elements.copyResultBtn = document.getElementById('copy-result-btn');
  elements.searchResultBtn = document.getElementById('search-result-btn');

  // 链接历史元素
  elements.historyContainer = document.getElementById('history-container');
  elements.historyList = document.getElementById('history-list');
  elements.historySearch = document.getElementById('history-search');
  elements.showHistoryBtn = document.getElementById('show-history-btn');
  elements.editHistoryBtn = document.getElementById('edit-history-btn');
  elements.clearHistoryBtn = document.getElementById('clear-history-btn');

  // 剪贴板历史元素
  elements.clipboardActionPanel = document.getElementById('clipboard-action-panel');
  elements.clipboardPermissionPanel = document.getElementById('clipboard-permission-panel');
  elements.clipboardSettingsPanel = document.getElementById('clipboard-settings-panel');
  elements.clipboardHistoryContainer = document.getElementById('clipboard-history-container');
  elements.clipboardHistoryList = document.getElementById('clipboard-history-list');
  elements.clipboardHistorySearch = document.getElementById('clipboard-history-search');
  elements.showClipboardBtn = document.getElementById('show-clipboard-btn');
  elements.clipboardSettingsBtn = document.getElementById('clipboard-settings-btn');
  elements.clearClipboardBtn = document.getElementById('clear-clipboard-btn');
  elements.readClipboardBtn = document.getElementById('read-clipboard-btn');
  elements.toggleAutoMonitorBtn = document.getElementById('toggle-auto-monitor-btn');
  elements.requestClipboardPermissionBtn = document.getElementById(
    'request-clipboard-permission-btn'
  );
  elements.saveClipboardSettings = document.getElementById('save-clipboard-settings');
  elements.cancelClipboardSettings = document.getElementById('cancel-clipboard-settings');
  elements.clipboardEnabled = document.getElementById('clipboard-enabled');
  elements.clipboardAutoSave = document.getElementById('clipboard-auto-save');
  elements.clipboardMaxItems = document.getElementById('clipboard-max-items');

  // Token 历史元素
  elements.tokenHistoryContainer = document.getElementById('token-history-container');
  elements.tokenHistoryList = document.getElementById('token-history-list');
  elements.tokenHistorySearch = document.getElementById('token-history-search');
  elements.showTokenHistoryBtn = document.getElementById('show-token-history-btn');
  elements.clearTokenHistoryBtn = document.getElementById('clear-token-history-btn');
}

// 通知提示
function showNotification(message, isSuccess = true) {
  const notification = document.getElementById('notification');
  if (!notification) {
    console.log(message);
    return;
  }
  notification.textContent = message;
  notification.className = `notification ${isSuccess ? 'success' : 'error'} show`;
  setTimeout(() => notification.classList.remove('show'), 3000);
}

// 初始化搜索引擎选择列表
async function initEngineSelect() {
  const settings = await getSettings();
  state.searchEngines = settings.searchEngines || [];

  const select = elements.engineSelect;
  if (!select) return;

  select.innerHTML = state.searchEngines
    .map((engine) => `<option value="${engine.name}">${engine.name}</option>`)
    .join('');

  // 设置默认引擎
  const defaultEngine = settings.defaultEngine || state.searchEngines[0]?.name;
  if (defaultEngine) {
    select.value = defaultEngine;
  }
}

// 搜索功能
async function performSearch() {
  const query = elements.searchInput?.value.trim();
  if (!query) {
    showNotification('请输入搜索内容', false);
    return;
  }

  const engineName = elements.engineSelect?.value;
  const engine = state.searchEngines.find((e) => e.name === engineName);

  if (!engine) {
    showNotification('请选择搜索引擎', false);
    return;
  }

  const searchUrl = engine.template.replace('%s', encodeURIComponent(query));
  chrome.tabs.create({ url: searchUrl });

  // 添加到历史记录
  await linkHistoryManager.addSearchQuery(query, searchUrl, engineName, 'popup_search');
}

// 更新功能面板显示
function updateFeaturePanels() {
  const showExtract = elements.switchExtract?.checked;
  const showLinkGen = elements.switchLinkGen?.checked;
  const showMultiFormat = elements.switchMultiFormat?.checked;

  if (elements.extractContainer) {
    elements.extractContainer.style.display = showExtract ? 'block' : 'none';
  }
  if (elements.linkGenContainer) {
    elements.linkGenContainer.style.display = showLinkGen ? 'block' : 'none';
  }
  if (elements.multiFormatContainer) {
    elements.multiFormatContainer.style.display = showMultiFormat ? 'block' : 'none';
  }

  // 如果有输入内容，自动处理
  const text = elements.searchInput?.value.trim();
  if (text) {
    if (showExtract) processExtract(text);
    if (showLinkGen) processLinkGen(text);
    if (showMultiFormat) processMultiFormat(text);
  }
}

// 提取和拆解功能
function processExtract(text) {
  if (!text) return;

  // 路径转换
  const paths = processPath(text);
  if (paths && paths.length > 0) {
    if (elements.pathConversionTool) elements.pathConversionTool.style.display = 'block';
    renderPathConversion(paths);
  } else {
    if (elements.pathConversionTool) elements.pathConversionTool.style.display = 'none';
  }

  // 链接提取
  const urlRegex = /https?:\/\/[^\s<>"{}|^`[\]]+/gi;
  const links = text.match(urlRegex) || [];
  if (links.length > 0) {
    if (elements.linkExtractionResult) elements.linkExtractionResult.style.display = 'block';
    renderLinkExtraction([...new Set(links)]);
  } else {
    if (elements.linkExtractionResult) elements.linkExtractionResult.style.display = 'none';
  }

  // 文本拆分工具
  if (elements.textSplittingTool) elements.textSplittingTool.style.display = 'block';
  processTextSplit(text);
}

// 渲染路径转换结果
function renderPathConversion(paths) {
  if (!elements.pathConversionResult) return;

  elements.pathConversionResult.innerHTML = paths
    .map(
      (path, index) => `
    <div class="path-item" data-index="${index}" data-original="${path}">
      <code>${escapeHtml(path)}</code>
      <button class="copy-path-btn" data-path="${path}">复制</button>
    </div>
  `
    )
    .join('');

  // 绑定复制事件
  elements.pathConversionResult.querySelectorAll('.copy-path-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.path);
      showNotification('路径已复制');
    });
  });
}

// 渲染链接提取结果
function renderLinkExtraction(links) {
  if (!elements.linkExtractionResult) return;

  elements.linkExtractionResult.innerHTML = `
    <h5>提取的链接 (${links.length})</h5>
    <div class="link-list">
      ${links
        .map(
          (link) => `
        <div class="link-item">
          <a href="${link}" target="_blank" title="${link}">${truncateText(link, 50)}</a>
          <button class="copy-link-btn" data-link="${link}">复制</button>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  elements.linkExtractionResult.querySelectorAll('.copy-link-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.link);
      showNotification('链接已复制');
    });
  });
}

// 文本拆分处理
async function processTextSplit(text) {
  const mode = elements.splitDelimiterSelect?.value || 'smart';

  // 显示/隐藏多规则按钮
  if (elements.multiRuleButtons) {
    elements.multiRuleButtons.style.display = mode === 'multi' ? 'block' : 'none';
  }

  try {
    let tokens = [];
    if (mode === 'multi') {
      tokens = await splitText(text, 'multi', { rules: state.multiRuleSequence });
    } else {
      tokens = await splitText(text, mode);
    }

    state.splitTokens = tokens;
    renderSplitOutput(tokens);
  } catch (error) {
    console.error('文本拆分失败:', error);
    showNotification('文本拆分失败', false);
  }
}

// 渲染拆分输出
function renderSplitOutput(tokens) {
  if (!elements.splitOutputContainer) return;

  if (tokens.length === 0) {
    elements.splitOutputContainer.innerHTML = '<p class="empty-text">无分词结果</p>';
    return;
  }

  elements.splitOutputContainer.innerHTML = tokens
    .map(
      (token, index) => `
    <label class="token-checkbox-item">
      <input type="checkbox" class="token-checkbox" data-index="${index}" data-token="${escapeHtml(token)}">
      <span class="token-text">${escapeHtml(token)}</span>
    </label>
  `
    )
    .join('');

  // 绑定复选框事件
  elements.splitOutputContainer.querySelectorAll('.token-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (e.target.checked) {
        state.selectedTokens.add(index);
      } else {
        state.selectedTokens.delete(index);
      }
      updateSelectAllCheckbox();
    });
  });
}

// 更新全选复选框状态
function updateSelectAllCheckbox() {
  if (!elements.selectAllCheckbox) return;
  const allChecked =
    state.selectedTokens.size === state.splitTokens.length && state.splitTokens.length > 0;
  elements.selectAllCheckbox.checked = allChecked;
}

// 复制选中的分词
async function copySelectedTokens() {
  if (state.selectedTokens.size === 0) {
    showNotification('请先选择要复制的分词', false);
    return;
  }

  const selectedIndices = Array.from(state.selectedTokens).sort((a, b) => a - b);
  let separator = '\n';
  if (elements.copyOptSpace?.checked) separator = ' ';
  if (elements.copyOptNewline?.checked) separator = '\n';
  if (elements.copyOptTab?.checked) separator = '\t';

  const text = selectedIndices.map((i) => state.splitTokens[i]).join(separator);

  try {
    await navigator.clipboard.writeText(text);
    showNotification(`已复制 ${state.selectedTokens.size} 个分词`);
  } catch (error) {
    showNotification('复制失败', false);
  }
}

// 链接生成功能
function processLinkGen(text) {
  const result = processLinkGeneration(text);

  if (!elements.linkGenResult) return;

  if (!result) {
    elements.linkGenResult.innerHTML = '<p class="empty-text">未检测到GitHub仓库格式</p>';
    return;
  }

  elements.linkGenResult.innerHTML = `
    <div class="link-gen-original">
      <span>原始链接:</span>
      <a href="${result.originalGithubLink}" target="_blank">${result.originalGithubLink}</a>
    </div>
    <div class="link-gen-list">
      <h5>生成的链接</h5>
      ${result.generatedLinks
        .map(
          (link) => `
        <div class="generated-link-item">
          <a href="${link}" target="_blank">${link}</a>
          <button class="copy-gen-link-btn" data-link="${link}">复制</button>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  elements.linkGenResult.querySelectorAll('.copy-gen-link-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.link);
      showNotification('链接已复制');
    });
  });
}

// 多格式分析功能
function processMultiFormat(text) {
  if (!elements.originalText) return;

  elements.originalText.textContent = text || '请在输入框中输入文本，然后点击下方按钮进行处理';
  state.multiFormatHistory = [text];
  state.multiFormatHistoryIndex = 0;
}

// 应用多格式转换
function applyMultiFormat(action) {
  if (state.multiFormatHistory.length === 0) return;

  const currentText = state.multiFormatHistory[state.multiFormatHistoryIndex];
  let result = currentText;

  switch (action) {
    case 'remove-chinese':
      result = currentText.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '');
      break;
    case 'remove-non-url-chars':
      result = currentText.replace(/[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/g, '');
      break;
    case 'remove-spaces':
      result = currentText.replace(/\s/g, '');
      break;
    case 'convert-to-url-chars':
      result = encodeURIComponent(currentText);
      break;
    case 'convert-period':
      result = currentText.replace(/。/g, '.');
      break;
    case 'convert-slash-to-backslash':
      result = currentText.replace(/\//g, '\\');
      break;
    case 'convert-backslash-to-slash':
      result = currentText.replace(/\\/g, '/');
      break;
    case 'convert-slash-to-double':
      result = currentText.replace(/\//g, '//');
      break;
    case 'convert-backslash-to-double':
      result = currentText.replace(/\\/g, '\\\\');
      break;
    case 'add-file-protocol':
      result = currentText.startsWith('file:///')
        ? currentText
        : 'file:///' + currentText.replace(/^\/+/, '');
      break;
    case 'remove-brackets':
      result = currentText.replace(/\[[^\]]*\]/g, '');
      break;
    case 'escape-spaces':
      result = currentText.replace(/ /g, '%20');
      break;
    default:
      return;
  }

  // 添加到历史
  state.multiFormatHistory = state.multiFormatHistory.slice(0, state.multiFormatHistoryIndex + 1);
  state.multiFormatHistory.push(result);
  state.multiFormatHistoryIndex++;

  updateMultiFormatResult();
}

// 更新多格式分析结果显示
function updateMultiFormatResult() {
  if (!elements.originalText) return;

  const currentText = state.multiFormatHistory[state.multiFormatHistoryIndex];
  elements.originalText.textContent = currentText;

  // 更新返回按钮状态
  if (elements.backToPrevious) {
    elements.backToPrevious.disabled = state.multiFormatHistoryIndex <= 0;
  }
}

// 返回上一次处理结果
function backToPreviousResult() {
  if (state.multiFormatHistoryIndex > 0) {
    state.multiFormatHistoryIndex--;
    updateMultiFormatResult();
  }
}

// 复制多格式分析结果
async function copyMultiFormatResult() {
  if (state.multiFormatHistory.length === 0) return;

  const text = state.multiFormatHistory[state.multiFormatHistoryIndex];
  try {
    await navigator.clipboard.writeText(text);
    showNotification('结果已复制');
  } catch (error) {
    showNotification('复制失败', false);
  }
}

// 搜索多格式分析结果
function searchMultiFormatResult() {
  if (state.multiFormatHistory.length === 0) return;

  const text = state.multiFormatHistory[state.multiFormatHistoryIndex];
  const engineName = elements.engineSelect?.value;
  const engine = state.searchEngines.find((e) => e.name === engineName);

  if (engine) {
    const searchUrl = engine.template.replace('%s', encodeURIComponent(text));
    chrome.tabs.create({ url: searchUrl });
  }
}

// 多规则组合处理
function addMultiRule(rule) {
  state.multiRuleSequence.push(rule);
  updateMultiRuleHistory();
  refreshTextSplit();
}

// 撤销多规则
function backMultiRule() {
  if (state.multiRuleSequence.length > 0) {
    state.multiRuleSequence.pop();
    updateMultiRuleHistory();
    refreshTextSplit();
  }
}

// 重置多规则
function resetMultiRule() {
  state.multiRuleSequence = [];
  updateMultiRuleHistory();
  refreshTextSplit();
}

// 更新多规则历史显示
function updateMultiRuleHistory() {
  if (!elements.multiRuleHistory) return;

  if (state.multiRuleSequence.length === 0) {
    elements.multiRuleHistory.textContent = '无';
  } else {
    elements.multiRuleHistory.textContent = state.multiRuleSequence.join(' → ');
  }

  if (elements.multiRuleBackBtn) {
    elements.multiRuleBackBtn.disabled = state.multiRuleSequence.length === 0;
  }
}

// 刷新文本拆分
async function refreshTextSplit() {
  const text = elements.searchInput?.value.trim();
  if (text) {
    await processTextSplit(text);
  }
}

// 链接历史管理
async function loadLinkHistory() {
  const history = await linkHistoryManager.getHistory();
  renderLinkHistory(history);
}

function renderLinkHistory(history, filter = 'all', searchTerm = '') {
  if (!elements.historyList) return;

  let filtered = history;

  // 应用过滤器
  if (filter !== 'all') {
    filtered = filtered.filter((item) => {
      const isGithub = item.url?.includes('github.com');
      if (filter === 'github') return isGithub;
      if (filter === 'other') return !isGithub;
      return true;
    });
  }

  // 应用搜索
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.url?.toLowerCase().includes(term) ||
        item.title?.toLowerCase().includes(term) ||
        item.searchQuery?.toLowerCase().includes(term)
    );
  }

  if (filtered.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-state"><p>暂无历史记录</p></div>';
    return;
  }

  elements.historyList.innerHTML = filtered
    .map((item) => {
      const isSearch = item.isSearch;
      const displayText = isSearch ? item.searchQuery || item.title : item.url;
      const isGithub = item.url?.includes('github.com');

      return `
      <div class="history-item ${isGithub ? 'github-item' : ''}" data-id="${item.id}">
        <div class="history-content">
          ${isSearch ? '<span class="search-badge">搜索</span>' : ''}
          <a href="${item.url}" target="_blank" class="history-link" title="${displayText}">
            ${truncateText(displayText, 60)}
          </a>
        </div>
        <div class="history-actions">
          <button class="copy-btn btn-sm" data-text="${displayText}">复制</button>
          <button class="remove-btn btn-sm" data-id="${item.id}">删除</button>
        </div>
      </div>
    `;
    })
    .join('');

  // 绑定事件
  elements.historyList.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.text);
      showNotification('已复制');
    });
  });

  elements.historyList.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要删除这条记录吗？')) {
        await linkHistoryManager.removeItem(btn.dataset.id);
        loadLinkHistory();
        showNotification('已删除');
      }
    });
  });
}

async function clearLinkHistory() {
  if (confirm('确定要清空所有链接历史吗？')) {
    await linkHistoryManager.clearHistory();
    loadLinkHistory();
    showNotification('历史记录已清空');
  }
}

// 剪贴板监控状态同步
async function syncClipboardMonitoringState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getGlobalMonitoringState' });
    if (response) {
      state.isClipboardMonitoring = response.isActive ?? false;
      updateClipboardMonitoringButton();
    }
  } catch (error) {
    console.error('同步剪贴板监控状态失败:', error);
  }
}

// 切换剪贴板监控状态
async function toggleClipboardMonitoring() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'toggleGlobalMonitoring' });
    if (response && response.success) {
      state.isClipboardMonitoring = response.isActive;
      updateClipboardMonitoringButton();
      showNotification(`剪贴板监控已${response.isActive ? '开启' : '关闭'}`, response.isActive);
    }
  } catch (error) {
    console.error('切换剪贴板监控状态失败:', error);
    showNotification('切换失败，请重试', false);
  }
}

// 更新剪贴板监控按钮状态
function updateClipboardMonitoringButton() {
  const isActive = state.isClipboardMonitoring;

  // 更新 toggleAutoMonitorBtn
  if (elements.toggleAutoMonitorBtn) {
    elements.toggleAutoMonitorBtn.textContent = isActive ? '停止监控' : '开始监控';
    elements.toggleAutoMonitorBtn.classList.toggle('active', isActive);
    elements.toggleAutoMonitorBtn.classList.toggle('btn-success', isActive);
    elements.toggleAutoMonitorBtn.classList.toggle('btn-primary', !isActive);
  }

  // 更新 clipboardBtn（头部按钮的小圆点状态）
  if (elements.clipboardBtn) {
    const statusSpan = elements.clipboardBtn.querySelector('.clipboard-status');
    if (statusSpan) {
      statusSpan.classList.toggle('active', isActive);
    }
  }
}

// 剪贴板历史管理
async function loadClipboardSettings() {
  const settings = await clipboardHistoryManager.getSettings();
  state.clipboardSettings = { ...state.clipboardSettings, ...settings };

  if (elements.clipboardEnabled)
    elements.clipboardEnabled.checked = state.clipboardSettings.enabled;
  if (elements.clipboardAutoSave)
    elements.clipboardAutoSave.checked = state.clipboardSettings.autoSave;
  if (elements.clipboardMaxItems)
    elements.clipboardMaxItems.value = state.clipboardSettings.maxItems;
}

async function loadClipboardHistory() {
  const history = await clipboardHistoryManager.getHistory();
  renderClipboardHistory(history);
}

function renderClipboardHistory(history, filter = 'all', searchTerm = '') {
  if (!elements.clipboardHistoryList) return;

  let filtered = history;

  // 应用过滤器
  if (filter !== 'all') {
    filtered = filtered.filter((item) => {
      const tags = item.tags || [];
      if (filter === 'url') return tags.includes('url');
      if (filter === 'code') return tags.includes('code');
      if (filter === 'text') return !tags.includes('url') && !tags.includes('code');
      return true;
    });
  }

  // 应用搜索
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.text?.toLowerCase().includes(term) || item.preview?.toLowerCase().includes(term)
    );
  }

  if (filtered.length === 0) {
    elements.clipboardHistoryList.innerHTML =
      '<div class="empty-state"><p>暂无剪贴板历史</p></div>';
    return;
  }

  elements.clipboardHistoryList.innerHTML = filtered
    .map((item) => {
      const isUrl = item.tags?.includes('url');
      const isCode = item.tags?.includes('code');

      return `
      <div class="clipboard-item ${isUrl ? 'url-item' : ''} ${isCode ? 'code-item' : ''}" data-id="${item.id}">
        <div class="clipboard-content">
          <div class="clipboard-preview" title="${escapeHtml(item.text)}">
            ${escapeHtml(item.preview || item.text.substring(0, 100))}
          </div>
          <div class="clipboard-meta">
            <span class="clipboard-length">${item.length} 字符</span>
            <span class="clipboard-time">${formatRelativeTime(item.timestamp)}</span>
          </div>
        </div>
        <div class="clipboard-actions">
          <button class="copy-clipboard-btn btn-sm" data-text="${escapeHtml(item.text)}">复制</button>
          <button class="use-clipboard-btn btn-sm" data-text="${escapeHtml(item.text)}">使用</button>
          <button class="remove-clipboard-btn btn-sm" data-id="${item.id}">删除</button>
        </div>
      </div>
    `;
    })
    .join('');

  // 绑定事件
  elements.clipboardHistoryList.querySelectorAll('.copy-clipboard-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.text);
      showNotification('已复制到剪贴板');
    });
  });

  elements.clipboardHistoryList.querySelectorAll('.use-clipboard-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (elements.searchInput) {
        elements.searchInput.value = btn.dataset.text;
        updateFeaturePanels();
      }
    });
  });

  elements.clipboardHistoryList.querySelectorAll('.remove-clipboard-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('确定要删除这条记录吗？')) {
        await clipboardHistoryManager.removeItem(btn.dataset.id);
        loadClipboardHistory();
        showNotification('已删除');
      }
    });
  });
}

async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      await clipboardHistoryManager.addItem(text, { source: 'manual_read' });
      if (elements.searchInput) {
        elements.searchInput.value = text;
        updateFeaturePanels();
      }
      loadClipboardHistory();
      showNotification('剪贴板内容已读取');
    }
  } catch (error) {
    showNotification('无法读取剪贴板，请检查权限', false);
  }
}

async function saveClipboardSettings() {
  const settings = {
    enabled: elements.clipboardEnabled?.checked ?? true,
    autoSave: elements.clipboardAutoSave?.checked ?? true,
    maxItems: parseInt(elements.clipboardMaxItems?.value) || 100
  };

  await clipboardHistoryManager.saveSettings(settings);
  state.clipboardSettings = settings;

  // 隐藏设置面板
  if (elements.clipboardSettingsPanel) {
    elements.clipboardSettingsPanel.style.display = 'none';
  }
  showNotification('设置已保存');
}

async function clearClipboardHistory() {
  if (confirm('确定要清空所有剪贴板历史吗？')) {
    await clipboardHistoryManager.clearHistory();
    loadClipboardHistory();
    showNotification('剪贴板历史已清空');
  }
}

// 工具函数
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

// 绑定事件
function bindEvents() {
  // 搜索相关
  elements.searchBtn?.addEventListener('click', performSearch);
  elements.searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  });
  elements.searchInput?.addEventListener('input', (e) => {
    state.currentText = e.target.value;
    updateFeaturePanels();
  });

  // 头部按钮
  elements.clipboardBtn?.addEventListener('click', () => {
    toggleClipboardMonitoring();
  });

  elements.settingsBtn?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.() ||
      window.open(chrome.runtime.getURL('src/settings/index.html'));
  });

  // 功能开关
  elements.switchExtract?.addEventListener('change', updateFeaturePanels);
  elements.switchLinkGen?.addEventListener('change', updateFeaturePanels);
  elements.switchMultiFormat?.addEventListener('change', updateFeaturePanels);

  // 路径转换
  elements.pathAddQuoteBtn?.addEventListener('click', () => {
    const pathItems = elements.pathConversionResult?.querySelectorAll('.path-item');
    pathItems?.forEach((item) => {
      const path = item.dataset.original;
      const quotedPath = `"${path}"`;
      item.querySelector('code').textContent = quotedPath;
      item.querySelector('.copy-path-btn').dataset.path = quotedPath;
    });
  });

  elements.pathResetQuoteBtn?.addEventListener('click', () => {
    const pathItems = elements.pathConversionResult?.querySelectorAll('.path-item');
    pathItems?.forEach((item) => {
      const path = item.dataset.original;
      item.querySelector('code').textContent = path;
      item.querySelector('.copy-path-btn').dataset.path = path;
    });
  });

  // 文本拆分
  elements.splitDelimiterSelect?.addEventListener('change', refreshTextSplit);
  elements.refreshSplitBtn?.addEventListener('click', refreshTextSplit);
  elements.copySelectedBtn?.addEventListener('click', copySelectedTokens);

  elements.selectAllCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      state.splitTokens.forEach((_, i) => state.selectedTokens.add(i));
    } else {
      state.selectedTokens.clear();
    }
    renderSplitOutput(state.splitTokens);
  });

  // 多规则组合
  elements.multiRuleButtons?.querySelectorAll('.format-btn[data-rule]').forEach((btn) => {
    btn.addEventListener('click', () => addMultiRule(btn.dataset.rule));
  });
  elements.multiRuleBackBtn?.addEventListener('click', backMultiRule);
  elements.multiRuleResetBtn?.addEventListener('click', resetMultiRule);

  // 多格式分析
  document.querySelectorAll('.multi-format-buttons .format-btn[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => applyMultiFormat(btn.dataset.action));
  });
  elements.backToPrevious?.addEventListener('click', backToPreviousResult);
  elements.copyResultBtn?.addEventListener('click', copyMultiFormatResult);
  elements.searchResultBtn?.addEventListener('click', searchMultiFormatResult);

  // 链接历史
  elements.showHistoryBtn?.addEventListener('click', () => {
    const container = elements.historyContainer;
    if (container) {
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
      if (container.style.display === 'block') loadLinkHistory();
    }
  });

  elements.editHistoryBtn?.addEventListener('click', () => {
    showNotification('编辑模式开发中');
  });

  elements.clearHistoryBtn?.addEventListener('click', clearLinkHistory);

  elements.historySearch?.addEventListener('input', (e) => {
    linkHistoryManager.getHistory().then((history) => {
      renderLinkHistory(history, state.linkHistoryFilter, e.target.value);
    });
  });

  document.querySelectorAll('.filter-tab[data-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.linkHistoryFilter = tab.dataset.filter;
      linkHistoryManager.getHistory().then((history) => {
        renderLinkHistory(history, state.linkHistoryFilter, elements.historySearch?.value);
      });
    });
  });

  // 剪贴板历史
  elements.showClipboardBtn?.addEventListener('click', () => {
    const container = elements.clipboardHistoryContainer;
    if (container) {
      const isHidden = container.style.display === 'none';
      container.style.display = isHidden ? 'block' : 'none';
      if (elements.clipboardActionPanel) {
        elements.clipboardActionPanel.style.display = isHidden ? 'none' : 'block';
      }
      if (isHidden) loadClipboardHistory();
    }
  });

  elements.readClipboardBtn?.addEventListener('click', readClipboard);
  elements.clipboardSettingsBtn?.addEventListener('click', () => {
    if (elements.clipboardSettingsPanel) {
      elements.clipboardSettingsPanel.style.display = 'block';
      loadClipboardSettings();
    }
  });
  elements.saveClipboardSettings?.addEventListener('click', saveClipboardSettings);
  elements.cancelClipboardSettings?.addEventListener('click', () => {
    if (elements.clipboardSettingsPanel) {
      elements.clipboardSettingsPanel.style.display = 'none';
    }
  });
  elements.clearClipboardBtn?.addEventListener('click', clearClipboardHistory);
  elements.toggleAutoMonitorBtn?.addEventListener('click', toggleClipboardMonitoring);
  elements.requestClipboardPermissionBtn?.addEventListener('click', requestClipboardPermission);

  elements.clipboardHistorySearch?.addEventListener('input', (e) => {
    clipboardHistoryManager.getHistory().then((history) => {
      renderClipboardHistory(history, state.clipboardFilter, e.target.value);
    });
  });

  document
    .querySelectorAll('#clipboard-history-container .filter-tab[data-filter]')
    .forEach((tab) => {
      tab.addEventListener('click', () => {
        document
          .querySelectorAll('#clipboard-history-container .filter-tab')
          .forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.clipboardFilter = tab.dataset.filter;
        clipboardHistoryManager.getHistory().then((history) => {
          renderClipboardHistory(
            history,
            state.clipboardFilter,
            elements.clipboardHistorySearch?.value
          );
        });
      });
    });
}

// 申请剪贴板权限
async function requestClipboardPermission() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'requestClipboardPermission' });
      showNotification('请在页面上授予剪贴板权限');
    }
  } catch (error) {
    console.error('申请剪贴板权限失败:', error);
    showNotification('无法申请权限，请刷新页面后重试', false);
  }
}

// 初始化
async function init() {
  try {
    initElements();
    await initEngineSelect();
    bindEvents();

    // 初始化功能面板状态（根据开关状态显示/隐藏）
    updateFeaturePanels();

    // 处理快捷键传递的标记
    await handleShortcutMarkers();

    // 加载剪贴板设置
    await loadClipboardSettings();

    // 同步剪贴板监控状态
    await syncClipboardMonitoringState();

    showNotification('加载完成');
  } catch (error) {
    console.error('初始化失败:', error);
    showNotification('初始化失败', false);
  }
}

// 处理快捷键传递的标记
async function handleShortcutMarkers() {
  try {
    const markers = await chrome.storage.local.get([
      'focusInputOnOpen',
      'readClipboardOnOpen',
      'quickSearchText'
    ]);

    if (markers.readClipboardOnOpen) {
      await chrome.storage.local.remove('readClipboardOnOpen');
      const text = await navigator.clipboard.readText();
      if (text && elements.searchInput) {
        elements.searchInput.value = text;
        state.currentText = text;
        updateFeaturePanels();
      }
    }

    if (markers.quickSearchText) {
      await chrome.storage.local.remove('quickSearchText');
      if (elements.searchInput) {
        elements.searchInput.value = markers.quickSearchText;
        state.currentText = markers.quickSearchText;
        updateFeaturePanels();
      }
    }

    if (markers.focusInputOnOpen) {
      await chrome.storage.local.remove('focusInputOnOpen');
      elements.searchInput?.focus();
    }
  } catch (error) {
    console.error('处理快捷键标记失败:', error);
  }
}

// 启动
document.addEventListener('DOMContentLoaded', init);
