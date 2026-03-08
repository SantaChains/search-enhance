/**
 * Schema 导入导出测试脚本
 * 用于验证统一 Schema 的导入导出功能
 */

import {
    validateSchema,
    detectLegacyFormat,
    convertLegacyToNew,
    parseImportData,
    extractDataForContext,
    createFullExport,
    createSettingsExport,
    createLinkHistoryExport,
    createClipboardHistoryExport,
    EXPORT_TYPES,
    IMPORT_CONTEXTS,
} from '../src/utils/exportImportSchema.js';

// 测试统计
let testStats = {
    passed: 0,
    failed: 0,
    total: 0
};

/**
 * 更新测试统计显示
 */
function updateStats() {
    const passedEl = document.getElementById('stat-passed');
    const failedEl = document.getElementById('stat-failed');
    const totalEl = document.getElementById('stat-total');
    
    if (passedEl) passedEl.textContent = testStats.passed;
    if (failedEl) failedEl.textContent = testStats.failed;
    if (totalEl) totalEl.textContent = testStats.total;
}

/**
 * 记录日志
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型 (info|success|error)
 */
function log(message, type = 'info') {
    const logEl = document.getElementById('validation-log');
    if (!logEl) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    logEl.innerHTML += `[${timestamp}] ${prefix} ${message}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

/**
 * 显示测试结果
 * @param {string} elementId - 结果元素ID
 * @param {string} message - 显示消息
 * @param {boolean} isSuccess - 是否成功
 */
function showResult(elementId, message, isSuccess = true) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.textContent = message;
    el.className = `result ${isSuccess ? 'success' : 'error'}`;
    el.style.display = 'block';
    
    testStats.total++;
    if (isSuccess) {
        testStats.passed++;
    } else {
        testStats.failed++;
    }
    updateStats();
}

/**
 * 加载示例数据
 */
export async function loadSampleData() {
    try {
        const response = await fetch('sample.schema.json');
        const data = await response.json();
        const textArea = document.getElementById('text-import');
        if (textArea) {
            textArea.value = JSON.stringify(data, null, 2);
        }
        log('示例数据已加载到文本框');
    } catch (error) {
        log(`加载示例数据失败: ${error.message}`, 'error');
    }
}

/**
 * 测试从文件导入完整备份
 */
export async function testImportFull() {
    const fileInput = document.getElementById('file-import-full');
    const file = fileInput?.files[0];
    
    if (!file) {
        showResult('result-import-full', '请先选择一个 JSON 文件', false);
        return;
    }

    try {
        const text = await file.text();
        const result = parseImportData(text, IMPORT_CONTEXTS.SETTINGS);
        
        if (result.success) {
            const extractResult = extractDataForContext(result.data, IMPORT_CONTEXTS.SETTINGS);
            if (extractResult.success) {
                const dataKeys = Object.keys(extractResult.data);
                showResult('result-import-full', 
                    `✅ 导入成功！\n` +
                    `导出类型: ${result.data.metadata.exportType}\n` +
                    `导出时间: ${result.data.metadata.exportDate}\n` +
                    `包含数据: ${dataKeys.join(', ')}\n` +
                    `是否为旧格式: ${result.isLegacy ? '是' : '否'}`,
                    true
                );
                log(`成功导入文件: ${file.name}`, 'success');
            } else {
                showResult('result-import-full', `❌ 提取数据失败: ${extractResult.error}`, false);
                log(`提取数据失败: ${extractResult.error}`, 'error');
            }
        } else {
            showResult('result-import-full', `❌ 解析失败: ${result.error}`, false);
            log(`解析失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult('result-import-full', `❌ 错误: ${error.message}`, false);
        log(`导入错误: ${error.message}`, 'error');
    }
}

/**
 * 测试从文本导入
 */
export function testImportFromText() {
    const text = document.getElementById('text-import')?.value;
    
    if (!text?.trim()) {
        showResult('result-import-text', '请先输入 JSON 数据', false);
        return;
    }

    try {
        const result = parseImportData(text, IMPORT_CONTEXTS.SETTINGS);
        
        if (result.success) {
            const validation = validateSchema(result.data);
            showResult('result-import-text',
                `✅ 解析成功！\n` +
                `应用名称: ${result.data.metadata.appName}\n` +
                `版本: ${result.data.metadata.version}\n` +
                `导出类型: ${result.data.metadata.exportType}\n` +
                `验证结果: ${validation.valid ? '有效' : '无效'}\n` +
                `是否为旧格式: ${result.isLegacy ? '是' : '否'}`,
                true
            );
            log('文本导入测试通过', 'success');
        } else {
            showResult('result-import-text', `❌ 解析失败: ${result.error}`, false);
            log(`文本导入失败: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult('result-import-text', `❌ 错误: ${error.message}`, false);
        log(`文本导入错误: ${error.message}`, 'error');
    }
}

/**
 * 测试导出完整备份
 */
export function testExportFull() {
    try {
        const settings = {
            searchEngines: [
                { name: 'Bing', template: 'https://www.bing.com/search?q=%s' }
            ],
            defaultEngine: 'Bing'
        };
        
        const linkHistory = {
            items: [{ id: '1', url: 'https://example.com', title: 'Example' }],
            settings: { enabled: true, maxItems: 100 }
        };
        
        const clipboardHistory = {
            items: [{ id: '1', text: 'test', preview: 'test' }],
            settings: { enabled: true, maxItems: 100 }
        };

        const exportData = createFullExport(settings, linkHistory, clipboardHistory);
        const validation = validateSchema(exportData);
        
        showResult('result-export-full',
            `✅ 导出成功！\n` +
            `导出类型: ${exportData.metadata.exportType}\n` +
            `验证结果: ${validation.valid ? '有效' : '无效'}\n` +
            `数据分区: ${Object.keys(exportData.data).join(', ')}\n` +
            `JSON 大小: ${JSON.stringify(exportData).length} 字节`,
            true
        );
        log('完整备份导出测试通过', 'success');
    } catch (error) {
        showResult('result-export-full', `❌ 导出失败: ${error.message}`, false);
        log(`导出失败: ${error.message}`, 'error');
    }
}

/**
 * 测试导出设置
 */
export function testExportSettings() {
    try {
        const settings = {
            searchEngines: [{ name: 'Google', template: 'https://google.com/search?q=%s' }],
            defaultEngine: 'Google'
        };
        
        const exportData = createSettingsExport(settings);
        
        showResult('result-export-partial',
            `✅ 设置导出成功！\n` +
            `导出类型: ${exportData.metadata.exportType}\n` +
            `包含数据: ${Object.keys(exportData.data).join(', ')}`,
            true
        );
        log('设置导出测试通过', 'success');
    } catch (error) {
        showResult('result-export-partial', `❌ 导出失败: ${error.message}`, false);
        log(`设置导出失败: ${error.message}`, 'error');
    }
}

/**
 * 测试导出链接历史
 */
export function testExportLinkHistory() {
    try {
        const items = [{ id: '1', url: 'https://github.com', title: 'GitHub' }];
        const settings = { enabled: true, maxItems: 100 };
        
        const exportData = createLinkHistoryExport(items, settings);
        
        showResult('result-export-partial',
            `✅ 链接历史导出成功！\n` +
            `导出类型: ${exportData.metadata.exportType}\n` +
            `记录数: ${exportData.data.linkHistory.items.length}`,
            true
        );
        log('链接历史导出测试通过', 'success');
    } catch (error) {
        showResult('result-export-partial', `❌ 导出失败: ${error.message}`, false);
        log(`链接历史导出失败: ${error.message}`, 'error');
    }
}

/**
 * 测试导出剪贴板历史
 */
export function testExportClipboardHistory() {
    try {
        const items = [{ id: '1', text: 'clipboard text', preview: 'clipboard' }];
        const settings = { enabled: true, maxItems: 100, autoSave: true };
        
        const exportData = createClipboardHistoryExport(items, settings);
        
        showResult('result-export-partial',
            `✅ 剪贴板历史导出成功！\n` +
            `导出类型: ${exportData.metadata.exportType}\n` +
            `记录数: ${exportData.data.clipboardHistory.items.length}`,
            true
        );
        log('剪贴板历史导出测试通过', 'success');
    } catch (error) {
        showResult('result-export-partial', `❌ 导出失败: ${error.message}`, false);
        log(`剪贴板历史导出失败: ${error.message}`, 'error');
    }
}

/**
 * 测试旧格式设置
 */
export function testLegacySettings() {
    try {
        // 旧格式：直接包含 searchEngines
        const legacyData = {
            searchEngines: [
                { name: 'Bing', template: 'https://www.bing.com/search?q=%s' }
            ],
            defaultEngine: 'Bing',
            historyLimit: 100
        };
        
        const legacyType = detectLegacyFormat(legacyData);
        const converted = convertLegacyToNew(legacyData, legacyType, IMPORT_CONTEXTS.SETTINGS);
        const validation = validateSchema(converted);
        
        showResult('result-legacy-settings',
            `✅ 旧格式转换成功！\n` +
            `检测到的格式: ${legacyType}\n` +
            `转换后类型: ${converted.metadata.exportType}\n` +
            `验证结果: ${validation.valid ? '有效' : '无效'}`,
            true
        );
        log('旧格式设置兼容测试通过', 'success');
    } catch (error) {
        showResult('result-legacy-settings', `❌ 转换失败: ${error.message}`, false);
        log(`旧格式设置测试失败: ${error.message}`, 'error');
    }
}

/**
 * 测试旧格式链接历史
 */
export function testLegacyLinkHistory() {
    try {
        // 旧格式：直接是数组
        const legacyData = [
            { id: '1', url: 'https://example.com', title: 'Example' }
        ];
        
        const legacyType = detectLegacyFormat(legacyData);
        const converted = convertLegacyToNew(legacyData, legacyType, IMPORT_CONTEXTS.LINK_HISTORY);
        const validation = validateSchema(converted);
        
        showResult('result-legacy-link',
            `✅ 旧格式转换成功！\n` +
            `检测到的格式: ${legacyType}\n` +
            `转换后类型: ${converted.metadata.exportType}\n` +
            `记录数: ${converted.data.linkHistory.items.length}\n` +
            `验证结果: ${validation.valid ? '有效' : '无效'}`,
            true
        );
        log('旧格式链接历史兼容测试通过', 'success');
    } catch (error) {
        showResult('result-legacy-link', `❌ 转换失败: ${error.message}`, false);
        log(`旧格式链接历史测试失败: ${error.message}`, 'error');
    }
}

/**
 * 初始化测试页面
 */
export function initSchemaTest() {
    log('Schema 测试页面已加载');
    log('点击"加载示例数据"按钮加载 sample.schema.json');
    
    // 绑定全局函数到 window 对象
    window.loadSampleData = loadSampleData;
    window.testImportFull = testImportFull;
    window.testImportFromText = testImportFromText;
    window.testExportFull = testExportFull;
    window.testExportSettings = testExportSettings;
    window.testExportLinkHistory = testExportLinkHistory;
    window.testExportClipboardHistory = testExportClipboardHistory;
    window.testLegacySettings = testLegacySettings;
    window.testLegacyLinkHistory = testLegacyLinkHistory;
}

// 如果页面已加载，自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSchemaTest);
} else {
    initSchemaTest();
}
