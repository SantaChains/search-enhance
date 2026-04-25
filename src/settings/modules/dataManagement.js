// src/settings/modules/dataManagement.js
// 数据管理模块

import { getSettings, saveSettings, clearAllData } from '../../utils/storage.js';
import linkHistoryManager from '../../utils/linkHistory.js';
import clipboardHistoryManager from '../../utils/clipboardHistory.js';
import tokenHistoryManager from '../../utils/tokenHistory.js';
import {
  createFullExport,
  parseImportData,
  extractDataForContext,
  IMPORT_CONTEXTS
} from '../../utils/exportImportSchema.js';

export function initDataManagement(elements, showNotification) {
  return {
    async exportAll() {
      try {
        const settings = await getSettings();
        const linkHistoryItems = await linkHistoryManager.getHistory();
        const linkHistorySettings = await linkHistoryManager.getSettings();
        const clipboardHistoryItems = await clipboardHistoryManager.getHistory();
        const clipboardHistorySettings = await clipboardHistoryManager.getSettings();
        const tokenHistoryItems = await tokenHistoryManager.getHistory();
        const tokenHistorySettings = await tokenHistoryManager.getSettings();

        // 构造统一 Schema 格式的数据
        const linkHistoryData = {
          items: linkHistoryItems,
          settings: linkHistorySettings
        };
        const clipboardHistoryData = {
          items: clipboardHistoryItems,
          settings: clipboardHistorySettings
        };
        const tokenHistoryData = {
          items: tokenHistoryItems,
          settings: tokenHistorySettings
        };

        // 使用统一 Schema 创建导出数据
        const exportData = createFullExport(
          settings,
          linkHistoryData,
          clipboardHistoryData,
          tokenHistoryData
        );

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-enhance-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('数据导出成功');
      } catch (error) {
        console.error('导出数据失败:', error);
        showNotification('数据导出失败', false);
      }
    },

    async importAll(file) {
      try {
        const text = await file.text();

        // 使用统一 Schema 解析数据
        const parseResult = parseImportData(text, IMPORT_CONTEXTS.SETTINGS);

        if (!parseResult.success) {
          showNotification(parseResult.error || '无效的数据文件', false);
          return false;
        }

        // 提取数据
        const extractResult = extractDataForContext(parseResult.data, IMPORT_CONTEXTS.SETTINGS);

        if (!extractResult.success) {
          showNotification(extractResult.error || '无法提取数据', false);
          return false;
        }

        const data = extractResult.data;

        // 导入设置
        if (data.settings) {
          await saveSettings(data.settings);
        }

        // 导入链接历史
        if (data.linkHistory) {
          const items = data.linkHistory.items || data.linkHistory;
          const settings = data.linkHistory.settings;

          if (Array.isArray(items)) {
            for (const item of items) {
              await linkHistoryManager.addLink(
                item.url || item,
                item.title,
                item.source || 'import',
                {
                  searchQuery: item.searchQuery,
                  searchEngine: item.searchEngine
                }
              );
            }
          }

          if (settings) {
            await linkHistoryManager.saveSettings(settings);
          }
        }

        // 导入剪贴板历史
        if (data.clipboardHistory) {
          const items = data.clipboardHistory.items || data.clipboardHistory;
          const settings = data.clipboardHistory.settings;

          if (Array.isArray(items)) {
            for (const item of items) {
              await clipboardHistoryManager.addItem(item.text || item, {
                source: item.source || 'import',
                metadata: item.metadata
              });
            }
          }

          if (settings) {
            await clipboardHistoryManager.saveSettings(settings);
          }
        }

        // 导入Token历史
        if (data.tokenHistory) {
          const items = data.tokenHistory.items || data.tokenHistory;
          const settings = data.tokenHistory.settings;

          if (Array.isArray(items)) {
            for (const item of items) {
              await tokenHistoryManager.addItem(item.token || item, {
                source: item.source || 'import',
                ...item.metadata
              });
            }
          }

          if (settings) {
            await tokenHistoryManager.saveSettings(settings);
          }
        }

        // 兼容旧格式（直接检查原始解析数据）
        const rawData = parseResult.data.data || parseResult.data;

        // 旧格式：直接包含 linkHistory/clipboardHistory/tokenHistory 数组
        if (!data.linkHistory && Array.isArray(rawData.linkHistory)) {
          for (const item of rawData.linkHistory) {
            await linkHistoryManager.addLink(item.url || item, item.title, item.type);
          }
        }

        if (!data.clipboardHistory && Array.isArray(rawData.clipboardHistory)) {
          for (const item of rawData.clipboardHistory) {
            await clipboardHistoryManager.addItem(item.text || item, item.metadata);
          }
        }

        if (!data.tokenHistory && Array.isArray(rawData.tokenHistory)) {
          for (const item of rawData.tokenHistory) {
            await tokenHistoryManager.addItem(item.token || item, item.metadata);
          }
        }

        showNotification('数据导入成功');
        return true;
      } catch (error) {
        console.error('导入数据失败:', error);
        showNotification('数据导入失败', false);
        return false;
      }
    },

    async clearAll() {
      if (!confirm('确定要清除所有数据吗？此操作不可恢复。')) return;

      try {
        await clearAllData();
        await linkHistoryManager.clearHistory();
        await clipboardHistoryManager.clearHistory();
        await tokenHistoryManager.clearHistory();

        showNotification('所有数据已清除');
      } catch (error) {
        showNotification('清除数据失败', false);
      }
    },

    bindEvents() {
      elements.exportAll?.addEventListener('click', () => this.exportAll());

      elements.importAll?.addEventListener('click', () => {
        elements.importFile?.click();
      });

      elements.importFile?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.importAll(file);
          e.target.value = '';
        }
      });

      elements.clearAll?.addEventListener('click', () => this.clearAll());
    }
  };
}
