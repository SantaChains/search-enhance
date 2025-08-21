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
    DEFAULT_ENGINE: 'defaultEngine',
    USER_PREFERENCES: 'userPreferences',
    LAST_BACKUP: 'lastBackup'
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
 * Add a record to history with deduplication and validation
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
        
        // Remove duplicates and add to front
        const filteredHistory = history.filter(h => h !== trimmedItem);
        const newHistory = [trimmedItem, ...filteredHistory];
        
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
 * Get history with optional filtering
 * @param {number} limit - Maximum number of items to return
 * @param {string} filter - Optional filter string
 * @returns {Promise<string[]>} History items
 */
export async function getHistory(limit = null, filter = null) {
    try {
        const { history } = await getSettings();
        let filteredHistory = history;
        
        // Apply filter if provided
        if (filter && typeof filter === 'string') {
            const filterLower = filter.toLowerCase();
            filteredHistory = history.filter(item => 
                item.toLowerCase().includes(filterLower)
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
