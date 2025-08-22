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

let isClipboardMonitoring = false;
let lastClipboardContent = '';
let clipboardInterval = null;

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.info('收到消息:', request);
    
    switch (request.action) {
        case 'toggleClipboardMonitoring':
            toggleClipboardMonitoring();
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

// 切换剪贴板监控
function toggleClipboardMonitoring() {
    isClipboardMonitoring = !isClipboardMonitoring;
    
    if (isClipboardMonitoring) {
        startClipboardMonitoring();
        showPageNotification('剪贴板监控已启动', 'success');
    } else {
        stopClipboardMonitoring();
        showPageNotification('剪贴板监控已停止', 'info');
    }
}

// 启动剪贴板监控
async function startClipboardMonitoring() {
    if (clipboardInterval) {
        clearInterval(clipboardInterval);
    }
    
    clipboardInterval = setInterval(async () => {
        if (!isClipboardMonitoring) return;
        
        try {
            const text = await navigator.clipboard.readText();
            if (text && text !== lastClipboardContent && text.trim().length > 0) {
                lastClipboardContent = text;
                
                // 通知popup有新的剪贴板内容
                chrome.runtime.sendMessage({
                    action: 'clipboardChanged',
                    content: text
                });
                
                showPageNotification('检测到剪贴板内容变化', 'info');
            }
        } catch (err) {
            // 静默处理剪贴板读取错误
        }
    }, 1000);
}

// 停止剪贴板监控
function stopClipboardMonitoring() {
    if (clipboardInterval) {
        clearInterval(clipboardInterval);
        clipboardInterval = null;
    }
}

// 在页面上显示通知
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
    
    // Alt+Shift+C - 切换剪贴板监控（backup处理）
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'c' && !event.ctrlKey) {
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