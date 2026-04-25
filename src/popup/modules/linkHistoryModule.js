// src/popup/modules/linkHistoryModule.js
// 链接历史功能模块

import linkHistoryManager from '../../utils/linkHistory.js';

const LinkHistoryMode = { NORMAL: 'normal', EDIT: 'edit' };

function isGitHubRepository(url) {
  const patterns = [
    /https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/zread\.ai\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/deepwiki\.com\/([^/]+)\/([^/?#]+)/,
    /https?:\/\/context7\.com\/([^/]+)\/([^/?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, username, repo] = match;
      return { isRepo: true, username, repo, githubUrl: `https://github.com/${username}/${repo}` };
    }
  }

  const simplePattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/;
  const simpleMatch = url.match(simplePattern);
  if (simpleMatch) {
    const [, username, repo] = simpleMatch;
    return { isRepo: true, username, repo, githubUrl: `https://github.com/${username}/${repo}` };
  }

  return { isRepo: false };
}

export function initLinkHistoryModule(state, elements, showNotification) {
  return {
    async load() {
      try {
        state.linkHistory = await linkHistoryManager.getHistory();
      } catch (error) {
        state.linkHistory = [];
      }
    },

    async add(url, title = '', type = 'general') {
      try {
        const isGithub = isGitHubRepository(url);
        if (isGithub.isRepo && isGithub.githubUrl) {
          await linkHistoryManager.addLink(isGithub.githubUrl, '', 'github_repo');
        } else {
          await linkHistoryManager.addLink(url, title, type);
        }
        state.linkHistory = await linkHistoryManager.getHistory();
        this.render();
      } catch (error) {
        console.error('添加历史记录失败:', error);
      }
    },

    async remove(id) {
      try {
        await linkHistoryManager.removeItem(id);
        state.linkHistory = await linkHistoryManager.getHistory();
        this.render();
        showNotification('已删除');
      } catch (error) {
        showNotification('删除失败', false);
      }
    },

    async clear() {
      try {
        await linkHistoryManager.clearHistory();
        state.linkHistory = [];
        this.render();
        showNotification('历史记录已清空');
      } catch (error) {
        showNotification('清空失败', false);
      }
    },

    async saveEdit(id, newUrl) {
      const originalUrl = state.editingLinkHistoryOriginalUrl;

      if (newUrl.trim() === originalUrl) {
        this.cancelEdit();
        showNotification('内容未修改');
        return;
      }

      try {
        if (id && id !== originalUrl) {
          await linkHistoryManager.removeItem(id);
        } else {
          const history = await linkHistoryManager.getHistory();
          const itemToRemove = history.find((item) => {
            const itemUrl = typeof item === 'string' ? item : item.url;
            return itemUrl === originalUrl;
          });
          if (itemToRemove?.id) {
            await linkHistoryManager.removeItem(itemToRemove.id);
          }
        }

        await linkHistoryManager.addLink(newUrl.trim(), '', 'edit');

        state.editingLinkHistoryId = null;
        state.editingLinkHistoryOriginalUrl = null;
        state.linkHistoryMode = LinkHistoryMode.NORMAL;

        state.linkHistory = await linkHistoryManager.getHistory();
        this.render();
        showNotification('已保存修改');
      } catch (error) {
        showNotification('保存失败', false);
      }
    },

    cancelEdit() {
      state.editingLinkHistoryId = null;
      state.editingLinkHistoryOriginalUrl = null;
      state.linkHistoryMode = LinkHistoryMode.NORMAL;
      this.render();
    },

    toggleEditMode() {
      if (state.linkHistoryMode === LinkHistoryMode.NORMAL) {
        state.linkHistoryMode = LinkHistoryMode.EDIT;
        showNotification('点击历史项进行编辑');
      } else {
        state.linkHistoryMode = LinkHistoryMode.NORMAL;
        state.editingLinkHistoryId = null;
        state.editingLinkHistoryOriginalUrl = null;
      }
      this.render();
    },

    render(searchTerm = '') {
      const list = elements.history_list;
      if (!list || !state.linkHistory) return;

      let filtered = state.linkHistory;

      const filter = state.linkHistoryFilter || 'all';
      if (filter !== 'all') {
        filtered = filtered.filter((item) => {
          const url = typeof item === 'string' ? item : item.url;
          const isGithub = url?.includes('github.com');
          if (filter === 'github') return isGithub;
          if (filter === 'other') return !isGithub;
          return true;
        });
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter((item) => {
          const url = typeof item === 'string' ? item : item.url;
          return url?.toLowerCase().includes(term);
        });
      }

      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><p>${searchTerm ? '没有找到匹配的记录' : '暂无历史记录'}</p></div>`;
        return;
      }

      list.innerHTML = filtered.map((item) => this.renderItem(item)).join('');
      this.bindEvents();
    },

    renderItem(item) {
      const url = typeof item === 'string' ? item : item.url;
      const id = typeof item === 'object' ? item.id : url;
      const isGithub = url?.includes('github.com');
      const isEditing = state.editingLinkHistoryId === id;

      if (isEditing) {
        return `
          <div class="history-item editing" data-id="${id}">
            <textarea class="edit-url-textarea" rows="2">${url}</textarea>
            <div class="edit-actions-row">
              <button class="save-edit-btn btn-primary" data-id="${id}">保存</button>
              <button class="cancel-edit-btn btn-secondary">取消</button>
            </div>
          </div>`;
      }

      const isEditMode = state.linkHistoryMode === LinkHistoryMode.EDIT;

      return `
        <div class="history-item ${isGithub ? 'github-item' : 'other-item'} ${isEditMode ? 'editable' : ''}" data-id="${id}" data-url="${url}">
          <div class="history-content">
            ${isEditMode ? `<span class="history-link disabled">${url}</span>` : `<a href="${url}" target="_blank" class="history-link">${url}</a>`}
          </div>
          <div class="history-actions">
            ${isEditMode ? '' : `<button class="copy-btn btn-sm" data-link="${url}">复制</button><button class="remove-btn btn-sm" data-id="${id}">删除</button>`}
          </div>
        </div>`;
    },

    bindEvents() {
      const list = elements.history_list;
      if (!list) return;

      list.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const link = e.target.dataset.link;
          await navigator.clipboard.writeText(link);
          showNotification('已复制');
        });
      });

      list.querySelectorAll('.remove-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          if (confirm('确定要删除这个历史记录吗？')) {
            await this.remove(id);
          }
        });
      });

      if (state.linkHistoryMode === LinkHistoryMode.EDIT) {
        list.querySelectorAll('.history-item.editable').forEach((item) => {
          item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            state.editingLinkHistoryId = item.dataset.id;
            state.editingLinkHistoryOriginalUrl = item.dataset.url;
            this.render();
          });
        });
      }

      list.querySelectorAll('.save-edit-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const textarea = list.querySelector(`.history-item[data-id="${id}"] textarea`);
          if (textarea) {
            await this.saveEdit(id, textarea.value);
          }
        });
      });

      list.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.cancelEdit();
        });
      });
    }
  };
}
