// src/settings/main.js
import { getSettings, saveSettings, DEFAULTS } from '../utils/storage.js';
import linkHistoryManager from '../utils/linkHistory.js';
import clipboardHistoryManager from '../utils/clipboardHistory.js';

// XSS防护：HTML转义函数
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM Elements ---
  const engineList = document.getElementById('engine-list');
  const newEngineNameInput = document.getElementById('new-engine-name');
  const newEngineTemplateInput = document.getElementById('new-engine-template');
  const addEngineBtn = document.getElementById('add-engine-btn');

  // 链接历史元素
  const linkHistoryList = document.getElementById('link-history-list');
  const linkHistoryEnabledInput = document.getElementById('link-history-enabled');
  const linkHistoryLimitInput = document.getElementById('link-history-limit');
  const exportLinkHistoryBtn = document.getElementById('export-link-history-btn');
  const importLinkHistoryInput = document.getElementById('import-link-history-input');
  const clearLinkHistoryBtn = document.getElementById('clear-link-history-btn');

  // 剪贴板历史元素
  const clipboardHistoryList = document.getElementById('clipboard-history-list');
  const clipboardHistoryEnabledInput = document.getElementById('clipboard-history-enabled');
  const clipboardAutoSaveInput = document.getElementById('clipboard-auto-save');
  const clipboardHistoryLimitInput = document.getElementById('clipboard-history-limit');
  const exportClipboardHistoryBtn = document.getElementById('export-clipboard-history-btn');
  const importClipboardHistoryInput = document.getElementById('import-clipboard-history-input');
  const clearClipboardHistoryBtn = document.getElementById('clear-clipboard-history-btn');

  const exportBtn = document.getElementById('export-btn');
  const importFileInput = document.getElementById('import-file-input');

  // --- Tokenizer Settings Elements ---
  const cnUseDictInput = document.getElementById('cn-use-dict');
  const cnUseAlgoInput = document.getElementById('cn-use-algo');
  const aiEnabledInput = document.getElementById('ai-enabled');
  const aiProviderInput = document.getElementById('ai-provider');
  const aiBaseURLInput = document.getElementById('ai-base-url');
  const aiApiKeyInput = document.getElementById('ai-api-key');
  const aiModelInput = document.getElementById('ai-model');
  const aiModelCustomInput = document.getElementById('ai-model-custom');
  const aiProtocolInput = document.getElementById('ai-protocol');
  const sentenceModeInput = document.getElementById('sentence-mode');
  const charBreakLengthInput = document.getElementById('char-break-length');
  const randomMinLenInput = document.getElementById('random-min-len');
  const randomMaxLenInput = document.getElementById('random-max-len');
  const namingRemoveSymbolInput = document.getElementById('naming-remove-symbol');
  const historyMaxSizeInput = document.getElementById('history-max-size');
  const saveTokenizerBtn = document.getElementById('save-tokenizer-btn');
  const testAIConnectionBtn = document.getElementById('test-ai-connection-btn');
  const aiTestResult = document.getElementById('ai-test-result');

  // --- State ---
  let settings = await getSettings();

  // --- Initial Rendering ---
  renderEngineList();

  // 初始化链接历史设置
  initLinkHistorySettings();
  renderLinkHistoryList();

  // 初始化剪贴板历史设置
  initClipboardHistorySettings();
  renderClipboardHistoryList();

  // 初始化分词设置
  initTokenizerSettings();

  // --- Event Listeners ---
  addEngineBtn.addEventListener('click', handleAddEngine);
  exportBtn.addEventListener('click', handleExport);
  importFileInput.addEventListener('change', handleImport);

  // 链接历史事件
  if (linkHistoryEnabledInput) {
    linkHistoryEnabledInput.addEventListener('change', handleLinkHistoryEnabledChange);
  }
  if (linkHistoryLimitInput) {
    linkHistoryLimitInput.addEventListener('change', handleLinkHistoryLimitChange);
  }
  if (exportLinkHistoryBtn) {
    exportLinkHistoryBtn.addEventListener('click', handleExportLinkHistory);
  }
  if (importLinkHistoryInput) {
    importLinkHistoryInput.addEventListener('change', handleImportLinkHistory);
  }
  if (clearLinkHistoryBtn) {
    clearLinkHistoryBtn.addEventListener('click', handleClearLinkHistory);
  }

  // 剪贴板历史事件
  if (clipboardHistoryEnabledInput) {
    clipboardHistoryEnabledInput.addEventListener('change', handleClipboardHistoryEnabledChange);
  }
  if (clipboardAutoSaveInput) {
    clipboardAutoSaveInput.addEventListener('change', handleClipboardAutoSaveChange);
  }
  if (clipboardHistoryLimitInput) {
    clipboardHistoryLimitInput.addEventListener('change', handleClipboardHistoryLimitChange);
  }
  if (exportClipboardHistoryBtn) {
    exportClipboardHistoryBtn.addEventListener('click', handleExportClipboardHistory);
  }
  if (importClipboardHistoryInput) {
    importClipboardHistoryInput.addEventListener('change', handleImportClipboardHistory);
  }
  if (clearClipboardHistoryBtn) {
    clearClipboardHistoryBtn.addEventListener('click', handleClearClipboardHistory);
  }

  // 开发者工具按钮事件
  const openTestPageBtn = document.getElementById('open-test-page-btn');
  const openDebugPageBtn = document.getElementById('open-debug-page-btn');
  const openExamPageBtn = document.getElementById('open-exam-page-btn');

  if (openTestPageBtn) {
    openTestPageBtn.addEventListener('click', () => openTestPage('test.html'));
  }
  if (openDebugPageBtn) {
    openDebugPageBtn.addEventListener('click', () => openTestPage('debug.html'));
  }
  if (openExamPageBtn) {
    openExamPageBtn.addEventListener('click', () => openTestPage('exam.html'));
  }

  // 分词设置事件
  saveTokenizerBtn.addEventListener('click', handleSaveTokenizerSettings);

  // AI启用开关事件
  aiEnabledInput.addEventListener('change', handleAIEnabledChange);

  // AI模型选择切换事件
  aiModelInput.addEventListener('change', handleModelChange);

  // 测试AI连接事件
  testAIConnectionBtn.addEventListener('click', handleTestAIConnection);

  // 初始化响应式布局
  initResponsiveLayout();

  // --- Functions ---

  // ===== 链接历史功能 =====
  async function initLinkHistorySettings() {
    const linkSettings = await linkHistoryManager.getSettings();
    if (linkHistoryEnabledInput) {
      linkHistoryEnabledInput.checked = linkSettings.enabled !== false;
    }
    if (linkHistoryLimitInput) {
      linkHistoryLimitInput.value = linkSettings.maxItems || 100;
    }
  }

  async function renderLinkHistoryList() {
    if (!linkHistoryList) return;

    linkHistoryList.innerHTML = '';
    const history = await linkHistoryManager.getHistory({ limit: 10 });

    if (history.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
                <p>暂无链接历史</p>
                <span>您的链接访问记录将显示在这里</span>
            `;
      linkHistoryList.appendChild(emptyState);
      return;
    }

    history.forEach((item) => {
      const safeUrl = escapeHtml(item.url || item.originalUrl || '');
      const safeTitle = escapeHtml(item.title || '未知链接');
      const div = document.createElement('div');
      div.className = 'engine-item';
      div.innerHTML = `
                <div class="engine-info">
                    <div class="engine-name">${safeTitle}</div>
                    <div class="engine-url">${safeUrl}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn copy-link" data-url="${safeUrl}" title="复制">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>
            `;
      linkHistoryList.appendChild(div);
    });

    linkHistoryList.querySelectorAll('.copy-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        navigator.clipboard
          .writeText(url)
          .then(() => showNotification('已复制到剪贴板'))
          .catch((err) => console.error('复制失败:', err));
      });
    });
  }

  async function handleLinkHistoryEnabledChange() {
    const enabled = linkHistoryEnabledInput.checked;
    await linkHistoryManager.saveSettings({ enabled });
    showNotification(enabled ? '链接历史已启用' : '链接历史已禁用');
  }

  async function handleLinkHistoryLimitChange() {
    const maxItems = parseInt(linkHistoryLimitInput.value);
    if (!isNaN(maxItems) && maxItems >= 10 && maxItems <= 1000) {
      await linkHistoryManager.saveSettings({ maxItems });
      showNotification('链接历史记录限制已更新');
    } else {
      showNotification('请输入10-1000之间的数字', false);
    }
  }

  async function handleExportLinkHistory() {
    const result = await linkHistoryManager.exportHistory('json');
    if (result.success) {
      showNotification(`已导出 ${result.count} 条链接历史记录`);
    } else {
      showNotification('导出失败', false);
    }
  }

  async function handleImportLinkHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const result = await linkHistoryManager.importFromFile(file, {
      merge: true,
    });
    if (result.success) {
      renderLinkHistoryList();
      showNotification(result.message);
    } else {
      showNotification(result.message || '导入失败', false);
    }
    event.target.value = ''; // 清空输入
  }

  async function handleClearLinkHistory() {
    if (confirm('确定要清空所有链接历史吗？')) {
      await linkHistoryManager.clearHistory();
      renderLinkHistoryList();
      showNotification('链接历史已清空');
    }
  }

  // ===== 剪贴板历史功能 =====
  async function initClipboardHistorySettings() {
    const clipboardSettings = await clipboardHistoryManager.getSettings();
    if (clipboardHistoryEnabledInput) {
      clipboardHistoryEnabledInput.checked = clipboardSettings.enabled !== false;
    }
    if (clipboardAutoSaveInput) {
      clipboardAutoSaveInput.checked = clipboardSettings.autoSave !== false;
    }
    if (clipboardHistoryLimitInput) {
      clipboardHistoryLimitInput.value = clipboardSettings.maxItems || 100;
    }
  }

  async function renderClipboardHistoryList() {
    if (!clipboardHistoryList) return;

    clipboardHistoryList.innerHTML = '';
    const history = await clipboardHistoryManager.getHistory({ limit: 10 });

    if (history.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
                <p>暂无剪贴板历史</p>
                <span>您的剪贴板记录将显示在这里</span>
            `;
      clipboardHistoryList.appendChild(emptyState);
      return;
    }

    history.forEach((item) => {
      const safeText = escapeHtml(item.preview || item.text || '');
      const div = document.createElement('div');
      div.className = 'engine-item';
      div.innerHTML = `
                <div class="engine-info">
                    <div class="engine-name">${safeText.substring(0, 50)}${safeText.length > 50 ? '...' : ''}</div>
                    <div class="engine-url">长度: ${item.length || 0} | 标签: ${(item.tags || []).join(', ') || '无'}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn copy-clipboard" data-text="${escapeHtml(item.text || '')}" title="复制">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>
            `;
      clipboardHistoryList.appendChild(div);
    });

    clipboardHistoryList.querySelectorAll('.copy-clipboard').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.text;
        navigator.clipboard
          .writeText(text)
          .then(() => showNotification('已复制到剪贴板'))
          .catch((err) => console.error('复制失败:', err));
      });
    });
  }

  async function handleClipboardHistoryEnabledChange() {
    const enabled = clipboardHistoryEnabledInput.checked;
    await clipboardHistoryManager.saveSettings({ enabled });
    showNotification(enabled ? '剪贴板历史已启用' : '剪贴板历史已禁用');
  }

  async function handleClipboardAutoSaveChange() {
    const autoSave = clipboardAutoSaveInput.checked;
    await clipboardHistoryManager.saveSettings({ autoSave });
    showNotification(autoSave ? '自动保存已启用' : '自动保存已禁用');
  }

  async function handleClipboardHistoryLimitChange() {
    const maxItems = parseInt(clipboardHistoryLimitInput.value);
    if (!isNaN(maxItems) && maxItems >= 10 && maxItems <= 1000) {
      await clipboardHistoryManager.saveSettings({ maxItems });
      showNotification('剪贴板历史记录限制已更新');
    } else {
      showNotification('请输入10-1000之间的数字', false);
    }
  }

  async function handleExportClipboardHistory() {
    const result = await clipboardHistoryManager.exportHistory('json');
    if (result.success) {
      showNotification(`已导出 ${result.count} 条剪贴板历史记录`);
    } else {
      showNotification('导出失败', false);
    }
  }

  async function handleImportClipboardHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const result = await clipboardHistoryManager.importFromFile(file, {
      merge: true,
    });
    if (result.success) {
      renderClipboardHistoryList();
      showNotification(result.message);
    } else {
      showNotification(result.message || '导入失败', false);
    }
    event.target.value = ''; // 清空输入
  }

  async function handleClearClipboardHistory() {
    if (confirm('确定要清空所有剪贴板历史吗？')) {
      await clipboardHistoryManager.clearHistory();
      renderClipboardHistoryList();
      showNotification('剪贴板历史已清空');
    }
  }

  function renderEngineList() {
    engineList.innerHTML = '';
    settings.searchEngines.forEach((engine, index) => {
      const isDefault = engine.name === settings.defaultEngine;
      const item = document.createElement('div');
      item.className = 'engine-item';
      const safeName = escapeHtml(engine.name);
      const safeTemplate = escapeHtml(engine.template);
      item.innerHTML = `
                <input type="radio" name="default-engine" value="${safeName}" ${isDefault ? 'checked' : ''} data-index="${index}" id="engine-${index}" style="margin-right: 8px;">
                <div class="engine-info">
                    <div class="engine-name">${safeName}</div>
                    <div class="engine-url">${safeTemplate}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn delete" data-index="${index}" title="删除">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" x2="10" y1="11" y2="17"/>
                            <line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;
      engineList.appendChild(item);
    });
    engineList.querySelectorAll('.engine-btn.delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        handleRemoveEngine(index);
      });
    });
    engineList.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener('change', (e) => handleSetDefaultEngine(e.target.value));
    });
  }

  async function handleAddEngine() {
    const name = newEngineNameInput.value.trim();
    const template = newEngineTemplateInput.value.trim();
    if (name && template && template.includes('%s')) {
      settings.searchEngines.push({ name, template });
      await saveSettings(settings);
      renderEngineList();
      newEngineNameInput.value = '';
      newEngineTemplateInput.value = '';
      showNotification('搜索引擎添加成功！');
    } else {
      showNotification('请提供有效的名称和包含 "%s" 的URL模板', false);
    }
  }

  async function handleRemoveEngine(index) {
    if (settings.searchEngines.length <= 1) {
      showNotification('必须至少保留一个搜索引擎', false);
      return;
    }
    const removedEngine = settings.searchEngines.splice(index, 1)[0];
    if (settings.defaultEngine === removedEngine.name) {
      settings.defaultEngine = settings.searchEngines[0].name;
    }
    await saveSettings(settings);
    renderEngineList();
    showNotification('搜索引擎已删除');
  }

  async function handleSetDefaultEngine(name) {
    settings.defaultEngine = name;
    await saveSettings(settings);
    showNotification('默认搜索引擎已更新');
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
          background: var(--bg-primary, white);
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          min-width: 320px;
          max-width: 90%;
          border: 1px solid var(--border-color, #e5e7eb);
        ">
          <h3 style="margin: 0 0 20px 0; font-size: 18px; color: var(--text-primary, #1f2937);">选择要导出的数据</h3>
          
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
              <input type="checkbox" id="export-settings" checked style="margin-right: 10px; width: 18px; height: 18px;">
              <span style="font-size: 14px; color: var(--text-secondary, #374151);">
                <strong>设置</strong> - 搜索引擎、用户偏好等
              </span>
            </label>
            
            <label style="display: flex; align-items: center; margin-bottom: 12px; cursor: pointer;">
              <input type="checkbox" id="export-link-history" checked style="margin-right: 10px; width: 18px; height: 18px;">
              <span style="font-size: 14px; color: var(--text-secondary, #374151);">
                <strong>链接历史</strong> - 搜索和访问的链接记录
              </span>
            </label>
            
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="export-clipboard-history" checked style="margin-right: 10px; width: 18px; height: 18px;">
              <span style="font-size: 14px; color: var(--text-secondary, #374151);">
                <strong>剪贴板历史</strong> - 剪贴板内容记录
              </span>
            </label>
          </div>
          
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="export-cancel" style="
              padding: 8px 16px;
              border: 1px solid var(--border-color, #d1d5db);
              background: var(--bg-secondary, white);
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              color: var(--text-muted, #6b7280);
            ">取消</button>
            <button id="export-confirm" style="
              padding: 8px 16px;
              border: none;
              background: var(--primary, #3b82f6);
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

  async function handleExport() {
    try {
      // 显示导出选项对话框
      const options = await showExportOptionsDialog();
      if (!options) return; // 用户取消

      // 检查是否至少选择了一项
      if (!options.settings && !options.linkHistory && !options.clipboardHistory) {
        showNotification('请至少选择一项要导出的数据', false);
        return;
      }

      // 构建导出数据
      const exportData = {
        type: 'allData',
        appName: 'SearchBuddy',
        version: '2.0',
        exportDate: new Date().toISOString(),
        data: {},
      };

      const dataPromises = [];

      if (options.settings) {
        exportData.data.settings = settings;
      }

      if (options.linkHistory) {
        dataPromises.push(
          linkHistoryManager.getHistory().then((history) => {
            exportData.data.linkHistory = history;
          })
        );
      }

      if (options.clipboardHistory) {
        dataPromises.push(
          clipboardHistoryManager.getHistory().then((history) => {
            exportData.data.clipboardHistory = history;
          })
        );
      }

      await Promise.all(dataPromises);

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-buddy-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 根据导出内容显示提示
      const exportedItems = [];
      if (options.settings) exportedItems.push('设置');
      if (options.linkHistory) exportedItems.push('链接历史');
      if (options.clipboardHistory) exportedItems.push('剪贴板历史');
      showNotification(`${exportedItems.join('、')}已导出`);
    } catch (error) {
      console.error('导出失败:', error);
      showNotification('导出失败', false);
    }
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // 检查是否是新格式的完整备份文件 (v2.0格式，数据在data字段中)
        if (
          importedData.version === '2.0' &&
          importedData.type === 'allData' &&
          importedData.data
        ) {
          const data = importedData.data;

          // 导入设置
          if (data.settings) {
            settings = { ...settings, ...data.settings };
            await saveSettings(settings);
          }

          // 导入链接历史
          if (data.linkHistory && Array.isArray(data.linkHistory)) {
            for (const item of data.linkHistory) {
              if (item.url) {
                await linkHistoryManager.addLink(
                  item.url,
                  item.title || '',
                  item.type || 'general'
                );
              }
            }
          }

          // 导入剪贴板历史
          if (data.clipboardHistory && Array.isArray(data.clipboardHistory)) {
            for (const item of data.clipboardHistory) {
              if (item.text) {
                await clipboardHistoryManager.addItem(item.text, {
                  source: item.source || 'import',
                });
              }
            }
          }

          renderEngineList();
          renderLinkHistoryList();
          renderClipboardHistoryList();
          initTokenizerSettings();

          const linkCount = data.linkHistory?.length || 0;
          const clipboardCount = data.clipboardHistory?.length || 0;
          showNotification(
            `导入成功！包含 ${linkCount} 条链接历史，${clipboardCount} 条剪贴板历史`
          );
        }
        // 兼容旧格式：只包含settings的配置文件
        else if (importedData.searchEngines) {
          settings = { ...settings, ...importedData };
          await saveSettings(settings);
          renderEngineList();
          initTokenizerSettings();
          showNotification('设置导入成功！');
        } else {
          showNotification('无效的配置文件', false);
        }
      } catch (error) {
        showNotification('解析配置文件失败', false);
        console.error(error);
      }
      event.target.value = ''; // 清空输入
    };
    reader.readAsText(file);
  }

  /**
   * 初始化分词设置
   * 从存储加载分词配置到UI
   */
  function initTokenizerSettings() {
    const ts = settings.tokenizerSettings || DEFAULTS.tokenizerSettings;

    cnUseDictInput.checked = ts.cnUseDict !== false;
    cnUseAlgoInput.checked = ts.cnUseAlgo !== false;

    // AI设置
    aiEnabledInput.checked = ts.aiEnabled === true;
    updateAIConfigVisibility(ts.aiEnabled === true);
    aiProviderInput.value = ts.aiProvider || 'openai';
    aiBaseURLInput.value = ts.aiBaseURL || '';
    aiApiKeyInput.value = ts.aiApiKey || '';

    // 处理模型选择
    const savedModel = ts.aiModel || 'gpt-4o-mini';
    const predefinedModels = [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'claude-3-5-sonnet',
      'gemini-1.5-flash',
    ];
    const customRow = document.getElementById('ai-model-custom-row');
    if (predefinedModels.includes(savedModel)) {
      aiModelInput.value = savedModel;
      if (customRow) {
        customRow.style.display = 'none';
      }
    } else {
      aiModelInput.value = 'custom';
      aiModelCustomInput.value = savedModel;
      if (customRow) {
        customRow.style.display = 'flex';
      }
    }

    aiProtocolInput.value = ts.aiDefaultProtocol || 'https://';
    sentenceModeInput.value = ts.sentenceMode || 'sentence';
    charBreakLengthInput.value = ts.charBreakLength || 100;
    randomMinLenInput.value = ts.randomMinLen || 1;
    randomMaxLenInput.value = ts.randomMaxLen || 10;
    namingRemoveSymbolInput.checked = ts.namingRemoveSymbol !== false;
    historyMaxSizeInput.value = ts.historyMaxSize || 6;
  }

  /**
   * 处理AI启用开关变化
   */
  function handleAIEnabledChange() {
    updateAIConfigVisibility(aiEnabledInput.checked);
  }

  /**
   * 更新AI配置区域可见性
   */
  function updateAIConfigVisibility(enabled) {
    const aiConfigContainer = document.getElementById('ai-config-container');
    if (aiConfigContainer) {
      aiConfigContainer.style.display = enabled ? 'block' : 'none';
    }
  }

  /**
   * 处理模型选择变化
   */
  function handleModelChange() {
    const customRow = document.getElementById('ai-model-custom-row');
    if (aiModelInput.value === 'custom') {
      if (customRow) {
        customRow.style.display = 'flex';
      }
      aiModelCustomInput.focus();
    } else {
      if (customRow) {
        customRow.style.display = 'none';
      }
      aiModelCustomInput.value = '';
    }
  }

  /**
   * 获取当前选中的模型值
   */
  function getCurrentModel() {
    if (aiModelInput.value === 'custom') {
      return aiModelCustomInput.value.trim() || 'gpt-4o-mini';
    }
    return aiModelInput.value;
  }

  /**
   * 测试AI连接
   */
  async function handleTestAIConnection() {
    const baseURL = aiBaseURLInput.value.trim();
    const apiKey = aiApiKeyInput.value.trim();
    const model = getCurrentModel();
    const provider = aiProviderInput.value;

    if (!baseURL) {
      showTestResult('请输入 Base URL', 'error');
      return;
    }
    if (!apiKey) {
      showTestResult('请输入 API Key', 'error');
      return;
    }

    showTestResult('测试中...', 'loading');
    testAIConnectionBtn.disabled = true;

    try {
      // 构建请求URL
      const url = baseURL.endsWith('/') ? baseURL : baseURL + '/';
      const chatUrl = url + 'chat/completions';

      // 发送测试请求
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
          showTestResult('连接成功！', 'success');
        } else {
          showTestResult('连接成功但响应异常', 'warning');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
        showTestResult(`连接失败: ${errorMsg}`, 'error');
      }
    } catch (error) {
      showTestResult(`连接失败: ${error.message}`, 'error');
    } finally {
      testAIConnectionBtn.disabled = false;
    }
  }

  /**
   * 显示测试结果
   */
  function showTestResult(message, type) {
    aiTestResult.textContent = message;
    aiTestResult.className = 'test-result ' + type;

    // 3秒后清除成功消息
    if (type === 'success') {
      setTimeout(() => {
        aiTestResult.textContent = '';
        aiTestResult.className = 'test-result';
      }, 3000);
    }
  }

  /**
   * 保存分词设置
   * 从UI读取配置并保存到存储
   */
  async function handleSaveTokenizerSettings() {
    const tokenizerSettings = {
      cnUseDict: cnUseDictInput.checked,
      cnUseAlgo: cnUseAlgoInput.checked,
      aiEnabled: aiEnabledInput.checked,
      aiProvider: aiProviderInput.value,
      aiBaseURL: aiBaseURLInput.value.trim(),
      aiApiKey: aiApiKeyInput.value.trim(),
      aiModel: getCurrentModel(),
      aiDefaultProtocol: aiProtocolInput.value,
      sentenceMode: sentenceModeInput.value,
      charBreakLength: parseInt(charBreakLengthInput.value) || 100,
      randomMinLen: parseInt(randomMinLenInput.value) || 1,
      randomMaxLen: parseInt(randomMaxLenInput.value) || 10,
      namingRemoveSymbol: namingRemoveSymbolInput.checked,
      historyMaxSize: parseInt(historyMaxSizeInput.value) || 6,
    };

    // 验证输入
    if (tokenizerSettings.charBreakLength < 10 || tokenizerSettings.charBreakLength > 500) {
      showNotification('字符断行长度必须在10-500之间', false);
      return;
    }

    if (tokenizerSettings.randomMinLen < 1 || tokenizerSettings.randomMinLen > 10) {
      showNotification('随机分词最小长度必须在1-10之间', false);
      return;
    }

    if (tokenizerSettings.randomMaxLen < 5 || tokenizerSettings.randomMaxLen > 50) {
      showNotification('随机分词最大长度必须在5-50之间', false);
      return;
    }

    if (tokenizerSettings.randomMinLen > tokenizerSettings.randomMaxLen) {
      showNotification('随机分词最小长度不能大于最大长度', false);
      return;
    }

    if (tokenizerSettings.historyMaxSize < 1 || tokenizerSettings.historyMaxSize > 10) {
      showNotification('历史栈上限必须在1-10之间', false);
      return;
    }

    // 验证 Base URL 格式（如果填写了的话）
    if (tokenizerSettings.aiBaseURL) {
      try {
        new URL(tokenizerSettings.aiBaseURL);
      } catch {
        showNotification('请输入有效的 Base URL', false);
        return;
      }
    }

    // 保存设置
    settings.tokenizerSettings = tokenizerSettings;
    const success = await saveSettings(settings);

    if (success) {
      showNotification('分词设置已保存！');
    } else {
      showNotification('保存失败，请重试', false);
    }
  }

  function showNotification(message, isSuccess = true) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isSuccess ? 'var(--success)' : 'var(--danger)'};
            color: white;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            z-index: 10000;
            font-size: 14px;
            box-shadow: var(--shadow-md);
            animation: slideIn 0.3s ease-out;
        `;

    const style = document.createElement('style');
    style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 3000);
  }
});

/**
 * 打开测试页面
 * @param {string} pageName 页面文件名
 */
function openTestPage(pageName) {
  const extensionId = chrome.runtime.id;
  const pageUrl = `chrome-extension://${extensionId}/${pageName}`;

  chrome.tabs.create({ url: pageUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('打开测试页面失败:', chrome.runtime.lastError);
      // 使用 alert 替代 showNotification，因为 showNotification 在 DOMContentLoaded 内部定义
      alert('打开测试页面失败');
    } else {
      console.log(`已打开测试页面: ${pageName}`);
    }
  });
}

/**
 * 初始化响应式布局
 */
function initResponsiveLayout() {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      const container = document.getElementById('resizable-container');

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
    }
  });

  const container = document.getElementById('resizable-container');
  if (container) {
    resizeObserver.observe(container);
  }
}
