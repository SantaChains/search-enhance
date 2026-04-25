// src/settings/modules/aiSettings.js
// AI设置模块

import { getSettings, saveSettings } from '../../utils/storage.js';

const AI_PROVIDERS = {
  openai: { name: 'OpenAI', baseURL: 'https://api.openai.com/v1' },
  azure: { name: 'Azure OpenAI', baseURL: '' },
  custom: { name: '自定义', baseURL: '' }
};

export function initAISettings(elements, showNotification) {
  return {
    async load() {
      const settings = await getSettings();
      const ts = settings.tokenizerSettings || {};

      if (elements.aiEnabled) elements.aiEnabled.checked = ts.aiEnabled === true;
      if (elements.aiProvider) elements.aiProvider.value = ts.aiProvider || 'openai';
      if (elements.aiBaseURL) elements.aiBaseURL.value = ts.aiBaseURL || '';
      if (elements.aiApiKey) elements.aiApiKey.value = ts.aiApiKey || '';
      if (elements.aiModel) elements.aiModel.value = ts.aiModel || '';

      this.updateProviderUI(ts.aiProvider || 'openai');
    },

    async save() {
      const settings = await getSettings();
      const currentTokenizer = settings.tokenizerSettings || {};

      const updatedTokenizer = {
        ...currentTokenizer,
        aiEnabled: elements.aiEnabled?.checked ?? false,
        aiProvider: elements.aiProvider?.value || 'openai',
        aiBaseURL: elements.aiBaseURL?.value || '',
        aiApiKey: elements.aiApiKey?.value || '',
        aiModel: elements.aiModel?.value || ''
      };

      await saveSettings({ tokenizerSettings: updatedTokenizer });
      showNotification('AI设置已保存');
    },

    updateProviderUI(provider) {
      const providerInfo = AI_PROVIDERS[provider];
      if (providerInfo && elements.aiBaseURL && !elements.aiBaseURL.value) {
        elements.aiBaseURL.placeholder = providerInfo.baseURL || '输入API基础URL';
      }
    },

    bindEvents() {
      elements.saveAI?.addEventListener('click', () => this.save());

      elements.aiProvider?.addEventListener('change', (e) => {
        this.updateProviderUI(e.target.value);
      });

      elements.aiEnabled?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (elements.aiBaseURL) elements.aiBaseURL.disabled = !enabled;
        if (elements.aiApiKey) elements.aiApiKey.disabled = !enabled;
        if (elements.aiModel) elements.aiModel.disabled = !enabled;
      });
    }
  };
}
