// src/background/index.js

/**
 * Enhanced Search Buddy Background Script
 * Handles side panel management, context menus, and keyboard shortcuts
 */

// Constants
const CONTEXT_MENU_ID = "open-search-buddy-selection";
const STORAGE_KEY_SELECTED_TEXT = "selectedText";

// Utility functions
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args)
};

/**
 * Opens the side panel for a given window
 * @param {number} windowId - The window ID to open the side panel for
 * @param {string} source - Source of the request for logging
 */
async function openSidePanel(windowId, source = 'unknown') {
    try {
        // Check if we're in a normal window (not a popup or app window)
        const window = await chrome.windows.get(windowId);
        if (window.type !== 'normal') {
            logger.warn(`Cannot open side panel in ${window.type} window`);
            return;
        }
        
        await chrome.sidePanel.open({ windowId });
        logger.info(`Side panel opened successfully via ${source}`);
    } catch (error) {
        logger.error(`Failed to open side panel via ${source}:`, error);
    }
}

/**
 * Saves selected text to storage and opens side panel
 * @param {string} text - The selected text
 * @param {number} windowId - The window ID
 */
async function handleSelectedText(text, windowId) {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY_SELECTED_TEXT]: text });
        await openSidePanel(windowId, 'context menu');
    } catch (error) {
        logger.error('Failed to handle selected text:', error);
    }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    try {
        // Set up side panel behavior
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        logger.info('Side panel behavior configured successfully');

        // Create context menu
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: "Search with Buddy for \"%s\"",
            contexts: ["selection"]
        });
        logger.info('Context menu created successfully');

    } catch (error) {
        logger.error('Failed to initialize extension:', error);
    }
});

// Handle keyboard shortcuts with enhanced functionality
chrome.commands.onCommand.addListener(async (command, tab) => {
    logger.info(`Command received: ${command}`, tab);
    
    switch (command) {
        case '_execute_action':
            // Alt+L - Open side panel
            if (tab?.windowId) {
                await openSidePanel(tab.windowId, 'keyboard shortcut (Alt+L)');
            }
            break;
            
        case 'toggle_clipboard_monitoring':
            // Alt+K - Toggle clipboard monitoring
            try {
                if (!tab?.id) {
                    logger.warn('No active tab found for clipboard monitoring');
                    return;
                }
                
                await chrome.tabs.sendMessage(tab.id, { 
                    action: 'toggleClipboardMonitoring' 
                });
                logger.info('Alt+K快捷键已触发剪贴板监控切换');
                
            } catch (error) {
                logger.warn('Could not send clipboard toggle message to tab:', error);
                // 如果内容脚本未加载，尝试注入完整的剪贴板监控功能
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: () => {
                            // 页面内通知函数
                            function showPageNotification(message, type = 'info') {
                                const existingNotification = document.getElementById('search-buddy-notification');
                                if (existingNotification) {
                                    existingNotification.remove();
                                }
                                
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
                                
                                // 添加动画样式
                                const style = document.createElement('style');
                                style.textContent = `
                                    @keyframes slideIn {
                                        from { transform: translateX(100%); opacity: 0; }
                                        to { transform: translateX(0); opacity: 1; }
                                    }
                                `;
                                if (!document.querySelector('#search-buddy-animation-style')) {
                                    style.id = 'search-buddy-animation-style';
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
                            
                            // 剪贴板监控功能
                            if (window.searchBuddyClipboardInterval) {
                                clearInterval(window.searchBuddyClipboardInterval);
                                window.searchBuddyClipboardInterval = null;
                                showPageNotification('剪贴板监控已关闭', 'info');
                            } else {
                                window.searchBuddyClipboardInterval = setInterval(async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        if (text && text !== window.lastClipboardContent && text.trim().length > 0) {
                                            window.lastClipboardContent = text;
                                            console.log('剪贴板内容:', text);
                                        }
                                    } catch (e) {
                                        // 静默处理剪贴板读取错误
                                    }
                                }, 1000);
                                showPageNotification('剪贴板监控已开启', 'success');
                            }
                        }
                    });
                } catch (injectError) {
                    logger.error('Failed to inject clipboard monitoring:', injectError);
                }
            }
            break;
            
        case 'quick_search':
            // Alt+Shift+S - Quick search selected text
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: getSelectedText
                });
                
                if (result?.result) {
                    await handleSelectedText(result.result, tab.windowId);
                }
            } catch (error) {
                logger.warn('Could not get selected text:', error);
                // Fallback: just open the side panel
                await openSidePanel(tab.windowId, 'quick search fallback');
            }
            break;
            
        default:
            logger.warn(`Unknown command: ${command}`);
    }
});

/**
 * Function to be injected to get selected text
 */
function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && tab?.windowId && info.selectionText) {
        await handleSelectedText(info.selectionText, tab.windowId);
    }
});

// Handle extension icon clicks (fallback)
chrome.action.onClicked.addListener(async (tab) => {
    if (tab?.windowId) {
        await openSidePanel(tab.windowId, 'extension icon');
    }
});

// Clean up on startup
chrome.runtime.onStartup.addListener(() => {
    logger.info('Extension started');
});
