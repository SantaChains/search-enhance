/**
 * 剪贴板历史管理模块
 * 负责记录、存储和管理剪贴板内容历史
 */

class ClipboardHistoryManager {
  constructor() {
    this.storageKey = 'clipboardHistory';
    this.maxHistoryItems = 100; // 默认最大条数
    this.settingsKey = 'clipboardHistorySettings';
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
        autoSave: true,
        ...result[this.settingsKey],
      };
    } catch (error) {
      console.error('获取剪贴板历史设置失败:', error);
      return { maxItems: 100, enabled: true, autoSave: true };
    }
  }

  /**
   * 保存设置
   * @param {Object} settings - 设置对象
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [this.settingsKey]: settings,
      });
      this.maxHistoryItems = settings.maxItems || 100;
      return true;
    } catch (error) {
      console.error('保存剪贴板历史设置失败:', error);
      return false;
    }
  }

  /**
   * 添加剪贴板内容到历史记录
   * @param {string} text - 剪贴板内容
   * @param {Object} options - 选项
   * @param {string} options.source - 来源
   * @param {Object} options.metadata - 元数据
   */
  async addItem(text, options = {}) {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) {
        return false;
      }

      if (!text || text.trim() === '') {
        return false;
      }

      const trimmedText = text.trim();
      const history = await this.getHistory();

      // 检查是否已存在相同内容
      const existingIndex = history.findIndex((item) => item.text === trimmedText);

      const historyItem = {
        id: this.generateId(),
        text: trimmedText,
        preview: this.generatePreview(trimmedText),
        length: trimmedText.length,
        source: options.source || 'clipboard',
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        metadata: options.metadata || {},
        tags: this.generateTags(trimmedText),
      };

      if (existingIndex !== -1) {
        // 更新现有记录
        history[existingIndex] = {
          ...history[existingIndex],
          accessCount: history[existingIndex].accessCount + 1,
          lastAccessed: Date.now(),
          timestamp: Date.now(), // 更新时间戳使其排到前面
        };
        // 移到最前面
        const item = history.splice(existingIndex, 1)[0];
        history.unshift(item);
      } else {
        // 添加新记录
        history.unshift(historyItem);

        // 限制历史记录数量
        const maxItems = settings.maxItems || this.maxHistoryItems;
        if (history.length > maxItems) {
          history.splice(maxItems);
        }
      }

      await this.saveHistory(history);
      return true;
    } catch (error) {
      console.error('添加剪贴板历史失败:', error);
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

      // 应用搜索过滤
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        history = history.filter(
          (item) =>
            item.text.toLowerCase().includes(searchTerm) ||
            item.preview.toLowerCase().includes(searchTerm) ||
            item.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
        );
      }

      // 应用排序
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

      // 应用分页
      if (options.limit) {
        const offset = options.offset || 0;
        history = history.slice(offset, offset + options.limit);
      }

      return history;
    } catch (error) {
      console.error('获取剪贴板历史失败:', error);
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
      console.error('删除剪贴板历史失败:', error);
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
      console.error('清空剪贴板历史失败:', error);
      return false;
    }
  }

  /**
   * 更新历史记录项
   * @param {string} id - 记录ID
   * @param {Object} updates - 更新内容
   */
  async updateItem(id, updates) {
    try {
      const history = await this.getHistory();
      const index = history.findIndex((item) => item.id === id);

      if (index === -1) {
        return false;
      }

      history[index] = {
        ...history[index],
        ...updates,
        lastAccessed: Date.now(),
      };

      await this.saveHistory(history);
      return true;
    } catch (error) {
      console.error('更新剪贴板历史失败:', error);
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

      let content = '';
      let filename = '';
      let mimeType = '';

      switch (format.toLowerCase()) {
        case 'json': {
          const exportData = {
            type: 'clipboardHistory',
            history,
            exportDate: new Date().toISOString(),
            version: '1.0',
            appName: 'SearchBuddy',
          };
          content = JSON.stringify(exportData, null, 2);
          filename = `search-buddy-clipboard-history-${this.formatDate(new Date())}.json`;
          mimeType = 'application/json';
          break;
        }

        case 'csv':
          content = this.convertToCSV(history);
          filename = `clipboard-history-${this.formatDate(new Date())}.csv`;
          mimeType = 'text/csv';
          break;

        case 'txt':
          content = this.convertToText(history);
          filename = `clipboard-history-${this.formatDate(new Date())}.txt`;
          mimeType = 'text/plain';
          break;

        default:
          throw new Error('不支持的导出格式');
      }

      // 创建下载链接
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // 触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, filename, count: history.length };
    } catch (error) {
      console.error('导出剪贴板历史失败:', error);
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
      let importedData = [];
      let parsedData = null;

      // 解析数据
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          importedData = this.parseCSV(data);
        }
      } else if (Array.isArray(data)) {
        importedData = data;
      } else if (data && typeof data === 'object') {
        parsedData = data;
      }

      // 处理包装格式（新版导出格式）
      if (parsedData && typeof parsedData === 'object') {
        if (parsedData.history && Array.isArray(parsedData.history)) {
          // 新版包装格式
          importedData = parsedData.history;
        } else if (Array.isArray(parsedData)) {
          // 旧版数组格式
          importedData = parsedData;
        } else {
          // 单条记录
          importedData = [parsedData];
        }
      }

      if (!Array.isArray(importedData) || importedData.length === 0) {
        return { success: false, imported: 0, errors: 1, message: '无效的数据格式' };
      }

      let currentHistory = merge ? await this.getHistory() : [];
      let imported = 0;
      let errors = 0;
      const existingTexts = new Set(currentHistory.map((item) => item.text));

      const settings = await this.getSettings();
      const maxItems = settings.maxItems || this.maxHistoryItems;

      for (const item of importedData) {
        try {
          if (!item.text || item.text.trim() === '') {
            errors++;
            continue;
          }

          const trimmedText = item.text.trim();

          // 检查是否已存在
          if (existingTexts.has(trimmedText)) {
            continue;
          }

          // 规范化导入的数据
          const normalizedItem = {
            id: item.id || this.generateId(),
            text: trimmedText,
            preview: item.preview || this.generatePreview(trimmedText),
            length: trimmedText.length,
            source: item.source || 'import',
            timestamp: item.timestamp || Date.now(),
            accessCount: item.accessCount || 1,
            lastAccessed: item.lastAccessed || Date.now(),
            tags: Array.isArray(item.tags) ? item.tags : this.generateTags(trimmedText),
            metadata: item.metadata || {},
          };

          currentHistory.push(normalizedItem);
          existingTexts.add(trimmedText);
          imported++;
        } catch (itemError) {
          console.error('导入单项失败:', itemError);
          errors++;
        }
      }

      // 限制历史记录数量
      if (currentHistory.length > maxItems) {
        currentHistory = currentHistory.slice(0, maxItems);
      }

      await this.saveHistory(currentHistory);

      return {
        success: true,
        imported,
        errors,
        total: currentHistory.length,
        message: `成功导入 ${imported} 条记录${errors > 0 ? `，${errors} 条失败` : ''}`,
      };
    } catch (error) {
      console.error('导入剪贴板历史失败:', error);
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
        topTags: this.getTopTags(history),
        accessFrequency: this.getAccessFrequency(history),
      };

      return stats;
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return null;
    }
  }

  // 私有方法

  /**
   * 生成预览文本
   */
  generatePreview(text, maxLength = 100) {
    if (!text) return '';
    const lines = text.split(/\r?\n/);
    let preview = lines[0] || '';
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    return preview;
  }

  /**
   * 生成标签
   */
  generateTags(text) {
    const tags = [];

    // 检测内容类型
    if (this.isUrl(text)) {
      tags.push('url');
    }
    if (this.isCode(text)) {
      tags.push('code');
    }
    if (this.hasChinese(text)) {
      tags.push('chinese');
    }
    if (this.hasEnglish(text)) {
      tags.push('english');
    }
    if (text.includes('\n')) {
      tags.push('multiline');
    }

    return tags;
  }

  /**
   * 检测是否为URL
   */
  isUrl(text) {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检测是否为代码
   */
  isCode(text) {
    const codePatterns = [
      /^(function|const|let|var|class|import|export)\s/m,
      /^(def|class|import|from)\s/m,
      /[{;}]\s*\n/,
      /\(\s*\)\s*=>/,
      /^(if|for|while|switch)\s*\(/m,
    ];
    return codePatterns.some((pattern) => pattern.test(text));
  }

  /**
   * 检测是否包含中文
   */
  hasChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  /**
   * 检测是否包含英文
   */
  hasEnglish(text) {
    return /[a-zA-Z]/.test(text);
  }

  /**
   * 保存历史记录
   */
  async saveHistory(history) {
    await chrome.storage.local.set({ [this.storageKey]: history });
  }

  /**
   * 读取文件内容
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
   * 转换为CSV格式
   */
  convertToCSV(history) {
    const headers = ['内容', '预览', '长度', '来源', '访问次数', '添加时间', '最后访问', '标签'];
    const rows = history.map((item) => [
      `"${(item.text || '').replace(/"/g, '""')}"`,
      `"${(item.preview || '').replace(/"/g, '""')}"`,
      item.length || 0,
      item.source || '',
      item.accessCount || 1,
      new Date(item.timestamp).toLocaleString('zh-CN'),
      new Date(item.lastAccessed).toLocaleString('zh-CN'),
      `"${(item.tags || []).join(';')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * 转换为文本格式
   */
  convertToText(history) {
    return history
      .map((item) => {
        return `内容: ${item.text}\n预览: ${item.preview}\n长度: ${item.length}\n来源: ${item.source}\n访问次数: ${item.accessCount}\n添加时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}\n最后访问: ${new Date(item.lastAccessed).toLocaleString('zh-CN')}\n标签: ${(item.tags || []).join(', ')}\n${'='.repeat(50)}\n`;
      })
      .join('\n');
  }

  /**
   * 解析CSV
   */
  parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const item = {};

      headers.forEach((header, index) => {
        let value = values[index] || '';
        value = value.replace(/^"|"$/g, '').replace(/""/g, '"');

        if (['timestamp', 'lastAccessed', 'accessCount', 'length'].includes(header)) {
          value = ['accessCount', 'length'].includes(header)
            ? parseInt(value) || 0
            : parseInt(value) || Date.now();
        } else if (header === 'tags') {
          value = value ? value.split(';').filter(Boolean) : [];
        }

        item[header] = value;
      });

      result.push(item);
    }

    return result;
  }

  /**
   * 解析CSV行
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * 获取热门标签
   */
  getTopTags(history) {
    const tagCount = {};
    history.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
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
      mostAccessed: history.sort((a, b) => (b.accessCount || 1) - (a.accessCount || 1)).slice(0, 5),
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
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// 导出单例实例
const clipboardHistoryManager = new ClipboardHistoryManager();
export default clipboardHistoryManager;
