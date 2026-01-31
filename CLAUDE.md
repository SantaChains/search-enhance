# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decide Search is a powerful browser extension that enhances search experience through intelligent text processing, multi-format analysis, and advanced clipboard monitoring. Built with Manifest V3, it supports Microsoft Edge (Chromium) and Google Chrome.

## Development Commands

### Build and Package
```bash
# Package extension for distribution
npm run package
# Creates: enhance-search-buddy.zip (excludes .git, node_modules, .bak files, debug.html, test.html)
```

### Linting
```bash
# Lint JavaScript code with ESLint
npm run lint
```

### Testing
```bash
# Run tests (placeholder - extension requires manual browser testing)
npm run test
```

## Core Architecture

### Manifest V3 Structure
- **Manifest Version**: 3 (latest Chrome/Edge standard)
- **Service Worker**: `src/background/index.js` - Background script for persistent operations
- **Content Scripts**: `src/content/index.js` - Injected into web pages for clipboard monitoring
- **Extension Pages**:
  - Popup/Side Panel: `src/popup/` - Main user interface
  - Options/Settings: `src/settings/` - Configuration management

### Module Communication Flow

```
Background Script (Service Worker)
├── Handles keyboard shortcuts (Alt+L, Alt+K, Alt+Shift+S)
├── Manages context menu integration
└── Controls side panel behavior

Content Script (per tab)
├── ClipboardMonitor Class - Intelligent clipboard monitoring with adaptive polling
├── Message bridge between popup and page
└── Handles text insertion at cursor

Popup/Settings Pages
├── Main UI for text processing and search
├── Settings management for search engines and preferences
└── History and clipboard management interface

Utility Modules (src/utils/)
├── clipboard.js - Clipboard operations with fallback mechanisms
├── textProcessor.js - Core text analysis and transformation logic
├── storage.js - Chrome storage API wrappers with data management
├── logger.js - Centralized logging system
├── communication.js - Message passing utilities
└── linkHistory.js - URL history tracking and management
```

### Data Flow
1. **Text Input**: User inputs text in popup or selects text on page
2. **Processing**: TextProcessor analyzes for URLs, paths, emails, phone numbers
3. **Transformation**: Based on enabled features (extraction, link generation, multi-format)
4. **Output**: Display results with copy-to-clipboard functionality
5. **Storage**: Save to history, manage clipboard history, persist settings

## Key Features Implementation

### Clipboard Monitoring System (`src/content/index.js`)
- **Adaptive Polling**: Adjusts interval based on clipboard activity (300ms-2000ms)
- **Smart Detection**: Deduplication and debouncing to prevent spam
- **Error Classification**: Categorizes errors (permission/security/temporary) with appropriate handling
- **Privacy Protection**: Sanitizes sensitive data (passwords, credit cards, emails)
- **Performance**: Resource cleanup on tab close, memory optimization

### Text Processing Engine (`src/utils/textProcessor.js`)
- **Multi-Format Detection**: URLs, Windows paths, emails, phone numbers, GitHub repos
- **Path Conversion**: Windows to Unix, escaped, File URL formats
- **Link Generation**: GitHub, ZRead, DeepWiki, Context7 from repo identifiers
- **Text Splitting**: Multiple strategies (spaces, newlines, punctuation, sentences)
- **Repository Detection**: Intelligent parsing of `username/repo` patterns

### Storage Management (`src/utils/storage.js`)
- **Settings Persistence**: Search engines, history limits, clipboard preferences
- **History Tracking**: Link history with timestamps and metadata
- **Clipboard History**: Separate storage for clipboard items with management functions
- **Data Export/Import**: JSON-based configuration backup and restore

## Code Standards

### JavaScript Conventions
- **ES6 Modules**: All code uses `import/export` syntax
- **async/await**: Prefer over Promises for asynchronous operations
- **JSDoc Comments**: Document functions with parameters and return types
- **Error Handling**: Try-catch blocks with specific error messages
- **Logging**: Use logger utility instead of console.log directly

### Naming Conventions
- **Files**: kebab-case for HTML/CSS, camelCase for JS
- **Functions**: camelCase, descriptive verb-noun structure
- **Constants**: UPPER_SNAKE_CASE
- **Classes**: PascalCase

### Security Considerations
- **CSP Compliance**: All inline styles/scripts must comply with manifest CSP
- **Input Validation**: Sanitize all user inputs and clipboard content
- **Permission Management**: Request minimal required permissions
- **HTTPS Only**: Clipboard API requires secure contexts

## Development Workflow

### Adding New Features
1. **Check Manifest**: Verify permissions and resources needed
2. **Module Design**: Decide on content script, popup, or background implementation
3. **Communication**: Use chrome.runtime messaging for cross-component communication
4. **Storage**: Add data structures to storage.js for persistence
5. **UI Updates**: Update popup/settings HTML and CSS as needed
6. **Testing**: Test in both popup and side panel modes

### Debugging
- **Background Script**: Inspect via `chrome://extensions/` service worker logs
- **Content Script**: Use browser DevTools on target page
- **Popup**: Right-click popup, select "Inspect"
- **Clipboard Issues**: Check permissions and HTTPS requirements

### Common Issues
- **CSP Violations**: Avoid inline scripts, use external JS files
- **Clipboard Permissions**: Requires user gesture or HTTPS context
- **Message Passing**: Always return true for async responses
- **Storage Limits**: Chrome storage has size limits, monitor data growth

## Browser Compatibility

### Tested Platforms
- **Microsoft Edge**: 88+ (Chromium-based) - Primary target
- **Google Chrome**: 88+ - Theoretically compatible
- **Other Chromium**: Not tested, may work

### Platform Limitations
- **Windows**: Full support for all features including path conversion
- **macOS/Linux**: Basic support, path conversion features limited
- **Mobile**: Not supported, desktop browsers only

## Performance Considerations

### Clipboard Monitoring
- **Polling Interval**: Adaptive from 300ms (active) to 2000ms (idle)
- **Memory Management**: Regular cleanup of timers and event listeners
- **Debouncing**: 100ms debounce for clipboard content processing

### Text Processing
- **Regex Optimization**: Compiled patterns for repeated use
- **Batch Operations**: Process text in chunks for large inputs
- **Lazy Loading**: Defer heavy operations until needed

### UI Responsiveness
- **requestAnimationFrame**: For smooth animations and resize handlers
- **Virtual Scrolling**: Consider for large history lists
- **Lazy Rendering**: Load UI components on demand