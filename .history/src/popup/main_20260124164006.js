// src/popup/main.js - 重构版本

import { 
    getSettings, 
    saveSettings, 
    addToHistory, 
    clearHistory,
    getHistory,
    createHistoryEntry,
    DEFAULTS 
} from '../utils/storage.js';

import {
    isURL,
    processTextExtraction,
    splitText,
    processPath,
    processLinkGeneration,
    analyzeTextForMultipleFormats,
    chineseWordSegmentation,
    copyToClipboard as copyTextToClipboard
} from '../utils/textProcessor.js';

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args)
};

// 应用状态
let appState = {
    settings: null,
    splitItemsState: [],
    clipboardMonitoring: false,
    lastClipboardContent: '',
    clipboardInterval: null,
    linkHistory: [],
    // 多格式分析状态
    multiFormatState: {
        originalText: '',
        processingHistory: [],
        currentIndex: -1
    },
    // 剪贴板历史状态
    clipboardHistory: [],
    clipboardHistoryVisible: false,
    clipboardBatchMode: false,
    maxClipboardHistory: 100,
    selectedItems: new Set() // 批量选择的项目ID集合
};

// DOM 元素映射
const elements = {};

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    logger.info("Search Buddy 正在初始化...");
    
    try {
        // 获取DOM元素
        initializeElements();
        
        // 加载设置
        appState.settings = await getSettings();
        
        // 加载历史记录
        appState.linkHistory = await getHistory();
        
        // 加载剪贴板历史
        await loadClipboardHistory();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 初始化UI
        renderEngineSelect();
        
        // 初始化剪贴板监控状态（从background script获取）
        await initClipboardMonitoringState();
        
        renderHistory();
        renderClipboardHistory();
        
        // 初始化textarea自适应高度
        initializeTextareaAutoResize();
        
        // 初始化响应式布局
        initializeResponsiveLayout();
        
        // 默认启用提取和拆解功能
        if (elements.switch_extract) {
            elements.switch_extract.checked = true;
            // 触发一次输入处理，确保UI面板正确显示
            handleInputChange();
        }
        
        logger.info("Search Buddy 初始化完成");
    } catch (error) {
        logger.error("初始化失败:", error);
        showNotification("初始化失败，请尝试刷新扩展", false);
    }
});

// 初始化DOM元素
function initializeElements() {
    const elementIds = [
        'search-input', 'search-btn', 'engine-select',
        'switch-extract', 'switch-link-gen', 'switch-multi-format',
        'clipboard-btn', 'settings-btn',
        'extract-container', 'link-gen-container', 'multi-format-container',
        'path-conversion-tool', 'path-quote-checkbox', 'path-conversion-result',
        'link-extraction-result', 'text-splitting-tool',
        'split-delimiter-select', 'refresh-split-btn', 'split-output-container',
        'copy-selected-btn', 'copy-opt-space', 'copy-opt-newline', 'copy-opt-tab',
        'select-all-checkbox', 'show-history-btn', 'export-history-btn',
        'clear-history-btn', 'history-container', 'history-search', 'history-list',
        // 剪贴板历史相关元素
        'show-clipboard-history-btn', 'clipboard-history-container',
        'clipboard-history-list', 'batch-operations-btn', 'batch-toolbar',
        'select-all-clipboard-btn', 'deselect-all-clipboard-btn',
        'delete-selected-clipboard-btn', 'copy-selected-clipboard-btn',
        'batch-search-btn', 'clear-clipboard-history-btn'
    ];
    
    elementIds.forEach(id => {
        elements[id.replace(/-/g, '_')] = document.getElementById(id);
    });
    
    // 验证关键元素
    if (!elements.search_input || !elements.search_btn) {
        throw new Error("关键DOM元素缺失");
    }
}

// 通知系统
function showNotification(message, isSuccess = true) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.background = isSuccess ? '#10b981' : '#ef4444';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// 剪贴板监控功能
async function toggleClipboardMonitoring() {
    // 切换本地监控状态
    appState.clipboardMonitoring = !appState.clipboardMonitoring;
    
    if (appState.clipboardMonitoring) {
        try {
            await startClipboardMonitoring();
            showNotification('剪贴板监控已启动');
        } catch (error) {
            logger.warn('剪贴板监控启动失败:', error);
            appState.clipboardMonitoring = false;
            showNotification('无法启动剪贴板监控', false);
        }
    } else {
        stopClipboardMonitoring();
        showNotification('剪贴板监控已停止');
    }
    
    // 通知background script状态变化
    chrome.runtime.sendMessage({
        action: 'clipboardMonitoringToggled',
        isActive: appState.clipboardMonitoring
    }).catch(error => {
        logger.warn('通知background script状态变化失败:', error);
    });
    
    updateClipboardButtonState(appState.clipboardMonitoring);
}

async function startClipboardMonitoring() {
    if (appState.clipboardInterval) {
        clearInterval(appState.clipboardInterval);
    }
    
    appState.clipboardInterval = setInterval(async () => {
        if (!appState.clipboardMonitoring) return;
        
        try {
            const text = await navigator.clipboard.readText();
            if (text && text !== appState.lastClipboardContent && text.trim().length > 0) {
                appState.lastClipboardContent = text;
                
                // 更新搜索框内容
                if (elements.search_input) {
                    elements.search_input.value = text;
                    
                    // 重置手动调整标记，允许自适应调整
                    elements.search_input.isManuallyResized = false;
                    
                    // 触发输入处理和高度调整
                    handleTextareaInput();
                    
                    // 更新搜索控件位置
                    updateSearchControlsPosition();
                }
                
                // 添加到剪贴板历史
                await addToClipboardHistory(text);
                
                // 通知background script，以便它可以通知其他打开的侧边栏
                chrome.runtime.sendMessage({
                    action: 'clipboardChanged',
                    content: text
                }).catch(error => {
                    logger.warn('通知background script剪贴板变化失败:', error);
                });
                
                showNotification('检测到剪贴板内容变化');
            }
        } catch (err) {
            // 静默处理剪贴板读取错误
        }
    }, 1000);
}

function stopClipboardMonitoring() {
    if (appState.clipboardInterval) {
        clearInterval(appState.clipboardInterval);
        appState.clipboardInterval = null;
    }
}

// 从background script获取当前剪贴板监控状态
async function getClipboardMonitoringState() {
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: 'getClipboardMonitoringState' 
        });
        return response?.isActive || false;
    } catch (error) {
        logger.warn('获取剪贴板监控状态失败:', error);
        return false;
    }
}

// 初始化剪贴板监控状态
async function initClipboardMonitoringState() {
    // 从background script获取当前监控状态
    const isMonitoring = await getClipboardMonitoringState();
    appState.clipboardMonitoring = isMonitoring;
    
    // 如果监控状态为开启，启动监控
    if (appState.clipboardMonitoring) {
        await startClipboardMonitoring();
    }
    
    updateClipboardButtonState(appState.clipboardMonitoring);
    
    // 更新开关状态
    if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.checked = appState.clipboardMonitoring;
    }
}

function updateClipboardButtonState(isActive) {
    if (!elements.clipboard_btn) return;
    
    const statusIndicator = elements.clipboard_btn.querySelector('.clipboard-status');
    if (statusIndicator) {
        statusIndicator.classList.toggle('active', isActive);
    }
}

// 添加消息监听器，处理来自background script的剪贴板变化通知
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.info('收到来自background的消息:', request);
    
    switch (request.action) {
        case 'clipboardChanged':
            // 处理剪贴板内容变化
            if (request.content && request.content.trim().length > 0) {
                // 更新搜索框内容
                if (elements.search_input) {
                    elements.search_input.value = request.content;
                    
                    // 重置手动调整标记，允许自适应调整
                    elements.search_input.isManuallyResized = false;
                    
                    // 触发输入处理和高度调整
                    handleTextareaInput();
                    
                    // 更新搜索控件位置
                    updateSearchControlsPosition();
                }
                
                // 添加到剪贴板历史
                addToClipboardHistory(request.content).catch(error => {
                    logger.error('添加到剪贴板历史失败:', error);
                });
                
                showNotification('检测到剪贴板内容变化');
            }
            break;
            
        case 'clipboardMonitoringToggled':
            // 处理剪贴板监控状态变化
            appState.clipboardMonitoring = request.isActive;
            updateClipboardButtonState(appState.clipboardMonitoring);
            break;
            
        default:
            break;
    }
    
    return true;
});

// 剪贴板历史功能
// 加载剪贴板历史
async function loadClipboardHistory() {
    try {
        const settings = await getSettings();
        appState.clipboardHistory = settings.clipboardHistory || [];
    } catch (error) {
        logger.error('加载剪贴板历史失败:', error);
        appState.clipboardHistory = [];
    }
}

// 保存剪贴板历史
async function saveClipboardHistory() {
    try {
        // 限制最大条数
        if (appState.clipboardHistory.length > appState.maxClipboardHistory) {
            appState.clipboardHistory = appState.clipboardHistory.slice(0, appState.maxClipboardHistory);
        }
        
        await saveSettings({
            ...appState.settings,
            clipboardHistory: appState.clipboardHistory
        });
    } catch (error) {
        logger.error('保存剪贴板历史失败:', error);
    }
}

// 添加剪贴板记录
async function addToClipboardHistory(text) {
    if (!text || text.trim() === '') return;
    
    // 检查是否已有相同的记录，如果有则移除旧记录
    const existingIndex = appState.clipboardHistory.findIndex(item => item.text === text);
    if (existingIndex !== -1) {
        appState.clipboardHistory.splice(existingIndex, 1);
    }
    
    // 添加新记录到开头
    const newRecord = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text: text,
        timestamp: new Date().toISOString()
    };
    
    appState.clipboardHistory.unshift(newRecord);
    
    // 保存到存储
    await saveClipboardHistory();
    
    // 重新渲染
    renderClipboardHistory();
}

// 渲染剪贴板历史
function renderClipboardHistory() {
    if (!elements.clipboard_history_list) return;
    
    if (appState.clipboardHistory.length === 0) {
        elements.clipboard_history_list.innerHTML = '<div class="empty-state"><p>暂无剪贴板历史</p><span>复制内容后将显示在这里</span></div>';
        return;
    }
    
    elements.clipboard_history_list.innerHTML = appState.clipboardHistory.map(item => {
        const isSelected = appState.selectedItems && appState.selectedItems.has(item.id);
        return `
            <div class="history-item" data-id="${item.id}">
                <div class="clipboard-item-content">
                    <!-- 非编辑状态：勾选框 + 文本内容 -->
                    <div class="content-row">
                        <input type="checkbox" class="clipboard-checkbox" data-id="${item.id}" 
                               ${appState.clipboardBatchMode ? 'style="display:inline-block;"' : 'style="display:none;"'} 
                               ${isSelected ? 'checked' : ''}>
                        <div class="clipboard-text-content" data-id="${item.id}">${escapeHtml(item.text)}</div>
                        <button class="edit-btn btn-sm" data-id="${item.id}" title="编辑">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- 编辑状态：勾选框 + 文本框 + 保存/取消按钮 -->
                    <div class="edit-row" data-id="${item.id}" style="display:none;">
                        <input type="checkbox" class="clipboard-checkbox" data-id="${item.id}" 
                               ${appState.clipboardBatchMode ? 'style="display:inline-block;"' : 'style="display:none;"'} 
                               ${isSelected ? 'checked' : ''}>
                        <textarea class="clipboard-edit-textarea" data-id="${item.id}">${escapeHtml(item.text)}</textarea>
                        <div class="edit-buttons">
                            <button class="save-edit-btn btn-sm" data-id="${item.id}">保存</button>
                            <button class="cancel-edit-btn btn-sm" data-id="${item.id}">取消</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // 绑定事件
    bindClipboardHistoryEvents();
    
    // 更新批量操作计数
    updateBatchCounter();
}

// 转义HTML特殊字符
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 绑定剪贴板历史事件
function bindClipboardHistoryEvents() {
    // 复制按钮事件
    elements.clipboard_history_list.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const item = appState.clipboardHistory.find(item => item.id === id);
            if (item) {
                await copyToClipboard(item.text, btn);
            }
        });
    });
    
    // 编辑按钮事件
    elements.clipboard_history_list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            startEditClipboardItem(id);
        });
    });
    
    // 保存编辑按钮事件
    elements.clipboard_history_list.querySelectorAll('.save-edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await saveEditClipboardItem(id);
        });
    });
    
    // 取消编辑按钮事件
    elements.clipboard_history_list.querySelectorAll('.cancel-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            cancelEditClipboardItem(id);
        });
    });
    
    // 删除按钮事件
    elements.clipboard_history_list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            deleteClipboardItem(id);
        });
    });
    
    // 复选框事件
    elements.clipboard_history_list.querySelectorAll('.clipboard-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                appState.selectedItems.add(id);
            } else {
                appState.selectedItems.delete(id);
            }
            updateBatchCounter();
        });
    });
}

// 开始编辑剪贴板项
function startEditClipboardItem(id) {
    // 隐藏非编辑状态行
    const contentRow = elements.clipboard_history_list.querySelector(`.content-row`);
    if (contentRow) {
        contentRow.style.display = 'none';
    }
    
    // 显示编辑状态行
    const editRow = elements.clipboard_history_list.querySelector(`.edit-row[data-id="${id}"]`);
    if (editRow) {
        editRow.style.display = 'flex';
    }
    
    // 设置焦点到文本框
    const textarea = elements.clipboard_history_list.querySelector(`.clipboard-edit-textarea[data-id="${id}"]`);
    if (textarea) {
        textarea.focus();
        // 调整文本框高度以适应内容
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
}

// 保存编辑的剪贴板项
async function saveEditClipboardItem(id) {
    const textarea = elements.clipboard_history_list.querySelector(`.clipboard-edit-textarea[data-id="${id}"]`);
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    if (!newText) return;
    
    const item = appState.clipboardHistory.find(item => item.id === id);
    if (!item || newText === item.text) {
        // 如果内容没有变化，直接取消编辑
        cancelEditClipboardItem(id);
        return;
    }
    
    // 添加新的记录，不修改原记录
    await addToClipboardHistory(newText);
    
    // 渲染更新后的历史记录
    renderClipboardHistory();
}

// 取消编辑剪贴板项
function cancelEditClipboardItem(id) {
    // 显示非编辑状态行
    const contentRow = elements.clipboard_history_list.querySelector(`.content-row`);
    if (contentRow) {
        contentRow.style.display = 'flex';
    }
    
    // 隐藏编辑状态行
    const editRow = elements.clipboard_history_list.querySelector(`.edit-row[data-id="${id}"]`);
    if (editRow) {
        editRow.style.display = 'none';
    }
}

// 删除剪贴板项
async function deleteClipboardItem(id) {
    if (confirm('确定要删除这条剪贴板记录吗？')) {
        appState.clipboardHistory = appState.clipboardHistory.filter(item => item.id !== id);
        await saveClipboardHistory();
        renderClipboardHistory();
        showNotification('已删除剪贴板记录');
    }
}

// 切换剪贴板历史显示
function toggleClipboardHistory() {
    if (!elements.clipboard_history_container) return;
    
    appState.clipboardHistoryVisible = !appState.clipboardHistoryVisible;
    elements.clipboard_history_container.style.display = appState.clipboardHistoryVisible ? 'block' : 'none';
}

// 切换批量操作模式
function toggleBatchOperations() {
    if (!elements.batch_toolbar || !elements.batch_operations_btn) return;
    
    appState.clipboardBatchMode = !appState.clipboardBatchMode;
    
    // 显示/隐藏批量操作工具栏
    elements.batch_toolbar.style.display = appState.clipboardBatchMode ? 'inline-flex' : 'none';
    
    // 更新批量操作按钮文本（保留图标）
    const buttonText = elements.batch_operations_btn.querySelector('span') || elements.batch_operations_btn;
    buttonText.textContent = appState.clipboardBatchMode ? '取消批量' : '批量操作';
    
    // 显示/隐藏所有勾选框
    const checkboxes = document.querySelectorAll('.clipboard-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.style.display = appState.clipboardBatchMode ? 'inline-block' : 'none';
    });
    
    // 如果取消批量操作，清空所有选中状态
    if (!appState.clipboardBatchMode) {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        appState.selectedItems.clear();
    } else {
        // 进入批量模式时，确保selectedItems已初始化
        if (!appState.selectedItems) {
            appState.selectedItems = new Set();
        }
    }
}



// 全选剪贴板项
function selectAllClipboardItems() {
    appState.selectedItems.clear();
    appState.clipboardHistory.forEach(item => {
        appState.selectedItems.add(item.id);
    });
    renderClipboardHistory();
    updateBatchCounter();
}

// 取消全选
function deselectAllClipboardItems() {
    appState.selectedItems.clear();
    renderClipboardHistory();
    updateBatchCounter();
}





// 批量搜索选中的剪贴板项
function batchSearchSelectedItems() {
    if (appState.selectedItems.size === 0) {
        showNotification('请先选择要搜索的项目', false);
        return;
    }
    
    const selectedTexts = appState.clipboardHistory
        .filter(item => appState.selectedItems.has(item.id))
        .map(item => item.text);
    
    if (selectedTexts.length > 0) {
        // 将选中的文本合并到搜索框
        elements.search_input.value = selectedTexts.join(' ');
        
        // 触发搜索
        handleSearch();
        
        showNotification(`已将 ${selectedTexts.length} 条记录添加到搜索框`);
    }
}

// 更新批量操作计数
function updateBatchCounter() {
    if (!elements.batch_operations_btn) return;
    
    const count = appState.selectedItems ? appState.selectedItems.size : 0;
    if (count > 0) {
        elements.batch_operations_btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list">
                <line x1="8" x2="21" y1="6" y2="6"/>
                <line x1="8" x2="21" y1="12" y2="12"/>
                <line x1="8" x2="21" y1="18" y2="18"/>
                <line x1="3" x2="3.01" y1="6" y2="6"/>
                <line x1="3" x2="3.01" y1="12" y2="12"/>
                <line x1="3" x2="3.01" y1="18" y2="18"/>
            </svg>
            <span>批量<span class="batch-counter">${count}</span></span>
        `;
    } else {
        elements.batch_operations_btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list">
                <line x1="8" x2="21" y1="6" y2="6"/>
                <line x1="8" x2="21" y1="12" y2="12"/>
                <line x1="8" x2="21" y1="18" y2="18"/>
                <line x1="3" x2="3.01" y1="6" y2="6"/>
                <line x1="3" x2="3.01" y1="12" y2="12"/>
                <line x1="3" x2="3.01" y1="18" y2="18"/>
            </svg>
            <span>批量</span>
        `;
    }
}

// 获取选中的剪贴板项
function getSelectedClipboardItems() {
    return appState.clipboardHistory.filter(item => appState.selectedItems.has(item.id));
}

// 更新批量操作工具栏状态


// 删除选中的剪贴板项
async function deleteSelectedClipboardItems() {
    if (appState.selectedItems.size === 0) {
        showNotification('请先选择要删除的项', false);
        return;
    }
    
    if (confirm(`确定要删除选中的 ${appState.selectedItems.size} 条记录吗？`)) {
        appState.clipboardHistory = appState.clipboardHistory.filter(
            item => !appState.selectedItems.has(item.id)
        );
        await saveClipboardHistory();
        // 清空选择
        appState.selectedItems.clear();
        renderClipboardHistory();
        showNotification(`已删除 ${appState.selectedItems.size} 条记录`);
    }
}

// 复制选中的剪贴板项
async function copySelectedClipboardItems() {
    if (appState.selectedItems.size === 0) {
        showNotification('请先选择要复制的项', false);
        return;
    }
    
    const selectedItems = appState.clipboardHistory.filter(
        item => appState.selectedItems.has(item.id)
    );
    
    // 每条记录之间用空一行隔开
    const textToCopy = selectedItems.map(item => item.text).join('\n\n');
    
    try {
        await copyTextToClipboard(textToCopy);
        showNotification(`已复制 ${selectedItems.length} 条记录`);
    } catch (error) {
        logger.error('复制选中项失败:', error);
        showNotification('复制失败', false);
    }
}

// 清空剪贴板历史功能
const clearClipboardHistory = async () => {
    if (confirm('确定要清空所有剪贴板历史吗？')) {
        appState.clipboardHistory = [];
        await saveClipboardHistory();
        renderClipboardHistory();
        showNotification('已清空剪贴板历史');
    }
};

// 搜索引擎渲染
function renderEngineSelect() {
    if (!elements.engine_select || !appState.settings) return;

    elements.engine_select.innerHTML = '';

    appState.settings.searchEngines.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.name;
        option.textContent = engine.name;
        if (engine.name === appState.settings.defaultEngine) {
            option.selected = true;
        }
        elements.engine_select.appendChild(option);
    });
}

// 搜索功能
function handleSearch() {
    const query = elements.search_input.value.trim();
    if (!query) return;

    if (isURL(query)) {
        window.open(query, '_blank');
        addToHistoryEnhanced(query);
        return;
    }
    
    let selectedEngineName = appState.settings.defaultEngine;
    if (elements.engine_select && elements.engine_select.value) {
        selectedEngineName = elements.engine_select.value;
    }
    
    const selectedEngine = appState.settings.searchEngines.find(e => e.name === selectedEngineName);
    
    if (selectedEngine) {
        const searchUrl = selectedEngine.template.replace('%s', encodeURIComponent(query));
        window.open(searchUrl, '_blank');
        addToHistoryEnhanced(query);
    } else {
        showNotification("没有找到搜索引擎配置", false);
    }
}

// 增强的历史记录添加功能
async function addToHistoryEnhanced(item) {
    try {
        const isGithubRepo = isGitHubRepository(item);
        
        // 如果是GitHub仓库链接，优先记录GitHub链接
        if (isGithubRepo.isRepo && isGithubRepo.githubUrl) {
            await addToHistory(isGithubRepo.githubUrl);
        } else {
            await addToHistory(item);
        }
        
        // 更新本地历史状态
        appState.linkHistory = await getHistory();
        renderHistory();
    } catch (error) {
        logger.error('添加历史记录失败:', error);
    }
}

// 检测是否为GitHub仓库类型链接
function isGitHubRepository(url) {
    const repoPatterns = [
        /https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+)/,
        /https?:\/\/zread\.ai\/([^\/]+)\/([^\/\?#]+)/,
        /https?:\/\/deepwiki\.com\/([^\/]+)\/([^\/\?#]+)/,
        /https?:\/\/context7\.com\/([^\/]+)\/([^\/\?#]+)/
    ];
    
    for (const pattern of repoPatterns) {
        const match = url.match(pattern);
        if (match) {
            const [, username, repo] = match;
            return {
                isRepo: true,
                username,
                repo,
                githubUrl: `https://github.com/${username}/${repo}`
            };
        }
    }
    
    // 检测简单的用户名/仓库名格式
    const simplePattern = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/;
    const simpleMatch = url.match(simplePattern);
    if (simpleMatch) {
        const [, username, repo] = simpleMatch;
        return {
            isRepo: true,
            username,
            repo,
            githubUrl: `https://github.com/${username}/${repo}`
        };
    }
    
    return { isRepo: false };
}

// 输入变化处理
function handleInputChange() {
    const text = elements.search_input.value;
    
    // 隐藏所有结果面板
    [elements.extract_container, elements.link_gen_container, elements.multi_format_container].forEach(panel => {
        if (panel) panel.style.display = 'none';
    });
    
    if (!text.trim()) return;

    if (elements.switch_extract.checked) {
        elements.extract_container.style.display = 'block';
        renderExtractionUI(text);
    } else if (elements.switch_link_gen.checked) {
        elements.link_gen_container.style.display = 'block';
        renderLinkGenerationUI(text);
    } else if (elements.switch_multi_format.checked) {
        elements.multi_format_container.style.display = 'block';
        // 更新多格式分析状态
        updateMultiFormatState(text);
        // 显示原始文本
        displayMultiFormatResult(text);
    }
}

// 处理开关变化 - 确保多格式分析的按钮和界面只在勾选时显示
function handleMultiFormatSwitchChange(checkbox) {
    const multiFormatContainer = document.getElementById('multi-format-container');
    if (multiFormatContainer) {
        if (checkbox.checked) {
            multiFormatContainer.style.display = 'block';
            // 如果输入框有内容，触发输入处理
            if (elements.search_input && elements.search_input.value.trim()) {
                handleInputChange();
            }
        } else {
            multiFormatContainer.style.display = 'none';
        }
    }
}

// 开关变化处理
function handleSwitchChange(activeSwitch, activePanelId) {
    logger.info(`开关变化: ${activeSwitch.id} 状态: ${activeSwitch.checked}`);
    
    if (activeSwitch.checked) {
        // 关闭其他开关
        [elements.switch_extract, elements.switch_link_gen, elements.switch_multi_format].forEach(sw => {
            if (sw && sw !== activeSwitch) sw.checked = false;
        });
        
        // 显示对应面板
        const activePanel = document.getElementById(activePanelId);
        if (activePanel) {
            activePanel.style.display = 'block';
        }
    } else {
        // 隐藏面板
        const activePanel = document.getElementById(activePanelId);
        if (activePanel) {
            activePanel.style.display = 'none';
        }
    }
    
    handleInputChange();
}

// 渲染提取功能UI
function renderExtractionUI(text) {
    if (!elements.path_conversion_tool || !elements.link_extraction_result || !elements.text_splitting_tool) {
        logger.error('提取功能UI元素缺失');
        return;
    }
    
    const pathResults = processPath(text);

    if (pathResults) {
        elements.path_conversion_tool.style.display = 'block';
        elements.link_extraction_result.style.display = 'none';
        elements.text_splitting_tool.style.display = 'none';
        
        const useQuotes = elements.path_quote_checkbox ? elements.path_quote_checkbox.checked : false;
        if (elements.path_conversion_result) {
            elements.path_conversion_result.innerHTML = pathResults.map(p => {
                const quotedPath = useQuotes ? `"${p}"` : p;
                return `<div class="path-item">
                    <button class="path-copy-btn" data-path="${p}">复制</button>
                    <pre>${quotedPath}</pre>
                </div>`;
            }).join('');
            
            // 绑定复制事件
            elements.path_conversion_result.querySelectorAll('.path-copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const path = e.target.dataset.path;
                    const textToCopy = (elements.path_quote_checkbox && elements.path_quote_checkbox.checked) ? `"${path}"` : path;
                    copyToClipboard(textToCopy, e.target);
                });
            });
        }
    } else {
        elements.path_conversion_tool.style.display = 'none';
        elements.link_extraction_result.style.display = 'block';
        elements.text_splitting_tool.style.display = 'block';

        const { cleanedText, extractedLinks } = processTextExtraction(text);
        
        let linkHtml = '<h5>提取的链接</h5>';
        if (extractedLinks.length > 0) {
            extractedLinks.forEach(link => addToHistoryEnhanced(link));
            linkHtml += extractedLinks.map(link => `<div class="link-item">
                <button class="copy-btn" data-link="${link}">复制</button>
                <a href="${link}" target="_blank">${link}</a>
            </div>`).join('');
        } else {
            linkHtml += '<p>未找到链接。</p>';
        }
        elements.link_extraction_result.innerHTML = linkHtml;
        
        // 绑定链接复制事件
        elements.link_extraction_result.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.target.dataset.link;
                copyToClipboard(link, e.target);
            });
        });

        renderSplittingTool(cleanedText);
    }
}

// 渲染链接生成UI
function renderLinkGenerationUI(text) {
    if (!elements.link_gen_container) return;
    
    const linkGenResult = processLinkGeneration(text);
    let html = '';
    
    if (linkGenResult) {
        if (linkGenResult.originalGithubLink) {
            addToHistoryEnhanced(linkGenResult.originalGithubLink);
        }
        
        html = `<h5>生成的链接</h5>` + linkGenResult.generatedLinks.map(link => {
            addToHistoryEnhanced(link);
            return `<div class="link-item">
                <button class="copy-btn" data-link="${link}">复制</button>
                <a href="${link}" target="_blank">${link}</a>
            </div>`;
        }).join('');
    } else {
        html = '<p>请输入 "用户名/仓库名" 或已知的仓库URL。</p>';
    }
    
    elements.link_gen_container.innerHTML = html;
    
    // 绑定复制事件
    elements.link_gen_container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const link = e.target.dataset.link;
            copyToClipboard(link, e.target);
        });
    });
}

// 渲染多格式分析
function renderMultiFormatAnalysis(text) {
    if (!elements.multi_format_container) return;
    
    const results = analyzeTextForMultipleFormats(text);
    
    elements.multi_format_container.innerHTML = '';
    
    if (results.length === 0) {
        elements.multi_format_container.innerHTML = '<div class="no-results">未检测到可处理的格式</div>';
        return;
    }

    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'format-card';
        
        card.innerHTML = `
            <div class="format-header">${result.type}</div>
            <div class="format-controls">
                <button class="process-btn" data-type="${result.type}" data-original="${encodeURIComponent(text)}">单独处理</button>
            </div>
            <div class="format-content" id="format-${result.type.replace(/\s+/g, '-')}"></div>
            <div class="format-processed-result" id="processed-${result.type.replace(/\s+/g, '-')}"></div>
        `;
        
        const content = card.querySelector(`#format-${result.type.replace(/\s+/g, '-')}`);
        
        if (result.type === '路径转换') {
            result.data.forEach(path => {
                const item = document.createElement('div');
                item.className = 'path-item';
                item.innerHTML = `
                    <button class="copy-btn" data-path="${path}">复制</button>
                    <span class="path-text">${path}</span>
                `;
                content.appendChild(item);
            });
        } else if (['链接提取', '仓库链接', 'GitHub链接'].includes(result.type)) {
            result.data.forEach(linkObj => {
                const linkUrl = linkObj.url || linkObj;
                addToHistoryEnhanced(linkUrl);
                
                const item = document.createElement('div');
                item.className = 'link-item';
                item.innerHTML = `
                    <button class="copy-btn" data-link="${linkUrl}">复制</button>
                    <a href="${linkUrl}" target="_blank">${linkUrl}</a>
                `;
                content.appendChild(item);
            });
        } else if (['邮箱地址', '电话号码', 'IP地址'].includes(result.type)) {
            result.data.forEach(item => {
                const value = item.url || item;
                const displayValue = value.replace(/^(mailto:|tel:|http:\/\/)/, '');
                const itemEl = document.createElement('div');
                itemEl.className = 'format-item';
                itemEl.innerHTML = `
                    <button class="copy-btn" data-value="${value}">复制</button>
                    <span class="format-value">${displayValue}</span>
                `;
                content.appendChild(itemEl);
            });
        }
        
        elements.multi_format_container.appendChild(card);
    });
    
    // 绑定复制事件
    elements.multi_format_container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.dataset.path || e.target.dataset.link || e.target.dataset.value;
            copyToClipboard(text, e.target);
        });
    });
    
    }

// 更新多格式分析状态
function updateMultiFormatState(text) {
    appState.multiFormatState.originalText = text;
    appState.multiFormatState.processingHistory = [text];
    appState.multiFormatState.currentIndex = 0;
    // 更新回到上一次处理结果按钮状态
    updateBackButtonState();
}

// 显示多格式分析结果
function displayMultiFormatResult(text) {
    const resultContainer = document.getElementById('multi-format-result');
    if (!resultContainer) return;
    
    resultContainer.innerHTML = text;
}

// 更新回到上一次处理结果按钮状态
function updateBackButtonState() {
    const backButton = document.getElementById('back-to-previous');
    if (!backButton) return;
    
    // 当currentIndex > 0时，按钮可用，否则禁用
    backButton.disabled = appState.multiFormatState.currentIndex <= 0;
    if (backButton.disabled) {
        backButton.style.opacity = '0.5';
        backButton.style.cursor = 'not-allowed';
    } else {
        backButton.style.opacity = '1';
        backButton.style.cursor = 'pointer';
    }
}

// 回到上一次处理结果
function handleBackToPrevious() {
    if (appState.multiFormatState.currentIndex > 0) {
        appState.multiFormatState.currentIndex--;
        const previousResult = appState.multiFormatState.processingHistory[appState.multiFormatState.currentIndex];
        displayMultiFormatResult(previousResult);
        // 更新按钮状态
        updateBackButtonState();
    }
}

// 复制结果到剪贴板
async function handleCopyResult() {
    const resultContainer = document.getElementById('multi-format-result');
    if (!resultContainer) return;
    
    const resultText = resultContainer.innerText;
    if (!resultText) return;
    
    try {
        await copyTextToClipboard(resultText);
        showNotification('已复制到剪贴板');
    } catch (err) {
        logger.error("复制结果失败:", err);
        showNotification("复制失败", false);
    }
}

// 搜索结果
function handleSearchResult() {
    const resultContainer = document.getElementById('multi-format-result');
    if (!resultContainer) return;
    
    const resultText = resultContainer.innerText;
    if (!resultText) return;
    
    // 如果是URL，直接跳转
    if (isURL(resultText)) {
        window.open(resultText, '_blank');
        addToHistoryEnhanced(resultText);
        return;
    }
    
    // 否则使用当前选中的搜索引擎搜索
    let selectedEngineName = appState.settings.defaultEngine;
    if (elements.engine_select && elements.engine_select.value) {
        selectedEngineName = elements.engine_select.value;
    }
    
    const selectedEngine = appState.settings.searchEngines.find(e => e.name === selectedEngineName);
    
    if (selectedEngine) {
        const searchUrl = selectedEngine.template.replace('%s', encodeURIComponent(resultText));
        window.open(searchUrl, '_blank');
        addToHistoryEnhanced(resultText);
    } else {
        showNotification("没有找到搜索引擎配置", false);
    }
}

// 处理多格式分析按钮点击
function handleFormatButtonClick(e) {
    const btn = e.target;
    const action = btn.dataset.action;
    const currentText = appState.multiFormatState.processingHistory[appState.multiFormatState.currentIndex] || '';
    
    if (!currentText) {
        const inputText = elements.search_input.value.trim();
        if (!inputText) {
            displayMultiFormatResult('请先在输入框中输入文本，然后点击下方按钮进行处理');
            return;
        }
        updateMultiFormatState(inputText);
        return;
    }
    
    // 执行处理
    let processedResult = currentText;
    
    switch (action) {
        case 'remove-chinese':
            // 去除中文和中文符号
            processedResult = currentText.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '');
            break;
        case 'remove-non-url-chars':
            // 去除非URL字符（包含中文和非URL的标点符号）
            // 保留URL、英文字母、数字和URL允许的符号
            processedResult = currentText.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef<>{}\|^`\'"\s]+/g, ' ')
                                         .replace(/\s+/g, ' ')  // 将多个空格合并为一个
                                         .trim();             // 去除首尾空格
            break;
        case 'convert-to-url-chars':
            // 非URL符号转URL符号
            processedResult = encodeURIComponent(currentText);
            break;
        case 'convert-period':
            // 。转.符号
            processedResult = currentText.replace(/。/g, '.');
            break;
        case 'convert-slash-to-backslash':
            // /转\
            processedResult = currentText.replace(/\//g, '\\');
            break;
        case 'convert-backslash-to-slash':
            // \\转/
            processedResult = currentText.replace(/\\/g, '/');
            break;
        case 'convert-slash-to-double':
                // /转//，只对单个/生效，对//不生效
                // 使用更兼容的方式实现，避免使用负向断言
                processedResult = currentText.replace(/\//g, (match, offset, string) => {
                    // 检查前面和后面是否也是斜杠
                    const prevChar = string[offset - 1];
                    const nextChar = string[offset + 1];
                    if (prevChar !== '/' && nextChar !== '/') {
                        return '//';
                    }
                    return match;
                });
                break;
        case 'remove-spaces':
            // 去除空格
            processedResult = currentText.replace(/\s+/g, '');
            break;
        case 'convert-backslash-to-double':
            // \转\\，只对单个\生效，对\\不生效
            // 使用更兼容的方式实现，避免使用负向断言
            processedResult = currentText.replace(/\\/g, (match, offset, string) => {
                // 检查前面和后面是否也是反斜杠
                const prevChar = string[offset - 1];
                const nextChar = string[offset + 1];
                if (prevChar !== '\\' && nextChar !== '\\') {
                    return '\\\\';
                }
                return match;
            });
            break;
        default:
            break;
    }
    
    // 更新处理历史
    if (processedResult !== currentText) {
        // 如果当前不在历史记录末尾，截断历史记录
        if (appState.multiFormatState.currentIndex < appState.multiFormatState.processingHistory.length - 1) {
            appState.multiFormatState.processingHistory = appState.multiFormatState.processingHistory.slice(0, appState.multiFormatState.currentIndex + 1);
        }
        // 添加新的处理结果到历史记录
        appState.multiFormatState.processingHistory.push(processedResult);
        appState.multiFormatState.currentIndex++;
        // 显示处理结果
        displayMultiFormatResult(processedResult);
        // 更新回到上一次处理结果按钮状态
        updateBackButtonState();
    }
}

// 处理单独格式分析
function handleSingleFormatProcessing(e) {
    const btn = e.target;
    const formatType = btn.dataset.type;
    const originalText = decodeURIComponent(btn.dataset.original);
    const resultContainer = document.getElementById(`processed-${formatType.replace(/\s+/g, '-')}`);
    
    // 清空之前的结果
    resultContainer.innerHTML = '';
    
    // 根据格式类型进行不同的处理
    let processedResult;
    switch (formatType) {
        case '路径转换':
            processedResult = processPath(originalText);
            break;
        case '链接提取':
            processedResult = processTextExtraction(originalText).extractedLinks;
            break;
        case '仓库链接':
        case 'GitHub链接':
            processedResult = processLinkGeneration(originalText)?.generatedLinks || [];
            break;
        case '邮箱地址':
            // 使用正则表达式提取邮箱
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            processedResult = [...new Set(originalText.match(emailRegex) || [])];
            break;
        case '电话号码':
            // 使用正则表达式提取电话号码
            const phoneRegex = /(?:\+86[\s-]?)?(?:1[3-9]\d{9}|0\d{2,3}[\s-]?\d{7,8})/g;
            processedResult = [...new Set(originalText.match(phoneRegex) || [])];
            break;
        case 'IP地址':
            // 使用正则表达式提取IP地址
            const ipRegex = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
            processedResult = [...new Set(originalText.match(ipRegex) || [])];
            break;
        default:
            processedResult = [];
    }
    
    // 显示处理结果
    if (processedResult && processedResult.length > 0) {
        resultContainer.innerHTML = `
            <div class="processed-header">处理结果：</div>
            <div class="processed-content">
                ${formatProcessedResults(processedResult, formatType)}
            </div>
        `;
        
        // 为新生成的复制按钮绑定事件
        resultContainer.querySelectorAll('.copy-btn').forEach(copyBtn => {
            copyBtn.addEventListener('click', (copyEvent) => {
                const text = copyEvent.target.dataset.text || copyEvent.target.dataset.link || copyEvent.target.dataset.path;
                copyToClipboard(text, copyBtn);
            });
        });
    } else {
        resultContainer.innerHTML = '<div class="no-processed-results">未生成处理结果</div>';
    }
}

// 格式化处理结果
function formatProcessedResults(results, type) {
    if (!results || results.length === 0) {
        return '<div class="no-results">无结果</div>';
    }
    
    let html = '';
    
    switch (type) {
        case '路径转换':
            html = results.map(path => `
                <div class="processed-item">
                    <button class="copy-btn" data-path="${path}">复制</button>
                    <span class="processed-text">${path}</span>
                </div>
            `).join('');
            break;
        case '链接提取':
        case '仓库链接':
        case 'GitHub链接':
            html = results.map(link => `
                <div class="processed-item">
                    <button class="copy-btn" data-link="${link}">复制</button>
                    <a href="${link}" target="_blank">${link}</a>
                </div>
            `).join('');
            break;
        case '邮箱地址':
            html = results.map(email => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${email}">复制</button>
                    <span class="processed-text">${email}</span>
                </div>
            `).join('');
            break;
        case '电话号码':
            html = results.map(phone => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${phone}">复制</button>
                    <span class="processed-text">${phone}</span>
                </div>
            `).join('');
            break;
        case 'IP地址':
            html = results.map(ip => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${ip}">复制</button>
                    <span class="processed-text">${ip}</span>
                </div>
            `).join('');
            break;
        default:
            html = results.map(item => `
                <div class="processed-item">
                    <button class="copy-btn" data-text="${item}">复制</button>
                    <span class="processed-text">${item}</span>
                </div>
            `).join('');
    }
    
    return html;
}

// 文本拆分工具渲染
function renderSplittingTool(text) {
    if (!elements.split_delimiter_select || !elements.split_output_container) {
        logger.error('拆分工具UI元素缺失');
        return;
    }
    
    // 获取选中的分隔规则
    let delimiter = elements.split_delimiter_select.value;
    
    // 检查是否启用了多规则选择
    const multiRuleCheckbox = document.getElementById('enable-multi-rules');
    if (multiRuleCheckbox && multiRuleCheckbox.checked) {
        const selectedRules = getSelectedRules();
        if (selectedRules.length > 0) {
            delimiter = selectedRules;
        }
    }
    
    const splitItems = splitText(text, delimiter);
    
    appState.splitItemsState = splitItems.map(item => ({ text: item, selected: false }));
    
    let html = '';
    const ITEMS_PER_ROW = 5;
    
    for (let i = 0; i < appState.splitItemsState.length; i += ITEMS_PER_ROW) {
        const rowItems = appState.splitItemsState.slice(i, i + ITEMS_PER_ROW);
        const rowNum = Math.floor(i / ITEMS_PER_ROW) + 1;
        
        html += `<div class="split-row">
            <div class="split-row-header">
                <input type="checkbox" class="split-row-checkbox" data-row-start-index="${i}">
                <span>第 ${rowNum} 行</span>
            </div>
            <div class="split-row-items">
                ${rowItems.map((item, index) => 
                    `<div class="split-item" data-index="${i + index}">${item.text}</div>`
                ).join('')}
            </div>
        </div>`;
    }
    
    elements.split_output_container.innerHTML = html;
    addSplitItemListeners();
    
    if (elements.select_all_checkbox) {
        elements.select_all_checkbox.checked = false;
    }
}

// 获取选中的分隔规则
function getSelectedRules() {
    const checkboxes = document.querySelectorAll('#multi-rule-selection input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// 切换多规则选择显示
function toggleMultiRuleSelection() {
    const checkbox = document.getElementById('enable-multi-rules');
    const container = document.getElementById('multi-rule-selection');
    
    if (checkbox && container) {
        container.style.display = checkbox.checked ? 'block' : 'none';
        
        // 如果启用多规则选择，禁用单规则选择器
        if (elements.split_delimiter_select) {
            elements.split_delimiter_select.disabled = checkbox.checked;
        }
        
        // 重新渲染拆分结果
        if (elements.search_input && elements.search_input.value.trim()) {
            renderSplittingTool(elements.search_input.value);
        }
    }
}

// 拆分项监听器
function addSplitItemListeners() {
    document.querySelectorAll('.split-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            appState.splitItemsState[index].selected = !appState.splitItemsState[index].selected;
            e.target.classList.toggle('selected', appState.splitItemsState[index].selected);
        });
    });

    document.querySelectorAll('.split-row-checkbox').forEach(el => {
        el.addEventListener('change', (e) => {
            const startIndex = parseInt(e.target.dataset.rowStartIndex);
            const endIndex = Math.min(startIndex + 5, appState.splitItemsState.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                appState.splitItemsState[i].selected = e.target.checked;
                const item = document.querySelector(`.split-item[data-index="${i}"]`);
                if (item) {
                    item.classList.toggle('selected', e.target.checked);
                }
            }
        });
    });
}

// 历史记录渲染
function renderHistory() {
    if (!elements.history_list || !appState.linkHistory) return;
    
    if (appState.linkHistory.length === 0) {
        elements.history_list.innerHTML = `
            <div class="empty-state">
                <p>暂无历史记录</p>
                <span>处理的链接将会显示在这里</span>
            </div>
        `;
        return;
    }
    
    elements.history_list.innerHTML = appState.linkHistory.map(item => {
        // 处理新旧格式兼容性
        let url, isGithub, domain;
        
        if (typeof item === 'string') {
            // 旧格式：直接是字符串
            url = item;
            isGithub = url.includes('github.com');
            try {
                // 尝试解析URL
                const urlObj = new URL(url);
                domain = urlObj.hostname;
            } catch (e) {
                // 如果不是有效URL，就用原始文本作为域名
                domain = '搜索查询';
            }
        } else if (item && typeof item === 'object') {
            // 新格式：对象
            url = item.url || item.toString();
            isGithub = item.type === 'github' || item.isGitHubRepo || (url && url.includes('github.com'));
            domain = item.domain || item.title || '未知域名';
        } else {
            // 异常情况，跳过该项
            logger.warn('遇到异常历史记录项:', item);
            return '';
        }
        
        // 确保 url 存在且不为空
        if (!url || url.trim() === '') {
            return '';
        }
        
        return `
            <div class="history-item ${isGithub ? 'github-item' : 'other-item'}">
                <div class="history-content">
                    <a href="${url}" target="_blank" class="history-link">${url}</a>
                    <span class="history-domain">${domain}</span>
                </div>
                <div class="history-actions">
                    <button class="copy-btn btn-sm" data-link="${url}">复制</button>
                    <button class="remove-btn btn-sm" data-link="${url}">删除</button>
                </div>
            </div>
        `;
    }).filter(html => html !== '').join('');
    
    // 绑定历史记录事件
    document.querySelectorAll('.history-item .copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const link = e.target.dataset.link;
            copyToClipboard(link, e.target);
        });
    });
    
    // 绑定删除事件
    document.querySelectorAll('.history-item .remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const link = e.target.dataset.link;
            if (confirm(`确定要删除这个历史记录吗？\n${link}`)) {
                try {
                    // 从历史记录中移除
                    appState.linkHistory = appState.linkHistory.filter(item => {
                        const itemUrl = typeof item === 'string' ? item : item.url;
                        return itemUrl !== link;
                    });
                    
                    // 保存到存储
                    await saveSettings({ history: appState.linkHistory });
                    
                    // 重新渲染
                    renderHistory();
                    
                    showNotification('历史记录已删除');
                } catch (error) {
                    logger.error('删除历史记录失败:', error);
                    showNotification('删除失败', false);
                }
            }
        });
    });
}

// 复制到剪贴板 - 使用导入的工具函数
async function copyToClipboard(text, button) {
    try {
        await copyTextToClipboard(text);
        showCopyFeedback(button);
        showNotification('已复制到剪贴板');
    } catch (err) {
        logger.error("复制失败:", err);
        showNotification("复制失败", false);
    }
}

// 复制反馈
function showCopyFeedback(button) {
    if (!button) return;
    
    const originalText = button.textContent;
    const originalBg = button.style.backgroundColor;
    
    button.textContent = '已复制!';
    button.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
        if (button.parentNode) {
            button.textContent = originalText;
            button.style.backgroundColor = originalBg;
        }
    }, 1500);
}

// 事件监听器设置
function setupEventListeners() {
    logger.info("设置事件监听器...");
    
    // 基础功能监听器
    if (elements.search_input) {
        elements.search_input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
            else handleInputChange();
        });
        
        // 添加输入事件监听器用于自适应高度
        elements.search_input.addEventListener('input', handleTextareaInput);
    }
    
    if (elements.search_btn) {
        elements.search_btn.addEventListener('click', handleSearch);
    }
    
    if (elements.clipboard_btn) {
        elements.clipboard_btn.addEventListener('click', () => {
            toggleClipboardMonitoring();
        });
    }
    
    if (elements.settings_btn) {
        elements.settings_btn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : 
                window.open(chrome.runtime.getURL('src/settings/index.html'));
        });
    }
    
    // 功能开关监听器 - 支持点击整个div区域
    setupSwitchContainerListeners();
    
    // 拆分工具监听器
    if (elements.refresh_split_btn) {
        elements.refresh_split_btn.addEventListener('click', () => 
            renderSplittingTool(elements.search_input ? elements.search_input.value : ''));
    }
    
    // 多规则选择监听器
    const multiRuleCheckbox = document.getElementById('enable-multi-rules');
    if (multiRuleCheckbox) {
        multiRuleCheckbox.addEventListener('change', toggleMultiRuleSelection);
    }
    
    // 监听多规则选择变化
    document.addEventListener('change', (e) => {
        if (e.target.matches('#multi-rule-selection input[type="checkbox"]')) {
            // 当多规则选择发生变化时，重新渲染拆分结果
            if (elements.search_input && elements.search_input.value.trim()) {
                renderSplittingTool(elements.search_input.value);
            }
        }
    });
    
    // 分隔规则选择器变化监听
    if (elements.split_delimiter_select) {
        elements.split_delimiter_select.addEventListener('change', () => {
            if (elements.search_input && elements.search_input.value.trim()) {
                renderSplittingTool(elements.search_input.value);
            }
        });
    }
    
    if (elements.copy_selected_btn) {
        elements.copy_selected_btn.addEventListener('click', handleCopySelected);
    }
    
    if (elements.select_all_checkbox) {
        elements.select_all_checkbox.addEventListener('change', handleSelectAll);
    }
    
    if (elements.path_quote_checkbox) {
        elements.path_quote_checkbox.addEventListener('change', () => 
            renderExtractionUI(elements.search_input ? elements.search_input.value : ''));
    }
    
    // 历史记录监听器
    if (elements.show_history_btn) {
        elements.show_history_btn.addEventListener('click', toggleHistoryDisplay);
    }
    
    if (elements.export_history_btn) {
        elements.export_history_btn.addEventListener('click', exportHistory);
    }
    
    if (elements.clear_history_btn) {
        elements.clear_history_btn.addEventListener('click', handleClearHistory);
    }
    
    // 添加手动调整大小的监听器
    setupTextareaResizeHandle();
    
    // 多格式分析按钮监听器
    const formatButtons = document.querySelectorAll('.format-btn');
    formatButtons.forEach(btn => {
        btn.addEventListener('click', handleFormatButtonClick);
    });
    
    // 回到上一次处理结果按钮监听器
    const backButton = document.getElementById('back-to-previous');
    if (backButton) {
        backButton.addEventListener('click', handleBackToPrevious);
    }
    
    // 复制结果按钮监听器
    const copyResultButton = document.getElementById('copy-result-btn');
    if (copyResultButton) {
        copyResultButton.addEventListener('click', handleCopyResult);
    }
    
    // 搜索结果按钮监听器
    const searchResultButton = document.getElementById('search-result-btn');
    if (searchResultButton) {
        searchResultButton.addEventListener('click', handleSearchResult);
    }
    
    // 剪贴板历史监听器
    // 显示/隐藏剪贴板历史
    if (elements.show_clipboard_history_btn) {
        elements.show_clipboard_history_btn.addEventListener('click', toggleClipboardHistory);
    }
    
    // 批量操作按钮
    if (elements.batch_operations_btn) {
        elements.batch_operations_btn.addEventListener('click', toggleBatchOperations);
    }
    
    // 批量操作工具栏按钮
    if (elements.select_all_clipboard_btn) {
        elements.select_all_clipboard_btn.addEventListener('click', selectAllClipboardItems);
    }
    
    if (elements.deselect_all_clipboard_btn) {
        elements.deselect_all_clipboard_btn.addEventListener('click', deselectAllClipboardItems);
    }
    
    if (elements.delete_selected_clipboard_btn) {
        elements.delete_selected_clipboard_btn.addEventListener('click', deleteSelectedClipboardItems);
    }
    
    if (elements.copy_selected_clipboard_btn) {
        elements.copy_selected_clipboard_btn.addEventListener('click', copySelectedClipboardItems);
    }
    
    if (elements.batch_search_btn) {
        elements.batch_search_btn.addEventListener('click', batchSearchSelectedItems);
    }
    
    // 清空剪贴板历史按钮
    if (elements.clear_clipboard_history_btn) {
        elements.clear_clipboard_history_btn.addEventListener('click', clearClipboardHistory);
    }
    
    // 注意：Alt+K快捷键已在manifest.json中定义为全局命令
    // 由background.js处理，不需要在popup中重复定义
    
    logger.info("事件监听器设置完成");
}

// 设置开关容器监听器，支持点击整个div区域
function setupSwitchContainerListeners() {
    const switchContainers = document.querySelectorAll('.switch-container');
    
    switchContainers.forEach(container => {
        const checkbox = container.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        
        // 初始化时，隐藏多格式分析面板（只在勾选时显示）
        if (checkbox.id === 'switch-multi-format') {
            const multiFormatContainer = document.getElementById('multi-format-container');
            if (multiFormatContainer) {
                multiFormatContainer.style.display = checkbox.checked ? 'block' : 'none';
            }
        }
        
        container.addEventListener('click', (e) => {
            // 如果点击的是checkbox本身，不处理（避免双重触发）
            if (e.target === checkbox) return;
            
            // 切换checkbox状态
            checkbox.checked = !checkbox.checked;
            
            // 触发change事件
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
            
            // 根据不同的开关执行相应的处理
            const switchType = container.dataset.switch;
            switch (switchType) {
                case 'extract':
                    handleSwitchChange(checkbox, 'extract-container');
                    break;
                case 'link-gen':
                    handleSwitchChange(checkbox, 'link-gen-container');
                    break;
                case 'multi-format':
                    handleMultiFormatSwitchChange(checkbox);
                    break;
            }
        });
        
        // 直接点击checkbox时的处理
        checkbox.addEventListener('change', () => {
            const switchType = container.dataset.switch;
            switch (switchType) {
                case 'extract':
                    handleSwitchChange(checkbox, 'extract-container');
                    break;
                case 'link-gen':
                    handleSwitchChange(checkbox, 'link-gen-container');
                    break;
                case 'multi-format':
                    handleMultiFormatSwitchChange(checkbox);
                    break;
            }
        });
    });
}

// 初始化textarea自适应高度
function initializeTextareaAutoResize() {
    if (!elements.search_input) return;
    
    // 设置初始高度
    adjustTextareaHeight();
}

// 处理textarea输入事件
function handleTextareaInput() {
    adjustTextareaHeight();
    handleInputChange();
    updateSearchControlsPosition();
}

// 调整textarea高度
function adjustTextareaHeight() {
    if (!elements.search_input) return;
    
    const textarea = elements.search_input;
    
    // 如果已经手动调整过大小，不进行自动调整
    if (textarea.isManuallyResized) return;
    
    const maxHeight = window.innerHeight * 0.5; // 最大高度为浏览器高度的一半
    const minHeight = 32; // 最小高度32px
    
    // 添加自适应调整的CSS类
    textarea.classList.add('auto-resizing');
    
    // 重置高度以获取正确的scrollHeight
    textarea.style.height = 'auto';
    
    // 计算新高度
    let newHeight = Math.max(minHeight, textarea.scrollHeight);
    newHeight = Math.min(newHeight, maxHeight);
    
    // 根据剪贴板监控状态调整高度策略
    if (appState.clipboardMonitoring) {
        // 剪贴板监控开启时，给予更多空间以适应可能的长文本
        const expandedMaxHeight = Math.min(maxHeight * 1.2, window.innerHeight * 0.6);
        newHeight = Math.min(newHeight, expandedMaxHeight);
    }
    
    textarea.style.height = newHeight + 'px';
    
    // 如果内容超过最大高度，显示滚动条
    if (textarea.scrollHeight > newHeight) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
    
    // 移除自适应调整的CSS类
    setTimeout(() => {
        textarea.classList.remove('auto-resizing');
    }, 150);
}

// 设置textarea手动调整大小功能
function setupTextareaResizeHandle() {
    const handle = document.querySelector('.textarea-resize-handle');
    const textarea = elements.search_input;
    const container = document.querySelector('.search-input-container');
    
    if (!handle || !textarea || !container) return;
    
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    let animationFrame = null;
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(textarea).height, 10);
        
        // 添加拖拽状态样式
        container.classList.add('resizing');
        document.body.style.cursor = 'nw-resize';
        document.body.style.userSelect = 'none';
        
        // 禁用textarea的过渡动画以实现平滑拖拽
        textarea.style.transition = 'none';
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseUp); // 处理鼠标离开窗口的情况
        
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        // 使用requestAnimationFrame确保平滑的拖拽体验
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        
        animationFrame = requestAnimationFrame(() => {
            const deltaY = e.clientY - startY;
            const maxHeight = window.innerHeight * 0.5;
            const newHeight = Math.max(32, Math.min(maxHeight, startHeight + deltaY));
            
            textarea.style.height = newHeight + 'px';
            textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
            
            // 标记为手动调整过大小
            textarea.isManuallyResized = true;
            
            // 实时更新搜索控件位置
            updateSearchControlsPosition();
        });
    }
    
    function handleMouseUp() {
        if (!isResizing) return;
        
        isResizing = false;
        
        // 移除拖拽状态样式
        container.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 恢复过渡动画
        setTimeout(() => {
            textarea.style.transition = '';
        }, 50);
        
        // 清理动画帧
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
    }
}

// 更新搜索控件位置
function updateSearchControlsPosition() {
    const searchControls = document.getElementById('search-controls');
    const container = document.getElementById('resizable-container');
    const textarea = elements.search_input;
    
    if (!searchControls || !container || !textarea) return;
    
    const containerWidth = container.offsetWidth;
    const textareaHeight = textarea.offsetHeight;
    const isNarrow = containerWidth < 480;
    const isTextareaExpanded = textareaHeight > 32;
    
    // 当侧边栏宽度小于480px或textarea被手动调整高度时，将搜索控件移到下方
    if (isNarrow || isTextareaExpanded) {
        searchControls.classList.add('below-input');
    } else {
        searchControls.classList.remove('below-input');
    }
}

// 初始化响应式布局
function initializeResponsiveLayout() {
    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // 根据容器宽度调整布局
            const width = entry.contentRect.width;
            
            if (width < 480) {
                // 窄屏布局
                document.body.classList.add('narrow-layout');
                document.body.classList.remove('medium-layout', 'wide-layout');
            } else if (width < 768) {
                // 中等屏幕布局
                document.body.classList.add('medium-layout');
                document.body.classList.remove('narrow-layout', 'wide-layout');
            } else {
                // 宽屏布局
                document.body.classList.add('wide-layout');
                document.body.classList.remove('narrow-layout', 'medium-layout');
            }
            
            updateSearchControlsPosition();
        }
    });
    
    const container = document.getElementById('resizable-container');
    if (container) {
        resizeObserver.observe(container);
    }
    
    // 初始调用
    updateSearchControlsPosition();
}

// 复制选中项
function handleCopySelected() {
    const selectedItems = appState.splitItemsState.filter(item => item.selected).map(item => item.text);
    if (selectedItems.length === 0) {
        showNotification("未选择任何项目！", false);
        return;
    }

    let separator = '';
    if (elements.copy_opt_newline && elements.copy_opt_newline.checked) {
        separator = '\n';
    } else if (elements.copy_opt_tab && elements.copy_opt_tab.checked) {
        separator = '\t';
    } else if (elements.copy_opt_space && elements.copy_opt_space.checked) {
        separator = ' ';
    }

    const textToCopy = selectedItems.join(separator);
    copyToClipboard(textToCopy, elements.copy_selected_btn);
}

// 全选处理
function handleSelectAll(e) {
    const isSelected = e.target.checked;
    appState.splitItemsState.forEach(item => item.selected = isSelected);
    document.querySelectorAll('.split-item').forEach(el => el.classList.toggle('selected', isSelected));
    document.querySelectorAll('.split-row-checkbox').forEach(cb => cb.checked = isSelected);
}

// 历史记录显示切换
function toggleHistoryDisplay() {
    const container = elements.history_container;
    if (container) {
        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        elements.show_history_btn.textContent = isVisible ? '📖 历史' : '📖 隐藏';
    }
}

// 导出历史记录
async function exportHistory() {
    try {
        const history = await getHistory();
        const exportData = {
            history,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-buddy-history-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('历史记录已导出');
    } catch (error) {
        logger.error('导出历史记录失败:', error);
        showNotification('导出失败', false);
    }
}

// 清空历史记录
async function handleClearHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
        try {
            await clearHistory();
            appState.linkHistory = [];
            renderHistory();
            showNotification('历史记录已清空');
        } catch (error) {
            logger.error('清空历史记录失败:', error);
            showNotification('清空失败', false);
        }
    }
}