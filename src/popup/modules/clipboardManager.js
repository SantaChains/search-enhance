// src/popup/modules/clipboardManager.js
// 剪贴板管理模块

import { 
    addToClipboardHistory, 
    getClipboardHistory, 
    clearClipboardHistory, 
    removeFromClipboardHistory, 
    removeMultipleFromClipboardHistory, 
    updateClipboardHistoryItem, 
    restoreClipboardHistoryItem 
} from '../../utils/storage.js';
import { copyToClipboard as copyTextToClipboard } from '../../utils/textProcessor.js';
import { copyToClipboard as copyToClipboardUtil } from '../../utils/clipboard.js';

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[ClipboardManager] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ClipboardManager] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[ClipboardManager] ${message}`, ...args)
};

class ClipboardManager {
    constructor() {
        this.clipboardMonitorInterval = null;
        this.clipboardDebounceTimer = null;
        this.elements = {};
    }

    /**
     * 初始化剪贴板管理器
     * @param {Object} elements - DOM元素映射
     * @param {Object} appState - 应用状态
     */
    init(elements, appState) {
        this.elements = elements;
        this.appState = appState;
    }

    /**
     * 检查剪贴板权限
     * @returns {Promise<boolean>} 是否有剪贴板权限
     */
    async checkClipboardPermission() {
        try {
            // 尝试读取剪贴板来检查权限
            const text = await navigator.clipboard.readText();
            return true;
        } catch (error) {
            logger.warn('剪贴板权限检查失败:', error);
            return false;
        }
    }

    /**
     * 请求剪贴板权限
     * @returns {Promise<boolean>} 是否获得权限
     */
    async requestClipboardPermission() {
        try {
            // 尝试读取剪贴板来触发权限请求
            const text = await navigator.clipboard.readText();
            return true;
        } catch (error) {
            logger.error('请求剪贴板权限失败:', error);
            return false;
        }
    }

    /**
     * 从剪贴板读取文本
     * @returns {Promise<string|null>} 剪贴板内容
     */
    async readFromClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                return text;
            }
            return null;
        } catch (error) {
            logger.error('读取剪贴板失败:', error);
            return null;
        }
    }

    /**
     * 切换剪贴板监控状态
     * @returns {Promise<void>}
     */
    async toggleClipboardMonitoring() {
        try {
            // 检查剪贴板权限
            const hasPermission = await this.checkClipboardPermission();
            if (!hasPermission && this.appState.clipboardMonitoring === false) {
                // 如果是从关闭状态切换到开启状态，且没有权限
                const permissionGranted = await this.requestClipboardPermission();
                if (!permissionGranted) {
                    this.showNotification('需要剪贴板权限才能开启监控', false);
                    return;
                }
            }

            this.appState.clipboardMonitoring = !this.appState.clipboardMonitoring;

            // 更新UI状态
            this.updateClipboardButtonState(this.appState.clipboardMonitoring);

            // 保存监控状态到storage
            await chrome.storage.local.set({
                clipboardMonitoring: this.appState.clipboardMonitoring
            });

            if (this.appState.clipboardMonitoring) {
                // 启动监控
                const success = await this.startClipboardMonitoring();
                if (success) {
                    this.showNotification('剪贴板监控已开启');
                } else {
                    this.appState.clipboardMonitoring = false;
                    this.updateClipboardButtonState(false);
                }
            } else {
                // 停止监控
                this.stopClipboardMonitoring();
                this.showNotification('剪贴板监控已关闭');
            }
        } catch (error) {
            logger.error('切换剪贴板监控状态失败:', error);
            this.showNotification('切换剪贴板监控状态失败：' + error.message, false);
        }
    }

    /**
     * 启动剪贴板监控
     * @returns {Promise<boolean>} 是否启动成功
     */
    async startClipboardMonitoring() {
        try {
            // 检查剪贴板权限
            const hasPermission = await this.checkClipboardPermission();
            if (!hasPermission) {
                logger.warn('没有剪贴板读取权限，尝试请求权限');
                
                // 尝试通过用户交互获取权限
                const text = await this.readFromClipboard();
                if (!text && text !== '') {
                    this.showNotification('需要剪贴板权限，请在弹出的权限请求中允许', false);
                    return false;
                }
            }

            if (this.clipboardMonitorInterval) {
                clearInterval(this.clipboardMonitorInterval);
            }

            // 立即检查一次
            await this.checkClipboard();

            // 设置定时检查 - 优化：调整为2000ms，减少性能消耗
            this.clipboardMonitorInterval = setInterval(async () => {
                if (this.appState.clipboardMonitoring) {
                    await this.checkClipboard();
                }
            }, 2000); // 每2000ms检查一次

            logger.info('剪贴板监控已启动');
            return true;
        } catch (error) {
            logger.error('启动剪贴板监控失败:', error);
            this.showNotification('启动剪贴板监控失败：' + error.message, false);
            return false;
        }
    }

    /**
     * 停止剪贴板监控
     */
    stopClipboardMonitoring() {
        if (this.clipboardMonitorInterval) {
            clearInterval(this.clipboardMonitorInterval);
            this.clipboardMonitorInterval = null;
        }

        if (this.clipboardDebounceTimer) {
            clearTimeout(this.clipboardDebounceTimer);
            this.clipboardDebounceTimer = null;
        }

        this.appState.lastClipboardContent = '';
        logger.info('剪贴板监控已停止');
    }

    /**
     * 检查剪贴板内容
     * @returns {Promise<void>}
     */
    async checkClipboard() {
        try {
            // 检查剪贴板权限
            const hasPermission = await this.checkClipboardPermission();
            if (!hasPermission) {
                logger.warn('没有剪贴板读取权限');
                return;
            }

            // 读取剪贴板内容
            const text = await this.readFromClipboard();

            if (!text || text === this.appState.lastClipboardContent) {
                return; // 内容未变化
            }

            this.appState.lastClipboardContent = text;

            // 防抖处理
            if (this.clipboardDebounceTimer) {
                clearTimeout(this.clipboardDebounceTimer);
            }

            this.clipboardDebounceTimer = setTimeout(async () => {
                try {
                    // 安全处理：检查内容长度
                    let processedText = text;
                    if (processedText.length > 10000) {
                        logger.warn('剪贴板内容过大，已截断处理');
                        processedText = processedText.substring(0, 10000);
                    }

                    // 保存到 storage
                    const timestamp = Date.now();
                    await chrome.storage.local.set({
                        lastClipboardContent: processedText,
                        clipboardHistoryUpdated: timestamp
                    });

                    // 添加到剪贴板历史
                    await addToClipboardHistory(processedText, 'clipboard-monitor');

                    // 更新UI
                    if (this.elements.search_input && this.appState.clipboardMonitoring) {
                        this.elements.search_input.value = processedText;
                        // 触发输入处理和高度调整
                        if (typeof handleTextareaInput === 'function') {
                            handleTextareaInput();
                        }
                        if (typeof updateSearchControlsPosition === 'function') {
                            updateSearchControlsPosition();
                        }
                    }

                    // 通知 content script（用于显示页面通知）
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, {
                                action: 'clipboardChanged',
                                content: processedText,
                                source: 'clipboard-monitor',
                                timestamp: timestamp
                            });
                        } catch (error) {
                            // content script 可能未加载，忽略错误
                            logger.debug('向content script发送消息失败:', error.message);
                        }
                    }

                    logger.info('检测到剪贴板内容变化');
                } catch (error) {
                    logger.error('处理剪贴板内容失败:', error);
                }
            }, 100); // 100ms防抖
        } catch (error) {
            logger.error('读取剪贴板失败:', error);
            
            // 如果是权限错误，停止监控
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                logger.warn('剪贴板权限被拒绝，停止监控');
                this.stopClipboardMonitoring();
                this.updateClipboardButtonState(false);
            }
        }
    }

    /**
     * 更新剪贴板按钮状态
     * @param {boolean} isActive - 是否激活
     */
    updateClipboardButtonState(isActive) {
        if (!this.elements.clipboard_btn) return;
        
        const statusIndicator = this.elements.clipboard_btn.querySelector('.clipboard-status');
        if (statusIndicator) {
            statusIndicator.classList.toggle('active', isActive);
        }
        
        // 更新开关状态
        const clipboardSwitch = document.querySelector('.clipboard-monitor-switch input[type="checkbox"]');
        if (clipboardSwitch) {
            clipboardSwitch.checked = isActive;
        }
    }

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {boolean} isSuccess - 是否成功消息
     */
    showNotification(message, isSuccess = true) {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.background = isSuccess ? '#10b981' : '#ef4444';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 从background script获取当前剪贴板监控状态
     * @returns {Promise<boolean>} 是否激活
     */
    async getClipboardMonitoringState() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'getClipboardMonitoringState' 
            });
            return response?.isActive || false;
        } catch (error) {
            logger.warn('获取剪贴板监控状态失败:', error);
            return false;
        }
    }

    /**
     * 初始化剪贴板监控状态
     * @returns {Promise<void>}
     */
    async initClipboardMonitoringState() {
        // 从background script获取当前监控状态
        const isMonitoring = await this.getClipboardMonitoringState();
        this.appState.clipboardMonitoring = isMonitoring;
        
        // 如果监控状态为开启，启动监控
        if (this.appState.clipboardMonitoring) {
            await this.startClipboardMonitoring();
        }
        
        this.updateClipboardButtonState(this.appState.clipboardMonitoring);
        
        // 更新开关状态
        if (this.elements.clipboard_monitor_switch) {
            this.elements.clipboard_monitor_switch.checked = this.appState.clipboardMonitoring;
        }
    }
}

// 导出单例
export default new ClipboardManager();
