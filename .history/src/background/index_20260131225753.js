// src/background/index.js

/**
 * Enhanced Search Buddy Background Script
 * Handles side panel management, context menus, and keyboard shortcuts
 */

// Constants
const CONTEXT_MENU_ID = "open-search-buddy-selection";
const STORAGE_KEY_SELECTED_TEXT = "selectedText";

// Import utilities
import { logger } from '../utils/logger.js';

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
            // Alt+K - 切换剪贴板监控
            try {
                // 从 storage 读取当前状态
                const result = await chrome.storage.local.get('clipboardMonitoring');
                const currentState = result.clipboardMonitoring || false;
                const newState = !currentState;

                // 更新 storage 状态
                await chrome.storage.local.set({ clipboardMonitoring: newState });
                logger.info(`剪贴板监控状态已切换: ${currentState} -> ${newState}`);

                // 创建系统通知
                try {
                    await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: '剪贴板监控',
                        message: newState ? '剪贴板监控已开启' : '剪贴板监控已关闭'
                    });
                } catch (error) {
                    logger.debug('创建通知失败:', error.message);
                }

                // 通知当前标签页的 content script（用于显示通知）
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'refreshClipboardMonitoring',
                        enabled: newState
                    });
                } catch (error) {
                    // content script 可能未加载，尝试注入
                    logger.debug('Content script 未加载，尝试注入:', error.message);
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['src/content/index.js']
                        });
                        
                        // 延迟发送消息
                        setTimeout(async () => {
                            try {
                                await chrome.tabs.sendMessage(tab.id, {
                                    action: 'refreshClipboardMonitoring',
                                    enabled: newState
                                });
                            } catch (retryError) {
                                logger.debug('重试发送消息失败:', retryError.message);
                            }
                        }, 100);
                    } catch (injectError) {
                        logger.debug('注入 content script 失败:', injectError.message);
                    }
                }

                // 通知 popup（如果打开）
                try {
                    await chrome.runtime.sendMessage({
                        action: 'clipboardMonitoringChanged',
                        enabled: newState
                    });
                } catch (error) {
                    logger.debug('通知 popup 失败:', error.message);
                }

            } catch (error) {
                logger.error('切换剪贴板监控状态失败:', error);
                
                // 创建错误通知
                try {
                    await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon48.png',
                        title: '剪贴板监控',
                        message: '切换剪贴板监控失败：' + error.message
                    });
                } catch (notifyError) {
                    logger.debug('创建错误通知失败:', notifyError.message);
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
