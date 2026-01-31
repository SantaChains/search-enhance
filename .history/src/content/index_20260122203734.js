// src/content/index.js - 增强版内容脚本

/**
 * Enhanced Content Script for Search Buddy
 * Handles page-level interactions and communication with popup
 */

// 导入剪贴板工具
import { checkClipboardPermission as checkClipboardPermissionUtil, readFromClipboard } from '../utils/clipboard.js';

// 导入日志工具
import { logger } from '../utils/logger.js';

/**
 * 剪贴板监控模块
 * 统一管理剪贴板监控功能
 * 支持历史记录和快速更新
 */
class ClipboardMonitor {
    constructor() {
        // 核心状态
        this.isMonitoring = false;
        this.lastContent = '';
        this.intervalId = null;
        this.tabId = null;
        this.monitoringType = null; // 监控类型：shortcut或ui
        this.isCheckingClipboard = false; // 标记是否正在检查剪贴板，避免并发调用
        this.isSkipPolling = false; // 标记是否跳过此次轮询
        this.clipboardDebounceTimer = null; // 剪贴板内容处理的防抖定时器
        this.permissionCache = null; // 权限缓存，减少权限请求频率
        
        // 智能轮询配置
        this.pollingConfig = {
            baseInterval: 500, // 基础轮询间隔（毫秒）
            minInterval: 300, // 最小轮询间隔（毫秒）
            maxInterval: 2000, // 最大轮询间隔（毫秒）
            currentInterval: 500,
            noChangeCount: 0,
            totalNoChangeCount: 0, // 总无变化计数，用于更智能的轮询调整
            adjustThreshold: 5 // 调整间隔的阈值
        };
        
        // 错误处理配置
        this.errorConfig = {
            retryCount: 0,
            maxRetries: 3 // 最大重试次数
        };
        
        // 多标签页同步配置
        this.syncConfig = {
            activeTabKey: 'activeClipboardMonitorTabId', // storage中存储活跃标签页ID的键
            lastSyncTime: Date.now()
        };
        
        // 历史记录配置
        this.historyConfig = {
            lastUpdateTime: Date.now(),
            batchUpdateThreshold: 1000 // 批量更新阈值（毫秒）
        };
        
        // 初始化
        this.init();
    }

    /**
     * 统一初始化方法
     */
    async init() {
        try {
            await this.initTabId();
            this.setupEventListeners();
            await this.initializeMonitoringState();
            logger.info('剪贴板监控模块初始化完成');
        } catch (error) {
            logger.error('初始化剪贴板监控模块失败:', error);
        }
    }

    /**
     * 初始化标签页ID
     */
    async initTabId() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                this.tabId = tab.id;
                logger.info('标签页ID初始化成功:', this.tabId);
            }
        } catch (error) {
            logger.error('初始化标签页ID失败:', error);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听storage变化，实现多标签页同步
        chrome.storage.local.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                this.handleStorageChanges(changes);
            }
        });

        // 监听标签页卸载，清理资源
        window.addEventListener('beforeunload', async () => {
            await this.handleTabUnload();
        });
    }

    /**
     * 初始化监控状态
     */
    async initializeMonitoringState() {
        try {
            const { clipboardMonitoring } = await chrome.storage.local.get('clipboardMonitoring');
            
            // 初始化监控状态：默认关闭
            this.isMonitoring = clipboardMonitoring || false;
            
            if (this.isMonitoring) {
                await this.startMonitoring();
            }
        } catch (error) {
            logger.error('初始化剪贴板监控状态失败:', error);
        }
    }

    /**
     * 处理storage变化
     * @param {Object} changes - storage变化对象
     */
    handleStorageChanges(changes) {
        // 监听活跃标签页变化
        if (changes[this.syncConfig.activeTabKey]) {
            const newActiveTabId = changes[this.syncConfig.activeTabKey].newValue;
            logger.info('活跃标签页变化:', newActiveTabId);
            
            // 如果新的活跃标签页不是当前标签页，且当前标签页正在进行全局监控，则停止监控
            if (newActiveTabId !== this.tabId && this.isMonitoring && this.monitoringType === 'shortcut') {
                logger.info('当前标签页不再是活跃全局监控标签页，停止监控');
                this.stopMonitoring();
                this.isMonitoring = false;
                this.monitoringType = null;
                // 更新存储中的监控状态
                chrome.storage.local.set({ clipboardMonitoring: false });
            }
        }
        
        // 监听剪贴板监控状态变化
        if (changes.clipboardMonitoring) {
            const newState = changes.clipboardMonitoring.newValue;
            logger.info('剪贴板监控状态变化:', newState);
            
            // 如果状态变化为关闭，且当前标签页正在监控，则停止监控
            if (!newState && this.isMonitoring) {
                logger.info('收到关闭监控指令，停止监控');
                this.stopMonitoring();
                this.isMonitoring = false;
                this.monitoringType = null;
            }
        }
    }

    /**
     * 处理标签页卸载
     */
    async handleTabUnload() {
        // 如果当前标签页是活跃的全局监控标签页，清除活跃标签页标记
        if (this.isMonitoring && this.monitoringType === 'shortcut') {
            try {
                const { [this.syncConfig.activeTabKey]: activeTabId } = await chrome.storage.local.get(this.syncConfig.activeTabKey);
                if (activeTabId === this.tabId) {
                    await chrome.storage.local.remove(this.syncConfig.activeTabKey);
                    logger.info('标签页卸载，清除活跃监控标签页标记');
                }
            } catch (error) {
                logger.error('清除活跃监控标签页标记失败:', error);
            }
        }
        
        // 清理所有资源
        await this.cleanupResources();
    }

    /**
     * 更新活跃监控标签页
     */
    async updateActiveTab() {
        try {
            await chrome.storage.local.set({ [this.syncConfig.activeTabKey]: this.tabId });
            logger.info('更新活跃监控标签页:', this.tabId);
        } catch (error) {
            logger.error('更新活跃监控标签页失败:', error);
        }
    }

    /**
     * 切换剪贴板监控状态
     * @param {string} type - 监控类型：shortcut或ui
     */
    async toggleMonitoring(type = 'ui') {
        this.isMonitoring = !this.isMonitoring;
        this.monitoringType = this.isMonitoring ? type : null;
        
        try {
            await this.saveMonitoringState();
            
            if (this.isMonitoring) {
                const hasPermission = await this.checkClipboardPermission();
                if (hasPermission) {
                    await this.startMonitoring();
                    showPageNotification('剪贴板监控已启动', 'success');
                } else {
                    await this.handlePermissionError();
                }
            } else {
                await this.stopMonitoring();
                showPageNotification('剪贴板监控已停止', 'info');
            }
        } catch (error) {
            logger.error('切换剪贴板监控状态失败:', error);
        }
    }

    /**
     * 更新剪贴板监控状态
     * @param {boolean} enabled - 是否启用监控
     * @param {string} type - 监控类型：shortcut或ui
     */
    async updateMonitoring(enabled, type = 'ui') {
        try {
            if (enabled) {
                const hasPermission = await this.checkClipboardPermission();
                if (hasPermission) {
                    this.isMonitoring = true;
                    this.monitoringType = type;
                    await this.startMonitoring();
                } else {
                    this.isMonitoring = false;
                    this.monitoringType = null;
                    enabled = false;
                    logger.warn('无法更新剪贴板监控状态：缺少剪贴板权限');
                }
            } else {
                this.isMonitoring = false;
                this.monitoringType = null;
                await this.stopMonitoring();
            }
            
            await this.saveMonitoringState();
        } catch (error) {
            logger.error('更新剪贴板监控状态失败:', error);
        }
    }

    /**
     * 保存监控状态到storage
     */
    async saveMonitoringState() {
        try {
            await chrome.storage.local.set({
                clipboardMonitoring: this.isMonitoring
            });
            logger.info('监控状态保存成功:', { isMonitoring: this.isMonitoring });
        } catch (error) {
            logger.error('保存监控状态失败:', error);
            throw error;
        }
    }

    /**
     * 处理权限错误
     */
    async handlePermissionError() {
        this.isMonitoring = false;
        this.monitoringType = null;
        
        // 显示详细的权限错误提示
        showPageNotification(
            '无法启动剪贴板监控：缺少剪贴板权限。请在浏览器设置中允许扩展访问剪贴板。',
            'error',
            5000 // 延长显示时间
        );
        
        await chrome.storage.local.set({ clipboardMonitoring: false });
    }

    /**
     * 启动剪贴板监控
     */
    async startMonitoring() {
        if (this.intervalId) {
            await this.stopMonitoring();
        }
        
        this.intervalId = setInterval(async () => {
            if (!this.isMonitoring) return;
            await this.checkClipboard();
        }, this.pollingConfig.currentInterval);
        
        // 更新活跃标签页
        await this.updateActiveTab();
        
        logger.info('剪贴板监控已启动，轮询间隔:', this.pollingConfig.currentInterval, 'ms');
    }

    /**
     * 停止剪贴板监控
     */
    async stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            
            // 重置轮询间隔
            this.pollingConfig.currentInterval = this.pollingConfig.baseInterval;
            this.pollingConfig.noChangeCount = 0;
            this.pollingConfig.totalNoChangeCount = 0;
            
            // 如果是全局监控且当前标签页是活跃监控标签页，清除活跃标签页标记
            if (this.monitoringType === 'shortcut') {
                try {
                    const { [this.syncConfig.activeTabKey]: activeTabId } = await chrome.storage.local.get(this.syncConfig.activeTabKey);
                    if (activeTabId === this.tabId) {
                        await chrome.storage.local.remove(this.syncConfig.activeTabKey);
                        logger.info('清除活跃监控标签页标记');
                    }
                } catch (error) {
                    logger.error('清除活跃监控标签页标记失败:', error);
                }
            }
            
            // 清理资源
            await this.cleanupResources();
            
            logger.info('剪贴板监控已停止');
        }
    }
    
    /**
     * 清理资源，优化内存使用
     */
    async cleanupResources() {
        // 停止轮询
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // 清除防抖定时器
        if (this.clipboardDebounceTimer) {
            clearTimeout(this.clipboardDebounceTimer);
            this.clipboardDebounceTimer = null;
        }
        
        // 重置状态
        this.isCheckingClipboard = false;
        this.isSkipPolling = false;
        
        // 清除不必要的缓存
        if (Date.now() - this.permissionCache?.timestamp > 600000) { // 10分钟后清除权限缓存
            this.permissionCache = null;
        }
        
        logger.info('资源清理完成');
    }

    /**
     * 智能调整轮询间隔
     * @param {boolean} hasChange - 剪贴板内容是否有变化
     */
    async adjustPollingInterval(hasChange) {
        const oldInterval = this.pollingConfig.currentInterval;
        
        if (hasChange) {
            this.pollingConfig.currentInterval = Math.max(
                this.pollingConfig.minInterval,
                this.pollingConfig.currentInterval - 50
            );
            this.pollingConfig.noChangeCount = 0;
            this.pollingConfig.totalNoChangeCount = 0;
        } else {
            this.pollingConfig.noChangeCount++;
            this.pollingConfig.totalNoChangeCount++;
            
            if (this.pollingConfig.noChangeCount >= this.pollingConfig.adjustThreshold) {
                const increment = this.pollingConfig.currentInterval < 1000 ? 100 : 200;
                this.pollingConfig.currentInterval = Math.min(
                    this.pollingConfig.maxInterval,
                    this.pollingConfig.currentInterval + increment
                );
                this.pollingConfig.noChangeCount = 0;
            }
        }
        
        // 只有间隔发生变化且监控仍在运行时，才重启定时器
        if (this.pollingConfig.currentInterval !== oldInterval && this.intervalId && this.isMonitoring) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                if (!this.isMonitoring) return;
                await this.checkClipboard();
            }, this.pollingConfig.currentInterval);
        }
    }

    /**
     * 检查剪贴板权限
     * @returns {Promise<boolean>} 是否有权限读取剪贴板
     */
    async checkClipboardPermission() {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const permission = await navigator.permissions.query({ name: 'clipboard-read' });
                    if (permission.state === 'granted') {
                        return true;
                    }
                    if (permission.state === 'denied') {
                        logger.warn('剪贴板权限被拒绝');
                        return false;
                    }
                } catch (permError) {
                    logger.warn('权限查询失败，尝试直接读取:', permError.message);
                }
            }

            const canRead = await this.testClipboardAccess();
            return canRead;
        } catch (error) {
            logger.warn('剪贴板权限检查失败:', error.message);
            return false;
        }
    }

    /**
     * 测试剪贴板访问能力
     * @returns {Promise<boolean}} 是否可以访问剪贴板
     */
    async testClipboardAccess() {
        try {
            if (!navigator.clipboard || !navigator.clipboard.readText) {
                logger.warn('浏览器不支持 Clipboard API');
                return false;
            }

            await navigator.clipboard.readText();
            return true;
        } catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                logger.warn('剪贴板权限被拒绝，需要用户授权');
                return false;
            }
            if (error.name === 'SecurityError' || error.message.includes('security')) {
                logger.warn('剪贴板访问因安全策略被阻止（非HTTPS或无用户手势）');
                return false;
            }
            logger.warn('剪贴板访问测试失败:', error.message);
            return false;
        }
    }

    /**
     * 检查剪贴板内容变化
     */
    async checkClipboard() {
        try {
            // 检查是否需要跳过此次轮询
            if (this.isSkipPolling) {
                return;
            }
            
            // 标记当前正在检查剪贴板，避免并发调用
            this.isCheckingClipboard = true;
            
            const text = await readFromClipboard();
            this.errorConfig.retryCount = 0; // 重置重试计数
            
            let hasChange = false;
            if (text && text !== this.lastContent && text.trim().length > 0) {
                this.lastContent = text;
                
                // 使用防抖机制，避免短时间内多次处理相同内容
                if (this.clipboardDebounceTimer) {
                    clearTimeout(this.clipboardDebounceTimer);
                }
                
                this.clipboardDebounceTimer = setTimeout(async () => {
                    await this.handleNewClipboardContent(text);
                }, 100); // 100ms防抖
                
                hasChange = true;
            }
            
            // 智能调整轮询间隔
            await this.adjustPollingInterval(hasChange);
        } catch (error) {
            this.errorConfig.retryCount++;
            await this.handleClipboardError(error);
        } finally {
            // 重置检查状态
            this.isCheckingClipboard = false;
        }
    }

    /**
     * 处理剪贴板错误
     * @param {Error} error - 错误对象
     */
    async handleClipboardError(error) {
        // 区分错误类型，进行不同处理
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            logger.error('剪贴板权限被拒绝:', error.message);
            showPageNotification('剪贴板权限被拒绝，请检查浏览器设置', 'error');
            await this.stopMonitoring(); // 权限问题，直接停止监控
            return;
        } else if (error.name === 'NotReadableError' || error.name === 'TypeError') {
            logger.warn(`读取剪贴板内容失败 (${this.errorConfig.retryCount}/${this.errorConfig.maxRetries}):`, error.message);
        } else {
            logger.error(`剪贴板监控异常 (${this.errorConfig.retryCount}/${this.errorConfig.maxRetries}):`, error.message);
        }
        
        // 如果重试次数超过上限，暂停监控并通知用户
        if (this.errorConfig.retryCount >= this.errorConfig.maxRetries) {
            logger.error('读取剪贴板失败次数过多，暂停监控');
            showPageNotification('剪贴板监控遇到问题，已自动暂停', 'error');
            await this.stopMonitoring();
        }
    }

    /**
     * 处理新的剪贴板内容
     * @param {string} content - 新的剪贴板内容
     */
    async handleNewClipboardContent(content) {
        try {
            // 安全处理：检查内容长度，避免过大的剪贴板内容
            if (content.length > 10000) { // 限制10KB
                logger.warn('剪贴板内容过大，已截断处理');
                content = content.substring(0, 10000) + '...';
            }
            
            // 安全处理：敏感内容检测和过滤
            const sanitizedContent = this.sanitizeClipboardContent(content);
            
            // 保存剪贴板内容到storage
            const timestamp = Date.now();
            await chrome.storage.local.set({
                lastClipboardContent: sanitizedContent,
                clipboardHistoryUpdated: timestamp
            });
            
            // 发送消息通知popup立即更新，并包含处理后的内容
            chrome.runtime.sendMessage({
                action: 'clipboardChanged',
                content: sanitizedContent,
                source: 'clipboard-monitor',
                timestamp: timestamp
            });
            
            // 显示通知
            showPageNotification('检测到剪贴板内容变化', 'info');
        } catch (error) {
            logger.error('处理剪贴板内容失败:', error);
        }
    }
    
    /**
     * 清理剪贴板内容，保护用户隐私
     * @param {string} content - 原始剪贴板内容
     * @returns {string} 清理后的剪贴板内容
     */
    sanitizeClipboardContent(content) {
        // 移除可能的敏感信息正则
        const sensitivePatterns = [
            /(\b(?:password|passwd|pwd|secret|token|api[_\-]?key|auth[_\-]?token|access[_\-]?token)\b[\s:\-=]*[\w\d]{8,})/gi,
            /(\b(?:credit[_\-]?card|cc|visa|mastercard|amex)\b[\s:\-=]*\d{4}[\s\-]*\d{4}[\s\-]*\d{4}[\s\-]*\d{4})/gi,
            /(\b(?:email|mail|e[_\-]?mail)\b[\s:\-=]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /(\b(?:phone|tel|mobile|cell)\b[\s:\-=]*\d{10,})/gi
        ];
        
        let sanitized = content;
        for (const pattern of sensitivePatterns) {
            sanitized = sanitized.replace(pattern, '$1****');
        }
        
        return sanitized;
    }
}

// 创建剪贴板监控实例
const clipboardMonitor = new ClipboardMonitor();

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.info('收到消息:', request);
    
    switch (request.action) {
        case 'toggleClipboardMonitoring':
            // 切换剪贴板监控状态
            clipboardMonitor.toggleMonitoring('shortcut');
            sendResponse({ success: true });
            break;
            
        case 'refreshClipboardMonitoring':
            // 刷新监控状态
            clipboardMonitor.updateMonitoring(request.enabled, request.type || 'ui');
            sendResponse({ success: true });
            break;
            
        case 'getSelectedText':
            const selectedText = window.getSelection().toString().trim();
            sendResponse({ selectedText });
            break;
            
        case 'insertText':
            insertTextAtCursor(request.text);
            sendResponse({ success: true });
            break;
            
        default:
            logger.warn('未知消息类型:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // 保持消息通道开放
});

// 在页面上显示通知
function showPageNotification(message, type = 'info', duration = 3000) {
    // 检查是否已有通知
    const existingNotification = document.getElementById('search-buddy-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.id = 'search-buddy-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        max-width: 350px;
        word-wrap: break-word;
        line-height: 1.4;
    `;
    
    notification.textContent = `🔍 ${message}`;
    
    // 添加滑入动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

// 在光标位置插入文本
function insertTextAtCursor(text) {
    const activeElement = document.activeElement;
    
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const value = activeElement.value;
        
        activeElement.value = value.substring(0, start) + text + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        
        // 触发input事件
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (activeElement && activeElement.isContentEditable) {
        // 处理contentEditable元素
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// 键盘快捷键监听（作为backup，主要通过manifest的commands处理）
document.addEventListener('keydown', (event) => {
    // Alt+L - 打开侧边栏（backup处理）
    if (event.altKey && event.key.toLowerCase() === 'l' && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
    }
    
    // Alt+K - 切换剪贴板监控（backup处理）
    if (event.altKey && event.key.toLowerCase() === 'k' && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        clipboardMonitor.toggleMonitoring('shortcut');
    }
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

/**
 * 初始化内容脚本
 */
async function initializeContentScript() {
    logger.info('Content script initialized');
    
    // 通知background script内容脚本已准备就绪
    chrome.runtime.sendMessage({ action: 'contentScriptReady' });
}

// 监听页面卸载，清理资源
window.addEventListener('beforeunload', () => {
    clipboardMonitor.stopMonitoring();
});