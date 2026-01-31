// src/utils/storage.js

/**
 * Enhanced Storage Management Utilities
 * Provides robust data persistence with error handling and validation
 */

// Storage keys constants
export const STORAGE_KEYS = {
    SEARCH_ENGINES: 'searchEngines',
    HISTORY: 'history',
    HISTORY_LIMIT: 'historyLimit',
    CLIPBOARD_HISTORY: 'clipboardHistory',
    CLIPBOARD_HISTORY_LIMIT: 'clipboardHistoryLimit',
    DEFAULT_ENGINE: 'defaultEngine',
    USER_PREFERENCES: 'userPreferences',
    LAST_BACKUP: 'lastBackup',
    CLIPBOARD_MONITORING: 'clipboardMonitoring',
    CLIPBOARD_MONITORING_TYPE: 'clipboardMonitoringType', // 'shortcut' or 'sidebar'
    LAST_CLIPBOARD_CONTENT: 'lastClipboardContent'
};

// Default settings with enhanced search engines
export const DEFAULTS = {
    searchEngines: [
        { name: 'Bing', template: 'https://www.bing.com/search?q=%s', category: 'general' },
        { name: 'Google', template: 'https://www.google.com/search?q=%s', category: 'general' },
        { name: 'Google Scholar', template: 'https://scholar.google.com/scholar?q=%s', category: 'academic' },
        { name: 'Metaso', template: 'https://metaso.cn/search?q=%s', category: 'ai' },
        { name: 'Sogou', template: 'https://www.sogou.com/web?query=%s', category: 'general' },
        { name: 'GitHub', template: 'https://github.com/search?q=%s', category: 'code' },
        { name: 'Stack Overflow', template: 'https://stackoverflow.com/search?q=%s', category: 'code' },
        { name: 'MDN', template: 'https://developer.mozilla.org/en-US/search?q=%s', category: 'docs' },
    ],
    history: [],
    historyLimit: 100,
    clipboardHistory: [],
    clipboardHistoryLimit: 50,
    defaultEngine: 'Bing',
    userPreferences: {
        theme: 'auto',
        language: 'zh-CN',
        autoClipboard: false,
        showNotifications: true,
        compactMode: false
    },
    lastBackup: null
};

// Utility functions
const logger = {
    info: (message, ...args) => console.log(`[Storage] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Storage] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[Storage] ${message}`, ...args)
};

/**
 * Validates settings object structure
 * @param {object} settings - Settings to validate
 * @returns {boolean} - Whether settings are valid
 */
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object') return false;
    
    // Validate search engines
    if (settings.searchEngines && Array.isArray(settings.searchEngines)) {
        for (const engine of settings.searchEngines) {
            if (!engine.name || !engine.template || typeof engine.name !== 'string' || typeof engine.template !== 'string') {
                return false;
            }
        }
    }
    
    // Validate history
    if (settings.history && !Array.isArray(settings.history)) return false;
    
    // Validate history limit
    if (settings.historyLimit && (typeof settings.historyLimit !== 'number' || settings.historyLimit < 1)) return false;
    
    return true;
}

/**
 * Get settings from chrome.storage.local with enhanced error handling
 * @returns {Promise<object>} Settings object
 */
export async function getSettings() {
    try {
        const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
        const settings = { ...DEFAULTS, ...data };
        
        // Validate loaded settings
        if (!validateSettings(settings)) {
            logger.warn('Invalid settings detected, using defaults');
            return DEFAULTS;
        }
        
        return settings;
    } catch (error) {
        logger.error('Failed to load settings:', error);
        return DEFAULTS;
    }
}

/**
 * Save settings to chrome.storage.local with validation
 * @param {object} settings - Settings to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveSettings(settings) {
    try {
        if (!validateSettings(settings)) {
            logger.error('Invalid settings provided for saving');
            return false;
        }
        
        await chrome.storage.local.set(settings);
        logger.info('Settings saved successfully');
        return true;
    } catch (error) {
        logger.error('Failed to save settings:', error);
        return false;
    }
}

/**
 * Add a record to history with enhanced GitHub repository detection
 * @param {string} item - Item to add to history
 * @returns {Promise<boolean>} Success status
 */
export async function addToHistory(item) {
    try {
        if (!item || typeof item !== 'string' || !item.trim()) {
            logger.warn('Invalid history item provided');
            return false;
        }
        
        const { history, historyLimit } = await getSettings();
        const trimmedItem = item.trim();
        
        // Enhanced history entry with metadata
        const historyEntry = createHistoryEntry(trimmedItem);
        
        // Remove duplicates (by URL) and add to front
        const filteredHistory = history.filter(h => {
            const existing = typeof h === 'string' ? h : h.url;
            return existing !== historyEntry.url;
        });
        const newHistory = [historyEntry, ...filteredHistory];
        
        // Enforce history limit
        if (newHistory.length > historyLimit) {
            newHistory.length = historyLimit;
        }
        
        const success = await saveSettings({ history: newHistory });
        if (success) {
            logger.info(`Added to history: ${trimmedItem.substring(0, 50)}...`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to add to history:', error);
        return false;
    }
}

/**
 * Create enhanced history entry with metadata
 * @param {string} url - URL to create entry for
 * @returns {object} History entry with metadata
 */
export function createHistoryEntry(url) {
    const entry = {
        url,
        timestamp: new Date().toISOString(),
        type: 'other',
        domain: '',
        title: '',
        isGitHubRepo: false,
        repoInfo: null
    };
    
    try {
        const urlObj = new URL(url);
        entry.domain = urlObj.hostname;
        
        // GitHub repository detection
        if (urlObj.hostname === 'github.com') {
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                entry.type = 'github';
                entry.isGitHubRepo = true;
                entry.repoInfo = {
                    username: pathParts[0],
                    repository: pathParts[1],
                    fullName: `${pathParts[0]}/${pathParts[1]}`
                };
                entry.title = entry.repoInfo.fullName;
            }
        }
        // Other code platforms
        else if (['zread.ai', 'deepwiki.com', 'context7.com'].includes(urlObj.hostname)) {
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2) {
                entry.type = 'code_platform';
                entry.repoInfo = {
                    username: pathParts[0],
                    repository: pathParts[1],
                    fullName: `${pathParts[0]}/${pathParts[1]}`
                };
                entry.title = entry.repoInfo.fullName;
            }
        }
        // Regular websites
        else {
            entry.type = 'website';
            entry.title = urlObj.hostname;
        }
    } catch (e) {
        // If not a valid URL, treat as search query
        entry.type = 'search';
        entry.title = url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
    
    return entry;
}

/**
 * Clear history
 * @returns {Promise<boolean>} Success status
 */
export async function clearHistory() {
    try {
        const success = await saveSettings({ history: [] });
        if (success) {
            logger.info('History cleared successfully');
        }
        return success;
    } catch (error) {
        logger.error('Failed to clear history:', error);
        return false;
    }
}

/**
 * Get history with enhanced filtering options
 * @param {number} limit - Maximum number of items to return
 * @param {string} filter - Optional filter string
 * @param {string} type - Optional type filter ('github', 'website', 'search', 'all')
 * @returns {Promise<Array>} History items
 */
export async function getHistory(limit = null, filter = null, type = 'all') {
    try {
        const { history } = await getSettings();
        let filteredHistory = history;
        
        // Ensure backward compatibility - convert string entries to objects
        filteredHistory = history.map(item => {
            if (typeof item === 'string') {
                return createHistoryEntry(item);
            }
            return item;
        });
        
        // Apply type filter
        if (type && type !== 'all') {
            filteredHistory = filteredHistory.filter(item => {
                if (type === 'github') {
                    return item.type === 'github' || item.isGitHubRepo;
                }
                if (type === 'other') {
                    return item.type !== 'github' && !item.isGitHubRepo;
                }
                return item.type === type;
            });
        }
        
        // Apply text filter
        if (filter && typeof filter === 'string') {
            const filterLower = filter.toLowerCase();
            filteredHistory = filteredHistory.filter(item => 
                item.url.toLowerCase().includes(filterLower) ||
                item.title.toLowerCase().includes(filterLower) ||
                (item.repoInfo && item.repoInfo.fullName.toLowerCase().includes(filterLower))
            );
        }
        
        // Apply limit if provided
        if (limit && typeof limit === 'number' && limit > 0) {
            filteredHistory = filteredHistory.slice(0, limit);
        }
        
        return filteredHistory;
    } catch (error) {
        logger.error('Failed to get history:', error);
        return [];
    }
}

/**
 * Get GitHub repositories from history
 * @param {number} limit - Maximum number of repos to return
 * @returns {Promise<Array>} GitHub repository entries
 */
export async function getGitHubRepositories(limit = null) {
    return await getHistory(limit, null, 'github');
}

/**
 * Remove specific item from history
 * @param {string} url - URL to remove from history
 * @returns {Promise<boolean>} Success status
 */
export async function removeFromHistory(url) {
    try {
        const { history } = await getSettings();
        const filteredHistory = history.filter(item => {
            const itemUrl = typeof item === 'string' ? item : item.url;
            return itemUrl !== url;
        });
        
        const success = await saveSettings({ history: filteredHistory });
        if (success) {
            logger.info(`Removed from history: ${url}`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to remove from history:', error);
        return false;
    }
}

/**
 * Add an entry to clipboard history
 * @param {string} content - Clipboard content
 * @param {string} source - Source of the clipboard content
 * @returns {Promise<boolean>} Success status
 */
export async function addToClipboardHistory(content, source = 'clipboard') {
    try {
        if (!content || !content.trim()) {
            logger.warn('Invalid clipboard content provided');
            return false;
        }
        
        const { clipboardHistory, clipboardHistoryLimit } = await getSettings();
        const trimmedContent = content.trim();
        
        // Create clipboard history entry
        const entry = {
            id: Date.now().toString(),
            content: trimmedContent,
            source,
            timestamp: new Date().toISOString(),
            isEdited: false,
            originalContent: trimmedContent
        };
        
        // Remove duplicates by content
        const filteredHistory = clipboardHistory.filter(item => item.content !== trimmedContent);
        
        // Add new entry to the front
        const newHistory = [entry, ...filteredHistory];
        
        // Enforce history limit
        if (newHistory.length > clipboardHistoryLimit) {
            newHistory.length = clipboardHistoryLimit;
        }
        
        const success = await saveSettings({ clipboardHistory: newHistory });
        if (success) {
            logger.info('Added to clipboard history');
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to add to clipboard history:', error);
        return false;
    }
}

/**
 * Get clipboard history
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} Clipboard history entries
 */
export async function getClipboardHistory(limit = null) {
    try {
        const { clipboardHistory } = await getSettings();
        let result = [...clipboardHistory];
        
        // Apply limit if provided
        if (limit && typeof limit === 'number' && limit > 0) {
            result = result.slice(0, limit);
        }
        
        return result;
    } catch (error) {
        logger.error('Failed to get clipboard history:', error);
        return [];
    }
}

/**
 * Clear clipboard history
 * @returns {Promise<boolean>} Success status
 */
export async function clearClipboardHistory() {
    try {
        const success = await saveSettings({ clipboardHistory: [] });
        if (success) {
            logger.info('Clipboard history cleared successfully');
        }
        return success;
    } catch (error) {
        logger.error('Failed to clear clipboard history:', error);
        return false;
    }
}

/**
 * Remove specific item from clipboard history
 * @param {string} id - ID of the item to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeFromClipboardHistory(id) {
    try {
        const { clipboardHistory } = await getSettings();
        const filteredHistory = clipboardHistory.filter(item => item.id !== id);
        
        const success = await saveSettings({ clipboardHistory: filteredHistory });
        if (success) {
            logger.info(`Removed from clipboard history: ${id}`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to remove from clipboard history:', error);
        return false;
    }
}

/**
 * Remove multiple items from clipboard history
 * @param {Array<string>} ids - Array of IDs to remove
 * @returns {Promise<boolean>} Success status
 */
export async function removeMultipleFromClipboardHistory(ids) {
    try {
        const { clipboardHistory } = await getSettings();
        const filteredHistory = clipboardHistory.filter(item => !ids.includes(item.id));
        
        const success = await saveSettings({ clipboardHistory: filteredHistory });
        if (success) {
            logger.info(`Removed ${ids.length} items from clipboard history`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to remove multiple items from clipboard history:', error);
        return false;
    }
}

/**
 * Update a clipboard history entry
 * @param {string} id - ID of the item to update
 * @param {string} newContent - New content for the item
 * @returns {Promise<boolean>} Success status
 */
export async function updateClipboardHistoryItem(id, newContent) {
    try {
        const { clipboardHistory } = await getSettings();
        const updatedHistory = clipboardHistory.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    content: newContent.trim(),
                    isEdited: true,
                    editedAt: new Date().toISOString()
                };
            }
            return item;
        });
        
        const success = await saveSettings({ clipboardHistory: updatedHistory });
        if (success) {
            logger.info(`Updated clipboard history item: ${id}`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to update clipboard history item:', error);
        return false;
    }
}

/**
 * Restore an edited clipboard history item to its original content
 * @param {string} id - ID of the item to restore
 * @returns {Promise<boolean>} Success status
 */
export async function restoreClipboardHistoryItem(id) {
    try {
        const { clipboardHistory } = await getSettings();
        const updatedHistory = clipboardHistory.map(item => {
            if (item.id === id && item.isEdited) {
                return {
                    ...item,
                    content: item.originalContent,
                    isEdited: false,
                    editedAt: null
                };
            }
            return item;
        });
        
        const success = await saveSettings({ clipboardHistory: updatedHistory });
        if (success) {
            logger.info(`Restored clipboard history item: ${id}`);
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to restore clipboard history item:', error);
        return false;
    }
}

/**
 * Export settings for backup
 * @returns {Promise<object|null>} Settings object or null if failed
 */
export async function exportSettings() {
    try {
        const settings = await getSettings();
        const exportData = {
            ...settings,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        logger.info('Settings exported successfully');
        return exportData;
    } catch (error) {
        logger.error('Failed to export settings:', error);
        return null;
    }
}

/**
 * Import settings from backup
 * @param {object} importData - Settings data to import
 * @returns {Promise<boolean>} Success status
 */
export async function importSettings(importData) {
    try {
        if (!importData || typeof importData !== 'object') {
            logger.error('Invalid import data provided');
            return false;
        }
        
        // Extract settings (exclude metadata)
        const { exportDate, version, ...settings } = importData;
        
        if (!validateSettings(settings)) {
            logger.error('Invalid settings in import data');
            return false;
        }
        
        const success = await saveSettings(settings);
        if (success) {
            logger.info('Settings imported successfully');
        }
        
        return success;
    } catch (error) {
        logger.error('Failed to import settings:', error);
        return false;
    }
}

/**
 * Reset settings to defaults
 * @returns {Promise<boolean>} Success status
 */
export async function resetSettings() {
    try {
        const success = await saveSettings(DEFAULTS);
        if (success) {
            logger.info('Settings reset to defaults');
        }
        return success;
    } catch (error) {
        logger.error('Failed to reset settings:', error);
        return false;
    }
}

/**
 * Get storage usage information
 * @returns {Promise<object>} Storage usage stats
 */
export async function getStorageInfo() {
    try {
        const usage = await chrome.storage.local.getBytesInUse();
        const settings = await getSettings();
        
        return {
            bytesUsed: usage,
            historyCount: settings.history.length,
            engineCount: settings.searchEngines.length,
            lastBackup: settings.lastBackup
        };
    } catch (error) {
        logger.error('Failed to get storage info:', error);
        return {
            bytesUsed: 0,
            historyCount: 0,
            engineCount: 0,
            lastBackup: null
        };
    }
}
