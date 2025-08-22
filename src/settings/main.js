// src/settings/main.js
import { getSettings, saveSettings } from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const engineList = document.getElementById('engine-list');
    const newEngineNameInput = document.getElementById('new-engine-name');
    const newEngineTemplateInput = document.getElementById('new-engine-template');
    const addEngineBtn = document.getElementById('add-engine-btn');
    
    const historyList = document.getElementById('history-list');
    const historyLimitInput = document.getElementById('history-limit-input');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    const exportBtn = document.getElementById('export-btn');
    const importFileInput = document.getElementById('import-file-input');

    // --- State ---
    let settings = await getSettings();

    // --- Initial Rendering ---
    renderEngineList();
    renderHistoryList();
    historyLimitInput.value = settings.historyLimit;

    // --- Event Listeners ---
    addEngineBtn.addEventListener('click', handleAddEngine);
    clearHistoryBtn.addEventListener('click', handleClearHistory);
    exportBtn.addEventListener('click', handleExport);
    importFileInput.addEventListener('change', handleImport);
    historyLimitInput.addEventListener('change', handleHistoryLimitChange);

    // --- Functions ---
    function renderEngineList() {
        engineList.innerHTML = '';
        settings.searchEngines.forEach((engine, index) => {
            const isDefault = engine.name === settings.defaultEngine;
            const item = document.createElement('div');
            item.className = 'engine-item';
            item.innerHTML = `
                <input type="radio" name="default-engine" value="${engine.name}" ${isDefault ? 'checked' : ''} data-index="${index}" id="engine-${index}" style="margin-right: 8px;">
                <div class="engine-info">
                    <div class="engine-name">${engine.name}</div>
                    <div class="engine-url">${engine.template}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn delete" data-index="${index}" title="删除">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" x2="10" y1="11" y2="17"/>
                            <line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;
            engineList.appendChild(item);
        });
        // Add event listeners for new elements
        engineList.querySelectorAll('.engine-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                handleRemoveEngine(index);
            });
        });
        engineList.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => handleSetDefaultEngine(e.target.value));
        });
    }

    function renderHistoryList() {
        historyList.innerHTML = '';
        
        if (settings.history.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <p>暂无历史记录</p>
                <span>您的搜索历史将显示在这里</span>
            `;
            historyList.appendChild(emptyState);
            return;
        }
        
        settings.history.forEach((item, index) => {
            // 处理新旧格式兼容性
            let url, title;
            
            if (typeof item === 'string') {
                url = item;
                try {
                    const urlObj = new URL(url);
                    title = urlObj.hostname;
                } catch (e) {
                    title = '搜索查询';
                }
            } else if (item && typeof item === 'object') {
                url = item.url || item.toString();
                title = item.domain || item.title || '未知域名';
            } else {
                return; // 跳过无效项
            }
            
            const div = document.createElement('div');
            div.className = 'engine-item';
            div.innerHTML = `
                <div class="engine-info">
                    <div class="engine-name">${title}</div>
                    <div class="engine-url">${url}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn" data-url="${url}" title="复制" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>
            `;
            historyList.appendChild(div);
        });
        
        // 添加复制按钮事件
        historyList.querySelectorAll('.engine-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                navigator.clipboard.writeText(url)
                    .then(() => showNotification('已复制到剪贴板'))
                    .catch(err => console.error('复制失败:', err));
            });
        });
    }

    async function handleAddEngine() {
        const name = newEngineNameInput.value.trim();
        const template = newEngineTemplateInput.value.trim();
        if (name && template && template.includes('%s')) {
            settings.searchEngines.push({ name, template });
            await saveSettings(settings);
            renderEngineList();
            newEngineNameInput.value = '';
            newEngineTemplateInput.value = '';
            showNotification('搜索引擎添加成功！');
        } else {
            showNotification('请提供有效的名称和包含 "%s" 的URL模板', false);
        }
    }

    async function handleRemoveEngine(index) {
        // Prevent deleting the last engine
        if (settings.searchEngines.length <= 1) {
            showNotification("必须至少保留一个搜索引擎", false);
            return;
        }
        const removedEngine = settings.searchEngines.splice(index, 1)[0];
        // If the default engine was removed, set the first one as the new default
        if (settings.defaultEngine === removedEngine.name) {
            settings.defaultEngine = settings.searchEngines[0].name;
        }
        await saveSettings(settings);
        renderEngineList();
        showNotification('搜索引擎已删除');
    }

    async function handleSetDefaultEngine(name) {
        settings.defaultEngine = name;
        await saveSettings(settings);
        showNotification('默认搜索引擎已更新');
        // No need to re-render, the radio button is already checked
    }

    async function handleHistoryLimitChange() {
        const limit = parseInt(historyLimitInput.value);
        if (!isNaN(limit) && limit >= 0) {
            settings.historyLimit = limit;
            await saveSettings(settings);
            showNotification('历史记录限制已更新');
        }
    }

    async function handleClearHistory() {
        if (confirm('确定要清空所有搜索历史吗？')) {
            settings.history = [];
            await saveSettings(settings);
            renderHistoryList();
            showNotification('搜索历史已清空');
        }
    }

    function handleExport() {
        const dataStr = JSON.stringify(settings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'search-buddy-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('配置已导出');
    }

    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedSettings = JSON.parse(e.target.result);
                if (importedSettings.searchEngines && importedSettings.history) {
                    settings = { ...settings, ...importedSettings };
                    await saveSettings(settings);
                    renderEngineList();
                    renderHistoryList();
                    historyLimitInput.value = settings.historyLimit;
                    showNotification('设置导入成功！');
                } else {
                    showNotification('无效的配置文件', false);
                }
            } catch (error) {
                showNotification('解析配置文件失败', false);
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function showNotification(message, isSuccess = true) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isSuccess ? 'var(--success)' : 'var(--danger)'};
            color: white;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            z-index: 10000;
            font-size: 14px;
            box-shadow: var(--shadow-md);
            animation: slideIn 0.3s ease-out;
        `;
        
        // 添加动画
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
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            if (style.parentNode) {
                style.remove();
            }
        }, 3000);
    }
});