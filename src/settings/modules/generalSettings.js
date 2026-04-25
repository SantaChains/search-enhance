// src/settings/modules/generalSettings.js
// 通用设置模块

import { getSettings, saveSettings } from '../../utils/storage.js';

export function initGeneralSettings(elements, showNotification) {
  return {
    async load() {
      const settings = await getSettings();
      const general = settings.general || {};

      if (elements.autoSave) elements.autoSave.checked = general.autoSave !== false;
      if (elements.showNotifications)
        elements.showNotifications.checked = general.showNotifications !== false;
      if (elements.theme) elements.theme.value = general.theme || 'auto';
      if (elements.language) elements.language.value = general.language || 'zh-CN';
    },

    async save() {
      const settings = {
        general: {
          autoSave: elements.autoSave?.checked ?? true,
          showNotifications: elements.showNotifications?.checked ?? true,
          theme: elements.theme?.value || 'auto',
          language: elements.language?.value || 'zh-CN'
        }
      };

      await saveSettings(settings);
      showNotification('通用设置已保存');
    },

    bindEvents() {
      elements.saveGeneral?.addEventListener('click', () => this.save());
    }
  };
}
