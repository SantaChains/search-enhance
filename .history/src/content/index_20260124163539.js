// src/content/index.js - 增强版内容脚本

/**
 * Enhanced Content Script for Search Buddy
 * Handles page-level interactions and communication with popup
 */

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy Content] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy Content] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy Content] ${message}`, ...args)
};

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.info('收到消息:', request);
    
    switch (request.action) {
        case 'getSelectedText':
            const selectedText = window.getSelection().toString().trim();
            sendResponse({ selectedText });
            break;
            
        case 'insertText':
            insertTextAtCursor(request.text);
            sendResponse({ success: true });
            break;
            
        case 'clipboardMonitoringToggled':
            // 显示剪贴板监控状态变化通知
            showPageNotification(
                request.isActive ? '剪贴板监控已开启' : '剪贴板监控已关闭',
                request.isActive ? 'success' : 'info'
            );
            sendResponse({ success: true });
            break;
            
        default:
            logger.warn('未知消息类型:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // 保持消息通道开放
});

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
        max-width: 300px;
        word-wrap: break-word;
    `;
    
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
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
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
        toggleClipboardMonitoring();
    }
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

function initializeContentScript() {
    logger.info('Content script initialized');
    
    // 通知background script内容脚本已准备就绪
    chrome.runtime.sendMessage({ action: 'contentScriptReady' });
}

// 监听页面卸载，清理资源
window.addEventListener('beforeunload', () => {
    stopClipboardMonitoring();
});