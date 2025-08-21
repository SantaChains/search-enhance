// src/popup/main.js

/**
 * Enhanced Search Buddy Popup Script
 * Main application logic with improved performance and error handling
 */

import { 
    getSettings, 
    saveSettings, 
    addToHistory, 
    clearHistory,
    getHistory,
    DEFAULTS 
} from '../utils/storage.js';

import {
    isURL,
    processTextExtraction,
    splitText,
    processPath,
    processLinkGeneration,
    analyzeTextForMultipleFormats,
    classifyText
} from '../utils/textProcessor.js';

// Logging utility
const logger = {
    info: (message, ...args) => console.log(`[SearchBuddy] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SearchBuddy] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SearchBuddy] ${message}`, ...args)
};

logger.info("Popup main.js script is loading...");

document.addEventListener('DOMContentLoaded', async () => {
    logger.info("DOM fully loaded and parsed.");
    
    // --- DOM Elements ---
    const elements = {
        clipboardBtn: document.getElementById('clipboard-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        engineSelect: document.getElementById('engine-select'),
        extractSwitch: document.getElementById('switch-extract'),
        linkGenSwitch: document.getElementById('switch-link-gen'),
        multiFormatSwitch: document.getElementById('switch-multi-format'),
        clipboardMonitorSwitch: document.getElementById('clipboard-monitor-switch'),
        
        // Panels
        extractContainer: document.getElementById('extract-container'),
        linkGenContainer: document.getElementById('link-gen-container'),
        multiFormatContainer: document.getElementById('multi-format-container'),
        
        // Extraction Sub-Tools
        pathConversionTool: document.getElementById('path-conversion-tool'),
        pathQuoteCheckbox: document.getElementById('path-quote-checkbox'),
        pathConversionResult: document.getElementById('path-conversion-result'),
        linkExtractionResult: document.getElementById('link-extraction-result'),
        textSplittingTool: document.getElementById('text-splitting-tool'),
        
        // Splitting Tool Elements
        splitDelimiterSelect: document.getElementById('split-delimiter-select'),
        refreshSplitBtn: document.getElementById('refresh-split-btn'),
        splitOutputContainer: document.getElementById('split-output-container'),
        copySelectedBtn: document.getElementById('copy-selected-btn'),
        copyOptSpace: document.getElementById('copy-opt-space'),
        copyOptNewline: document.getElementById('copy-opt-newline'),
        copyOptTab: document.getElementById('copy-opt-tab'),
        selectAllCheckbox: document.getElementById('select-all-checkbox')
    };
    
    logger.info("DOM Elements retrieved successfully");
    
    // Validate critical elements
    if (!elements.searchInput || !elements.searchBtn) {
        logger.error("Critical DOM elements for search functionality are missing.");
        if (document.body) {
            document.body.innerHTML = "<div class='error-message'>界面加载失败，请尝试刷新或重新打开。</div>";
        }
        return;
    }
    
    // --- Application State ---
    let settings;
    try {
        settings = await getSettings();
        logger.info("Settings loaded successfully");
    } catch (error) {
        logger.error("Failed to load settings:", error);
        settings = { ...DEFAULTS };
    }
    
    let splitItemsState = [];
    let clipboardMonitoring = false;
    let lastClipboardContent = '';
    let clipboardInterval = null;

    // --- Notification System ---
    function showNotification(message, isSuccess = true) {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        const baseStyles = `
            position: fixed;
            top: 15px;
            right: 15px;
            color: white;
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        const successColor = '#10b981'; // green-500
        const errorColor = '#ef4444'; // red-500
        
        notification.style.cssText = baseStyles + `background: ${isSuccess ? successColor : errorColor};`;
        
        if (document.body) {
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        } else {
            logger.warn("Cannot show notification: document.body is not available.");
        }
    }

    // --- Clipboard Management ---
    async function toggleClipboardMonitoring() {
        clipboardMonitoring = elements.clipboardMonitorSwitch.checked;
        
        if (clipboardMonitoring) {
            try {
                await navigator.permissions.query({name: 'clipboard-read'});
                startClipboardMonitoring();
                showNotification('剪贴板监听已启动');
            } catch (error) {
                logger.warn('剪贴板权限请求失败:', error);
                elements.clipboardMonitorSwitch.checked = false;
                clipboardMonitoring = false;
                showNotification('无法启动剪贴板监听', false);
            }
        } else {
            stopClipboardMonitoring();
            showNotification('剪贴板监听已停止');
        }
    }

    async function toggleClipboardMonitoringLegacy() {
        clipboardMonitoring = !clipboardMonitoring;
        
        if (clipboardMonitoring) {
            elements.clipboardBtn.title = '停止监听剪贴板';
            startClipboardMonitoring();
            showNotification('剪贴板监听已启动');
        } else {
            elements.clipboardBtn.title = '监听剪贴板';
            stopClipboardMonitoring();
            showNotification('剪贴板监听已停止');
        }
        updateClipboardButtonState(clipboardMonitoring);
    }

    function updateClipboardButtonState(isActive) {
        if (!elements.clipboardBtn) return;
        
        const statusIndicator = elements.clipboardBtn.querySelector('.clipboard-status') || 
            (() => {
                const indicator = document.createElement('span');
                indicator.className = 'clipboard-status';
                elements.clipboardBtn.appendChild(indicator);
                return indicator;
            })();
        
        statusIndicator.classList.toggle('active', isActive);
    }

    async function startClipboardMonitoring() {
        if (clipboardInterval) {
            clearInterval(clipboardInterval);
        }
        
        clipboardInterval = setInterval(async () => {
            if (!clipboardMonitoring) return;
            
            try {
                const text = await navigator.clipboard.readText();
                if (text && text !== lastClipboardContent && text.trim().length > 0) {
                    lastClipboardContent = text;
                    if (elements.searchInput) {
                        elements.searchInput.value = text;
                        handleInputChange();
                    }
                    showNotification('检测到剪贴板内容变化');
                }
            } catch (err) {
                logger.info('无法读取剪贴板内容 (可能是权限问题):', err.message);
            }
        }, 1000);
    }

    function stopClipboardMonitoring() {
        if (clipboardInterval) {
            clearInterval(clipboardInterval);
            clipboardInterval = null;
        }
    }

    // --- UI Rendering Functions ---
    function renderEngineSelect() {
        if (!elements.engineSelect) return;

        elements.engineSelect.innerHTML = '';

        settings.searchEngines.forEach(engine => {
            const option = document.createElement('option');
            option.value = engine.name;
            option.textContent = engine.name;
            if (engine.name === settings.defaultEngine) {
                option.selected = true;
            }
            elements.engineSelect.appendChild(option);
        });
    }

    async function handleContextMenuText() {
        try {
            const data = await chrome.storage.local.get('selectedText');
            if (data.selectedText) {
                elements.searchInput.value = data.selectedText;
                chrome.storage.local.remove('selectedText');
                handleInputChange();
                renderEngineSelect(); 
            }
            elements.searchInput.focus();
        } catch (error) {
            logger.error("Error handling context menu text:", error);
        }
    }
    
    function handleSwitchChange(activeSwitch, otherSwitches, activePanel) {
        logger.info(`Switch changed: ${activeSwitch.id} is now ${activeSwitch.checked}`);
        
        if (activeSwitch.checked) {
            otherSwitches.forEach(sw => {
                if (sw) sw.checked = false;
            });
            
            document.querySelectorAll('.result-panel').forEach(p => {
                if (p) p.style.display = 'none';
            });
            
            if (activePanel) {
                activePanel.style.display = 'block';
                logger.info(`Panel ${activePanel.id} displayed.`);
            } else {
                logger.warn("Active panel is null or undefined.");
            }
        } else {
            if (activePanel) activePanel.style.display = 'none';
        }
        handleInputChange();
    }

    // --- Core Search Functionality ---
    function handleSearch() {
        const query = elements.searchInput.value.trim();
        if (!query) return;

        if (isURL(query)) {
            window.open(query, '_blank');
            addToHistory(query);
            return;
        }
        
        let selectedEngineName = settings.defaultEngine;
        let selectedEngineObject = settings.searchEngines.find(e => e.name === selectedEngineName);
        
        if (elements.engineSelect && elements.engineSelect.value) {
            const tempSelectedEngineName = elements.engineSelect.value;
            const tempSelectedEngineObject = settings.searchEngines.find(e => e.name === tempSelectedEngineName);
            if (tempSelectedEngineObject) {
                selectedEngineName = tempSelectedEngineName;
                selectedEngineObject = tempSelectedEngineObject;
            }
        }
        
        if (!selectedEngineObject) {
            selectedEngineObject = settings.searchEngines[0];
        }

        if (selectedEngineObject) {
            const searchUrl = selectedEngineObject.template.replace('%s', encodeURIComponent(query));
            window.open(searchUrl, '_blank');
            addToHistory(query);
        } else {
            logger.error("No search engine available to perform search.");
            showNotification("配置错误：没有可用的搜索引擎。", false);
        }
    }

    function handleInputChange() {
        const text = elements.searchInput.value;
        if (!text.trim()) {
            elements.extractContainer.style.display = 'none';
            elements.linkGenContainer.style.display = 'none';
            if (elements.multiFormatContainer) elements.multiFormatContainer.style.display = 'none';
            elements.extractSwitch.checked = false;
            elements.linkGenSwitch.checked = false;
            elements.multiFormatSwitch.checked = false;
            return;
        }

        if (elements.extractSwitch.checked) {
            elements.extractContainer.style.display = 'block';
            renderExtractionUI(text);
        } else if (elements.linkGenSwitch.checked) {
            elements.linkGenContainer.style.display = 'block';
            renderLinkGenerationUI(text);
        } else if (elements.multiFormatSwitch.checked) {
            elements.multiFormatContainer.style.display = 'block';
            renderMultiFormatAnalysis(text);
        }
    }

    function renderMultiFormatAnalysis(text) {
        const results = analyzeTextForMultipleFormats(text);
        
        if (!elements.multiFormatContainer) {
            logger.error('多格式分析容器未找到');
            return;
        }
        
        elements.multiFormatContainer.innerHTML = '';
        elements.multiFormatContainer.style.display = 'block';
        
        if (results.length === 0) {
            elements.multiFormatContainer.innerHTML = '<div class="no-results">未检测到可处理的格式</div>';
            return;
        }

        results.forEach(result => {
            const card = document.createElement('div');
            card.className = 'format-card';
            
            const header = document.createElement('div');
            header.className = 'format-header';
            header.textContent = result.type;
            card.appendChild(header);
            
            const content = document.createElement('div');
            content.className = 'format-content';
            
            if (result.type === '路径转换') {
                result.data.forEach(path => {
                    const item = document.createElement('div');
                    item.className = 'path-item';
                    
                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = '复制';
                    copyBtn.className = 'copy-btn';
                    copyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(path);
                        showCopyFeedback(copyBtn);
                    });
                    
                    const pathText = document.createElement('span');
                    pathText.textContent = path;
                    pathText.className = 'path-text';
                    
                    item.appendChild(copyBtn);
                    item.appendChild(pathText);
                    content.appendChild(item);
                });
            } else if (result.type === '链接提取' || result.type === '仓库链接' || result.type === 'GitHub链接') {
                result.data.forEach(linkObj => {
                    const linkUrl = linkObj.url || linkObj;
                    addToHistory(linkUrl);
                    
                    const item = document.createElement('div');
                    item.className = 'link-item';
                    
                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = '复制';
                    copyBtn.className = 'copy-btn copy-link-btn';
                    copyBtn.dataset.link = linkUrl;
                    copyBtn.addEventListener('click', (e) => {
                        const linkToCopy = e.target.dataset.link;
                        navigator.clipboard.writeText(linkToCopy).then(() => {
                            showCopyFeedback(e.target);
                        });
                    });
                    
                    const linkElement = document.createElement('a');
                    linkElement.href = linkUrl;
                    linkElement.textContent = linkUrl;
                    linkElement.target = '_blank';
                    
                    item.appendChild(copyBtn);
                    item.appendChild(linkElement);
                    content.appendChild(item);
                });
            }
            
            card.appendChild(content);
            elements.multiFormatContainer.appendChild(card);
        });
    }

    function renderExtractionUI(text) {
        const pathResults = processPath(text);

        if (pathResults) {
            elements.pathConversionTool.style.display = 'block';
            elements.linkExtractionResult.style.display = 'none';
            elements.textSplittingTool.style.display = 'none';
            
            const useQuotes = elements.pathQuoteCheckbox.checked;
            elements.pathConversionResult.innerHTML = pathResults.map(p => {
                const quotedPath = useQuotes ? `"${p}"` : p;
                return `<div class="path-item">
                    <button class="path-copy-btn" data-path="${p}">复制</button>
                    <pre>${quotedPath}</pre>
                </div>`;
            }).join('');
            
            document.querySelectorAll('.path-copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const path = e.target.dataset.path;
                    const textToCopy = elements.pathQuoteCheckbox.checked ? `"${path}"` : path;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        showCopyFeedback(e.target);
                    });
                });
            });

        } else {
            elements.pathConversionTool.style.display = 'none';
            elements.linkExtractionResult.style.display = 'block';
            elements.textSplittingTool.style.display = 'block';

            const { cleanedText, extractedLinks } = processTextExtraction(text);
            
            let linkHtml = '<h4>提取的链接</h4>';
            if (extractedLinks.length > 0) {
                linkHtml += extractedLinks.map(link => {
                    addToHistory(link);
                    return `<div class="link-item">
                        <button class="copy-btn copy-link-btn" data-link="${link}">复制</button>
                        <a href="${link}" target="_blank">${link}</a>
                    </div>`;
                }).join('');
            } else {
                linkHtml += '<p>未找到链接。</p>';
            }
            elements.linkExtractionResult.innerHTML = linkHtml;
            
            document.querySelectorAll('.copy-link-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const link = e.target.dataset.link;
                    navigator.clipboard.writeText(link).then(() => {
                        showCopyFeedback(e.target);
                    });
                });
            });

            renderSplittingTool(cleanedText);
        }
    }

    function renderSplittingTool(text) {
        const delimiter = elements.splitDelimiterSelect.value;
        const splitItems = splitText(text, delimiter);
        
        splitItemsState = splitItems.map(item => ({ text: item, selected: false }));
        
        const ITEMS_PER_ROW = 5;
        let html = '';
        for (let i = 0; i < splitItemsState.length; i += ITEMS_PER_ROW) {
            const rowItems = splitItemsState.slice(i, i + ITEMS_PER_ROW);
            const rowNum = Math.floor(i / ITEMS_PER_ROW) + 1;
            html += `<div class="split-row">
                <div class="split-row-header">
                    <input type="checkbox" class="split-row-checkbox" data-row-start-index="${i}">
                    <span>${rowNum}</span>
                </div>
                <div class="split-row-items">
                    ${rowItems.map((item, index) => `<div class="split-item" data-index="${i + index}">${item.text}</div>`).join('')}
                </div>
            </div>`;
        }
        elements.splitOutputContainer.innerHTML = html;
        addSplitItemListeners();
        elements.selectAllCheckbox.checked = false;
    }

    function addSplitItemListeners() {
        document.querySelectorAll('.split-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                splitItemsState[index].selected = !splitItemsState[index].selected;
                e.target.classList.toggle('selected', splitItemsState[index].selected);
            });
        });

        document.querySelectorAll('.split-row-checkbox').forEach(el => {
            el.addEventListener('change', (e) => {
                const startIndex = parseInt(e.target.dataset.rowStartIndex);
                const endIndex = Math.min(startIndex + 5, splitItemsState.length);
                for (let i = startIndex; i < endIndex; i++) {
                    splitItemsState[i].selected = e.target.checked;
                    document.querySelector(`.split-item[data-index="${i}"]`).classList.toggle('selected', e.target.checked);
                }
            });
        });
    }

    function handleSelectAll(e) {
        const isSelected = e.target.checked;
        splitItemsState.forEach(item => item.selected = isSelected);
        document.querySelectorAll('.split-item').forEach(el => el.classList.toggle('selected', isSelected));
        document.querySelectorAll('.split-row-checkbox').forEach(cb => cb.checked = isSelected);
    }

    function handleCopy() {
        const selectedItems = splitItemsState.filter(item => item.selected).map(item => item.text);
        if (selectedItems.length === 0) {
            showNotification("未选择任何项目！", false);
            return;
        }

        let separator = '';
        if (elements.copyOptNewline && elements.copyOptNewline.checked) {
            separator = '\n';
        } else if (elements.copyOptTab && elements.copyOptTab.checked) {
            separator = '\t';
        } else if (elements.copyOptSpace && elements.copyOptSpace.checked) {
            separator = ' ';
        }

        const textToCopy = selectedItems.join(separator);
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback(elements.copySelectedBtn);
            showNotification(`已复制 ${selectedItems.length} 项`);
        }).catch(err => {
            logger.error("复制到剪贴板失败:", err);
            showNotification("复制失败，请手动复制。", false);
        });
    }

    function renderLinkGenerationUI(text) {
        const linkGenResult = processLinkGeneration(text);
        let html = '';
        if (linkGenResult) {
            if (linkGenResult.originalGithubLink) {
                addToHistory(linkGenResult.originalGithubLink);
            }
            
            html = `<h4>生成的链接</h4>` + linkGenResult.generatedLinks.map(link => {
                addToHistory(link);
                return `<div class="link-item">
                    <button class="copy-btn copy-link-btn" data-link="${link}">复制</button>
                    <a href="${link}" target="_blank">${link}</a>
                </div>`;
            }).join('');
        } else {
            html = '<p>请输入 "用户名/仓库名" 或已知的仓库URL。</p>';
        }
        elements.linkGenContainer.innerHTML = html;
        
        document.querySelectorAll('.copy-link-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.target.dataset.link;
                navigator.clipboard.writeText(link).then(() => {
                    showCopyFeedback(e.target);
                });
            });
        });
    }

    function showCopyFeedback(button) {
        if (!button || typeof button.textContent === 'undefined') {
            logger.warn("Invalid button element passed to showCopyFeedback");
            return;
        }
        const originalText = button.textContent;
        const originalBackgroundColor = button.style.backgroundColor;
        
        button.textContent = '已复制!';
        button.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            if (button.parentNode) {
                button.textContent = originalText;
                button.style.backgroundColor = originalBackgroundColor;
            }
        }, 1500);
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        logger.info("Setting up event listeners...");
        
        if (elements.clipboardBtn) {
            elements.clipboardBtn.addEventListener('click', toggleClipboardMonitoringLegacy);
        }
        
        if (elements.clipboardMonitorSwitch) {
            elements.clipboardMonitorSwitch.addEventListener('change', toggleClipboardMonitoring);
        }
        
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => {
                chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('src/settings/index.html'));
            });
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') handleSearch();
                else handleInputChange();
            });
        }
        
        if (elements.searchBtn) {
            elements.searchBtn.addEventListener('click', handleSearch);
        }

        if (elements.engineSelect) {
            elements.engineSelect.addEventListener('change', () => {
                logger.info("Engine select changed to:", elements.engineSelect.value);
            });
        }

        if (elements.extractSwitch) {
            elements.extractSwitch.addEventListener('change', () => handleSwitchChange(elements.extractSwitch, [elements.linkGenSwitch, elements.multiFormatSwitch], elements.extractContainer));
        }
        
        if (elements.linkGenSwitch) {
            elements.linkGenSwitch.addEventListener('change', () => handleSwitchChange(elements.linkGenSwitch, [elements.extractSwitch, elements.multiFormatSwitch], elements.linkGenContainer));
        }
        
        if (elements.multiFormatSwitch) {
            elements.multiFormatSwitch.addEventListener('change', () => handleSwitchChange(elements.multiFormatSwitch, [elements.extractSwitch, elements.linkGenSwitch], elements.multiFormatContainer));
        }
        
        if (elements.refreshSplitBtn) {
            elements.refreshSplitBtn.addEventListener('click', () => renderSplittingTool(elements.searchInput ? elements.searchInput.value : ''));
        }
        
        if (elements.copySelectedBtn) {
            elements.copySelectedBtn.addEventListener('click', handleCopy);
        }
        
        if (elements.selectAllCheckbox) {
            elements.selectAllCheckbox.addEventListener('change', handleSelectAll);
        }
        
        if (elements.pathQuoteCheckbox) {
            elements.pathQuoteCheckbox.addEventListener('change', () => renderExtractionUI(elements.searchInput ? elements.searchInput.value : ''));
        }
        
        logger.info("Finished setting up event listeners.");
    }

    // --- Initialize Application ---
    setupEventListeners();
    updateClipboardButtonState(clipboardMonitoring);
    renderEngineSelect();
    await handleContextMenuText();
    handleInputChange();

    logger.info("SearchBuddy application initialized successfully");
});