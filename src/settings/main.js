// src/settings/main.js
// 设置页面主入口 - 精简重构版

import {
  initGeneralSettings,
  initTokenizerSettings,
  initAISettings,
  initHistorySettings,
  initDataManagement
} from './modules/index.js';

const elements = {
  // General
  autoSave: document.getElementById('auto-save'),
  showNotifications: document.getElementById('show-notifications'),
  theme: document.getElementById('theme'),
  language: document.getElementById('language'),
  saveGeneral: document.getElementById('save-general'),

  // Tokenizer
  useDictionary: document.getElementById('use-dictionary'),
  useAlgorithm: document.getElementById('use-algorithm'),
  lineCharLimit: document.getElementById('line-char-limit'),
  randomMinLen: document.getElementById('random-min-len'),
  randomMaxLen: document.getElementById('random-max-len'),
  namingRemoveSymbols: document.getElementById('naming-remove-symbols'),
  saveTokenizer: document.getElementById('save-tokenizer'),

  // AI
  aiEnabled: document.getElementById('ai-enabled'),
  aiProvider: document.getElementById('ai-provider'),
  aiBaseURL: document.getElementById('ai-base-url'),
  aiApiKey: document.getElementById('ai-api-key'),
  aiModel: document.getElementById('ai-model'),
  saveAI: document.getElementById('save-ai'),

  // History
  linkHistoryEnabled: document.getElementById('link-history-enabled'),
  linkHistoryMaxItems: document.getElementById('link-history-max-items'),
  clipboardHistoryEnabled: document.getElementById('clipboard-history-enabled'),
  clipboardHistoryMaxItems: document.getElementById('clipboard-history-max-items'),
  tokenHistoryEnabled: document.getElementById('token-history-enabled'),
  tokenHistoryMaxItems: document.getElementById('token-history-max-items'),
  saveHistory: document.getElementById('save-history'),

  // Data Management
  exportAll: document.getElementById('export-all'),
  importAll: document.getElementById('import-all'),
  importFile: document.getElementById('import-file'),
  clearAll: document.getElementById('clear-all'),

  // UI
  notification: document.getElementById('notification'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content')
};

let notificationTimeout = null;

function showNotification(message, isSuccess = true) {
  const notification = elements.notification;
  if (!notification) {
    console.log(message);
    return;
  }

  notification.textContent = message;
  notification.className = `notification ${isSuccess ? 'success' : 'error'} show`;

  clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

function setupTabs() {
  elements.tabButtons?.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tabId = e.target.dataset.tab;

      elements.tabButtons.forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');

      elements.tabContents?.forEach((content) => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
      });
    });
  });
}

async function init() {
  try {
    setupTabs();

    const modules = {
      general: initGeneralSettings(elements, showNotification),
      tokenizer: initTokenizerSettings(elements, showNotification),
      ai: initAISettings(elements, showNotification),
      history: initHistorySettings(elements, showNotification),
      data: initDataManagement(elements, showNotification)
    };

    await Promise.all([
      modules.general.load(),
      modules.tokenizer.load(),
      modules.ai.load(),
      modules.history.load()
    ]);

    modules.general.bindEvents();
    modules.tokenizer.bindEvents();
    modules.ai.bindEvents();
    modules.history.bindEvents();
    modules.data.bindEvents();

    showNotification('设置页面加载完成');
  } catch (error) {
    console.error('初始化失败:', error);
    showNotification('初始化失败', false);
  }
}

document.addEventListener('DOMContentLoaded', init);
