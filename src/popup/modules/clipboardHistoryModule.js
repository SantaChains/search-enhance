// src/popup/modules/clipboardHistoryModule.js
// 剪贴板历史功能模块

import clipboardHistoryManager from '../../utils/clipboardHistory.js';

const ClipboardMode = { NORMAL: 'normal', BATCH: 'batch', EDIT: 'edit' };

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
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function detectClipboardContentType(text) {
  if (!text) return 'text';
  if (/^(https?:\/\/|www\.)[^\s]+$/i.test(text.trim())) return 'url';
  const codePatterns = [
    /^(function|class|const|let|var|import|export|if|for|while|return)\s/m,
    /[{;}]\s*$/m,
    /^(def|class|import|from|if|for|while|return)\s/m,
    /```[\s\S]*```/,
    /^(public|private|protected|static|void|int|String)\s/m
  ];
  if (codePatterns.some((p) => p.test(text))) return 'code';
  return 'text';
}

export function initClipboardHistoryModule(state, elements, showNotification) {
  const selectedItems = new Set();

  return {
    async load() {
      try {
        state.clipboardHistory = await clipboardHistoryManager.getHistory();
      } catch (error) {
        state.clipboardHistory = [];
      }
    },

    async add(text, source = 'clipboard') {
      try {
        await clipboardHistoryManager.addItem(text, { source });
        state.clipboardHistory = await clipboardHistoryManager.getHistory();
        this.render();
      } catch (error) {
        console.error('添加剪贴板历史失败:', error);
      }
    },

    async remove(id) {
      try {
        await clipboardHistoryManager.removeItem(id);
        state.clipboardHistory = await clipboardHistoryManager.getHistory();
        this.render();
        showNotification('已删除');
      } catch (error) {
        showNotification('删除失败', false);
      }
    },

    async clear() {
      try {
        await clipboardHistoryManager.clearHistory();
        state.clipboardHistory = [];
        selectedItems.clear();
        this.render();
        showNotification('剪贴板历史已清空');
      } catch (error) {
        showNotification('清空失败', false);
      }
    },

    async export(format = 'json') {
      try {
        const result = await clipboardHistoryManager.exportHistory(format);
        if (result.success) {
          showNotification(`已导出 ${result.count} 条记录`);
        } else {
          showNotification('导出失败', false);
        }
      } catch (error) {
        showNotification('导出失败', false);
      }
    },

    async import(file, merge = true) {
      try {
        const result = await clipboardHistoryManager.importFromFile(file, { merge });
        if (result.success) {
          state.clipboardHistory = await clipboardHistoryManager.getHistory();
          this.render();
          showNotification(result.message);
        } else {
          showNotification(result.message || '导入失败', false);
        }
        return result;
      } catch (error) {
        showNotification('导入失败', false);
        return { success: false };
      }
    },

    async updateSettings(settings) {
      try {
        await clipboardHistoryManager.saveSettings(settings);
        showNotification('设置已保存');
        return true;
      } catch (error) {
        showNotification('保存设置失败', false);
        return false;
      }
    },

    async getSettings() {
      try {
        return await clipboardHistoryManager.getSettings();
      } catch (error) {
        return { maxItems: 100, enabled: true, autoSave: true };
      }
    },

    setMode(mode) {
      if (!Object.values(ClipboardMode).includes(mode)) return;
      state.clipboardMode = mode;
      if (mode === ClipboardMode.NORMAL) {
        state.editingItemId = null;
        selectedItems.clear();
      } else if (mode === ClipboardMode.EDIT) {
        selectedItems.clear();
      }
      this.render();
    },

    enterBatchMode() {
      this.setMode(ClipboardMode.BATCH);
    },

    exitBatchMode() {
      this.setMode(ClipboardMode.NORMAL);
    },

    enterEditMode(itemId) {
      state.editingItemId = itemId;
      this.setMode(ClipboardMode.EDIT);
    },

    exitEditMode() {
      this.setMode(ClipboardMode.NORMAL);
    },

    toggleSelection(id) {
      if (selectedItems.has(id)) {
        selectedItems.delete(id);
      } else {
        selectedItems.add(id);
      }
      this.render();
    },

    selectAll() {
      state.clipboardHistory.forEach((item) => selectedItems.add(item.id));
      this.render();
    },

    clearSelection() {
      selectedItems.clear();
      this.render();
    },

    async batchCopy() {
      const selected = state.clipboardHistory.filter((item) => selectedItems.has(item.id));
      if (selected.length === 0) {
        showNotification('请先选择要复制的项目', false);
        return;
      }

      const textToCopy = selected.map((item) => item.text).join('\n\n');
      try {
        await navigator.clipboard.writeText(textToCopy);
        showNotification(`已复制 ${selected.length} 条记录`);
      } catch (error) {
        showNotification('复制失败', false);
      }
    },

    async batchDelete() {
      const selected = state.clipboardHistory.filter((item) => selectedItems.has(item.id));
      if (selected.length === 0) {
        showNotification('请先选择要删除的项目', false);
        return;
      }

      if (confirm(`确定要删除选中的 ${selected.length} 条记录吗？`)) {
        for (const item of selected) {
          await clipboardHistoryManager.removeItem(item.id);
        }
        state.clipboardHistory = await clipboardHistoryManager.getHistory();
        selectedItems.clear();
        this.render();
        showNotification(`已删除 ${selected.length} 条记录`);
      }
    },

    async saveEdit(itemId) {
      const textarea = document.querySelector(`.edit-textarea[data-id="${itemId}"]`);
      if (!textarea) return;

      const newText = textarea.value.trim();
      if (!newText) {
        showNotification('内容不能为空', false);
        return;
      }

      if (newText.length > 100000) {
        showNotification('内容过长，最多支持10万字', false);
        return;
      }

      const originalItem = state.clipboardHistory.find((item) => item.id === itemId);
      const originalText = originalItem ? originalItem.text : '';

      if (newText === originalText.trim()) {
        showNotification('内容未修改');
        this.exitEditMode();
        return;
      }

      const existingIndex = state.clipboardHistory.findIndex(
        (item) => item.text === newText && item.id !== itemId
      );
      if (existingIndex !== -1) {
        showNotification('该内容已存在于历史记录中', false);
        this.exitEditMode();
        return;
      }

      try {
        await this.add(newText, 'edit');
        showNotification('已保存为新记录');
      } catch (error) {
        showNotification('保存失败', false);
      } finally {
        this.exitEditMode();
      }
    },

    render(searchTerm = '') {
      const list = elements.clipboard_history_list;
      if (!list) return;

      let filtered = state.clipboardHistory;

      const filter = state.clipboardHistoryFilter || 'all';
      if (filter !== 'all') {
        filtered = filtered.filter((item) => {
          const contentType = detectClipboardContentType(item.text);
          return contentType === filter;
        });
      }

      if (searchTerm) {
        filtered = filtered.filter((item) =>
          item.text.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>${searchTerm ? '没有找到匹配的记录' : '暂无剪贴板历史'}</p></div>`;
        this.updateToolbar();
        return;
      }

      list.innerHTML = filtered.map((item) => this.renderItem(item)).join('');
      this.bindEvents();
      this.updateToolbar();
    },

    renderItem(item) {
      const isSelected = selectedItems.has(item.id);
      const isEditing =
        state.clipboardMode === ClipboardMode.EDIT && state.editingItemId === item.id;
      const showCheckbox = state.clipboardMode === ClipboardMode.BATCH;
      const truncatedText = truncateText(item.text, 120);
      const contentType = detectClipboardContentType(item.text);
      const typeIcon = { url: '🔗', code: '💻', text: '📝' }[contentType];

      if (isEditing) {
        return `
          <div class="history-item editing" data-id="${escapeHtml(String(item.id))}">
            <div class="clipboard-item-content">
              <div class="edit-row">
                <div class="edit-actions">
                  <button class="save-edit-btn btn-sm" data-id="${escapeHtml(String(item.id))}" title="保存">保存</button>
                  <button class="cancel-edit-btn btn-sm" title="取消">取消</button>
                </div>
                <textarea class="edit-textarea" data-id="${escapeHtml(String(item.id))}">${escapeHtml(item.text)}</textarea>
              </div>
            </div>
          </div>`;
      }

      return `
        <div class="history-item" data-id="${escapeHtml(String(item.id))}">
          <input type="checkbox" class="clipboard-checkbox"
                 data-id="${escapeHtml(String(item.id))}"
                 style="display: ${showCheckbox ? 'inline-block' : 'none'}"
                 ${isSelected ? 'checked' : ''}>
          <div class="clipboard-item-content">
            <div class="clipboard-text-content" data-id="${escapeHtml(String(item.id))}">
              <span class="content-type-icon">${typeIcon}</span>
              ${escapeHtml(truncatedText)}
            </div>
            <div class="clipboard-meta">
              <span class="timestamp">${formatRelativeTime(item.timestamp)}</span>
              <span class="char-count">${item.text.length} 字符</span>
            </div>
          </div>
          ${
            state.clipboardMode === ClipboardMode.NORMAL
              ? `
            <div class="item-actions">
              <button class="action-btn copy-btn" data-id="${escapeHtml(String(item.id))}" title="复制">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              <button class="action-btn use-btn" data-id="${escapeHtml(String(item.id))}" title="使用">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
              <button class="action-btn delete-btn" data-id="${escapeHtml(String(item.id))}" title="删除">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          `
              : ''
          }
        </div>`;
    },

    bindEvents() {
      const list = elements.clipboard_history_list;
      if (!list) return;

      list.querySelectorAll('.clipboard-checkbox').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          this.toggleSelection(id);
        });
      });

      list.querySelectorAll('.clipboard-text-content').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (state.clipboardMode === ClipboardMode.BATCH) {
            const id = e.target.dataset.id;
            const checkbox = list.querySelector(`.clipboard-checkbox[data-id="${id}"]`);
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
              this.toggleSelection(id);
            }
          }
        });
      });

      list.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const item = state.clipboardHistory.find((i) => String(i.id) === id);
          if (item) {
            await navigator.clipboard.writeText(item.text);
            showNotification('已复制到剪贴板');
          }
        });
      });

      list.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          this.enterEditMode(id);
        });
      });

      list.querySelectorAll('.save-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          this.saveEdit(id);
        });
      });

      list.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.exitEditMode();
        });
      });
    },

    updateToolbar() {
      const controls = elements.clipboard_controls;
      if (!controls) return;

      const mode = state.clipboardMode;
      const selectedCount = selectedItems.size;

      let buttonsHtml = '';

      if (mode === ClipboardMode.NORMAL) {
        buttonsHtml = `
          <button class="clipboard-action-btn" data-action="batch">批量</button>
          <button class="clipboard-action-btn danger" data-action="clear">清空</button>
        `;
      } else if (mode === ClipboardMode.BATCH) {
        buttonsHtml = `
          <button class="clipboard-action-btn" data-action="cancel-batch">取消</button>
          <button class="clipboard-action-btn" data-action="select-all">全选</button>
          <button class="clipboard-action-btn ${selectedCount === 0 ? 'disabled' : ''}" data-action="batch-copy" ${selectedCount === 0 ? 'disabled' : ''}>复制(${selectedCount})</button>
          <button class="clipboard-action-btn danger ${selectedCount === 0 ? 'disabled' : ''}" data-action="batch-delete" ${selectedCount === 0 ? 'disabled' : ''}>删除(${selectedCount})</button>
        `;
      } else if (mode === ClipboardMode.EDIT) {
        buttonsHtml = `<button class="clipboard-action-btn" data-action="exit-edit">完成</button>`;
      }

      controls.innerHTML = buttonsHtml;
      this.bindToolbarEvents();
    },

    bindToolbarEvents() {
      const controls = elements.clipboard_controls;
      if (!controls) return;

      controls.querySelectorAll('.clipboard-action-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          this.handleToolbarAction(action);
        });
      });
    },

    handleToolbarAction(action) {
      switch (action) {
        case 'batch':
          this.enterBatchMode();
          break;
        case 'clear':
          this.clear();
          break;
        case 'cancel-batch':
          this.exitBatchMode();
          break;
        case 'select-all':
          this.selectAll();
          break;
        case 'batch-copy':
          this.batchCopy();
          break;
        case 'batch-delete':
          this.batchDelete();
          break;
        case 'exit-edit':
          this.exitEditMode();
          break;
      }
    }
  };
}
