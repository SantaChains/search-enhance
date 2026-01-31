// src/popup/main.js - 重构版本

import { 
    getSettings, 
    saveSettings, 
    addToHistory, 
    clearHistory,
    getHistory,
    createHistoryEntry,
    addToClipboardHistory,
    getClipboardHistory,
    clearClipboardHistory,
    removeFromClipboardHistory,
    removeMultipleFromClipboardHistory,
    updateClipboardHistoryItem,
    restoreClipboardHistoryItem,
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

import linkHistoryManager from '../utils/linkHistory.js';
import { copyToClipboard as copyToClipboardUtil } from '../utils/clipboard.js';

// 日志工具
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args)
};

// 防抖函数，用于优化频繁的UI更新
let debounceTimeout = null;
const debounce = (func, wait) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, wait);
};

// 应用状态
let appState = {
    settings: null,
    splitItemsState: [],
    clipboardMonitoring: false,
    lastClipboardContent: '',
    linkHistory: [],
    clipboardHistory: [],
    isClipboardHistoryExpanded: false,
    selectedClipboardItems: new Set()
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
        
        // 从storage读取最后一次剪贴板内容
        const { lastClipboardContent } = await chrome.storage.local.get('lastClipboardContent');
        
        // 更新应用状态
        if (lastClipboardContent) {
            appState.lastClipboardContent = lastClipboardContent;
            if (elements.search_input) {
                elements.search_input.value = lastClipboardContent;
                handleTextareaInput();
                updateSearchControlsPosition();
            }
        }
        
        // 从storage读取监控状态，优先使用已保存的状态
        const { clipboardMonitoring } = await chrome.storage.local.get('clipboardMonitoring');
        
        // 侧边栏的剪贴板监控默认开启
        appState.clipboardMonitoring = clipboardMonitoring !== false;
        
        // 更新UI状态
        updateClipboardButtonState(appState.clipboardMonitoring);
        
        // 保存监控状态到storage
        try {
            await chrome.storage.local.set({
                clipboardMonitoring: appState.clipboardMonitoring
            });
            
            // 侧边栏点击时刷新监控：发送消息给content script，更新监控状态
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                // 检查标签页是否允许注入脚本
                const isAllowedUrl = !tab.url.startsWith('chrome://') && 
                                     !tab.url.startsWith('edge://') && 
                                     !tab.url.startsWith('about:') &&
                                     !tab.url.startsWith('file://');
                
                if (isAllowedUrl) {
                    try {
                        // 先尝试发送消息
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'refreshClipboardMonitoring',
                            enabled: appState.clipboardMonitoring
                        });
                        logger.info('向content脚本发送消息成功');
                    } catch (sendError) {
                        // 优雅处理发送失败，可能是content脚本还未加载或其他原因
                        logger.warn('向content脚本发送消息失败:', sendError.message);
                        
                        // 尝试重新注入content script
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['src/content/index.js']
                            });
                            logger.info('重新注入content script成功');
                            
                            // 再次尝试发送消息
                            setTimeout(async () => {
                                try {
                                    await chrome.tabs.sendMessage(tab.id, {
                                        action: 'refreshClipboardMonitoring',
                                        enabled: appState.clipboardMonitoring
                                    });
                                    logger.info('重新发送消息成功');
                                } catch (retryError) {
                                    logger.warn('重新发送消息失败:', retryError.message);
                                }
                            }, 100);
                        } catch (injectError) {
                            logger.error('重新注入content script失败:', injectError);
                        }
                    }
                } else {
                    logger.info('当前标签页不允许注入脚本，跳过刷新监控状态');
                }
            }
        } catch (error) {
            logger.error('初始化剪贴板监控状态失败:', error);
        }
        
        // 加载剪贴历史
        appState.clipboardHistory = await getClipboardHistory();
        
        // 监听storage变化
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                // 处理剪贴板内容变化
                if (changes.lastClipboardContent) {
                    const newContent = changes.lastClipboardContent.newValue;
                    
                    // 只有内容实际变化时才更新，避免重复更新
                    if (newContent && newContent !== appState.lastClipboardContent) {
                        appState.lastClipboardContent = newContent;
                        
                        // 实时更新显示框，移除防抖以确保立即更新
                        if (elements.search_input) {
                            // 检查当前值是否已被用户手动修改，避免覆盖用户输入
                            if (elements.search_input.value !== newContent) {
                                elements.search_input.value = newContent;
                                elements.search_input.isManuallyResized = false;
                                handleTextareaInput();
                                updateSearchControlsPosition();
                            }
                        }
                        
                        // 优化：仅当剪贴历史展开时才显示通知，减少干扰
                        if (appState.isClipboardHistoryExpanded) {
                            showNotification('检测到剪贴板内容变化');
                        }
                        
                        // 添加到剪贴历史 - 使用防抖减少频繁的历史记录更新
                        debounce(() => {
                            if (newContent) {
                                addToClipboardHistory(newContent, 'clipboard-monitor')
                                    .then(() => {
                                        // 优化：仅当剪贴历史展开时才更新UI，减少不必要的渲染
                                        if (appState.isClipboardHistoryExpanded) {
                                            return getClipboardHistory();
                                        }
                                        return null;
                                    })
                                    .then(history => {
                                        if (history) {
                                            appState.clipboardHistory = history;
                                            renderClipboardHistory();
                                        }
                                    });
                            }
                        }, 300);
                    }
                }
                
                // 处理剪贴板监控状态变化
                if (changes.clipboardMonitoring) {
                    const newMonitoringState = changes.clipboardMonitoring.newValue;
                    appState.clipboardMonitoring = newMonitoringState;
                    updateClipboardButtonState(newMonitoringState);
                }
            }
        });
        
        // 监听剪贴板变化消息，添加到历史记录
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'clipboardChanged') {
            // 防抖处理：避免频繁更新历史记录
            debounce(() => {
                // 添加到剪贴历史
                addToClipboardHistory(request.content, 'clipboard-monitor')
                    .then(() => {
                        // 仅当剪贴历史展开时才更新UI，减少不必要的渲染
                        if (appState.isClipboardHistoryExpanded) {
                            return getClipboardHistory();
                        }
                        return null;
                    })
                    .then(history => {
                        if (history) {
                            appState.clipboardHistory = history;
                            renderClipboardHistory();
                        }
                    });
                
                // 根据消息源显示不同通知
                if (request.source === 'global') {
                    // 全局监控：显示通知
                    showNotification('检测到剪贴板内容变化');
                } else {
                    // 侧边栏监控：只在剪贴历史展开时显示通知
                    if (appState.isClipboardHistoryExpanded) {
                        showNotification('检测到剪贴板内容变化');
                    }
                }
            }, 300);
        }
    });
        
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
        'clipboard-history-container', 'toggle-clipboard-history-btn', 'clear-clipboard-history-btn',
        'select-all-clipboard-btn', 'batch-delete-clipboard-btn'
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
// 快捷键：Alt+K - 全局剪贴板监控（默认关闭）
// 侧边栏：默认开启，只在点击侧边栏时刷新监控

/**
 * 更新剪贴板按钮状态
 * @param {boolean} isActive - 是否激活
 */
function updateClipboardButtonState(isActive) {
    if (!elements.clipboard_btn) return;
    
    const statusIndicator = elements.clipboard_btn.querySelector('.clipboard-status');
    if (statusIndicator) {
        statusIndicator.classList.toggle('active', isActive);
    }
    
    // 更新开关状态
    const clipboardSwitch = document.querySelector('.clipboard-monitor-switch input[type="checkbox"]');
    if (clipboardSwitch) {
        clipboardSwitch.checked = isActive;
    }
}

/**
 * 切换剪贴板监控状态
 */
async function toggleClipboardMonitoring() {
    appState.clipboardMonitoring = !appState.clipboardMonitoring;
    
    // 更新UI状态
    updateClipboardButtonState(appState.clipboardMonitoring);
    
    // 保存监控状态到storage
    try {
        await chrome.storage.local.set({
            clipboardMonitoring: appState.clipboardMonitoring
        });
        
        // 发送消息给content script，更新监控状态
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            const isAllowedUrl = !tab.url.startsWith('chrome://') && 
                                 !tab.url.startsWith('edge://') && 
                                 !tab.url.startsWith('about:') &&
                                 !tab.url.startsWith('file://');
            
            if (isAllowedUrl) {
                try {
                    // 先尝试发送消息
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'refreshClipboardMonitoring',
                        enabled: appState.clipboardMonitoring
                    });
                    logger.info('向content脚本发送消息成功');
                } catch (sendError) {
                    // 优雅处理发送失败，可能是content脚本还未加载或其他原因
                    logger.warn('向content脚本发送消息失败:', sendError.message);
                    
                    // 尝试重新注入content script
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['src/content/index.js']
                        });
                        logger.info('重新注入content script成功');
                        
                        // 再次尝试发送消息
                        setTimeout(async () => {
                            try {
                                await chrome.tabs.sendMessage(tab.id, {
                                    action: 'refreshClipboardMonitoring',
                                    enabled: appState.clipboardMonitoring
                                });
                                logger.info('重新发送消息成功');
                            } catch (retryError) {
                                logger.warn('重新发送消息失败:', retryError.message);
                            }
                        }, 100);
                    } catch (injectError) {
                        logger.error('重新注入content script失败:', injectError);
                    }
                }
            }
        }
        
        showNotification(appState.clipboardMonitoring ? '剪贴板监控已开启' : '剪贴板监控已关闭');
    } catch (error) {
        logger.error('切换剪贴板监控状态失败:', error);
        showNotification('切换剪贴板监控状态失败', false);
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
            // 添加到链接历史管理
            await linkHistoryManager.addLink(isGithubRepo.githubUrl, '', 'text_processing');
        } else {
            await addToHistory(item);
            // 添加到链接历史管理
            await linkHistoryManager.addLink(item, '', 'text_processing');
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
        
        // 绑定链接点击事件，记录跳转链接到历史
        elements.link_extraction_result.querySelectorAll('.link-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                const url = e.currentTarget.href;
                addToHistoryEnhanced(url);
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
    
    // 绑定链接点击事件，记录跳转链接到历史
    elements.link_gen_container.querySelectorAll('.link-item a').forEach(link => {
        link.addEventListener('click', (e) => {
            const url = e.currentTarget.href;
            addToHistoryEnhanced(url);
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
    
    // 绑定链接点击事件，记录跳转链接到历史
    elements.multi_format_container.querySelectorAll('.link-item a').forEach(link => {
        link.addEventListener('click', (e) => {
            const url = e.currentTarget.href;
            addToHistoryEnhanced(url);
        });
    });
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
    
    // 绑定链接点击事件，记录跳转链接到历史
    document.querySelectorAll('.history-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const url = e.currentTarget.href;
            addToHistoryEnhanced(url);
        });
    });
}

// 复制到剪贴板
async function copyToClipboard(text, button) {
    try {
        const success = await copyToClipboardUtil(text);
        if (success) {
            showCopyFeedback(button);
            showNotification('已复制到剪贴板');
        } else {
            showNotification("复制失败", false);
        }
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
    
    // 移除了clipboard-monitor-switch元素，现在通过快捷键和侧边栏自动管理剪贴板监控
    
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
    
    // 剪贴历史监听器
    if (elements.toggle_clipboard_history_btn) {
        elements.toggle_clipboard_history_btn.addEventListener('click', toggleClipboardHistoryDisplay);
    }
    
    if (elements.clear_clipboard_history_btn) {
        elements.clear_clipboard_history_btn.addEventListener('click', handleClearClipboardHistory);
    }
    
    // 剪贴历史全选/取消全选按钮
    if (elements.select_all_clipboard_btn) {
        elements.select_all_clipboard_btn.addEventListener('click', toggleSelectAllClipboardItems);
    }
    
    // 剪贴历史批量删除按钮
    if (elements.batch_delete_clipboard_btn) {
        elements.batch_delete_clipboard_btn.addEventListener('click', batchDeleteClipboardItems);
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
    // 优化：使用防抖减少频繁的计算和DOM操作
    debounce(() => {
        adjustTextareaHeight();
        handleInputChange();
        updateSearchControlsPosition();
    }, 50);
}

// 调整textarea高度
function adjustTextareaHeight() {
    if (!elements.search_input) return;
    
    const textarea = elements.search_input;
    
    // 如果已经手动调整过大小，不进行自动调整
    if (textarea.isManuallyResized) return;
    
    // 优化：缓存计算结果，避免重复计算
    const maxHeight = window.innerHeight * 0.5; // 最大高度为浏览器高度的一半
    const minHeight = 32; // 最小高度32px
    
    // 优化：避免不必要的类操作
    // 添加自适应调整的CSS类
    if (!textarea.classList.contains('auto-resizing')) {
        textarea.classList.add('auto-resizing');
    }
    
    // 优化：仅当内容实际变化时才调整高度
    const currentHeight = parseInt(textarea.style.height || textarea.clientHeight);
    const scrollHeight = textarea.scrollHeight;
    
    // 计算新高度
    let newHeight = Math.max(minHeight, scrollHeight);
    newHeight = Math.min(newHeight, maxHeight);
    
    // 只有高度实际变化时才更新DOM，减少重绘和回流
    if (newHeight !== currentHeight) {
        textarea.style.height = 'auto'; // 重置高度以获取正确的scrollHeight
        newHeight = Math.max(minHeight, textarea.scrollHeight);
        newHeight = Math.min(newHeight, maxHeight);
        
        textarea.style.height = newHeight + 'px';
        
        // 如果内容超过最大高度，显示滚动条
        textarea.style.overflowY = textarea.scrollHeight > newHeight ? 'auto' : 'hidden';
    }
    
    // 移除自适应调整的CSS类
    setTimeout(() => {
        if (textarea.classList.contains('auto-resizing')) {
            textarea.classList.remove('auto-resizing');
        }
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

// 渲染剪贴历史
function renderClipboardHistory() {
    const container = elements.clipboard_history_container;
    if (!container) return;
    
    // 优化：检查是否需要渲染（仅当剪贴历史展开时才渲染）
    if (!appState.isClipboardHistoryExpanded) {
        return;
    }
    
    if (appState.clipboardHistory.length === 0) {
        container.innerHTML = `
            <div class="clipboard-history-empty">
                <p>暂无剪贴历史记录</p>
                <span>复制的内容将显示在这里</span>
            </div>
        `;
        // 禁用批量删除按钮
        if (elements.batch_delete_clipboard_btn) {
            elements.batch_delete_clipboard_btn.disabled = true;
        }
        return;
    }
    
    // 优化：使用文档片段减少DOM操作次数
    const fragment = document.createDocumentFragment();
    
    appState.clipboardHistory.forEach(item => {
        const isSelected = appState.selectedClipboardItems.has(item.id);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'clipboard-history-item';
        itemDiv.dataset.id = item.id;
        
        itemDiv.innerHTML = `
            <div class="clipboard-item-selection">
                <input type="checkbox" class="clipboard-item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
            </div>
            <div class="clipboard-item-content">
                <textarea class="clipboard-item-text" placeholder="剪贴内容">${item.content}</textarea>
                <div class="clipboard-item-info">
                    <span class="clipboard-item-time">${new Date(item.timestamp).toLocaleString()}</span>
                    ${item.isEdited ? '<span class="clipboard-item-edited">已编辑</span>' : ''}
                </div>
            </div>
            <div class="clipboard-item-actions">
                <button class="clipboard-item-use-btn" title="使用此内容">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check">
                        <path d="m20 6-10 14-5-5"/>
                    </svg>
                </button>
                ${item.isEdited ? `
                    <button class="clipboard-item-restore-btn" title="恢复原始内容">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw">
                            <path d="M23 4v6h-6"/>
                            <path d="M1 20v-6h6"/>
                            <path d="m3.51 9 9.01 9.01"/>
                            <path d="m10.5 4 9.01 9"/>
                        </svg>
                    </button>
                ` : ''}
                <button class="clipboard-item-delete-btn" title="删除此记录">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        <line x1="10" x2="10" y1="11" y2="17"/>
                        <line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                </button>
            </div>
        `;
        
        fragment.appendChild(itemDiv);
    });
    
    // 一次性更新DOM，减少重绘和回流
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // 绑定事件
    bindClipboardHistoryEvents();
    
    // 更新批量删除按钮状态
    updateBatchDeleteButtonState();
}

// 切换剪贴历史展开/折叠
function toggleClipboardHistoryDisplay() {
    const container = elements.clipboard_history_container;
    if (!container) return;
    
    const btn = elements.toggle_clipboard_history_btn;
    if (!btn) return;
    
    appState.isClipboardHistoryExpanded = !appState.isClipboardHistoryExpanded;
    container.style.display = appState.isClipboardHistoryExpanded ? 'block' : 'none';
    btn.textContent = appState.isClipboardHistoryExpanded ? '📋 隐藏' : '📋 剪贴';
}

// 更新批量删除按钮状态
function updateBatchDeleteButtonState() {
    if (elements.batch_delete_clipboard_btn) {
        elements.batch_delete_clipboard_btn.disabled = appState.selectedClipboardItems.size === 0;
    }
}

// 全选/取消全选剪贴历史项
function toggleSelectAllClipboardItems() {
    if (appState.clipboardHistory.length === 0) return;
    
    const isAllSelected = appState.selectedClipboardItems.size === appState.clipboardHistory.length;
    
    if (isAllSelected) {
        // 取消全选
        appState.selectedClipboardItems.clear();
    } else {
        // 全选
        appState.selectedClipboardItems = new Set(appState.clipboardHistory.map(item => item.id));
    }
    
    renderClipboardHistory();
}

// 批量删除选中的剪贴历史项
async function batchDeleteClipboardItems() {
    if (appState.selectedClipboardItems.size === 0) return;
    
    const deleteCount = appState.selectedClipboardItems.size;
    
    if (confirm(`确定要删除选中的 ${deleteCount} 项剪贴历史记录吗？此操作不可恢复。`)) {
        const success = await removeMultipleFromClipboardHistory([...appState.selectedClipboardItems]);
        if (success) {
            appState.clipboardHistory = await getClipboardHistory();
            appState.selectedClipboardItems.clear();
            renderClipboardHistory();
            showNotification(`已删除 ${deleteCount} 项剪贴历史记录`);
        }
    }
}

// 绑定剪贴历史事件
function bindClipboardHistoryEvents() {
    // 复选框事件
    document.querySelectorAll('.clipboard-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const itemId = e.target.dataset.id;
            if (e.target.checked) {
                appState.selectedClipboardItems.add(itemId);
            } else {
                appState.selectedClipboardItems.delete(itemId);
            }
            updateBatchDeleteButtonState();
        });
    });
    
    // 使用按钮事件
    document.querySelectorAll('.clipboard-item-use-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.closest('.clipboard-history-item').dataset.id;
            const item = appState.clipboardHistory.find(i => i.id === itemId);
            if (item && elements.search_input) {
                elements.search_input.value = item.content;
                elements.search_input.isManuallyResized = false;
                handleTextareaInput();
                updateSearchControlsPosition();
                showNotification('已使用剪贴历史内容');
            }
        });
    });
    
    // 恢复按钮事件
    document.querySelectorAll('.clipboard-item-restore-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = e.target.closest('.clipboard-history-item').dataset.id;
            const success = await restoreClipboardHistoryItem(itemId);
            if (success) {
                appState.clipboardHistory = await getClipboardHistory();
                renderClipboardHistory();
                showNotification('已恢复原始内容');
            }
        });
    });
    
    // 删除按钮事件
    document.querySelectorAll('.clipboard-item-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = e.target.closest('.clipboard-history-item').dataset.id;
            const success = await removeFromClipboardHistory(itemId);
            if (success) {
                appState.clipboardHistory = await getClipboardHistory();
                // 移除已删除项的选中状态
                appState.selectedClipboardItems.delete(itemId);
                renderClipboardHistory();
                showNotification('已删除剪贴历史记录');
            }
        });
    });
    
    // 文本编辑事件
    document.querySelectorAll('.clipboard-item-text').forEach(textarea => {
        textarea.addEventListener('change', async (e) => {
            const itemId = e.target.closest('.clipboard-history-item').dataset.id;
            const newContent = e.target.value;
            const success = await updateClipboardHistoryItem(itemId, newContent);
            if (success) {
                appState.clipboardHistory = await getClipboardHistory();
                renderClipboardHistory();
                showNotification('已更新剪贴历史记录');
            }
        });
    });
}

// 清空剪贴历史
async function handleClearClipboardHistory() {
    if (confirm('确定要清空所有剪贴历史记录吗？此操作不可恢复。')) {
        const success = await clearClipboardHistory();
        if (success) {
            appState.clipboardHistory = [];
            renderClipboardHistory();
            showNotification('已清空剪贴历史记录');
        }
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