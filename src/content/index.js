// src/content/index.js - 增强版内容脚本

/**
 * Enhanced Content Script for Search Buddy
 * Handles page-level interactions and communication with popup
 */

// 导入日志工具
import { logger } from '../utils/logger.js';

<<<<<<< HEAD
/**
 * 剪贴板监控通知模块
 * 接收来自 popup 的通知并显示页面通知
 */
class ClipboardMonitor {
    constructor() {
        // 标记是否启用监控（用于显示通知）
        this.isMonitoring = false;
        this.init();
    }

    /**
     * 统一初始化方法
     */
    async init() {
        try {
            await this.initializeMonitoringState();
            logger.info('剪贴板监控通知模块初始化完成');
        } catch (error) {
            logger.error('初始化剪贴板监控通知模块失败:', error);
        }
    }

    /**
     * 初始化监控状态
     */
    async initializeMonitoringState() {
        try {
            const { clipboardMonitoring } = await chrome.storage.local.get('clipboardMonitoring');
            this.isMonitoring = clipboardMonitoring || false;
            logger.info('剪贴板监控状态:', this.isMonitoring);
        } catch (error) {
            logger.error('初始化剪贴板监控状态失败:', error);
        }
    }

    /**
     * 更新监控状态
     * @param {boolean} enabled - 是否启用
     */
    async updateMonitoring(enabled) {
        this.isMonitoring = enabled;

        if (enabled) {
            showPageNotification('剪贴板监控已启动', 'success');
        } else {
            showPageNotification('剪贴板监控已停止', 'info');
        }

        logger.info('剪贴板监控状态更新:', enabled);
    }

    /**
     * 处理新的剪贴板内容（显示通知）
     * @param {string} content - 新的剪贴板内容
     */
    async handleNewClipboardContent(content) {
        try {
            // 安全处理：检查内容长度
            if (content.length > 10000) {
                content = content.substring(0, 100) + '...';
            }

            // 显示通知
            showPageNotification('检测到剪贴板内容变化', 'info');
            logger.info('剪贴板内容已更新');
        } catch (error) {
            logger.error('处理剪贴板内容失败:', error);
        }
    }
}

// 创建剪贴板监控实例
const clipboardMonitor = new ClipboardMonitor();

// 监听来自background script和popup的消息
=======
// 监听来自background script的消息
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.info('收到消息:', request);

    switch (request.action) {
<<<<<<< HEAD
        case 'toggleClipboardMonitoring':
            // 切换剪贴板监控状态（兼容快捷键）
            clipboardMonitor.updateMonitoring(!clipboardMonitor.isMonitoring);
            sendResponse({ success: true });
            break;

        case 'refreshClipboardMonitoring':
            // 更新监控状态
            clipboardMonitor.updateMonitoring(request.enabled);
            sendResponse({ success: true });
            break;

        case 'clipboardChanged':
            // 剪贴板内容变化通知
            clipboardMonitor.handleNewClipboardContent(request.content);
            sendResponse({ success: true });
            break;

=======
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
        case 'getSelectedText':
            const selectedText = window.getSelection().toString().trim();
            sendResponse({ selectedText });
            break;

        case 'insertText':
            insertTextAtCursor(request.text);
            sendResponse({ success: true });
            break;
<<<<<<< HEAD

=======
            
        case 'clipboardMonitoringToggled':
            // 显示剪贴板监控状态变化通知
            showPageNotification(
                request.isActive ? '剪贴板监控已开启' : '剪贴板监控已关闭',
                request.isActive ? 'success' : 'info'
            );
            sendResponse({ success: true });
            break;
            
        case 'clipboardChanged':
            // 处理来自background script的剪贴板变化通知
            // 通知当前tab中的popup或侧边栏
            try {
                // 直接转发给当前tab的popup/sidebar
                chrome.runtime.sendMessage(request).catch(() => {
                    // 忽略错误，可能没有打开的popup/sidebar
                });
                sendResponse({ success: true });
            } catch (error) {
                logger.error('处理剪贴板变化通知失败:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
            
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
        default:
            logger.warn('未知消息类型:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // 保持消息通道开放
});

<<<<<<< HEAD
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

// 在页面上显示通知
function showPageNotification(message, type = 'info', duration = 3000) {
=======
// 剪贴板监控功能已迁移到background script，此处保留相关函数的空实现以保持兼容性
function toggleClipboardMonitoring() {
    // 空函数，监控逻辑已迁移到background script
}

async function startClipboardMonitoring() {
    // 空函数，监控逻辑已迁移到background script
}

function stopClipboardMonitoring() {
    // 空函数，监控逻辑已迁移到background script
}

// 在页面上显示通知（使用统一的页面内通知格式）
function showPageNotification(message, type = 'info') {
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
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
<<<<<<< HEAD

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

=======
    
    notification.textContent = message;
    
    // 添加动画样式（避免重复添加）
    if (!document.querySelector('#search-buddy-animation-style')) {
        const style = document.createElement('style');
        style.id = 'search-buddy-animation-style';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
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

// 键盘快捷键监听（作为backup，主要通过manifest的commands处理）
document.addEventListener('keydown', (event) => {
<<<<<<< HEAD
    // Alt+K - 切换剪贴板监控（backup处理）
    if (event.altKey && event.key.toLowerCase() === 'k' && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        clipboardMonitor.updateMonitoring(!clipboardMonitor.isMonitoring);
=======
    // Alt+L - 打开侧边栏（backup处理）
    if (event.altKey && event.key.toLowerCase() === 'l' && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
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
<<<<<<< HEAD
    logger.info('Content script is being unloaded');
});
=======
    // 空函数，监控逻辑已迁移到background script
});
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
