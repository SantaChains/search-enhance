/**
 * DOM元素缓存模块
 * 功能: 集中管理所有DOM元素引用
 * 入参: 无
 * 出参: elements对象
 */

export function initElements() {
  const elements = {};

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
  elements.clipboardFilterAll = document.getElementById('clipboard-filter-all');
  elements.clipboardFilterUrl = document.getElementById('clipboard-filter-url');
  elements.clipboardFilterCode = document.getElementById('clipboard-filter-code');
  elements.clipboardFilterText = document.getElementById('clipboard-filter-text');

  // Token历史元素
  elements.tokenHistoryContainer = document.getElementById('token-history-container');
  elements.tokenHistoryList = document.getElementById('token-history-list');
  elements.tokenHistorySearch = document.getElementById('token-history-search');
  elements.showTokenHistoryBtn = document.getElementById('show-token-history-btn');
  elements.clearTokenHistoryBtn = document.getElementById('clear-token-history-btn');

  // 通知元素
  elements.notification = document.getElementById('notification');

  return elements;
}
