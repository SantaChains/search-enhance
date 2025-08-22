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
    analyzeTextForMultipleFormats
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
    linkHistory: []
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
        
        // 设置事件监听器
        setupEventListeners();
        
        // 初始化UI
        renderEngineSelect();
        updateClipboardButtonState(false);
        renderHistory();
        
        // 初始化textarea自适应高度
        initializeTextareaAutoResize();
        
        // 初始化响应式布局
        initializeResponsiveLayout();
        
        // 设置剪贴板监控默认启动
        if (elements.clipboard_monitor_switch) {
            elements.clipboard_monitor_switch.checked = true;
            toggleClipboardMonitoring();
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
        'clipboard-monitor-switch', 'clipboard-btn', 'settings-btn',
        'extract-container', 'link-gen-container', 'multi-format-container',
        'path-conversion-tool', 'path-quote-checkbox', 'path-conversion-result',
        'link-extraction-result', 'text-splitting-tool',
        'split-delimiter-select', 'refresh-split-btn', 'split-output-container',
        'copy-selected-btn', 'copy-opt-space', 'copy-opt-newline', 'copy-opt-tab',
        'select-all-checkbox', 'show-history-btn', 'export-history-btn',
        'clear-history-btn', 'history-container', 'history-search', 'history-list'
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
    appState.clipboardMonitoring = elements.clipboard_monitor_switch.checked;
    
    if (appState.clipboardMonitoring) {
        try {
            await startClipboardMonitoring();
            showNotification('剪贴板监控已启动');
        } catch (error) {
            logger.warn('剪贴板监控启动失败:', error);
            elements.clipboard_monitor_switch.checked = false;
            appState.clipboardMonitoring = false;
            showNotification('无法启动剪贴板监控', false);
        }
    } else {
        stopClipboardMonitoring();
        showNotification('剪贴板监控已停止');
    }
    
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
                if (elements.search_input) {
                    elements.search_input.value = text;
                    
                    // 重置手动调整标记，允许自适应调整
                    elements.search_input.isManuallyResized = false;
                    
                    // 触发输入处理和高度调整
                    handleTextareaInput();
                    
                    // 更新搜索控件位置
                    updateSearchControlsPosition();
                }
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

function updateClipboardButtonState(isActive) {
    if (!elements.clipboard_btn) return;
    
    const statusIndicator = elements.clipboard_btn.querySelector('.clipboard-status');
    if (statusIndicator) {
        statusIndicator.classList.toggle('active', isActive);
    }
}

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
        renderMultiFormatAnalysis(text);
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
            <div class="format-content" id="format-${result.type.replace(/\s+/g, '-')}"></div>
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
        }
        
        elements.multi_format_container.appendChild(card);
    });
    
    // 绑定复制事件
    elements.multi_format_container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.dataset.path || e.target.dataset.link;
            copyToClipboard(text, e.target);
        });
    });
}

// 文本拆分工具渲染
function renderSplittingTool(text) {
    if (!elements.split_delimiter_select || !elements.split_output_container) {
        logger.error('拆分工具UI元素缺失');
        return;
    }
    
    const delimiter = elements.split_delimiter_select.value;
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

// 复制到剪贴板
async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
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
            elements.clipboard_monitor_switch.checked = !elements.clipboard_monitor_switch.checked;
            toggleClipboardMonitoring();
        });
    }
    
    if (elements.clipboard_monitor_switch) {
        elements.clipboard_monitor_switch.addEventListener('change', toggleClipboardMonitoring);
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
    
    logger.info("事件监听器设置完成");
}

// 设置开关容器监听器，支持点击整个div区域
function setupSwitchContainerListeners() {
    const switchContainers = document.querySelectorAll('.switch-container');
    
    switchContainers.forEach(container => {
        const checkbox = container.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        
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
                    handleSwitchChange(checkbox, 'multi-format-container');
                    break;
                case 'clipboard':
                    toggleClipboardMonitoring();
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