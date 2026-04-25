// src/settings/modules/historySettings.js
// 历史记录设置模块

import { getSettings, saveSettings } from '../../utils/storage.js';

export function initHistorySettings(elements, showNotification) {
  return {
    async load() {
      const settings = await getSettings();
      const hs = settings.historySettings || {};

      if (elements.linkHistoryEnabled)
        elements.linkHistoryEnabled.checked = hs.linkHistoryEnabled !== false;
      if (elements.linkHistoryMaxItems)
        elements.linkHistoryMaxItems.value = hs.linkHistoryMaxItems || 100;
      if (elements.clipboardHistoryEnabled)
        elements.clipboardHistoryEnabled.checked = hs.clipboardHistoryEnabled !== false;
      if (elements.clipboardHistoryMaxItems)
        elements.clipboardHistoryMaxItems.value = hs.clipboardHistoryMaxItems || 100;
      if (elements.tokenHistoryEnabled)
        elements.tokenHistoryEnabled.checked = hs.tokenHistoryEnabled !== false;
      if (elements.tokenHistoryMaxItems)
        elements.tokenHistoryMaxItems.value = hs.tokenHistoryMaxItems || 100;
    },

    async save() {
      const settings = {
        historySettings: {
          linkHistoryEnabled: elements.linkHistoryEnabled?.checked ?? true,
          linkHistoryMaxItems: parseInt(elements.linkHistoryMaxItems?.value) || 100,
          clipboardHistoryEnabled: elements.clipboardHistoryEnabled?.checked ?? true,
          clipboardHistoryMaxItems: parseInt(elements.clipboardHistoryMaxItems?.value) || 100,
          tokenHistoryEnabled: elements.tokenHistoryEnabled?.checked ?? true,
          tokenHistoryMaxItems: parseInt(elements.tokenHistoryMaxItems?.value) || 100
        }
      };

      await saveSettings(settings);
      showNotification('历史记录设置已保存');
    },

    bindEvents() {
      elements.saveHistory?.addEventListener('click', () => this.save());
    }
  };
}
