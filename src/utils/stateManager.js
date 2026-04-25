/**
 * 全局状态管理器 - 单一数据源
 * 功能: 统一管理剪贴板监控状态，避免多组件状态不一致
 * 入参: 无
 * 出参: StateManager 实例
 */

class StateManager {
  constructor() {
    this.state = {
      isMonitoring: false,
      lastContent: '',
      lastVersion: '',
      permissionDenied: false
    };
    this.listeners = new Set();
    this.storageKey = 'globalMonitoringState';
  }

  /**
   * 初始化状态
   */
  async init() {
    const result = await chrome.storage.local.get(this.storageKey);
    if (result[this.storageKey]) {
      this.state = { ...this.state, ...result[this.storageKey] };
    }
    return this.state;
  }

  /**
   * 获取状态
   */
  getState() {
    return { ...this.state };
  }

  /**
   * 设置状态
   */
  async setState(newState) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };

    // 持久化到 storage
    await chrome.storage.local.set({
      [this.storageKey]: this.state
    });

    // 通知所有监听器
    this.listeners.forEach((callback) => {
      try {
        callback(this.state, oldState);
      } catch (e) {
        console.error('状态监听回调失败:', e);
      }
    });

    return this.state;
  }

  /**
   * 订阅状态变化
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 切换监控状态
   */
  async toggle() {
    const newState = !this.state.isMonitoring;
    await this.setState({
      isMonitoring: newState,
      permissionDenied: newState ? false : this.state.permissionDenied
    });
    return newState;
  }
}

export const stateManager = new StateManager();
