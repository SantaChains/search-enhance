// src/popup/modules/uiModule.js
// UI交互功能模块

export function initUIModule(state, elements, showNotification) {
  let notificationTimeout = null;

  return {
    init() {
      this.setupTabs();
      this.setupSearch();
      this.setupKeyboardShortcuts();
    },

    setupTabs() {
      const tabContainer = elements.tab_container;
      if (!tabContainer) return;

      tabContainer.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const tabId = e.target.dataset.tab;
          this.switchTab(tabId);
        });
      });
    },

    switchTab(tabId) {
      const tabContainer = elements.tab_container;
      if (!tabContainer) return;

      tabContainer.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });

      document.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
      });

      state.currentTab = tabId;
    },

    setupSearch() {
      const searchInput = elements.search_input;
      if (!searchInput) return;

      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300);
      });
    },

    handleSearch(query) {
      state.searchQuery = query;

      switch (state.currentTab) {
        case 'link':
          state.modules.linkHistory?.render(query);
          break;
        case 'clipboard':
          state.modules.clipboardHistory?.render(query);
          break;
        case 'token':
          state.modules.tokenHistory?.render(query);
          break;
      }
    },

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'f':
              e.preventDefault();
              elements.search_input?.focus();
              break;
            case 'c':
              if (e.shiftKey) {
                e.preventDefault();
                state.modules.textProcessor?.copyCurrentToken();
              }
              break;
            case 'a':
              if (e.shiftKey) {
                e.preventDefault();
                state.modules.textProcessor?.copyAllTokens();
              }
              break;
          }
        }

        if (e.key === 'Escape') {
          this.closeAllModals();
        }
      });
    },

    showNotification(message, isSuccess = true) {
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
    },

    showModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('show');
      }
    },

    hideModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('show');
      }
    },

    closeAllModals() {
      document.querySelectorAll('.modal.show').forEach((modal) => {
        modal.classList.remove('show');
      });
    },

    showLoading(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.classList.add('loading');
      }
    },

    hideLoading(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.classList.remove('loading');
      }
    },

    updateStats(stats) {
      const statsContainer = elements.stats_container;
      if (!statsContainer) return;

      statsContainer.innerHTML = `
        <div class="stat-item">
          <span class="stat-value">${stats.linkCount || 0}</span>
          <span class="stat-label">链接</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.clipboardCount || 0}</span>
          <span class="stat-label">剪贴板</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.tokenCount || 0}</span>
          <span class="stat-label">Token</span>
        </div>
      `;
    }
  };
}
