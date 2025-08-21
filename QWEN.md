# Qwen Code Interaction Customization

This file contains instructions and context for Qwen Code to effectively assist with the 'Enhance Search Buddy' project.

## Project Overview

The project is a Chrome Extension designed to enhance the user's search experience by providing quick access to various search engines and tools directly from the browser toolbar. The core idea is to allow users to select text on a webpage, right-click, and choose from a context menu to search the selected text using different engines like Google, Bing, DuckDuckGo, AI tools (ChatGPT, Claude, Gemini), translation services, and writing assistance tools.

## Key Technologies & Structure

- **Language**: JavaScript (Vanilla)
- **Manifest Version**: 3 (MV3)
- **Structure**:
  - `manifest.json`: Core configuration for the Chrome Extension.
  - `src/background/index.js`: Background script for handling context menu interactions and search actions.
  - `src/content/index.js`: Content script (currently minimal, placeholder for future enhancements).
  - `src/popup/`: Contains files for the extension's popup UI (index.html, main.js, styles.css). The popup allows users to configure default search engines for different categories (Web, AI, Tools).
  - `src/settings/`: Currently empty, intended for future settings management.
  - `src/utils/`: Utility functions (e.g., `storage.js` for interacting with `chrome.storage`).

## Development Principles

- **Vanilla JS**: The project avoids external frameworks like React or libraries like Lodash. All code should be pure JavaScript.
- **Chrome Extension APIs**: Interactions with the browser are done using `chrome.*` APIs (e.g., `chrome.contextMenus`, `chrome.tabs`, `chrome.storage`).
- **MV3 Compliance**: All background logic runs in a Service Worker (`background/index.js`).
- **User Experience**: The extension should be intuitive, fast, and unobtrusive. The popup UI should be simple and clear.
- **Persistence**: User preferences (default search engines) are stored using `chrome.storage.local`.

## Common Tasks

- **Adding a New Search Engine/Tool**:
  1. Add the new engine/tool to the relevant list in `background/index.js` (e.g., `AI_TOOLS`, `WRITING_ASSISTANCE_TOOLS`).
  2. Ensure the URL format is correct and uses `{{query}}` as a placeholder.
  3. If it's a new category, define the category and its default engine in `background/index.js`.
  4. Update the popup UI logic in `src/popup/main.js` to handle the new category if necessary.
  5. Update `src/popup/index.html` if new UI elements are needed for the category.

- **Modifying Context Menu**:
  1. Changes are primarily in `src/background/index.js`.
  2. Modify `createContextMenu` to add/remove/modify menu items.
  3. Update `onMenuClick` to handle actions for new/modified items.

- **Updating Popup UI**:
  1. Modify `src/popup/index.html` for structural changes.
  2. Modify `src/popup/main.js` for logic and interaction handling.
  3. Modify `src/popup/styles.css` for styling.

- **Storing/Retrieving Preferences**:
  1. Use functions from `src/utils/storage.js`.
  2. Define keys in `src/utils/storage.js`.
  3. Interact with `chrome.storage.local` through these utility functions.

## File Purposes Summary

- `manifest.json`: Chrome Extension configuration.
- `src/background/index.js`: Core logic for context menus, search actions, and managing extension state.
- `src/content/index.js`: Runs in the context of web pages. Currently a placeholder.
- `src/popup/index.html`: Structure of the popup UI.
- `src/popup/main.js`: Logic for the popup UI, including loading/saving user preferences.
- `src/popup/styles.css`: Styling for the popup UI.
- `src/utils/storage.js`: Utility functions for interacting with `chrome.storage.local`.
- `PROJECT_SUMMARY.md`, `USER_REQUIREMENTS.md`, etc.: Documentation files describing the project's goals, requirements, and current state.