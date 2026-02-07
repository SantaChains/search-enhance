// src/settings/main.js
import { getSettings, saveSettings, DEFAULTS } from '../utils/storage.js';

// XSS防护：HTML转义函数
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

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
    
    // --- Tokenizer Settings Elements ---
    const cnUseDictInput = document.getElementById('cn-use-dict');
    const cnUseAlgoInput = document.getElementById('cn-use-algo');
    const aiEnabledInput = document.getElementById('ai-enabled');
    const aiProviderInput = document.getElementById('ai-provider');
    const aiBaseURLInput = document.getElementById('ai-base-url');
    const aiApiKeyInput = document.getElementById('ai-api-key');
    const aiModelInput = document.getElementById('ai-model');
    const aiModelCustomInput = document.getElementById('ai-model-custom');
    const aiProtocolInput = document.getElementById('ai-protocol');
    const sentenceModeInput = document.getElementById('sentence-mode');
    const charBreakLengthInput = document.getElementById('char-break-length');
    const randomMinLenInput = document.getElementById('random-min-len');
    const randomMaxLenInput = document.getElementById('random-max-len');
    const namingRemoveSymbolInput = document.getElementById('naming-remove-symbol');
    const historyMaxSizeInput = document.getElementById('history-max-size');
    const saveTokenizerBtn = document.getElementById('save-tokenizer-btn');
    const testAIConnectionBtn = document.getElementById('test-ai-connection-btn');
    const aiTestResult = document.getElementById('ai-test-result');

    // --- State ---
    let settings = await getSettings();

    // --- Initial Rendering ---
    renderEngineList();
    renderHistoryList();
    historyLimitInput.value = settings.historyLimit;
    
    // 初始化分词设置
    initTokenizerSettings();

    // --- Event Listeners ---
    addEngineBtn.addEventListener('click', handleAddEngine);
    clearHistoryBtn.addEventListener('click', handleClearHistory);
    exportBtn.addEventListener('click', handleExport);
    importFileInput.addEventListener('change', handleImport);
    historyLimitInput.addEventListener('change', handleHistoryLimitChange);
    
    // 分词设置事件
    saveTokenizerBtn.addEventListener('click', handleSaveTokenizerSettings);
    
    // AI启用开关事件
    aiEnabledInput.addEventListener('change', handleAIEnabledChange);
    
    // AI模型选择切换事件
    aiModelInput.addEventListener('change', handleModelChange);
    
    // 测试AI连接事件
    testAIConnectionBtn.addEventListener('click', handleTestAIConnection);
    
    // 初始化响应式布局
    initResponsiveLayout();

    // --- Functions ---
    function renderEngineList() {
        engineList.innerHTML = '';
        settings.searchEngines.forEach((engine, index) => {
            const isDefault = engine.name === settings.defaultEngine;
            const item = document.createElement('div');
            item.className = 'engine-item';
            const safeName = escapeHtml(engine.name);
            const safeTemplate = escapeHtml(engine.template);
            item.innerHTML = `
                <input type="radio" name="default-engine" value="${safeName}" ${isDefault ? 'checked' : ''} data-index="${index}" id="engine-${index}" style="margin-right: 8px;">
                <div class="engine-info">
                    <div class="engine-name">${safeName}</div>
                    <div class="engine-url">${safeTemplate}</div>
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
                return;
            }
            
            const safeTitle = escapeHtml(title);
            const safeUrl = escapeHtml(url);
            const div = document.createElement('div');
            div.className = 'engine-item';
            div.innerHTML = `
                <div class="engine-info">
                    <div class="engine-name">${safeTitle}</div>
                    <div class="engine-url">${safeUrl}</div>
                </div>
                <div class="engine-actions">
                    <button class="engine-btn" data-url="${safeUrl}" title="复制" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>
            `;
            historyList.appendChild(div);
        });
        
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
        if (settings.searchEngines.length <= 1) {
            showNotification("必须至少保留一个搜索引擎", false);
            return;
        }
        const removedEngine = settings.searchEngines.splice(index, 1)[0];
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
                    // 重新加载分词设置
                    initTokenizerSettings();
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

    /**
     * 初始化分词设置
     * 从存储加载分词配置到UI
     */
    function initTokenizerSettings() {
        const ts = settings.tokenizerSettings || DEFAULTS.tokenizerSettings;
        
        cnUseDictInput.checked = ts.cnUseDict !== false;
        cnUseAlgoInput.checked = ts.cnUseAlgo !== false;
        
        // AI设置
        aiEnabledInput.checked = ts.aiEnabled === true;
        updateAIConfigVisibility(ts.aiEnabled === true);
        aiProviderInput.value = ts.aiProvider || 'openai';
        aiBaseURLInput.value = ts.aiBaseURL || '';
        aiApiKeyInput.value = ts.aiApiKey || '';
        
        // 处理模型选择
        const savedModel = ts.aiModel || 'gpt-4o-mini';
        const predefinedModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-1.5-flash'];
        const customRow = document.getElementById('ai-model-custom-row');
        if (predefinedModels.includes(savedModel)) {
            aiModelInput.value = savedModel;
            if (customRow) {
                customRow.style.display = 'none';
            }
        } else {
            aiModelInput.value = 'custom';
            aiModelCustomInput.value = savedModel;
            if (customRow) {
                customRow.style.display = 'flex';
            }
        }
        
        aiProtocolInput.value = ts.aiDefaultProtocol || 'https://';
        sentenceModeInput.value = ts.sentenceMode || 'sentence';
        charBreakLengthInput.value = ts.charBreakLength || 100;
        randomMinLenInput.value = ts.randomMinLen || 1;
        randomMaxLenInput.value = ts.randomMaxLen || 10;
        namingRemoveSymbolInput.checked = ts.namingRemoveSymbol !== false;
        historyMaxSizeInput.value = ts.historyMaxSize || 6;
    }
    
    /**
     * 处理AI启用开关变化
     */
    function handleAIEnabledChange() {
        updateAIConfigVisibility(aiEnabledInput.checked);
    }
    
    /**
     * 更新AI配置区域可见性
     */
    function updateAIConfigVisibility(enabled) {
        const aiConfigContainer = document.getElementById('ai-config-container');
        if (aiConfigContainer) {
            aiConfigContainer.style.display = enabled ? 'block' : 'none';
        }
    }
    
    /**
     * 处理模型选择变化
     */
    function handleModelChange() {
        const customRow = document.getElementById('ai-model-custom-row');
        if (aiModelInput.value === 'custom') {
            if (customRow) {
                customRow.style.display = 'flex';
            }
            aiModelCustomInput.focus();
        } else {
            if (customRow) {
                customRow.style.display = 'none';
            }
            aiModelCustomInput.value = '';
        }
    }
    
    /**
     * 获取当前选中的模型值
     */
    function getCurrentModel() {
        if (aiModelInput.value === 'custom') {
            return aiModelCustomInput.value.trim() || 'gpt-4o-mini';
        }
        return aiModelInput.value;
    }
    
    /**
     * 测试AI连接
     */
    async function handleTestAIConnection() {
        const baseURL = aiBaseURLInput.value.trim();
        const apiKey = aiApiKeyInput.value.trim();
        const model = getCurrentModel();
        const provider = aiProviderInput.value;
        
        if (!baseURL) {
            showTestResult('请输入 Base URL', 'error');
            return;
        }
        if (!apiKey) {
            showTestResult('请输入 API Key', 'error');
            return;
        }
        
        showTestResult('测试中...', 'loading');
        testAIConnectionBtn.disabled = true;
        
        try {
            // 构建请求URL
            const url = baseURL.endsWith('/') ? baseURL : baseURL + '/';
            const chatUrl = url + 'chat/completions';
            
            // 发送测试请求
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 5
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    showTestResult('连接成功！', 'success');
                } else {
                    showTestResult('连接成功但响应异常', 'warning');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
                showTestResult(`连接失败: ${errorMsg}`, 'error');
            }
        } catch (error) {
            showTestResult(`连接失败: ${error.message}`, 'error');
        } finally {
            testAIConnectionBtn.disabled = false;
        }
    }
    
    /**
     * 显示测试结果
     */
    function showTestResult(message, type) {
        aiTestResult.textContent = message;
        aiTestResult.className = 'test-result ' + type;
        
        // 3秒后清除成功消息
        if (type === 'success') {
            setTimeout(() => {
                aiTestResult.textContent = '';
                aiTestResult.className = 'test-result';
            }, 3000);
        }
    }

    /**
     * 保存分词设置
     * 从UI读取配置并保存到存储
     */
    async function handleSaveTokenizerSettings() {
        const tokenizerSettings = {
            cnUseDict: cnUseDictInput.checked,
            cnUseAlgo: cnUseAlgoInput.checked,
            aiEnabled: aiEnabledInput.checked,
            aiProvider: aiProviderInput.value,
            aiBaseURL: aiBaseURLInput.value.trim(),
            aiApiKey: aiApiKeyInput.value.trim(),
            aiModel: getCurrentModel(),
            aiDefaultProtocol: aiProtocolInput.value,
            sentenceMode: sentenceModeInput.value,
            charBreakLength: parseInt(charBreakLengthInput.value) || 100,
            randomMinLen: parseInt(randomMinLenInput.value) || 1,
            randomMaxLen: parseInt(randomMaxLenInput.value) || 10,
            namingRemoveSymbol: namingRemoveSymbolInput.checked,
            historyMaxSize: parseInt(historyMaxSizeInput.value) || 6
        };

        // 验证输入
        if (tokenizerSettings.charBreakLength < 10 || tokenizerSettings.charBreakLength > 500) {
            showNotification('字符断行长度必须在10-500之间', false);
            return;
        }

        if (tokenizerSettings.randomMinLen < 1 || tokenizerSettings.randomMinLen > 10) {
            showNotification('随机分词最小长度必须在1-10之间', false);
            return;
        }

        if (tokenizerSettings.randomMaxLen < 5 || tokenizerSettings.randomMaxLen > 50) {
            showNotification('随机分词最大长度必须在5-50之间', false);
            return;
        }

        if (tokenizerSettings.randomMinLen > tokenizerSettings.randomMaxLen) {
            showNotification('随机分词最小长度不能大于最大长度', false);
            return;
        }

        if (tokenizerSettings.historyMaxSize < 1 || tokenizerSettings.historyMaxSize > 10) {
            showNotification('历史栈上限必须在1-10之间', false);
            return;
        }

        // 验证 Base URL 格式（如果填写了的话）
        if (tokenizerSettings.aiBaseURL) {
            try {
                new URL(tokenizerSettings.aiBaseURL);
            } catch {
                showNotification('请输入有效的 Base URL', false);
                return;
            }
        }

        // 保存设置
        settings.tokenizerSettings = tokenizerSettings;
        const success = await saveSettings(settings);
        
        if (success) {
            showNotification('分词设置已保存！');
        } else {
            showNotification('保存失败，请重试', false);
        }
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

/**
 * 初始化响应式布局
 */
function initResponsiveLayout() {
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            const container = document.getElementById('resizable-container');
            
            if (width < 480) {
                document.body.classList.add('narrow-layout');
                document.body.classList.remove('medium-layout', 'wide-layout');
            } else if (width < 768) {
                document.body.classList.add('medium-layout');
                document.body.classList.remove('narrow-layout', 'wide-layout');
            } else {
                document.body.classList.add('wide-layout');
                document.body.classList.remove('narrow-layout', 'medium-layout');
            }
        }
    });
    
    const container = document.getElementById('resizable-container');
    if (container) {
        resizeObserver.observe(container);
    }
}
