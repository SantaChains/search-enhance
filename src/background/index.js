// src/background/index.js

// Listen for the command to toggle the floating view
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-floating-view' && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/index.js']
    });
  }
});

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Create a context menu item upon installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "open-search-buddy-selection",
        title: "Search with Buddy for \"%s\"",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-search-buddy-selection" && tab) {
        // Save the selected text to local storage
        chrome.storage.local.set({ 'selectedText': info.selectionText }, () => {
            // Open the side panel to show the result
            if(tab.windowId) {
                chrome.sidePanel.open({ windowId: tab.windowId });
            }
        });
    }
});