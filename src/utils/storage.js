// src/utils/storage.js

// Default settings
const DEFAULTS = {
  searchEngines: [
    { name: 'Bing', template: 'https://www.bing.com/search?q=%s' },
    { name: 'Google', template: 'https://www.google.com/search?q=%s' },
    { name: 'Google Scholar', template: 'https://scholar.google.com/scholar?q=%s' },
    { name: 'Metaso', template: 'https://metaso.cn/search?q=%s' },
    { name: 'Sogou', template: 'https://www.sogou.com/web?query=%s' },
  ],
  history: [],
  historyLimit: 50,
  defaultEngine: 'Bing',
};

// Get settings from chrome.storage.local
export async function getSettings() {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...data };
}

// Save settings to chrome.storage.local
export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

// Add a record to history
export async function addToHistory(item) {
    const { history, historyLimit } = await getSettings();
    const newHistory = [item, ...history];
    if (newHistory.length > historyLimit) {
        newHistory.length = historyLimit;
    }
    await saveSettings({ history: newHistory });
}