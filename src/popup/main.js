// src/popup/main.js
import { getSettings, saveSettings, addToHistory } from '../utils/storage.js';
import {
    isURL,
    processTextExtraction,
    splitText,
    processPath,
    processLinkGeneration,
    analyzeTextForMultipleFormats
} from '../utils/textProcessor.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const clipboardBtn = document.getElementById('clipboard-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const extractSwitch = document.getElementById('switch-extract'); // ID from HTML
    const linkGenSwitch = document.getElementById('switch-link-gen'); // ID from HTML
    const multiFormatSwitch = document.getElementById('switch-multi-format'); // ID from HTML
    const clipboardMonitorSwitch = document.getElementById('clipboard-monitor-switch');
    
    // Panels
    const extractContainer = document.getElementById('extract-container');
    const linkGenContainer = document.getElementById('link-gen-container');
    const multiFormatContainer = document.getElementById('multi-format-container');

    // Extraction Sub-Tools
    const pathConversionTool = document.getElementById('path-conversion-tool');
    const pathQuoteCheckbox = document.getElementById('path-quote-checkbox');
    const pathConversionResult = document.getElementById('path-conversion-result');
    const linkExtractionResult = document.getElementById('link-extraction-result');
    const textSplittingTool = document.getElementById('text-splitting-tool');
    
    // Splitting Tool Elements
    const splitDelimiterSelect = document.getElementById('split-delimiter-select');
    const refreshSplitBtn = document.getElementById('refresh-split-btn');
    const splitOutputContainer = document.getElementById('split-output-container');
    const copySelectedBtn = document.getElementById('copy-selected-btn');
    const copyOptSpace = document.getElementById('copy-opt-space');
    const copyOptNewline = document.getElementById('copy-opt-newline');
    const copyOptTab = document.getElementById('copy-opt-tab');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');

    // --- State ---
    let settings = await getSettings();
    let splitItemsState = [];
    let clipboardMonitoring = false;
    let lastClipboardContent = '';
    let clipboardInterval = null;

    // --- Initial Setup ---
    setupFloatingView();
    setupEventListeners();
    updateClipboardButtonState(clipboardMonitoring); // 初始化剪贴板按钮状态
    await handleContextMenuText();

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        if (clipboardBtn) {
            clipboardBtn.addEventListener('click', toggleClipboardMonitoringLegacy);
        }
        
        if (clipboardMonitorSwitch) {
            clipboardMonitorSwitch.addEventListener('change', toggleClipboardMonitoring);
        }
        
        settingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('src/settings/index.html'));
        });

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
            else handleInputChange();
        });
        searchBtn.addEventListener('click', handleSearch);

        extractSwitch.addEventListener('change', () => handleSwitchChange(extractSwitch, [linkGenSwitch, multiFormatSwitch], extractContainer));
        linkGenSwitch.addEventListener('change', () => handleSwitchChange(linkGenSwitch, [extractSwitch, multiFormatSwitch], linkGenContainer));
        multiFormatSwitch.addEventListener('change', () => handleSwitchChange(multiFormatSwitch, [extractSwitch, linkGenSwitch], multiFormatContainer));
        
        refreshSplitBtn.addEventListener('click', () => renderSplittingTool(searchInput.value));
        copySelectedBtn.addEventListener('click', handleCopy);
        selectAllCheckbox.addEventListener('change', handleSelectAll);
        pathQuoteCheckbox.addEventListener('change', () => renderExtractionUI(searchInput.value));
    }

    // --- 剪贴板监听功能 ---
    async function toggleClipboardMonitoring() {
        clipboardMonitoring = clipboardMonitorSwitch.checked;
        
        if (clipboardMonitoring) {
            try {
                // 请求剪贴板权限
                await navigator.permissions.query({name: 'clipboard-read'});
                startClipboardMonitoring();
                showNotification('剪贴板监听已启动');
                updateClipboardButtonState(true);
            } catch (error) {
                console.warn('剪贴板权限请求失败:', error);
                clipboardMonitorSwitch.checked = false;
                clipboardMonitoring = false;
                showNotification('无法启动剪贴板监听');
                updateClipboardButtonState(false);
            }
        } else {
            stopClipboardMonitoring();
            showNotification('剪贴板监听已停止');
            updateClipboardButtonState(false);
        }
    }

    // 兼容旧版按钮的剪贴板监听
    async function toggleClipboardMonitoringLegacy() {
        clipboardMonitoring = !clipboardMonitoring;
        
        if (clipboardMonitoring) {
            // clipboardBtn.textContent = '📋✓'; // 不再修改按钮文本
            clipboardBtn.title = '停止监听剪贴板';
            startClipboardMonitoring();
            showNotification('剪贴板监听已启动');
            updateClipboardButtonState(true);
        } else {
            // clipboardBtn.textContent = '📋'; // 不再修改按钮文本
            clipboardBtn.title = '监听剪贴板';
            stopClipboardMonitoring();
            showNotification('剪贴板监听已停止');
            updateClipboardButtonState(false);
        }
    }

    // 更新剪贴板按钮状态指示器
    function updateClipboardButtonState(isActive) {
        const statusIndicator = clipboardBtn.querySelector('.clipboard-status') || 
            (() => {
                const indicator = document.createElement('span');
                indicator.className = 'clipboard-status';
                clipboardBtn.appendChild(indicator);
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
                    searchInput.value = text;
                    handleInputChange();
                    
                    // 显示提示
                    showNotification('检测到剪贴板内容变化');
                }
            } catch (err) {
                console.log('无法读取剪贴板内容:', err);
            }
        }, 1000);
    }

    function stopClipboardMonitoring() {
        if (clipboardInterval) {
            clearInterval(clipboardInterval);
            clipboardInterval = null;
        }
    }

    function showNotification(message) {
        // 移除现有的通知
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 3秒后自动移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // --- UI Logic ---
    function setupFloatingView() {
        const params = new URLSearchParams(window.location.search);
        const isFloatingView = params.get('view') === 'floating';
        const closeBtn = document.getElementById('close-btn');
        if (isFloatingView && closeBtn) {
            closeBtn.style.display = 'block';
            closeBtn.addEventListener('click', () => window.close());
        }
    }

    async function handleContextMenuText() {
        const data = await chrome.storage.local.get('selectedText');
        if (data.selectedText) {
            searchInput.value = data.selectedText;
            chrome.storage.local.remove('selectedText');
            handleInputChange();
        }
        searchInput.focus();
    }
    
    function handleSwitchChange(activeSwitch, otherSwitches, activePanel) {
        if (activeSwitch.checked) {
            otherSwitches.forEach(sw => sw.checked = false);
            document.querySelectorAll('.result-panel').forEach(p => p.style.display = 'none');
            if (activePanel) activePanel.style.display = 'block';
        } else {
            if (activePanel) activePanel.style.display = 'none';
        }
        handleInputChange();
    }

    // --- Core Functionality ---
    function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        if (isURL(query)) {
            window.open(query, '_blank');
            addToHistory(query);
            return;
        }
        
        const engine = settings.searchEngines.find(e => e.name === settings.defaultEngine) || settings.searchEngines[0];
        const searchUrl = engine.template.replace('%s', encodeURIComponent(query));
        window.open(searchUrl, '_blank');
        addToHistory(query);
    }

    function handleInputChange() {
        const text = searchInput.value;
        if (!text.trim()) {
            extractContainer.style.display = 'none';
            linkGenContainer.style.display = 'none';
            if (multiFormatContainer) multiFormatContainer.style.display = 'none';
            extractSwitch.checked = false;
            linkGenSwitch.checked = false;
            multiFormatSwitch.checked = false;
            return;
        }

        if (extractSwitch.checked) {
            extractContainer.style.display = 'block';
            renderExtractionUI(text);
        } else if (linkGenSwitch.checked) {
            linkGenContainer.style.display = 'block';
            renderLinkGenerationUI(text);
        } else if (multiFormatSwitch.checked) {
            multiFormatContainer.style.display = 'block';
            renderMultiFormatAnalysis(text);
        }
    }

    function renderMultiFormatAnalysis(text) {
        const results = analyzeTextForMultipleFormats(text);
        
        if (!multiFormatContainer) {
            console.error('多格式分析容器未找到');
            return;
        }
        
        multiFormatContainer.innerHTML = '';
        multiFormatContainer.style.display = 'block';
        
        if (results.length === 0) {
            multiFormatContainer.innerHTML = '<div class="no-results">未检测到可处理的格式</div>';
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
            } else if (result.type === '链接提取' || result.type === '仓库链接') {
                result.data.forEach(link => {
                    const item = document.createElement('div');
                    item.className = 'link-item';
                    
                    const linkElement = document.createElement('a');
                    linkElement.href = link.url || link;
                    linkElement.textContent = link.url || link;
                    linkElement.target = '_blank';
                    
                    item.appendChild(linkElement);
                    content.appendChild(item);
                });
            }
            
            card.appendChild(content);
            multiFormatContainer.appendChild(card);
        });
    }

    function renderExtractionUI(text) {
        const pathResults = processPath(text);

        if (pathResults) {
            pathConversionTool.style.display = 'block';
            linkExtractionResult.style.display = 'none';
            textSplittingTool.style.display = 'none';
            
            const useQuotes = pathQuoteCheckbox.checked;
            pathConversionResult.innerHTML = pathResults.map(p => {
                const quotedPath = useQuotes ? `"${p}"` : p;
                return `<div class="path-item">
                    <button class="path-copy-btn" data-path="${p}">复制</button>
                    <pre>${quotedPath}</pre>
                </div>`;
            }).join('');
            
            document.querySelectorAll('.path-copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const path = e.target.dataset.path;
                    const textToCopy = pathQuoteCheckbox.checked ? `"${path}"` : path;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        showCopyFeedback(e.target);
                    });
                });
            });

        } else {
            pathConversionTool.style.display = 'none';
            linkExtractionResult.style.display = 'block';
            textSplittingTool.style.display = 'block';

            const { cleanedText, extractedLinks } = processTextExtraction(text);
            
            let linkHtml = '<h4>提取的链接</h4>';
            if (extractedLinks.length > 0) {
                linkHtml += extractedLinks.map(link => `<div><a href="${link}" target="_blank">${link}</a></div>`).join('');
            } else {
                linkHtml += '<p>未找到链接。</p>';
            }
            linkExtractionResult.innerHTML = linkHtml;
            
            renderSplittingTool(cleanedText);
        }
    }

    function renderSplittingTool(text) {
        const delimiter = splitDelimiterSelect.value;
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
        splitOutputContainer.innerHTML = html;
        addSplitItemListeners();
        selectAllCheckbox.checked = false;
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
            alert("未选择任何项目！");
            return;
        }

        let separator = '';
        // Define priority: Newline > Tab > Space
        // If multiple are selected, only the highest priority one is used.
        // This prevents ambiguous combinations. User can choose one.
        if (copyOptNewline.checked) {
            separator = '\n';
        } else if (copyOptTab.checked) {
            separator = '\t';
        } else if (copyOptSpace.checked) {
            separator = ' ';
        }

        const textToCopy = selectedItems.join(separator);
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback(copySelectedBtn);
        });
    }

    function renderLinkGenerationUI(text) {
        const links = processLinkGeneration(text);
        let html = '';
        if (links) {
            html = `<h4>生成的链接</h4>` + links.map(link => `<div><a href="${link}" target="_blank">${link}</a></div>`).join('');
        } else {
            html = '<p>请输入 "用户名/仓库名" 或已知的仓库URL。</p>';
        }
        linkGenContainer.innerHTML = html;
    }

    function showCopyFeedback(button) {
        const originalText = button.textContent;
        button.textContent = '已复制!';
        button.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
        }, 1500);
    }

    // --- Initial call ---
    handleInputChange();
});