// src/popup/modules/textProcessorModule.js
// 文本处理功能模块

import { splitText, ANALYZE_MODES } from '../../utils/textProcessor.js';
import { getSettings } from '../../utils/storage.js';

export function initTextProcessorModule(state, elements, showNotification) {
  let currentTokens = [];
  let currentIndex = 0;

  return {
    async init() {
      const settings = await getSettings();
      state.tokenizerSettings = settings.tokenizerSettings || {};
      this.setupModeButtons();
      this.bindEvents();
    },

    setupModeButtons() {
      const container = elements.mode_buttons;
      if (!container) return;

      container.innerHTML = Object.entries(ANALYZE_MODES)
        .map(
          ([key, mode]) => `
          <button class="mode-btn ${key === 'smart' ? 'active' : ''}" data-mode="${key}" title="${mode.description}">
            ${mode.name}
          </button>
        `
        )
        .join('');
    },

    bindEvents() {
      const container = elements.mode_buttons;
      if (!container) return;

      container.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          container.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
          e.target.classList.add('active');
          state.currentMode = e.target.dataset.mode;
          this.processCurrentText();
        });
      });

      if (elements.process_btn) {
        elements.process_btn.addEventListener('click', () => this.processCurrentText());
      }

      if (elements.prev_token) {
        elements.prev_token.addEventListener('click', () => this.prevToken());
      }

      if (elements.next_token) {
        elements.next_token.addEventListener('click', () => this.nextToken());
      }

      if (elements.copy_token) {
        elements.copy_token.addEventListener('click', () => this.copyCurrentToken());
      }

      if (elements.copy_all) {
        elements.copy_all.addEventListener('click', () => this.copyAllTokens());
      }
    },

    async processText(text, mode = 'smart') {
      if (!text || !text.trim()) {
        currentTokens = [];
        currentIndex = 0;
        this.updateDisplay();
        return [];
      }

      try {
        currentTokens = await splitText(text, mode);
        currentIndex = 0;
        this.updateDisplay();
        return currentTokens;
      } catch (error) {
        console.error('文本处理失败:', error);
        showNotification('文本处理失败', false);
        return [];
      }
    },

    async processCurrentText() {
      const text = elements.input_text?.value || '';
      await this.processText(text, state.currentMode || 'smart');
    },

    updateDisplay() {
      if (elements.token_count) {
        elements.token_count.textContent = `共 ${currentTokens.length} 个分词`;
      }

      if (elements.current_token) {
        elements.current_token.textContent = currentTokens[currentIndex] || '';
      }

      if (elements.token_index) {
        elements.token_index.textContent =
          currentTokens.length > 0 ? `${currentIndex + 1} / ${currentTokens.length}` : '0 / 0';
      }

      if (elements.prev_token) {
        elements.prev_token.disabled = currentIndex <= 0;
      }

      if (elements.next_token) {
        elements.next_token.disabled = currentIndex >= currentTokens.length - 1;
      }

      if (elements.token_list) {
        elements.token_list.innerHTML = currentTokens
          .map(
            (token, idx) => `
            <div class="token-item ${idx === currentIndex ? 'active' : ''}" data-index="${idx}">
              ${token}
            </div>
          `
          )
          .join('');

        elements.token_list.querySelectorAll('.token-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            currentIndex = parseInt(e.target.dataset.index);
            this.updateDisplay();
          });
        });
      }
    },

    prevToken() {
      if (currentIndex > 0) {
        currentIndex--;
        this.updateDisplay();
      }
    },

    nextToken() {
      if (currentIndex < currentTokens.length - 1) {
        currentIndex++;
        this.updateDisplay();
      }
    },

    async copyCurrentToken() {
      const token = currentTokens[currentIndex];
      if (!token) {
        showNotification('没有可复制的分词', false);
        return;
      }

      try {
        await navigator.clipboard.writeText(token);
        showNotification('已复制当前分词');
      } catch (error) {
        showNotification('复制失败', false);
      }
    },

    async copyAllTokens() {
      if (currentTokens.length === 0) {
        showNotification('没有可复制的分词', false);
        return;
      }

      try {
        const text = currentTokens.join('\n');
        await navigator.clipboard.writeText(text);
        showNotification(`已复制 ${currentTokens.length} 个分词`);
      } catch (error) {
        showNotification('复制失败', false);
      }
    },

    getTokens() {
      return [...currentTokens];
    },

    getCurrentToken() {
      return currentTokens[currentIndex];
    },

    setIndex(index) {
      if (index >= 0 && index < currentTokens.length) {
        currentIndex = index;
        this.updateDisplay();
      }
    }
  };
}
