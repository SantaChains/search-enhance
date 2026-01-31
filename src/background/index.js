// src/background/index.js

/**
 * Enhanced Search Buddy Background Script
 * Handles side panel management, context menus, and keyboard shortcuts
 */

// Constants
const CONTEXT_MENU_ID = "open-search-buddy-selection";
const STORAGE_KEY_SELECTED_TEXT = "selectedText";
const STORAGE_KEY_CLIPBOARD_MONITORING = "clipboardMonitoring";
const STORAGE_KEY_LAST_CLIPBOARD_CONTENT = "lastClipboardContent";

// Global clipboard monitoring state
let isClipboardMonitoring = false;
let lastClipboardContent = '';
let clipboardInterval = null;

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

// 启动全局剪贴板监控
async function startGlobalClipboardMonitoring() {
    if (clipboardInterval) {
        clearInterval(clipboardInterval);
    }
    
    logger.info('全局剪贴板监控已启动');
    
    // 注意：在service worker中，navigator.clipboard API可能无法直接使用
    // 我们将依赖popup和content script来检测剪贴板变化
    // 当剪贴板变化时，它们会发送消息给background script
    // 这里我们只需要保持监控状态
}

// 停止全局剪贴板监控
function stopGlobalClipboardMonitoring() {
    if (clipboardInterval) {
        clearInterval(clipboardInterval);
        clipboardInterval = null;
    }
    
    logger.info('全局剪贴板监控已停止');
}

// 切换全局剪贴板监控状态
async function toggleGlobalClipboardMonitoring() {
    isClipboardMonitoring = !isClipboardMonitoring;
    
    // 保存状态到存储
    await chrome.storage.local.set({ [STORAGE_KEY_CLIPBOARD_MONITORING]: isClipboardMonitoring });
    
    // 通知所有打开的popup和侧边栏
    try {
        await chrome.runtime.sendMessage({
            action: 'clipboardMonitoringToggled',
            isActive: isClipboardMonitoring
        });
    } catch (error) {
        // 忽略错误，可能没有打开的popup或侧边栏
        logger.warn('通知剪贴板监控状态变化失败:', error);
    }
    
    return isClipboardMonitoring;
}

// 从存储加载剪贴板监控状态
async function loadClipboardMonitoringState() {
    const result = await chrome.storage.local.get([STORAGE_KEY_CLIPBOARD_MONITORING, STORAGE_KEY_LAST_CLIPBOARD_CONTENT]);
    isClipboardMonitoring = result[STORAGE_KEY_CLIPBOARD_MONITORING] || false;
    lastClipboardContent = result[STORAGE_KEY_LAST_CLIPBOARD_CONTENT] || '';
    
    // 如果监控状态为开启，启动监控
    if (isClipboardMonitoring) {
        await startGlobalClipboardMonitoring();
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
        
        // Load and initialize clipboard monitoring state
        await loadClipboardMonitoringState();

    } catch (error) {
        logger.error('Failed to initialize extension:', error);
    }
});

// Load clipboard monitoring state on startup
chrome.runtime.onStartup.addListener(async () => {
    try {
        await loadClipboardMonitoringState();
    } catch (error) {
        logger.error('Failed to load clipboard monitoring state on startup:', error);
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
<<<<<<< HEAD
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
=======
            // Alt+K - Toggle global clipboard monitoring
            try {
                const newState = await toggleGlobalClipboardMonitoring();
                logger.info(`Alt+K快捷键已触发剪贴板监控切换，新状态: ${newState ? '开启' : '关闭'}`);
                
                // 发送通知给当前标签页
                if (tab?.id) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'clipboardMonitoringToggled',
                        isActive: newState
                    }).catch(() => {
                        // 忽略标签页未响应的情况
                    });
                }
            } catch (error) {
                logger.error('切换剪贴板监控失败:', error);
>>>>>>> ba5619e15f58aa7a85a23c73997d283b520f0a09
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

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    logger.info('收到消息:', request, sender);
    
    switch (request.action) {
        case 'toggleClipboardMonitoring':
            // 处理来自popup或内容脚本的剪贴板监控切换请求
            try {
                const newState = await toggleGlobalClipboardMonitoring();
                sendResponse({ success: true, isActive: newState });
            } catch (error) {
                logger.error('切换剪贴板监控失败:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
            
        case 'getClipboardMonitoringState':
            // 获取当前剪贴板监控状态
            sendResponse({ isActive: isClipboardMonitoring });
            break;
            
        case 'clipboardChanged':
            // 处理来自popup或content script的剪贴板变化通知
            // 转发给其他打开的popup和侧边栏
            try {
                // 保存到存储中，以便新打开的popup访问
                await chrome.storage.local.set({ [STORAGE_KEY_LAST_CLIPBOARD_CONTENT]: request.content });
                
                // 转发给其他tab
                const tabs = await chrome.tabs.query({ status: 'complete' });
                for (const tab of tabs) {
                    if (tab.id && tab.id !== sender.tab?.id) {
                        await chrome.tabs.sendMessage(tab.id, request).catch(() => {
                            // 忽略错误，可能内容脚本未加载
                        });
                    }
                }
                
                sendResponse({ success: true });
            } catch (error) {
                logger.error('转发剪贴板变化通知失败:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
            
        case 'clipboardMonitoringToggled':
            // 更新全局状态
            isClipboardMonitoring = request.isActive;
            await chrome.storage.local.set({ [STORAGE_KEY_CLIPBOARD_MONITORING]: isClipboardMonitoring });
            sendResponse({ success: true });
            break;
            
        default:
            // 其他消息类型，保持通道开放
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // 保持消息通道开放
});

// Clean up on startup
chrome.runtime.onStartup.addListener(() => {
    logger.info('Extension started');
    // 重新加载剪贴板监控状态
    loadClipboardMonitoringState().catch(error => {
        logger.error('启动时加载剪贴板监控状态失败:', error);
    });
});
