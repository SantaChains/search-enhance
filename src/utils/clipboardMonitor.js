/**
 * 剪贴板监控器 - 优化版
 * 功能: 高效监控剪贴板变化，减少存储写入
 * 入参: 无
 * 出参: ClipboardMonitor 实例
 */

import { stateManager } from './stateManager.js';

class ClipboardMonitor {
  constructor() {
    this.config = {
      pollInterval: 1000, // 轮询间隔
      maxContentLength: 100000, // 最大内容长度
      storageDebounceMs: 2000 // 存储防抖时间
    };
    this.state = {
      isMonitoring: false,
      lastContent: '',
      lastVersion: '',
      pollTimer: null,
      permissionDenied: false,
      storageTimer: null
    };
  }

  /**
   * 启动监控
   * 入参: 无
   * 出参: boolean - 是否启动成功
   */
  async start() {
    if (this.state.isMonitoring) return true;

    // 检查权限
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      this.state.permissionDenied = true;
      return false;
    }

    this.state.isMonitoring = true;
    this.state.permissionDenied = false;

    // 立即检查一次
    await this.checkClipboard();

    // 启动轮询
    this.state.pollTimer = setInterval(() => {
      this.checkClipboard();
    }, this.config.pollInterval);

    return true;
  }

  /**
   * 停止监控
   */
  stop() {
    this.state.isMonitoring = false;
    if (this.state.pollTimer) {
      clearInterval(this.state.pollTimer);
      this.state.pollTimer = null;
    }
    if (this.state.storageTimer) {
      clearTimeout(this.state.storageTimer);
      this.state.storageTimer = null;
    }
  }

  /**
   * 检查剪贴板权限
   */
  async checkPermission() {
    try {
      await navigator.clipboard.readText();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查剪贴板内容
   */
  async checkClipboard() {
    if (!this.state.isMonitoring) return;

    try {
      const text = await navigator.clipboard.readText();

      // 基本过滤
      if (!text || text.trim().length === 0) return;
      if (text.length > this.config.maxContentLength) return;

      // 与上次内容比较
      if (text === this.state.lastContent) return;

      // 更新状态
      const version = this.generateVersion();
      this.state.lastContent = text;
      this.state.lastVersion = version;

      // 防抖写入 storage
      this.debouncedSave(text, version);

      // 触发回调
      this.onContentChange?.(text, version);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        this.state.permissionDenied = true;
        this.stop();
        this.onPermissionDenied?.();
      }
    }
  }

  /**
   * 防抖保存到 storage
   */
  debouncedSave(content, version) {
    if (this.state.storageTimer) {
      clearTimeout(this.state.storageTimer);
    }

    this.state.storageTimer = setTimeout(async () => {
      await stateManager.setState({
        lastContent: content,
        lastVersion: version
      });
    }, this.config.storageDebounceMs);
  }

  /**
   * 生成版本号
   */
  generateVersion() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * 获取当前内容
   */
  getContent() {
    return {
      content: this.state.lastContent,
      version: this.state.lastVersion
    };
  }

  /**
   * 设置内容变化回调
   */
  onChange(callback) {
    this.onContentChange = callback;
    return this;
  }

  /**
   * 设置权限拒绝回调
   */
  onDenied(callback) {
    this.onPermissionDenied = callback;
    return this;
  }
}

export const clipboardMonitor = new ClipboardMonitor();
