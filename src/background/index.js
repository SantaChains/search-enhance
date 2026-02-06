// src/background/index.js

/**
 * Enhanced Search Buddy Background Script
 * Handles side panel management, context menus, and clipboard monitoring
 * 
 * 修复版：不再直接轮询剪贴板，而是通过 storage 同步状态
 * 实际的剪贴板轮询由 popup/content script 负责
 */

// Constants
const CONTEXT_MENU_ID = "open-search-buddy-selection";
const STORAGE_KEY_SELECTED_TEXT = "selectedText";
const STORAGE_KEY_CLIPBOARD_MONITORING = "clipboardMonitoring";
const STORAGE_KEY_LAST_CLIPBOARD_CONTENT = "lastClipboardContent";
const STORAGE_KEY_CLIPBOARD_POLLING_VERSION = "clipboardPollingVersion";

// Global state
let isClipboardMonitoring = false;
let lastKnownContent = '';
let activePorts = new Map(); // portName -> Port

// Utility functions
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy-BG] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy-BG] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy-BG] ${message}`, ...args)
};

/**
 * 广播消息给所有连接的端口
 */
function broadcastToAllPorts(message) {
    const ports = Array.from(activePorts.values());
    
    ports.forEach(port => {
        try {
            port.postMessage(message);
        } catch (err) {
            logger.warn('发送消息失败:', err.message);
            activePorts.delete(port.name);
        }
    });
}

/**
 * 切换剪贴板监控状态
 */
async function toggleClipboardMonitoring() {
    isClipboardMonitoring = !isClipboardMonitoring;
    
    // 保存状态
    await chrome.storage.local.set({ [STORAGE_KEY_CLIPBOARD_MONITORING]: isClipboardMonitoring });
    
    // 广播状态变化
    broadcastToAllPorts({
        action: 'clipboardMonitoringToggled',
        isActive: isClipboardMonitoring
    });
    
    logger.info(`剪贴板监控状态切换: ${isClipboardMonitoring ? '开启' : '关闭'}`);
    
    return isClipboardMonitoring;
}

/**
 * 处理剪贴板内容变化通知
 * 由 popup/content script 调用
 */
async function handleClipboardChange(content, version) {
    if (content === lastKnownContent) {
        return { success: true, duplicate: true };
    }
    
    lastKnownContent = content;
    
    // 保存到存储
    await chrome.storage.local.set({
        [STORAGE_KEY_LAST_CLIPBOARD_CONTENT]: content,
        [STORAGE_KEY_CLIPBOARD_POLLING_VERSION]: version
    });
    
    // 广播给所有端口
    broadcastToAllPorts({
        action: 'clipboardChanged',
        content: content,
        version: version
    });
    
    logger.info('剪贴板内容变化已广播');
    return { success: true };
}

/**
 * 获取当前监控状态
 */
function getMonitoringState() {
    return {
        isActive: isClipboardMonitoring,
        lastContent: lastKnownContent
    };
}

// ============================================================================
// Service Worker 生命周期管理
// ============================================================================

// 安装时初始化
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        // 设置侧边栏行为
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        
        // 创建上下文菜单
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: "Search with Buddy for \"%s\"",
            contexts: ["selection"]
        });
        
        logger.info('扩展安装/更新，初始化完成');
        
        // 加载状态
        const result = await chrome.storage.local.get([
            STORAGE_KEY_CLIPBOARD_MONITORING,
            STORAGE_KEY_LAST_CLIPBOARD_CONTENT
        ]);
        
        isClipboardMonitoring = result[STORAGE_KEY_CLIPBOARD_MONITORING] ?? true;
        lastKnownContent = result[STORAGE_KEY_LAST_CLIPBOARD_CONTENT] || '';
        
    } catch (error) {
        logger.error('初始化失败:', error);
    }
});

// 启动时初始化
chrome.runtime.onStartup.addListener(async () => {
    logger.info('Service Worker 启动');
    
    try {
        const result = await chrome.storage.local.get([
            STORAGE_KEY_CLIPBOARD_MONITORING,
            STORAGE_KEY_LAST_CLIPBOARD_CONTENT
        ]);
        
        isClipboardMonitoring = result[STORAGE_KEY_CLIPBOARD_MONITORING] ?? true;
        lastKnownContent = result[STORAGE_KEY_LAST_CLIPBOARD_CONTENT] || '';
        
    } catch (error) {
        logger.error('加载状态失败:', error);
    }
});

// ============================================================================
// Port 连接管理
// ============================================================================

chrome.runtime.onConnect.addListener((port) => {
    if (port.name.startsWith('clipboard-') || port.name.startsWith('popup-') || port.name.startsWith('sidebar-')) {
        activePorts.set(port.name, port);
        
        logger.info(`Port连接: ${port.name}, 当前连接数: ${activePorts.size}`);
        
        port.onDisconnect.addListener(() => {
            activePorts.delete(port.name);
            logger.info(`Port断开: ${port.name}, 当前连接数: ${activePorts.size}`);
        });
        
        port.onMessage.addListener((message) => {
            handlePortMessage(message, port);
        });
    }
});

function handlePortMessage(message, port) {
    switch (message.action) {
        case 'clipboardChanged':
            // 接收来自 popup/content 的剪贴板变化
            handleClipboardChange(message.content, message.version);
            break;
            
        case 'getState':
            // 返回当前状态
            port.postMessage({
                action: 'stateResponse',
                ...getMonitoringState()
            });
            break;
            
        case 'toggleMonitoring':
            toggleClipboardMonitoring();
            break;
    }
}

// ============================================================================
// 消息处理
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        switch (request.action) {
            case 'toggleClipboardMonitoring':
                const newState = await toggleClipboardMonitoring();
                sendResponse({ success: true, isActive: newState });
                break;
                
            case 'getClipboardMonitoringState':
                sendResponse({ isActive: isClipboardMonitoring });
                break;
                
            case 'clipboardChanged':
                const result = await handleClipboardChange(request.content, request.version);
                sendResponse(result);
                break;
                
            case 'clipboardMonitoringToggled':
                isClipboardMonitoring = request.isActive;
                await chrome.storage.local.set({ [STORAGE_KEY_CLIPBOARD_MONITORING]: isClipboardMonitoring });
                broadcastToAllPorts(request);
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    })();
    
    return true; // 保持异步响应通道开放
});

// ============================================================================
// 快捷键处理
// ============================================================================

chrome.commands.onCommand.addListener(async (command, tab) => {
    logger.info(`收到命令: ${command}`);
    
    switch (command) {
        case '_execute_action':
            if (tab?.windowId) {
                await chrome.sidePanel.open({ windowId: tab.windowId });
            }
            break;
            
        case 'toggle_clipboard_monitoring':
            const newState = await toggleClipboardMonitoring();
            logger.info(`Alt+K切换监控: ${newState ? '开启' : '关闭'}`);
            
            if (tab?.id) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'clipboardMonitoringToggled',
                        isActive: newState
                    });
                } catch (e) {
                    // 内容脚本可能未加载
                }
            }
            break;
            
        case 'quick_search':
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => window.getSelection().toString().trim()
                });
                
                if (result?.result) {
                    await chrome.storage.local.set({ [STORAGE_KEY_SELECTED_TEXT]: result.result });
                    await chrome.sidePanel.open({ windowId: tab.windowId });
                }
            } catch (error) {
                logger.warn('获取选中文字失败:', error);
            }
            break;
    }
});

// ============================================================================
// 上下文菜单
// ============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && tab?.windowId && info.selectionText) {
        await chrome.storage.local.set({ [STORAGE_KEY_SELECTED_TEXT]: info.selectionText });
        await chrome.sidePanel.open({ windowId: tab.windowId });
    }
});

// ============================================================================
// 扩展图标点击
// ============================================================================

chrome.action.onClicked.addListener(async (tab) => {
    if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
    }
});

// ============================================================================
// 定期清理孤立的端口
// ============================================================================

setInterval(() => {
    if (activePorts.size > 0) {
        const validPorts = new Map();
        activePorts.forEach((port, name) => {
            try {
                // 测试端口是否仍然有效
                port.sender?.tab?.id;
                validPorts.set(name, port);
            } catch (e) {
                // 端口无效，移除
            }
        });
        activePorts = validPorts;
    }
}, 30000);

logger.info('Background script 加载完成');
