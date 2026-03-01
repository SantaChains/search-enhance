/**
 * 链接历史管理模块
 * 负责记录、存储和管理处理过的链接历史
 */

class LinkHistoryManager {
  constructor() {
    this.storageKey = 'linkHistory';
    this.settingsKey = 'linkHistorySettings';
    this.maxHistoryItems = 1000;
    this.githubPattern = /^https?:\/\/(www\.)?github\.com\//i;
    // 支持的搜索引擎模式
    this.searchEngines = [
      {
        pattern: /^https?:\/\/www\.google\.com\/search\?.*q=([^&]+)/i,
        name: 'Google',
      },
      {
        pattern: /^https?:\/\/www\.bing\.com\/search\?.*q=([^&]+)/i,
        name: 'Bing',
      },
      {
        pattern: /^https?:\/\/duckduckgo\.com\/\?.*q=([^&]+)/i,
        name: 'DuckDuckGo',
      },
      {
        pattern: /^https?:\/\/search\.yahoo\.com\/search\?.*p=([^&]+)/i,
        name: 'Yahoo',
      },
      {
        pattern: /^https?:\/\/www\.baidu\.com\/s\?.*wd=([^&]+)/i,
        name: '百度',
      },
      {
        pattern: /^https?:\/\/www\.baidu\.com\/s\?.*word=([^&]+)/i,
        name: '百度',
      },
      { pattern: /^https?:\/\/www\.so\.com\/s\?.*q=([^&]+)/i, name: '360搜索' },
      {
        pattern: /^https?:\/\/www\.sogou\.com\/web\?.*query=([^&]+)/i,
        name: '搜狗',
      },
    ];
  }

  /**
   * 添加链接或搜索查询到历史记录
   * @param {string} url - 链接URL或搜索查询
   * @param {string} title - 链接标题（可选）
   * @param {string} source - 来源（如：'text_processing', 'clipboard', 'search'）
   * @param {Object} options - 额外选项
   * @param {string} options.searchQuery - 搜索查询词（如果是搜索URL）
   * @param {string} options.searchEngine - 搜索引擎名称
   */
  async addLink(url, title = '', source = 'unknown', options = {}) {
    try {
      // 检查是否是搜索查询（非URL但包含搜索词）
      if (options.searchQuery) {
        return await this.addSearchQuery(options.searchQuery, url, options.searchEngine, source);
      }

      // 检查是否是有效的URL
      if (!this.isValidUrl(url)) {
        // 如果不是URL，但作为纯搜索词记录
        if (source === 'search' || source === 'clipboard') {
          return await this.addSearchQuery(url, null, null, source);
        }
        return false;
      }

      // 检查是否是搜索引擎URL，提取搜索词
      const searchInfo = this.extractSearchQuery(url);
      if (searchInfo) {
        return await this.addSearchQuery(searchInfo.query, url, searchInfo.engine, source);
      }

      const history = await this.getHistory();
      const linkType = this.detectLinkType(url);
      // 保留原始URL中的非URL字符，不进行转义
      const displayUrl = url;

      // 检查是否已存在相同链接（使用原始URL进行比较）
      const existingIndex = history.findIndex(
        (item) => item.url === url || item.originalUrl === url
      );

      const historyItem = {
        id: this.generateId(),
        url: displayUrl, // 显示用的URL（保留原始字符）
        originalUrl: url, // 原始URL
        title: title || this.extractTitleFromUrl(url),
        type: linkType,
        source: source,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        tags: this.generateTags(url, linkType),
        metadata: this.extractMetadata(url),
        isSearch: false,
      };

      if (existingIndex !== -1) {
        // 更新现有记录
        history[existingIndex] = {
          ...history[existingIndex],
          accessCount: history[existingIndex].accessCount + 1,
          lastAccessed: Date.now(),
          title: title || history[existingIndex].title,
        };
      } else {
        // 添加新记录
        history.unshift(historyItem);

        // 限制历史记录数量
        if (history.length > this.maxHistoryItems) {
          history.splice(this.maxHistoryItems);
        }
      }

      await this.saveHistory(history);
      return true;
    } catch (error) {
      console.error('添加链接历史失败:', error);
      return false;
    }
  }

  /**
   * 添加搜索查询到历史记录
   * @param {string} query - 搜索查询词
   * @param {string} searchUrl - 搜索URL（可选）
   * @param {string} engine - 搜索引擎名称（可选）
   * @param {string} source - 来源
   */
  async addSearchQuery(query, searchUrl = null, engine = null, source = 'unknown') {
    try {
      if (!query || !query.trim()) {
        return false;
      }

      const history = await this.getHistory();
      const trimmedQuery = query.trim();

      // 检查是否已存在相同的搜索查询
      const existingIndex = history.findIndex(
        (item) => item.isSearch && item.searchQuery === trimmedQuery
      );

      const historyItem = {
        id: this.generateId(),
        url: searchUrl || `search://${encodeURIComponent(trimmedQuery)}`,
        originalUrl: searchUrl,
        title: trimmedQuery,
        searchQuery: trimmedQuery,
        searchEngine: engine || '未知',
        type: 'search',
        source: source,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        tags: ['search', engine || 'unknown'],
        metadata: {
          isSearch: true,
          query: trimmedQuery,
          engine: engine,
        },
        isSearch: true,
      };

      if (existingIndex !== -1) {
        // 更新现有记录
        history[existingIndex] = {
          ...history[existingIndex],
          accessCount: history[existingIndex].accessCount + 1,
          lastAccessed: Date.now(),
          searchUrl: searchUrl || history[existingIndex].searchUrl,
        };
      } else {
        // 添加新记录
        history.unshift(historyItem);

        // 限制历史记录数量
        if (history.length > this.maxHistoryItems) {
          history.splice(this.maxHistoryItems);
        }
      }

      await this.saveHistory(history);
      return true;
    } catch (error) {
      console.error('添加搜索查询失败:', error);
      return false;
    }
  }

  /**
   * 从URL提取搜索查询
   * @param {string} url - 搜索引擎URL
   * @returns {Object|null} { query, engine } 或 null
   */
  extractSearchQuery(url) {
    try {
      for (const engine of this.searchEngines) {
        const match = url.match(engine.pattern);
        if (match && match[1]) {
          return {
            query: decodeURIComponent(match[1].replace(/\+/g, ' ')),
            engine: engine.name,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('提取搜索查询失败:', error);
      return null;
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

      // 应用过滤器
      if (options.type) {
        history = history.filter((item) => item.type === options.type);
      }

      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        history = history.filter(
          (item) =>
            item.title.toLowerCase().includes(searchTerm) ||
            item.url.toLowerCase().includes(searchTerm) ||
            item.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
        );
      }

      if (options.dateRange) {
        const { start, end } = options.dateRange;
        history = history.filter((item) => item.timestamp >= start && item.timestamp <= end);
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
      console.error('获取历史记录失败:', error);
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
      console.error('删除历史记录失败:', error);
      return false;
    }
  }

  /**
   * 清空历史记录
   * @param {string} type - 可选，只清空特定类型的记录
   */
  async clearHistory(type = null) {
    try {
      if (type) {
        const history = await this.getHistory();
        const filteredHistory = history.filter((item) => item.type !== type);
        await this.saveHistory(filteredHistory);
      } else {
        await chrome.storage.local.remove(this.storageKey);
      }
      return true;
    } catch (error) {
      console.error('清空历史记录失败:', error);
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
        case 'json':
          content = JSON.stringify(history, null, 2);
          filename = `search-buddy-history-${this.formatDate(new Date())}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          content = this.convertToCSV(history);
          filename = `search-buddy-history-${this.formatDate(new Date())}.csv`;
          mimeType = 'text/csv';
          break;

        case 'txt':
          content = this.convertToText(history);
          filename = `search-buddy-history-${this.formatDate(new Date())}.txt`;
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

      return { success: true, count: history.length };
    } catch (error) {
      console.error('导出历史记录失败:', error);
      return { success: false, count: 0, error: error.message };
    }
  }

  /**
   * 导入历史记录
   * @param {string|Object} data - 导入的数据（JSON字符串或对象）
   * @param {Object} options - 导入选项
   * @param {boolean} options.merge - 是否合并到现有记录（默认true），false则覆盖
   * @returns {Object} { success: boolean, imported: number, errors: number }
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
          // 尝试解析CSV格式
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
        return {
          success: false,
          imported: 0,
          errors: 1,
          message: '无效的数据格式',
        };
      }

      let currentHistory = merge ? await this.getHistory() : [];
      let imported = 0;
      let errors = 0;
      const existingUrls = new Set(currentHistory.map((item) => item.url));
      const existingQueries = new Set(
        currentHistory.filter((item) => item.isSearch).map((item) => item.searchQuery)
      );

      for (const item of importedData) {
        try {
          // 验证必要字段
          if (!item.url && !item.searchQuery) {
            errors++;
            continue;
          }

          // 检查是否已存在
          if (item.isSearch && item.searchQuery) {
            if (existingQueries.has(item.searchQuery)) {
              continue; // 跳过重复
            }
          } else if (existingUrls.has(item.url)) {
            continue; // 跳过重复
          }

          // 规范化导入的数据
          const normalizedItem = {
            id: item.id || this.generateId(),
            url: item.url || item.originalUrl || '',
            originalUrl: item.originalUrl || item.url || '',
            title: item.title || '',
            searchQuery: item.searchQuery || null,
            searchEngine: item.searchEngine || null,
            type: item.type || 'other',
            source: item.source || 'import',
            timestamp: item.timestamp || Date.now(),
            accessCount: item.accessCount || 1,
            lastAccessed: item.lastAccessed || Date.now(),
            tags: Array.isArray(item.tags) ? item.tags : [],
            metadata: item.metadata || {},
            isSearch: item.isSearch || false,
          };

          currentHistory.push(normalizedItem);

          // 添加到已存在集合
          if (normalizedItem.isSearch) {
            existingQueries.add(normalizedItem.searchQuery);
          } else {
            existingUrls.add(normalizedItem.url);
          }

          imported++;
        } catch (itemError) {
          console.error('导入单项失败:', itemError);
          errors++;
        }
      }

      // 限制历史记录数量
      if (currentHistory.length > this.maxHistoryItems) {
        currentHistory = currentHistory.slice(0, this.maxHistoryItems);
      }

      // 保存到存储
      await this.saveHistory(currentHistory);

      return {
        success: true,
        imported,
        errors,
        total: currentHistory.length,
        message: `成功导入 ${imported} 条记录${errors > 0 ? `，${errors} 条失败` : ''}`,
      };
    } catch (error) {
      console.error('导入历史记录失败:', error);
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
      reader.onerror = (e) => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 解析CSV格式数据
   * @param {string} csv - CSV字符串
   * @returns {Array}
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
        // 去除引号
        value = value.replace(/^"|"$/g, '').replace(/""/g, '"');

        // 特殊字段处理
        if (['timestamp', 'lastAccessed', 'accessCount'].includes(header)) {
          value = header === 'accessCount' ? parseInt(value) || 1 : parseInt(value) || Date.now();
        } else if (header === 'tags') {
          value = value ? value.split(';').filter(Boolean) : [];
        } else if (header === 'metadata') {
          try {
            value = JSON.parse(value);
          } catch {
            value = {};
          }
        } else if (header === 'isSearch') {
          value = value === 'true' || value === '1';
        }

        item[header] = value;
      });

      result.push(item);
    }

    return result;
  }

  /**
   * 解析CSV行（处理引号内的逗号）
   * @param {string} line - CSV行
   * @returns {Array}
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
          i++; // 跳过下一个引号
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
   * 获取统计信息
   */
  async getStatistics() {
    try {
      const history = await this.getHistory();
      const searchHistory = history.filter((item) => item.isSearch);
      const linkHistory = history.filter((item) => !item.isSearch);

      const stats = {
        totalItems: history.length,
        totalLinks: linkHistory.length,
        totalSearches: searchHistory.length,
        githubLinks: linkHistory.filter((item) => item.type === 'github').length,
        otherLinks: linkHistory.filter((item) => item.type === 'other').length,
        todayItems: history.filter((item) => this.isToday(item.timestamp)).length,
        thisWeekItems: history.filter((item) => this.isThisWeek(item.timestamp)).length,
        thisMonthItems: history.filter((item) => this.isThisMonth(item.timestamp)).length,
        topDomains: this.getTopDomains(linkHistory),
        linksBySource: this.getLinksBySource(history),
        accessFrequency: this.getAccessFrequency(history),
        topSearchQueries: this.getTopSearchQueries(searchHistory),
        searchEngines: this.getSearchEngineStats(searchHistory),
      };

      return stats;
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return null;
    }
  }

  /**
   * 获取热门搜索查询
   * @param {Array} searchHistory - 搜索历史
   */
  getTopSearchQueries(searchHistory) {
    const queryCount = {};
    searchHistory.forEach((item) => {
      const query = item.searchQuery || item.title;
      queryCount[query] = (queryCount[query] || 0) + (item.accessCount || 1);
    });

    return Object.entries(queryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
  }

  /**
   * 获取搜索引擎使用统计
   * @param {Array} searchHistory - 搜索历史
   */
  getSearchEngineStats(searchHistory) {
    const engineCount = {};
    searchHistory.forEach((item) => {
      const engine = item.searchEngine || '未知';
      engineCount[engine] = (engineCount[engine] || 0) + 1;
    });

    return Object.entries(engineCount)
      .sort(([, a], [, b]) => b - a)
      .map(([engine, count]) => ({ engine, count }));
  }

  // 私有方法

  /**
   * 检测链接类型
   */
  detectLinkType(url) {
    if (this.githubPattern.test(url)) {
      return 'github';
    }
    return 'other';
  }

  /**
   * 验证URL格式
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 解码转义的URL
   * @param {string} url - 转义的URL
   * @returns {string} 未转义的URL
   */
  unescapeUrl(url) {
    try {
      return decodeURIComponent(url);
    } catch {
      // 如果解码失败，返回原始URL
      return url;
    }
  }

  /**
   * 从URL提取标题
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);

      if (this.githubPattern.test(url)) {
        const pathParts = urlObj.pathname.split('/').filter((part) => part);
        if (pathParts.length >= 2) {
          return `${pathParts[0]}/${pathParts[1]}`;
        }
      }

      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * 生成标签
   */
  generateTags(url, type) {
    const tags = [type];

    try {
      const urlObj = new URL(url);
      tags.push(urlObj.hostname);

      if (type === 'github') {
        const pathParts = urlObj.pathname.split('/').filter((part) => part);
        if (pathParts.length >= 1) {
          tags.push(`user:${pathParts[0]}`);
        }
        if (pathParts.length >= 2) {
          tags.push(`repo:${pathParts[1]}`);
        }
        if (pathParts.includes('issues')) {
          tags.push('issues');
        }
        if (pathParts.includes('pull')) {
          tags.push('pull-request');
        }
      }
    } catch {
      // 忽略错误
    }

    return tags;
  }

  /**
   * 提取元数据
   */
  extractMetadata(url) {
    const metadata = {};

    try {
      const urlObj = new URL(url);
      metadata.domain = urlObj.hostname;
      metadata.protocol = urlObj.protocol;
      metadata.pathname = urlObj.pathname;

      if (this.githubPattern.test(url)) {
        const pathParts = urlObj.pathname.split('/').filter((part) => part);
        if (pathParts.length >= 2) {
          metadata.githubUser = pathParts[0];
          metadata.githubRepo = pathParts[1];
        }
      }
    } catch {
      // 忽略错误
    }

    return metadata;
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

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
    const headers = [
      '标题',
      'URL',
      '搜索查询',
      '搜索引擎',
      '类型',
      '来源',
      '访问次数',
      '添加时间',
      '最后访问',
      '是否搜索',
    ];
    const rows = history.map((item) => [
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${item.url || ''}"`,
      `"${(item.searchQuery || '').replace(/"/g, '""')}"`,
      item.searchEngine || '',
      item.type,
      item.source,
      item.accessCount,
      new Date(item.timestamp).toLocaleString('zh-CN'),
      new Date(item.lastAccessed).toLocaleString('zh-CN'),
      item.isSearch ? 'true' : 'false',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * 转换为文本格式
   */
  convertToText(history) {
    return history
      .map((item) => {
        const isSearch = item.isSearch;
        const typeLabel = isSearch ? '【搜索】' : '【链接】';
        const searchInfo = isSearch
          ? `搜索查询: ${item.searchQuery || item.title}\n搜索引擎: ${item.searchEngine || '未知'}\n`
          : '';

        return `${typeLabel} ${item.title}\n${searchInfo}URL: ${item.url}\n类型: ${item.type}\n来源: ${item.source}\n访问次数: ${item.accessCount}\n添加时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}\n最后访问: ${new Date(item.lastAccessed).toLocaleString('zh-CN')}\n${'='.repeat(50)}\n`;
      })
      .join('\n');
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
   * 获取热门域名
   */
  getTopDomains(history) {
    const domainCount = {};
    history.forEach((item) => {
      const domain = item.metadata.domain || 'unknown';
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    });

    return Object.entries(domainCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));
  }

  /**
   * 按来源分组
   */
  getLinksBySource(history) {
    const sourceCount = {};
    history.forEach((item) => {
      sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
    });
    return sourceCount;
  }

  /**
   * 获取访问频率
   */
  getAccessFrequency(history) {
    const totalAccess = history.reduce((sum, item) => sum + item.accessCount, 0);
    const avgAccess = totalAccess / history.length || 0;

    return {
      totalAccess,
      averageAccess: Math.round(avgAccess * 100) / 100,
      mostAccessed: history.sort((a, b) => b.accessCount - a.accessCount).slice(0, 5),
    };
  }

  /**
   * 获取链接历史设置
   * @returns {Object} 设置对象 { enabled, maxItems }
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get(this.settingsKey);
      return {
        enabled: true,
        maxItems: 100,
        ...result[this.settingsKey],
      };
    } catch (error) {
      console.error('获取链接历史设置失败:', error);
      return { enabled: true, maxItems: 100 };
    }
  }

  /**
   * 保存链接历史设置
   * @param {Object} settings - 设置对象
   * @returns {boolean} 是否保存成功
   */
  async saveSettings(settings) {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await chrome.storage.local.set({ [this.settingsKey]: newSettings });
      if (settings.maxItems) {
        this.maxHistoryItems = settings.maxItems;
      }
      return true;
    } catch (error) {
      console.error('保存链接历史设置失败:', error);
      return false;
    }
  }
}

// 导出单例实例
const linkHistoryManager = new LinkHistoryManager();
export default linkHistoryManager;
