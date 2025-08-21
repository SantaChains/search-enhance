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
            const isChecked = engine.name === settings.defaultEngine ? 'checked' : '';
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <input type="radio" name="default-engine" value="${engine.name}" ${isChecked} data-index="${index}">
                <span>${engine.name}</span>
                <span class="template">${engine.template}</span>
                <button data-index="${index}">删除</button>
            `;
            engineList.appendChild(item);
        });
        // Add event listeners for new elements
        engineList.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => handleRemoveEngine(parseInt(e.target.dataset.index)));
        });
        engineList.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => handleSetDefaultEngine(e.target.value));
        });
    }

    function renderHistoryList() {
        historyList.innerHTML = '';
        settings.history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.textContent = item;
            historyList.appendChild(div);
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
            alert('请提供有效的名称和包含 "%s" 的URL模板。');
        }
    }

    async function handleRemoveEngine(index) {
        // Prevent deleting the last engine
        if (settings.searchEngines.length <= 1) {
            alert("必须至少保留一个搜索引擎。");
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
                    alert('无效的配置文件。');
                }
            } catch (error) {
                alert('解析配置文件失败。');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
});