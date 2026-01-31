// src/popup/modules/clipboardHistoryManager.js
// 剪贴板历史管理模块

import { 
    addToClipboardHistory, 
    getClipboardHistory, 
    saveSettings
} from '../../utils/storage.js';
import { copyToClipboard as copyTextToClipboard } from '../../utils/textProcessor.js';

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[ClipboardHistoryManager] ${message}`, ...args),
    error: (message, ...args) => console.error(`[ClipboardHistoryManager] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[ClipboardHistoryManager] ${message}`, ...args)
};

class ClipboardHistoryManager {
    constructor() {
        this.elements = {};
        this.appState = null;
    }

    /**
     * 初始化剪贴板历史管理器
     * @param {Object} elements - DOM元素映射
     * @param {Object} appState - 应用状态
     */
    init(elements, appState) {
        this.elements = elements;
        this.appState = appState;
    }

    /**
     * 渲染剪贴板历史
     */
    renderClipboardHistory() {
        if (!this.elements.clipboard_history_list) return;
        
        if (this.appState.clipboardHistory.length === 0) {
            this.elements.clipboard_history_list.innerHTML = '<div class="empty-state"><p>暂无剪贴板历史</p><span>复制内容后将显示在这里</span></div>';
            return;
        }
        
        // 优化：使用文档片段减少DOM操作次数
        const fragment = document.createDocumentFragment();
        
        this.appState.clipboardHistory.forEach(item => {
            const isSelected = this.appState.selectedItems && this.appState.selectedItems.has(item.id);
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.dataset.id = item.id;
            
            itemDiv.innerHTML = `
                <div class="clipboard-item-content">
                    <!-- 非编辑状态：勾选框 + 文本内容 -->
                    <div class="content-row">
                        <input type="checkbox" class="clipboard-checkbox" data-id="${item.id}" 
                               ${this.appState.clipboardBatchMode ? 'style="display:inline-block;"' : 'style="display:none;"'} 
                               ${isSelected ? 'checked' : ''}>
                        <div class="clipboard-text-content" data-id="${item.id}">${this.escapeHtml(item.text)}</div>
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
                               ${this.appState.clipboardBatchMode ? 'style="display:inline-block;"' : 'style="display:none;"'} 
                               ${isSelected ? 'checked' : ''}>
                        <textarea class="clipboard-edit-textarea" data-id="${item.id}">${this.escapeHtml(item.text)}</textarea>
                        <div class="edit-buttons">
                            <button class="save-edit-btn btn-sm" data-id="${item.id}">保存</button>
                            <button class="cancel-edit-btn btn-sm" data-id="${item.id}">取消</button>
                        </div>
                    </div>
                </div>
            `;
            
            fragment.appendChild(itemDiv);
        });
        
        // 一次性更新DOM，减少重绘和回流
        this.elements.clipboard_history_list.innerHTML = '';
        this.elements.clipboard_history_list.appendChild(fragment);
        
        // 绑定事件
        this.bindClipboardHistoryEvents();
        
        // 更新批量操作计数
        this.updateBatchCounter();
    }

    /**
     * 转义HTML特殊字符
     * @param {string} text - 文本内容
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 绑定剪贴板历史事件
     */
    bindClipboardHistoryEvents() {
        // 复制按钮事件
        this.elements.clipboard_history_list.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const item = this.appState.clipboardHistory.find(item => item.id === id);
                if (item) {
                    await this.copyToClipboard(item.text, btn);
                }
            });
        });
        
        // 编辑按钮事件
        this.elements.clipboard_history_list.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.startEditClipboardItem(id);
            });
        });
        
        // 保存编辑按钮事件
        this.elements.clipboard_history_list.querySelectorAll('.save-edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await this.saveEditClipboardItem(id);
            });
        });
        
        // 取消编辑按钮事件
        this.elements.clipboard_history_list.querySelectorAll('.cancel-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.cancelEditClipboardItem(id);
            });
        });
        
        // 删除按钮事件
        this.elements.clipboard_history_list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteClipboardItem(id);
            });
        });
        
        // 复选框事件
        this.elements.clipboard_history_list.querySelectorAll('.clipboard-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.appState.selectedItems.add(id);
                } else {
                    this.appState.selectedItems.delete(id);
                }
                this.updateBatchCounter();
            });
        });
    }

    /**
     * 开始编辑剪贴板项
     * @param {string} id - 剪贴板项ID
     */
    startEditClipboardItem(id) {
        // 隐藏非编辑状态行
        const contentRow = this.elements.clipboard_history_list.querySelector(`.content-row`);
        if (contentRow) {
            contentRow.style.display = 'none';
        }
        
        // 显示编辑状态行
        const editRow = this.elements.clipboard_history_list.querySelector(`.edit-row[data-id="${id}"]`);
        if (editRow) {
            editRow.style.display = 'flex';
        }
        
        // 设置焦点到文本框
        const textarea = this.elements.clipboard_history_list.querySelector(`.clipboard-edit-textarea[data-id="${id}"]`);
        if (textarea) {
            textarea.focus();
            // 调整文本框高度以适应内容
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }

    /**
     * 保存编辑的剪贴板项
     * @param {string} id - 剪贴板项ID
     * @returns {Promise<void>}
     */
    async saveEditClipboardItem(id) {
        const textarea = this.elements.clipboard_history_list.querySelector(`.clipboard-edit-textarea[data-id="${id}"]`);
        if (!textarea) return;
        
        const newText = textarea.value.trim();
        if (!newText) return;
        
        const item = this.appState.clipboardHistory.find(item => item.id === id);
        if (!item || newText === item.text) {
            // 如果内容没有变化，直接取消编辑
            this.cancelEditClipboardItem(id);
            return;
        }
        
        // 添加新的记录，不修改原记录
        await this.addToClipboardHistory(newText);
        
        // 渲染更新后的历史记录
        this.renderClipboardHistory();
    }

    /**
     * 取消编辑剪贴板项
     * @param {string} id - 剪贴板项ID
     */
    cancelEditClipboardItem(id) {
        // 显示非编辑状态行
        const contentRow = this.elements.clipboard_history_list.querySelector(`.content-row`);
        if (contentRow) {
            contentRow.style.display = 'flex';
        }
        
        // 隐藏编辑状态行
        const editRow = this.elements.clipboard_history_list.querySelector(`.edit-row[data-id="${id}"]`);
        if (editRow) {
            editRow.style.display = 'none';
        }
    }

    /**
     * 删除剪贴板项
     * @param {string} id - 剪贴板项ID
     * @returns {Promise<void>}
     */
    async deleteClipboardItem(id) {
        if (confirm('确定要删除这条剪贴板记录吗？')) {
            this.appState.clipboardHistory = this.appState.clipboardHistory.filter(item => item.id !== id);
            await this.saveClipboardHistory();
            this.renderClipboardHistory();
            this.showNotification('已删除剪贴板记录');
        }
    }

    /**
     * 保存剪贴板历史
     * @returns {Promise<void>}
     */
    async saveClipboardHistory() {
        try {
            // 限制最大条数
            if (this.appState.clipboardHistory.length > this.appState.maxClipboardHistory) {
                this.appState.clipboardHistory = this.appState.clipboardHistory.slice(0, this.appState.maxClipboardHistory);
            }
            
            await saveSettings({
                ...this.appState.settings,
                clipboardHistory: this.appState.clipboardHistory
            });
        } catch (error) {
            logger.error('保存剪贴板历史失败:', error);
        }
    }

    /**
     * 添加剪贴板记录
     * @param {string} text - 文本内容
     * @returns {Promise<void>}
     */
    async addToClipboardHistory(text) {
        if (!text || text.trim() === '') return;
        
        // 检查是否已有相同的记录，如果有则移除旧记录
        const existingIndex = this.appState.clipboardHistory.findIndex(item => item.text === text);
        if (existingIndex !== -1) {
            this.appState.clipboardHistory.splice(existingIndex, 1);
        }
        
        // 添加新记录到开头
        const newRecord = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: text,
            timestamp: new Date().toISOString()
        };
        
        this.appState.clipboardHistory.unshift(newRecord);
        
        // 保存到存储
        await this.saveClipboardHistory();
        
        // 重新渲染
        this.renderClipboardHistory();
    }

    /**
     * 复制到剪贴板
     * @param {string} text - 文本内容
     * @param {HTMLElement} button - 触发按钮
     * @returns {Promise<void>}
     */
    async copyToClipboard(text, button) {
        try {
            await copyTextToClipboard(text);
            this.showCopyFeedback(button);
            this.showNotification('已复制到剪贴板');
        } catch (err) {
            logger.error("复制失败:", err);
            this.showNotification("复制失败", false);
        }
    }

    /**
     * 复制反馈
     * @param {HTMLElement} button - 触发按钮
     */
    showCopyFeedback(button) {
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

    /**
     * 显示通知
     * @param {string} message - 通知消息
     * @param {boolean} isSuccess - 是否成功消息
     */
    showNotification(message, isSuccess = true) {
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

    /**
     * 更新批量操作计数
     */
    updateBatchCounter() {
        if (!this.elements.batch_operations_btn) return;
        
        const count = this.appState.selectedItems ? this.appState.selectedItems.size : 0;
        if (count > 0) {
            this.elements.batch_operations_btn.innerHTML = `
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
            this.elements.batch_operations_btn.innerHTML = `
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

    /**
     * 切换批量操作模式
     */
    toggleBatchOperations() {
        if (!this.elements.batch_toolbar || !this.elements.batch_operations_btn) return;
        
        this.appState.clipboardBatchMode = !this.appState.clipboardBatchMode;
        
        // 显示/隐藏批量操作工具栏
        this.elements.batch_toolbar.style.display = this.appState.clipboardBatchMode ? 'inline-flex' : 'none';
        
        // 更新批量操作按钮文本（保留图标）
        const buttonText = this.elements.batch_operations_btn.querySelector('span') || this.elements.batch_operations_btn;
        buttonText.textContent = this.appState.clipboardBatchMode ? '取消批量' : '批量操作';
        
        // 显示/隐藏所有勾选框
        const checkboxes = document.querySelectorAll('.clipboard-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.style.display = this.appState.clipboardBatchMode ? 'inline-block' : 'none';
        });
        
        // 如果取消批量操作，清空所有选中状态
        if (!this.appState.clipboardBatchMode) {
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.appState.selectedItems.clear();
        } else {
            // 进入批量模式时，确保selectedItems已初始化
            if (!this.appState.selectedItems) {
                this.appState.selectedItems = new Set();
            }
        }
    }

    /**
     * 全选剪贴板项
     */
    selectAllClipboardItems() {
        this.appState.selectedItems.clear();
        this.appState.clipboardHistory.forEach(item => {
            this.appState.selectedItems.add(item.id);
        });
        this.renderClipboardHistory();
        this.updateBatchCounter();
    }

    /**
     * 取消全选
     */
    deselectAllClipboardItems() {
        this.appState.selectedItems.clear();
        this.renderClipboardHistory();
        this.updateBatchCounter();
    }

    /**
     * 批量搜索选中的剪贴板项
     */
    batchSearchSelectedItems() {
        if (this.appState.selectedItems.size === 0) {
            this.showNotification('请先选择要搜索的项目', false);
            return;
        }
        
        const selectedTexts = this.appState.clipboardHistory
            .filter(item => this.appState.selectedItems.has(item.id))
            .map(item => item.text);
        
        if (selectedTexts.length > 0) {
            // 将选中的文本合并到搜索框
            this.elements.search_input.value = selectedTexts.join(' ');
            
            // 触发搜索
            if (typeof handleSearch === 'function') {
                handleSearch();
            }
            
            this.showNotification(`已将 ${selectedTexts.length} 条记录添加到搜索框`);
        }
    }

    /**
     * 删除选中的剪贴板项
     * @returns {Promise<void>}
     */
    async deleteSelectedClipboardItems() {
        if (this.appState.selectedItems.size === 0) {
            this.showNotification('请先选择要删除的项', false);
            return;
        }
        
        const deleteCount = this.appState.selectedItems.size;
        
        if (confirm(`确定要删除选中的 ${deleteCount} 条记录吗？`)) {
            this.appState.clipboardHistory = this.appState.clipboardHistory.filter(
                item => !this.appState.selectedItems.has(item.id)
            );
            await this.saveClipboardHistory();
            // 清空选择
            this.appState.selectedItems.clear();
            this.renderClipboardHistory();
            this.showNotification(`已删除 ${deleteCount} 条记录`);
        }
    }

    /**
     * 复制选中的剪贴板项
     * @returns {Promise<void>}
     */
    async copySelectedClipboardItems() {
        if (this.appState.selectedItems.size === 0) {
            this.showNotification('请先选择要复制的项', false);
            return;
        }
        
        const selectedItems = this.appState.clipboardHistory.filter(
            item => this.appState.selectedItems.has(item.id)
        );
        
        // 每条记录之间用空一行隔开
        const textToCopy = selectedItems.map(item => item.text).join('\n\n');
        
        try {
            await copyTextToClipboard(textToCopy);
            this.showNotification(`已复制 ${selectedItems.length} 条记录`);
        } catch (error) {
            logger.error('复制选中项失败:', error);
            this.showNotification('复制失败', false);
        }
    }

    /**
     * 清空剪贴板历史功能
     * @returns {Promise<void>}
     */
    async clearClipboardHistory() {
        if (confirm('确定要清空所有剪贴板历史吗？')) {
            this.appState.clipboardHistory = [];
            await this.saveClipboardHistory();
            this.renderClipboardHistory();
            this.showNotification('已清空剪贴板历史');
        }
    }

    /**
     * 切换剪贴板历史显示
     */
    toggleClipboardHistory() {
        if (!this.elements.clipboard_history_container) return;
        
        this.appState.clipboardHistoryVisible = !this.appState.clipboardHistoryVisible;
        this.elements.clipboard_history_container.style.display = this.appState.clipboardHistoryVisible ? 'block' : 'none';
    }
}

// 导出单例
export default new ClipboardHistoryManager();
