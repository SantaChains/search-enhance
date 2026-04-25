// src/settings/modules/tokenizerSettings.js
// 分词器设置模块

import { getSettings, saveSettings } from '../../utils/storage.js';

export function initTokenizerSettings(elements, showNotification) {
  return {
    async load() {
      const settings = await getSettings();
      const ts = settings.tokenizerSettings || {};

      if (elements.useDictionary) elements.useDictionary.checked = ts.useDictionary !== false;
      if (elements.useAlgorithm) elements.useAlgorithm.checked = ts.useAlgorithm !== false;
      if (elements.lineCharLimit) elements.lineCharLimit.value = ts.lineCharLimit || 100;
      if (elements.randomMinLen) elements.randomMinLen.value = ts.randomMinLen || 1;
      if (elements.randomMaxLen) elements.randomMaxLen.value = ts.randomMaxLen || 10;
      if (elements.namingRemoveSymbols)
        elements.namingRemoveSymbols.checked = ts.namingRemoveSymbols !== false;
    },

    async save() {
      const settings = {
        tokenizerSettings: {
          useDictionary: elements.useDictionary?.checked ?? true,
          useAlgorithm: elements.useAlgorithm?.checked ?? true,
          lineCharLimit: parseInt(elements.lineCharLimit?.value) || 100,
          randomMinLen: parseInt(elements.randomMinLen?.value) || 1,
          randomMaxLen: parseInt(elements.randomMaxLen?.value) || 10,
          namingRemoveSymbols: elements.namingRemoveSymbols?.checked ?? true
        }
      };

      await saveSettings(settings);
      showNotification('分词器设置已保存');
    },

    bindEvents() {
      elements.saveTokenizer?.addEventListener('click', () => this.save());
    }
  };
}
