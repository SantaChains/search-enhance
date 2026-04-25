// src/popup/modules/tokenHistoryModule.js
// Token历史功能模块

import tokenHistoryManager from '../../utils/tokenHistory.js';

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

export function initTokenHistoryModule(state, elements, showNotification) {
  const selectedItems = new Set();

  return {
    async load() {
      try {
        state.tokenHistory = await tokenHistoryManager.getHistory();
      } catch (error) {
        state.tokenHistory = [];
      }
    },

    async add(token, metadata = {}) {
      try {
        await tokenHistoryManager.addItem(token, metadata);
        state.tokenHistory = await tokenHistoryManager.getHistory();
        this.render();
      } catch (error) {
        console.error('添加Token历史失败:', error);
      }
    },

    async remove(id) {
      try {
        await tokenHistoryManager.removeItem(id);
        state.tokenHistory = await tokenHistoryManager.getHistory();
        this.render();
        showNotification('已删除');
      } catch (error) {
        showNotification('删除失败', false);
      }
    },

    async clear() {
      try {
        await tokenHistoryManager.clearHistory();
        state.tokenHistory = [];
        selectedItems.clear();
        this.render();
        showNotification('Token历史已清空');
      } catch (error) {
        showNotification('清空失败', false);
      }
    },

    async export(format = 'json') {
      try {
        const result = await tokenHistoryManager.exportHistory(format);
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
        const result = await tokenHistoryManager.importFromFile(file, { merge });
        if (result.success) {
          state.tokenHistory = await tokenHistoryManager.getHistory();
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
        await tokenHistoryManager.saveSettings(settings);
        showNotification('设置已保存');
        return true;
      } catch (error) {
        showNotification('保存设置失败', false);
        return false;
      }
    },

    async getSettings() {
      try {
        return await tokenHistoryManager.getSettings();
      } catch (error) {
        return { maxItems: 100, enabled: true };
      }
    },

    setMode(mode) {
      if (!['normal', 'batch', 'edit'].includes(mode)) return;
      state.tokenHistoryMode = mode;
      if (mode === 'normal') {
        state.editingTokenId = null;
        selectedItems.clear();
      } else if (mode === 'edit') {
        selectedItems.clear();
      }
      this.render();
    },

    enterBatchMode() {
      this.setMode('batch');
    },

    exitBatchMode() {
      this.setMode('normal');
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
      state.tokenHistory.forEach((item) => selectedItems.add(item.id));
      this.render();
    },

    clearSelection() {
      selectedItems.clear();
      this.render();
    },

    async batchCopy() {
      const selected = state.tokenHistory.filter((item) => selectedItems.has(item.id));
      if (selected.length === 0) {
        showNotification('请先选择要复制的项目', false);
        return;
      }

      const textToCopy = selected.map((item) => item.token).join('\n\n');
      try {
        await navigator.clipboard.writeText(textToCopy);
        showNotification(`已复制 ${selected.length} 条记录`);
      } catch (error) {
        showNotification('复制失败', false);
      }
    },

    async batchDelete() {
      const selected = state.tokenHistory.filter((item) => selectedItems.has(item.id));
      if (selected.length === 0) {
        showNotification('请先选择要删除的项目', false);
        return;
      }

      if (confirm(`确定要删除选中的 ${selected.length} 条记录吗？`)) {
        for (const item of selected) {
          await tokenHistoryManager.removeItem(item.id);
        }
        state.tokenHistory = await tokenHistoryManager.getHistory();
        selectedItems.clear();
        this.render();
        showNotification(`已删除 ${selected.length} 条记录`);
      }
    },

    render(searchTerm = '') {
      const list = elements.token_history_list;
      if (!list) return;

      let filtered = state.tokenHistory;

      if (searchTerm) {
        filtered = filtered.filter((item) =>
          item.token.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>${searchTerm ? '没有找到匹配的记录' : '暂无Token历史'}</p></div>`;
        this.updateToolbar();
        return;
      }

      list.innerHTML = filtered.map((item) => this.renderItem(item)).join('');
      this.bindEvents();
      this.updateToolbar();
    },

    renderItem(item) {
      const isSelected = selectedItems.has(item.id);
      const showCheckbox = state.tokenHistoryMode === 'batch';
      const truncatedToken = truncateText(item.token, 100);

      return `
        <div class="history-item" data-id="${escapeHtml(String(item.id))}">
          <div class="token-item-content">
            <div class="content-row">
              <input type="checkbox" class="token-checkbox"
                     data-id="${escapeHtml(String(item.id))}"
                     style="display: ${showCheckbox ? 'inline-block' : 'none'}"
                     ${isSelected ? 'checked' : ''}>
              <div class="token-text" data-id="${escapeHtml(String(item.id))}">${escapeHtml(truncatedToken)}</div>
              ${
                state.tokenHistoryMode === 'normal'
                  ? `
                <div class="item-actions">
                  <button class="copy-btn btn-sm" data-id="${escapeHtml(String(item.id))}" title="复制">复制</button>
                  <button class="remove-btn btn-sm" data-id="${escapeHtml(String(item.id))}" title="删除">删除</button>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>`;
    },

    bindEvents() {
      const list = elements.token_history_list;
      if (!list) return;

      list.querySelectorAll('.token-checkbox').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          const id = e.target.dataset.id;
          this.toggleSelection(id);
        });
      });

      list.querySelectorAll('.token-text').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (state.tokenHistoryMode === 'batch') {
            const id = e.target.dataset.id;
            const checkbox = list.querySelector(`.token-checkbox[data-id="${id}"]`);
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
          const item = state.tokenHistory.find((i) => String(i.id) === id);
          if (item) {
            await navigator.clipboard.writeText(item.token);
            showNotification('已复制到剪贴板');
          }
        });
      });

      list.querySelectorAll('.remove-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          if (confirm('确定要删除这条记录吗？')) {
            await this.remove(id);
          }
        });
      });
    },

    updateToolbar() {
      const controls = elements.token_controls;
      if (!controls) return;

      const mode = state.tokenHistoryMode;
      const selectedCount = selectedItems.size;

      let buttonsHtml = '';

      if (mode === 'normal') {
        buttonsHtml = `
          <button class="token-action-btn" data-action="batch">批量</button>
          <button class="token-action-btn danger" data-action="clear">清空</button>
        `;
      } else if (mode === 'batch') {
        buttonsHtml = `
          <button class="token-action-btn" data-action="cancel-batch">取消</button>
          <button class="token-action-btn" data-action="select-all">全选</button>
          <button class="token-action-btn ${selectedCount === 0 ? 'disabled' : ''}" data-action="batch-copy" ${selectedCount === 0 ? 'disabled' : ''}>复制(${selectedCount})</button>
          <button class="token-action-btn danger ${selectedCount === 0 ? 'disabled' : ''}" data-action="batch-delete" ${selectedCount === 0 ? 'disabled' : ''}>删除(${selectedCount})</button>
        `;
      }

      controls.innerHTML = buttonsHtml;
      this.bindToolbarEvents();
    },

    bindToolbarEvents() {
      const controls = elements.token_controls;
      if (!controls) return;

      controls.querySelectorAll('.token-action-btn').forEach((btn) => {
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
      }
    }
  };
}
