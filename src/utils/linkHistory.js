/**
 * 链接历史管理模块
 * 负责记录、存储和管理处理过的链接历史
 * 提供链接分类、搜索、统计和导出功能
 */

/**
 * 链接历史管理器类
 * 实现了完整的链接历史管理功能，包括添加、查询、删除、统计和导出
 */
class LinkHistoryManager {
  /**
   * 构造函数
   * 初始化链接历史管理器的配置
   */
  constructor() {
    this.storageKey = 'linkHistory'; // 存储键名
    this.maxHistoryItems = 1000; // 最大历史记录数量
    this.githubPattern = /^https?:\/\/(www\.)?github\.com\//i; // GitHub链接匹配正则
  }

  /**
   * 添加链接到历史记录
   * @param {string} url - 链接URL
   * @param {string} title - 链接标题（可选）
   * @param {string} source - 来源（如：'text_processing', 'clipboard', 'direct_navigation'）
   */
  async addLink(url, title = '', source = 'unknown') {
    try {
      // 处理转义链接，确保存储未转义的版本
      const unescapedUrl = this.unescapeUrl(url);
      
      if (!this.isValidUrl(unescapedUrl)) {
        return false;
      }

      const history = await this.getHistory();
      const linkType = this.detectLinkType(unescapedUrl);
      
      // 检查是否已存在相同链接（使用未转义的URL进行比较）
      const existingIndex = history.findIndex(item => item.url === unescapedUrl);
      
      const historyItem = {
        id: this.generateId(),
        url: unescapedUrl, // 存储未转义的URL
        originalUrl: url, // 保存原始URL（如果有转义）
        title: title || this.extractTitleFromUrl(unescapedUrl),
        type: linkType,
        source: source,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        tags: this.generateTags(unescapedUrl, linkType),
        metadata: this.extractMetadata(unescapedUrl)
      };

      if (existingIndex !== -1) {
        // 更新现有记录
        history[existingIndex] = {
          ...history[existingIndex],
          accessCount: history[existingIndex].accessCount + 1,
          lastAccessed: Date.now(),
          title: title || history[existingIndex].title,
          source: source
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
   * 处理转义链接，返回未转义的URL
   * @param {string} url - 可能包含转义的URL
   * @returns {string} 未转义的URL
   */
  unescapeUrl(url) {
    try {
      // 处理常见的URL转义字符
      return decodeURIComponent(url.replace(/\+/g, ' '));
    } catch {
      // 如果解码失败，返回原始URL
      return url;
    }
  }

  /**
   * 记录直接导航的链接
   * @param {string} url - 导航的URL
   */
  async recordDirectNavigation(url) {
    return this.addLink(url, '', 'direct_navigation');
  }

  /**
   * 记录链接分析处理的链接
   * @param {string} url - 分析的URL
   */
  async recordLinkAnalysis(url) {
    return this.addLink(url, '', 'link_analysis');
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
        history = history.filter(item => item.type === options.type);
      }

      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        history = history.filter(item => 
          item.title.toLowerCase().includes(searchTerm) ||
          item.url.toLowerCase().includes(searchTerm) ||
          item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      if (options.dateRange) {
        const { start, end } = options.dateRange;
        history = history.filter(item => 
          item.timestamp >= start && item.timestamp <= end
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
      const filteredHistory = history.filter(item => item.id !== id);
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
        const filteredHistory = history.filter(item => item.type !== type);
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

      return true;
    } catch (error) {
      console.error('导出历史记录失败:', error);
      return false;
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    try {
      const history = await this.getHistory();
      
      const stats = {
        totalLinks: history.length,
        githubLinks: history.filter(item => item.type === 'github').length,
        otherLinks: history.filter(item => item.type === 'other').length,
        todayLinks: history.filter(item => this.isToday(item.timestamp)).length,
        thisWeekLinks: history.filter(item => this.isThisWeek(item.timestamp)).length,
        thisMonthLinks: history.filter(item => this.isThisMonth(item.timestamp)).length,
        topDomains: this.getTopDomains(history),
        linksBySource: this.getLinksBySource(history),
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
   * 从URL提取标题
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      
      if (this.githubPattern.test(url)) {
        const pathParts = urlObj.pathname.split('/').filter(part => part);
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
        const pathParts = urlObj.pathname.split('/').filter(part => part);
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
        const pathParts = urlObj.pathname.split('/').filter(part => part);
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
    const headers = ['标题', 'URL', '类型', '来源', '访问次数', '添加时间', '最后访问'];
    const rows = history.map(item => [
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.url}"`,
      item.type,
      item.source,
      item.accessCount,
      new Date(item.timestamp).toLocaleString('zh-CN'),
      new Date(item.lastAccessed).toLocaleString('zh-CN')
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * 转换为文本格式
   */
  convertToText(history) {
    return history.map(item => {
      return `标题: ${item.title}\nURL: ${item.url}\n类型: ${item.type}\n来源: ${item.source}\n访问次数: ${item.accessCount}\n添加时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}\n最后访问: ${new Date(item.lastAccessed).toLocaleString('zh-CN')}\n${'='.repeat(50)}\n`;
    }).join('\n');
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
    history.forEach(item => {
      const domain = item.metadata.domain || 'unknown';
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    });
    
    return Object.entries(domainCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));
  }

  /**
   * 按来源分组
   */
  getLinksBySource(history) {
    const sourceCount = {};
    history.forEach(item => {
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
      mostAccessed: history.sort((a, b) => b.accessCount - a.accessCount).slice(0, 5)
    };
  }
}

// 导出单例实例
const linkHistoryManager = new LinkHistoryManager();
export default linkHistoryManager;