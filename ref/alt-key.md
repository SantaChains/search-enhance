# Alt 系列快捷键完整执行逻辑

## 概述

本文档详细说明 Search Buddy 扩展中 `Alt+K`、`Alt+L`、`Alt+J` 三个快捷键的完整执行逻辑，包括代码层面的具体实现和组件间的交互流程。

## 快捷键功能总览

| 快捷键 | 功能 | 状态变更 |
|--------|------|----------|
| **Alt+L** | 打开/关闭侧边栏 + 聚焦输入框 | 切换模式 |
| **Alt+J** | 读取剪贴板到输入框（侧边栏关闭时自动打开） | 只读不关 |
| **Alt+K** | 切换剪贴板监控 | 全局状态 |

---

## 一、Alt+L - 打开/关闭侧边栏（切换模式）

### 1.1 执行路径

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户按下 Alt+L                                           │
│                      ↓                                      │
│ 2. manifest.json 捕获内置命令                               │
│    "commands": {                                            │
│      "_execute_action": {                                   │
│        "suggested_key": { "default": "Alt+L" }              │
│      }                                                      │
│    }                                                        │
│                      ↓                                      │
│ 3. background/index.js 监听处理                             │
│    chrome.commands.onCommand.addListener(async (command, tab│
│      switch (command) {                                     │
│        case '_execute_action':                              │
│          const isOpen = await openSidePanelWithAction(      │
│            tab?.windowId, 'focus'                           │
│          );                                                 │
│          // 显示通知                                        │
│          await chrome.tabs.sendMessage(tab.id, {            │
│            action: 'showNotification',                      │
│            message: `侧边栏已${isOpen ? '打开' : '关闭'}`    │
│          });                                                │
│          break;                                             │
│      }                                                      │
│    });                                                      │
│                      ↓                                      │
│ 4. openSidePanelWithAction() 执行流程                       │
│    ├─ const options = await chrome.sidePanel.getOptions()   │
│    ├─ const isOpen = options?.enabled === true              │
│    ├─ if (isOpen) {                                         │
│    │     await chrome.sidePanel.close({ windowId });        │
│    │     return false;                                      │
│    │   } else {                                             │
│    │     await chrome.sidePanel.open({ windowId });         │
│    │     await chrome.storage.local.set({                   │
│    │       focusInputOnOpen: true                           │
│    │     });                                                │
│    │     return true;                                       │
│    │   }                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心代码

**manifest.json 注册:**
```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Alt+L",
        "mac": "Command+Shift+L",
        "windows": "Alt+L",
        "linux": "Alt+L"
      },
      "description": "打开/关闭侧边栏"
    }
  }
}
```

**background/index.js 处理:**
```javascript
async function openSidePanelWithAction(windowId, actionType) {
  const options = await chrome.sidePanel.getOptions({ windowId });
  const isOpen = options?.enabled === true;

  if (isOpen) {
    await chrome.sidePanel.close({ windowId });
    return false;
  } else {
    await chrome.sidePanel.open({ windowId });
    if (actionType === 'focus') {
      await chrome.storage.local.set({ focusInputOnOpen: true });
    }
    return true;
  }
}
```

---

## 二、Alt+J - 读取剪贴板到侧边栏

### 2.1 执行路径

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户按下 Alt+J                                           │
│                      ↓                                      │
│ 2. manifest.json 捕获命令                                   │
│    "commands": {                                            │
│      "open_side_panel_and_read": {                          │
│        "suggested_key": { "default": "Alt+J" }              │
│      }                                                      │
│    }                                                        │
│                      ↓                                      │
│ 3. background/index.js 监听处理                             │
│    chrome.commands.onCommand.addListener(async (command, tab│
│      switch (command) {                                     │
│        case 'open_side_panel_and_read':                     │
│          await readClipboardToSidePanel(tab?.windowId);     │
│          // 显示通知                                        │
│          await chrome.tabs.sendMessage(tab.id, {            │
│            action: 'showNotification',                      │
│            message: '已读取剪贴板'                           │
│          });                                                │
│          break;                                             │
│      }                                                      │
│    });                                                      │
│                      ↓                                      │
│ 4. readClipboardToSidePanel() 执行流程                      │
│    ├─ await chrome.storage.local.set({                      │
│    │     readClipboardOnOpen: true                          │
│    │   });                                                  │
│    ├─ const options = await chrome.sidePanel.getOptions()   │
│    ├─ const isOpen = options?.enabled === true              │
│    └─ if (!isOpen) {                                        │
│          await chrome.sidePanel.open({ windowId });         │
│        }                                                    │
│                      ↓                                      │
│ 5. popup/main.js 监听 storage 变化                          │
│    chrome.storage.onChanged.addListener((changes, areaName) │
│      if (changes.readClipboardOnOpen?.newValue === true) {  │
│        chrome.storage.local.remove('readClipboardOnOpen');  │
│        await readSystemClipboard();                         │
│      }                                                      │
│    });                                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心代码

**manifest.json 注册:**
```json
{
  "commands": {
    "open_side_panel_and_read": {
      "suggested_key": {
        "default": "Alt+J",
        "mac": "Command+Shift+J"
      },
      "description": "打开侧边栏并读取剪贴板"
    }
  }
}
```

**background/index.js 处理:**
```javascript
async function readClipboardToSidePanel(windowId) {
  // 先设置读取剪贴板标记
  await chrome.storage.local.set({ readClipboardOnOpen: true });

  // 检查侧边栏状态
  const options = await chrome.sidePanel.getOptions({ windowId });
  const isOpen = options?.enabled === true;

  // 如果侧边栏关闭，则打开
  if (!isOpen) {
    await chrome.sidePanel.open({ windowId });
  }
}
```

**popup/main.js 监听:**
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.readClipboardOnOpen) {
    if (changes.readClipboardOnOpen.newValue === true) {
      chrome.storage.local.remove('readClipboardOnOpen');
      setTimeout(async () => {
        await readSystemClipboard();
      }, 100);
    }
  }
});
```

---

## 三、Alt+K - 切换剪贴板监控

### 3.1 执行路径

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户按下 Alt+K                                           │
│                      ↓                                      │
│ 2. manifest.json 捕获命令                                   │
│    "commands": {                                            │
│      "toggle_clipboard_monitoring": {                       │
│        "suggested_key": { "default": "Alt+K" }              │
│      }                                                      │
│    }                                                        │
│                      ↓                                      │
│ 3. background/index.js 监听处理                             │
│    chrome.commands.onCommand.addListener((command, tab) => {│
│      if (command === 'toggle_clipboard_monitoring') {       │
│        const newState = await toggleMonitoring();           │
│        // 显示通知                                          │
│        await chrome.tabs.sendMessage(tab.id, {              │
│          action: 'showNotification',                        │
│          message: `全局剪贴板监控已${newState ? '开启' : '关闭'}`│
│        });                                                  │
│      }                                                      │
│    });                                                      │
│                      ↓                                      │
│ 4. toggleMonitoring() 执行流程                              │
│    ├─ appState.isMonitoring = !appState.isMonitoring        │
│    ├─ await saveState() // 保存到 storage                   │
│    ├─ broadcastToAllTabs({                                  │
│    │    action: 'clipboardMonitoringToggled',               │
│    │    isActive: appState.isMonitoring                     │
│    │  })                                                    │
│    └─ return appState.isMonitoring                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心代码

**manifest.json 注册:**
```json
{
  "commands": {
    "toggle_clipboard_monitoring": {
      "suggested_key": {
        "default": "Alt+K",
        "mac": "Command+Shift+K"
      },
      "description": "切换剪贴板监控"
    }
  }
}
```

**background/index.js 处理:**
```javascript
chrome.commands.onCommand.addListener(async (command, tab) => {
  switch (command) {
    case 'toggle_clipboard_monitoring': {
      const newState = await toggleMonitoring();
      
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: `全局剪贴板监控已${newState ? '开启' : '关闭'}`,
          type: newState ? 'success' : 'info',
        });
        
        if (newState) {
          setTimeout(async () => {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'forceClipboardCheck',
            });
          }, 200);
        }
      }
      break;
    }
  }
});
```

---

## 四、消息通信汇总

### 4.1 Alt+L 涉及的消息

| 消息 Action | 方向 | 功能 |
|-------------|------|------|
| `showNotification` | Background → Content Script | 显示通知 |

### 4.2 Alt+J 涉及的消息

| 消息 Action | 方向 | 功能 |
|-------------|------|------|
| `readClipboardOnOpen` | Background → Storage | 设置读取标记 |
| Storage Change | Storage → Popup | 触发读取剪贴板 |
| `showNotification` | Background → Content Script | 显示通知 |

### 4.3 Alt+K 涉及的消息

| 消息 Action | 方向 | 功能 |
|-------------|------|------|
| `clipboardMonitoringToggled` | Background → Content Script/Popup | 广播状态变更 |
| `showNotification` | Background → Content Script | 显示通知 |
| `forceClipboardCheck` | Background → Content Script | 强制检测剪贴板 |

---

## 五、关键代码文件位置

| 功能 | 文件路径 | 行号范围 |
|------|----------|----------|
| Alt+L Manifest 注册 | `manifest.json` | L18-27 |
| Alt+L Background 处理 | `src/background/index.js` | L314-350, L419-432 |
| Alt+J Manifest 注册 | `manifest.json` | L35-41 |
| Alt+J Background 处理 | `src/background/index.js` | L352-377, L435-448 |
| Alt+J Popup 监听 | `src/popup/main.js` | L348-357 |
| Alt+K Manifest 注册 | `manifest.json` | L28-34 |
| Alt+K Background 处理 | `src/background/index.js` | L387-416 |

---

## 六、设计原则

1. **统一入口**: 所有快捷键通过 Manifest 注册，由 Background Script 统一处理
2. **避免冲突**: Content Script 不再重复监听快捷键，避免重复执行
3. **状态同步**: 使用 Chrome Storage API 进行跨组件状态同步
4. **用户反馈**: 每个操作都有通知反馈，提升用户体验

---

*文档版本: 2.0*  
*最后更新: 2026-03-08*
