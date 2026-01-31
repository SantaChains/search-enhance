/**
 * 组件间通信模块
 * 提供统一的消息传递机制，简化不同组件间的通信
 */

import { logger } from './logger.js';

// 消息类型定义
export const MESSAGE_TYPES = {
    // 剪贴板相关
    TOGGLE_CLIPBOARD_MONITORING: 'toggleClipboardMonitoring',
    REFRESH_CLIPBOARD_MONITORING: 'refreshClipboardMonitoring',
    CLIPBOARD_CHANGED: 'clipboardChanged',
    
    // 文本处理相关
    PROCESS_TEXT: 'processText',
    TEXT_PROCESSED: 'textProcessed',
    
    // 界面相关
    OPEN_SIDE_PANEL: 'openSidePanel',
    CONTENT_SCRIPT_READY: 'contentScriptReady',
    UPDATE_UI: 'updateUI',
    
    // 存储相关
    STORAGE_UPDATED: 'storageUpdated',
    
    // 其他
    GET_SELECTED_TEXT: 'getSelectedText',
    INSERT_TEXT: 'insertText',
    PERMISSION_STATUS: 'permissionStatus'
};

/**
 * 发送消息到background script
 * @param {object} message - 消息对象
 * @param {string} message.action - 消息类型
 * @param {any} message.data - 消息数据
 * @returns {Promise<any>} - 消息处理结果
 */
export async function sendToBackground(message) {
    try {
        const response = await chrome.runtime.sendMessage(message);
        logger.info('发送消息到background成功:', message.action, response);
        return response;
    } catch (error) {
        logger.error('发送消息到background失败:', message.action, error);
        throw error;
    }
}

/**
 * 发送消息到content script
 * @param {number} tabId - 标签页ID
 * @param {object} message - 消息对象
 * @param {string} message.action - 消息类型
 * @param {any} message.data - 消息数据
 * @returns {Promise<any>} - 消息处理结果
 */
export async function sendToContent(tabId, message) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        logger.info('发送消息到content script成功:', tabId, message.action, response);
        return response;
    } catch (error) {
        logger.error('发送消息到content script失败:', tabId, message.action, error);
        throw error;
    }
}

/**
 * 广播消息到所有content script
 * @param {object} message - 消息对象
 * @param {string} message.action - 消息类型
 * @param {any} message.data - 消息数据
 * @returns {Promise<Array<any>>} - 所有标签页的响应结果
 */
export async function broadcastToContent(message) {
    try {
        const tabs = await chrome.tabs.query({ active: false, currentWindow: false });
        const responses = [];
        
        for (const tab of tabs) {
            try {
                const response = await sendToContent(tab.id, message);
                responses.push({ tabId: tab.id, response });
            } catch (error) {
                // 忽略无法通信的标签页
                logger.debug('广播消息到标签页失败:', tab.id, error);
            }
        }
        
        logger.info('广播消息到所有content script成功:', message.action, responses.length);
        return responses;
    } catch (error) {
        logger.error('广播消息到所有content script失败:', message.action, error);
        throw error;
    }
}

/**
 * 注册消息监听器
 * @param {Function} callback - 消息处理回调函数
 * @returns {Function} - 取消监听的函数
 */
export function onMessage(callback) {
    const listener = (request, sender, sendResponse) => {
        logger.info('收到消息:', request.action, sender);
        return callback(request, sender, sendResponse);
    };
    
    chrome.runtime.onMessage.addListener(listener);
    
    // 返回取消监听的函数
    return () => {
        chrome.runtime.onMessage.removeListener(listener);
    };
}

/**
 * 注册特定类型的消息监听器
 * @param {string} action - 消息类型
 * @param {Function} callback - 消息处理回调函数
 * @returns {Function} - 取消监听的函数
 */
export function onMessageType(action, callback) {
    const listener = (request, sender, sendResponse) => {
        if (request.action === action) {
            logger.info('收到特定类型消息:', action, sender);
            return callback(request, sender, sendResponse);
        }
    };
    
    chrome.runtime.onMessage.addListener(listener);
    
    // 返回取消监听的函数
    return () => {
        chrome.runtime.onMessage.removeListener(listener);
    };
}

/**
 * 消息处理装饰器，用于统一处理消息的日志和错误
 * @param {Function} handler - 原始消息处理函数
 * @returns {Function} - 包装后的消息处理函数
 */
export function messageHandler(handler) {
    return async (request, sender, sendResponse) => {
        try {
            const result = await handler(request, sender);
            sendResponse({ success: true, data: result });
            return true;
        } catch (error) {
            logger.error('消息处理失败:', request.action, error);
            sendResponse({ success: false, error: error.message });
            return true;
        }
    };
}

/**
 * 统一的组件间通信管理器
 */
export const CommunicationManager = {
    // 初始化通信机制
    init() {
        logger.info('通信管理器已初始化');
    },
    
    // 发送消息到background
    sendToBackground,
    
    // 发送消息到content script
    sendToContent,
    
    // 广播消息到所有content script
    broadcastToContent,
    
    // 注册消息监听器
    onMessage,
    
    // 注册特定类型的消息监听器
    onMessageType,
    
    // 消息处理装饰器
    messageHandler
};

export default CommunicationManager;