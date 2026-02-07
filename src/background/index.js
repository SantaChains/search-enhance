// src/background/index.js

/**
 * Search Buddy Background Script
 * Manages global clipboard monitoring and state synchronization
 * 
 * 功能：
 * - 全局剪贴板监控协调
 * - 状态持久化
 * - 多tab同步
 * - 快捷键处理
 */

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
    STORAGE_KEYS: {
        GLOBAL_MONITORING: 'globalMonitoringEnabled',
        CLIPBOARD_CONTENT: 'globalClipboardContent',
        CLIPBOARD_VERSION: 'globalClipboardVersion',
        LAST_CLIPBOARD_CONTENT: 'lastClipboardContent'
    },
    DEFAULT_MONITORING: true
};

// ============================================================================
// 状态
// ============================================================================

let appState = {
    isMonitoring: CONFIG.DEFAULT_MONITORING,
    lastContent: '',
    activeTabs: new Map(), // tabId -> { port, monitoring }
    lastBroadcastVersion: ''
};

// ============================================================================
// 日志
// ============================================================================

const logger = {
    info: (msg, ...args) => console.log(`[SearchBuddy-BG] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[SearchBuddy-BG] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[SearchBuddy-BG] ${msg}`, ...args)
};

// ============================================================================
// 存储管理
// ============================================================================

async function loadState() {
    try {
        const result = await chrome.storage.local.get([
            CONFIG.STORAGE_KEYS.GLOBAL_MONITORING,
            CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT,
            CONFIG.STORAGE_KEYS.CLIPBOARD_VERSION
        ]);
        
        appState.isMonitoring = result[CONFIG.STORAGE_KEYS.GLOBAL_MONITORING] ?? CONFIG.DEFAULT_MONITORING;
        appState.lastContent = result[CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT] || '';
        
        logger.info(`加载状态: 监控=${appState.isMonitoring}, 内容长度=${appState.lastContent.length}`);
    } catch (error) {
        logger.error('加载状态失败:', error);
    }
}

async function saveState() {
    try {
        await chrome.storage.local.set({
            [CONFIG.STORAGE_KEYS.GLOBAL_MONITORING]: appState.isMonitoring,
            [CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT]: appState.lastContent
        });
    } catch (error) {
        logger.error('保存状态失败:', error);
    }
}

// ============================================================================
// 剪贴板变化处理
// ============================================================================

async function handleClipboardChange(content, version, source = 'background') {
    if (content === appState.lastContent && version === appState.lastBroadcastVersion) {
        return { success: true, duplicate: true };
    }
    
    appState.lastContent = content;
    appState.lastBroadcastVersion = version;
    
    // 保存到storage
    await chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.CLIPBOARD_CONTENT]: content,
        [CONFIG.STORAGE_KEYS.CLIPBOARD_VERSION]: version
    });
    
    // 广播到所有active tabs和popup
    await broadcastToAllTabs({
        action: 'clipboardChanged',
        content: content,
        version: version,
        source: source
    });
    
    logger.info(`剪贴板变化已广播 (来源: ${source}): ${content.substring(0, 50)}...`);
    return { success: true };
}

/**
 * 广播消息到所有active tabs和扩展组件
 */
async function broadcastToAllTabs(message) {
    // 通过Port发送给已连接的content scripts
    const ports = Array.from(appState.activeTabs.values());

    ports.forEach(({ port }) => {
        try {
            port.postMessage(message);
        } catch (e) {
            logger.warn('发送消息失败:', e.message);
            appState.activeTabs.delete(port.name?.replace('global-clipboard-', ''));
        }
    });

    // 同时通过sendMessage广播给所有监听器（包括popup）
    try {
        await chrome.runtime.sendMessage(message);
    } catch (e) {
        // 可能没有接收者，忽略错误
    }
}

/**
 * 切换全局监控状态
 */
async function toggleMonitoring() {
    appState.isMonitoring = !appState.isMonitoring;
    
    await saveState();
    
    // 广播状态变化
    broadcastToAllTabs({
        action: 'clipboardMonitoringToggled',
        isActive: appState.isMonitoring
    });
    
    logger.info(`全局监控切换: ${appState.isMonitoring ? '开启' : '关闭'}`);
    
    return appState.isMonitoring;
}

// ============================================================================
// Port连接管理
// ============================================================================

chrome.runtime.onConnect.addListener((port) => {
    if (port.name.startsWith('global-clipboard-') || port.name.startsWith('popup-')) {
        const tabId = port.name.replace(/^(global-clipboard-|popup-)/, '');
        
        appState.activeTabs.set(tabId, { port, monitoring: appState.isMonitoring });
        
        logger.info(`Port连接: ${port.name}, 当前连接数: ${appState.activeTabs.size}`);
        
        port.onMessage.addListener((message) => {
            handlePortMessage(message, port, tabId);
        });
        
        port.onDisconnect.addListener(() => {
            appState.activeTabs.delete(tabId);
            logger.info(`Port断开: ${port.name}, 当前连接数: ${appState.activeTabs.size}`);
        });
    }
});

function handlePortMessage(message, port, tabId) {
    switch (message.action) {
        case 'clipboardChanged':
            handleClipboardChange(message.content, message.version, 'content-script');
            break;
            
        case 'getState':
            port.postMessage({
                action: 'stateResponse',
                isActive: appState.isMonitoring,
                lastContent: appState.lastContent,
                lastVersion: appState.lastBroadcastVersion
            });
            break;
            
        case 'pong':
            // 心跳响应
            break;
    }
}

// ============================================================================
// 消息处理
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        switch (request.action) {
            case 'toggleGlobalMonitoring':
                const newState = await toggleMonitoring();
                sendResponse({ success: true, isActive: newState });
                break;
                
            case 'getGlobalMonitoringState':
                sendResponse({ 
                    isActive: appState.isMonitoring,
                    lastContent: appState.lastContent
                });
                break;
                
            case 'clipboardChanged':
                const result = await handleClipboardChange(request.content, request.version, 'message');
                sendResponse(result);
                break;
                
            case 'contentScriptReady':
                // Content script准备就绪，发送当前状态
                sendResponse({
                    success: true,
                    isMonitoring: appState.isMonitoring,
                    lastContent: appState.lastContent
                });
                break;
                
            case 'openSidePanel':
                if (sender.tab?.windowId) {
                    await chrome.sidePanel.open({ windowId: sender.tab.windowId });
                }
                sendResponse({ success: true });
                break;
                
            case 'showNotification':
                // 转发到content script显示通知
                if (sender.tab?.id) {
                    try {
                        await chrome.tabs.sendMessage(sender.tab.id, {
                            action: 'showNotification',
                            message: request.message,
                            type: request.type
                        });
                        logger.info('通知已转发到content script');
                    } catch (e) {
                        logger.warn('转发通知失败:', e.message);
                    }
                } else {
                    logger.warn('无法转发通知：sender.tab.id 不存在');
                }
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    })();
    
    return true;
});

// ============================================================================
// 快捷键处理
// ============================================================================

chrome.commands.onCommand.addListener(async (command, tab) => {
    logger.info(`收到命令: ${command}`);

    switch (command) {
        case 'toggle_clipboard_monitoring':
            const newState = await toggleMonitoring();

            // 在当前tab显示通知并触发剪贴板检测
            if (tab?.id) {
                try {
                    // 发送通知
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'showNotification',
                        message: `全局剪贴板监控已${newState ? '开启' : '关闭'}`,
                        type: newState ? 'success' : 'info'
                    });

                    // 如果开启监控，通知content script立即检测剪贴板
                    if (newState) {
                        setTimeout(async () => {
                            try {
                                await chrome.tabs.sendMessage(tab.id, {
                                    action: 'forceClipboardCheck'
                                });
                            } catch (e) {
                                // 可能没有content script
                            }
                        }, 200);
                    }
                } catch (e) {
                    // 可能没有content script
                }
            }

            logger.info(`快捷键切换监控: ${newState ? '开启' : '关闭'}`);
            break;
            
        case '_execute_action':
            if (tab?.windowId) {
                await chrome.sidePanel.open({ windowId: tab.windowId });
            }
            break;
            
        case 'quick_search':
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => window.getSelection().toString().trim()
                });
                
                if (result?.result) {
                    await chrome.storage.local.set({ selectedText: result.result });
                    await chrome.sidePanel.open({ windowId: tab.windowId });
                }
            } catch (error) {
                logger.warn('快速搜索失败:', error);
            }
            break;
    }
});

// ============================================================================
// 上下文菜单
// ============================================================================

const CONTEXT_MENU_ID = 'open-search-buddy-selection';

chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        // 设置侧边栏行为
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        
        // 创建上下文菜单
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: 'Search with Buddy for "%s"',
            contexts: ['selection']
        });
        
        logger.info('上下文菜单已创建');
        
        // 加载状态
        await loadState();
        
        if (details.reason === 'install') {
            logger.info('首次安装，默认开启全局监控');
        }
    } catch (error) {
        logger.error('初始化失败:', error);
    }
});

chrome.runtime.onStartup.addListener(async () => {
    logger.info('Service Worker启动');
    await loadState();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && tab?.windowId && info.selectionText) {
        await chrome.storage.local.set({ selectedText: info.selectionText });
        await chrome.sidePanel.open({ windowId: tab.windowId });
    }
});

chrome.action.onClicked.addListener(async (tab) => {
    if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
    }
});

// ============================================================================
// 清理孤立连接
// ============================================================================

setInterval(() => {
    if (appState.activeTabs.size > 0) {
        const validTabs = new Map();
        appState.activeTabs.forEach((value, key) => {
            try {
                value.port.sender?.tab?.id;
                validTabs.set(key, value);
            } catch (e) {
                // 连接无效
            }
        });
        appState.activeTabs = validTabs;
    }
}, 30000);

logger.info('Background script加载完成');
