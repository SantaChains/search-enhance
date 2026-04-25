/**
 * Token历史管理模块
 * 负责记录、存储和管理分词结果历史
 */

import {
  createTokenHistoryExport,
  parseImportData,
  extractDataForContext,
  IMPORT_CONTEXTS
} from './exportImportSchema.js';

class TokenHistoryManager {
  constructor() {
    this.storageKey = 'tokenHistory';
    this.maxHistoryItems = 100;
    this.settingsKey = 'tokenHistorySettings';
  }

  /**
   * 获取设置
   * @returns {Object} 设置对象
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.settingsKey);
      return {
        maxItems: 100,
        enabled: true,
        ...result[this.settingsKey]
      };
    } catch (error) {
      console.error('获取Token历史设置失败:', error);
      return { maxItems: 100, enabled: true };
    }
  }

  /**
   * 保存设置
   * @param {Object} settings - 设置对象
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [this.settingsKey]: settings
      });
      this.maxHistoryItems = settings.maxItems || 100;
      return true;
    } catch (error) {
      console.error('保存Token历史设置失败:', error);
      return false;
    }
  }

  /**
   * 添加Token到历史记录
   * @param {string} token - Token内容
   * @param {Object} metadata - 元数据
   */
  async addItem(token, metadata = {}) {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) {
        return false;
      }

      if (!token || token.trim() === '') {
        return false;
      }

      const trimmedToken = token.trim();
      const history = await this.getHistory();

      // 检查是否已存在相同内容
      const existingIndex = history.findIndex((item) => item.token === trimmedToken);

      const historyItem = {
        id: this.generateId(),
        token: trimmedToken,
        length: trimmedToken.length,
        source: metadata.source || 'unknown',
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        metadata: metadata || {}
      };

      if (existingIndex !== -1) {
        history[existingIndex] = {
          ...history[existingIndex],
          accessCount: history[existingIndex].accessCount + 1,
          lastAccessed: Date.now(),
          timestamp: Date.now()
        };
        const item = history.splice(existingIndex, 1)[0];
        history.unshift(item);
      } else {
        history.unshift(historyItem);
        const maxItems = settings.maxItems || this.maxHistoryItems;
        if (history.length > maxItems) {
          history.splice(maxItems);
        }
      }

      await this.saveHistory(history);
      return true;
    } catch (error) {
      console.error('添加Token历史失败:', error);
      return false;
    }
  }

  /**
   * 获取历史记录
   * @param {Object} options - 查询选项
   * @returns {Array} 历史记录数组
   */
  async getHistory(options = {}) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      let history = result[this.storageKey] || [];

      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        history = history.filter((item) => item.token.toLowerCase().includes(searchTerm));
      }

      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';

      history.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === 'timestamp' || sortBy === 'lastAccessed') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      if (options.limit) {
        const offset = options.offset || 0;
        history = history.slice(offset, offset + options.limit);
      }

      return history;
    } catch (error) {
      console.error('获取Token历史失败:', error);
      return [];
    }
  }

  /**
   * 删除历史记录项
   * @param {string} id - 记录ID
   */
  async removeItem(id) {
    try {
      const history = await this.getHistory();
      const filteredHistory = history.filter((item) => item.id !== id);
      await this.saveHistory(filteredHistory);
      return true;
    } catch (error) {
      console.error('删除Token历史失败:', error);
      return false;
    }
  }

  /**
   * 清空历史记录
   */
  async clearHistory() {
    try {
      await chrome.storage.local.remove(this.storageKey);
      return true;
    } catch (error) {
      console.error('清空Token历史失败:', error);
      return false;
    }
  }

  /**
   * 导出历史记录
   * @param {string} format - 导出格式 ('json', 'csv', 'txt')
   * @param {Object} options - 导出选项
   */
  async exportHistory(format = 'json', options = {}) {
    try {
      const history = await this.getHistory(options);
      const settings = await this.getSettings();

      let content = '';
      let filename = '';
      let mimeType = '';

      switch (format.toLowerCase()) {
        case 'json': {
          const exportData = createTokenHistoryExport(history, settings);
          content = JSON.stringify(exportData, null, 2);
          filename = `search-buddy-token-history-${this.formatDate(new Date())}.json`;
          mimeType = 'application/json';
          break;
        }

        case 'csv':
          content = this.convertToCSV(history);
          filename = `search-buddy-token-history-${this.formatDate(new Date())}.csv`;
          mimeType = 'text/csv';
          break;

        case 'txt':
          content = this.convertToText(history);
          filename = `search-buddy-token-history-${this.formatDate(new Date())}.txt`;
          mimeType = 'text/plain';
          break;

        default:
          throw new Error('不支持的导出格式');
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, filename, count: history.length };
    } catch (error) {
      console.error('导出Token历史失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 导入历史记录
   * @param {string|Object} data - 导入的数据
   * @param {Object} options - 导入选项
   * @param {boolean} options.merge - 是否合并到现有记录（默认true）
   */
  async importHistory(data, options = {}) {
    try {
      const { merge = true } = options;
      const parseResult = parseImportData(data, IMPORT_CONTEXTS.TOKEN_HISTORY);

      if (!parseResult.success) {
        return {
          success: false,
          imported: 0,
          errors: 1,
          message: parseResult.error || '无效的数据格式'
        };
      }

      const extractResult = extractDataForContext(parseResult.data, IMPORT_CONTEXTS.TOKEN_HISTORY);

      if (!extractResult.success) {
        return {
          success: false,
          imported: 0,
          errors: 1,
          message: extractResult.error
        };
      }

      let importedData = [];
      const extractedData = extractResult.data;

      if (extractedData.tokenHistory) {
        if (extractedData.tokenHistory.items) {
          importedData = extractedData.tokenHistory.items;
          if (extractedData.tokenHistory.settings) {
            await this.saveSettings(extractedData.tokenHistory.settings);
          }
        } else if (Array.isArray(extractedData.tokenHistory)) {
          importedData = extractedData.tokenHistory;
        }
      } else if (Array.isArray(extractedData)) {
        importedData = extractedData;
      }

      if (!Array.isArray(importedData) || importedData.length === 0) {
        return {
          success: false,
          imported: 0,
          errors: 1,
          message: '数据中没有找到Token历史记录'
        };
      }

      return this.processImportData(importedData, merge);
    } catch (error) {
      console.error('导入Token历史失败:', error);
      return { success: false, imported: 0, errors: 1, message: error.message };
    }
  }

  /**
   * 处理导入数据（内部方法）
   * @param {Array} importedData - 导入的数据数组
   * @param {boolean} merge - 是否合并
   * @returns {Object} 导入结果
   */
  async processImportData(importedData, merge) {
    try {
      let currentHistory = merge ? await this.getHistory() : [];
      let imported = 0;
      let errors = 0;
      const existingTokens = new Set(currentHistory.map((item) => item.token));

      const settings = await this.getSettings();
      const maxItems = settings.maxItems || this.maxHistoryItems;

      for (const item of importedData) {
        try {
          if (!item.token || item.token.trim() === '') {
            errors++;
            continue;
          }

          const trimmedToken = item.token.trim();

          if (existingTokens.has(trimmedToken)) {
            continue;
          }

          const normalizedItem = {
            id: item.id || this.generateId(),
            token: trimmedToken,
            length: trimmedToken.length,
            source: item.source || 'import',
            timestamp: item.timestamp || Date.now(),
            accessCount: item.accessCount || 1,
            lastAccessed: item.lastAccessed || Date.now(),
            metadata: item.metadata || {}
          };

          currentHistory.push(normalizedItem);
          existingTokens.add(trimmedToken);
          imported++;
        } catch (itemError) {
          console.error('导入单项失败:', itemError);
          errors++;
        }
      }

      if (currentHistory.length > maxItems) {
        currentHistory = currentHistory.slice(0, maxItems);
      }

      await this.saveHistory(currentHistory);

      return {
        success: true,
        imported,
        errors,
        total: currentHistory.length,
        message: `成功导入 ${imported} 条记录${errors > 0 ? `，${errors} 条失败` : ''}`
      };
    } catch (error) {
      console.error('处理导入数据失败:', error);
      return { success: false, imported: 0, errors: 1, message: error.message };
    }
  }

  /**
   * 从文件导入历史记录
   * @param {File} file - 导入的文件
   * @param {Object} options - 导入选项
   */
  async importFromFile(file, options = {}) {
    try {
      const content = await this.readFileContent(file);
      return await this.importHistory(content, options);
    } catch (error) {
      console.error('从文件导入失败:', error);
      return { success: false, imported: 0, errors: 1, message: error.message };
    }
  }

  /**
   * 读取文件内容
   * @param {File} file - 文件对象
   * @returns {Promise<string>}
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    try {
      const history = await this.getHistory();

      const stats = {
        totalItems: history.length,
        todayItems: history.filter((item) => this.isToday(item.timestamp)).length,
        thisWeekItems: history.filter((item) => this.isThisWeek(item.timestamp)).length,
        thisMonthItems: history.filter((item) => this.isThisMonth(item.timestamp)).length,
        totalLength: history.reduce((sum, item) => sum + (item.length || 0), 0),
        averageLength:
          history.length > 0
            ? Math.round(
                history.reduce((sum, item) => sum + (item.length || 0), 0) / history.length
              )
            : 0,
        accessFrequency: this.getAccessFrequency(history)
      };

      return stats;
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return null;
    }
  }

  // 私有方法

  /**
   * 保存历史记录
   */
  async saveHistory(history) {
    await chrome.storage.local.set({ [this.storageKey]: history });
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(history) {
    const headers = ['Token', '长度', '来源', '访问次数', '添加时间', '最后访问'];
    const rows = history.map((item) => [
      `"${(item.token || '').replace(/"/g, '""')}"`,
      item.length || 0,
      item.source || '',
      item.accessCount || 1,
      new Date(item.timestamp).toLocaleString('zh-CN'),
      new Date(item.lastAccessed).toLocaleString('zh-CN')
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * 转换为文本格式
   */
  convertToText(history) {
    return history
      .map((item) => {
        return `Token: ${item.token}\n长度: ${item.length}\n来源: ${item.source}\n访问次数: ${item.accessCount}\n添加时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}\n最后访问: ${new Date(item.lastAccessed).toLocaleString('zh-CN')}\n${'='.repeat(50)}\n`;
      })
      .join('\n');
  }

  /**
   * 获取访问频率
   */
  getAccessFrequency(history) {
    const totalAccess = history.reduce((sum, item) => sum + (item.accessCount || 1), 0);
    const avgAccess = history.length > 0 ? totalAccess / history.length : 0;

    return {
      totalAccess,
      averageAccess: Math.round(avgAccess * 100) / 100,
      mostAccessed: history.sort((a, b) => (b.accessCount || 1) - (a.accessCount || 1)).slice(0, 5)
    };
  }

  /**
   * 格式化日期
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * 检查是否为今天
   */
  isToday(timestamp) {
    const today = new Date();
    const date = new Date(timestamp);
    return date.toDateString() === today.toDateString();
  }

  /**
   * 检查是否为本周
   */
  isThisWeek(timestamp) {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    return timestamp >= weekStart.getTime();
  }

  /**
   * 检查是否为本月
   */
  isThisMonth(timestamp) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return timestamp >= monthStart.getTime();
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

// 导出单例实例
const tokenHistoryManager = new TokenHistoryManager();
export default tokenHistoryManager;
