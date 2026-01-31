# Alt+K 快捷键功能实现总结

## 功能描述

用户可以通过按 `Alt+K` 快捷键全局切换剪贴板监控状态，无需手动打开 popup 并点击开关。

## 实现原理

### 架构设计

```
快捷键事件流
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用户按下 Alt+K
    ↓
Chrome 浏览器捕获快捷键
    ↓
触发 background.js 的 onCommand 事件
    ↓
case 'toggle_clipboard_monitoring'
    ↓
读取当前状态 from chrome.storage.local
    ↓
计算新状态（取反）
    ↓
保存新状态 to chrome.storage.local
    ↓
通知 content script（显示页面通知）
    ┃
    ┣━━→ Content Script 显示通知
    ┃
    ┗━━→ Popup 监听 storage 变化
            ↓
        检测到 clipboardMonitoring 变化
            ↓
        更新 UI 开关状态
            ↓
        启动或停止监控逻辑

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 核心代码

#### 1. Background Script (`src/background/index.js`)

```javascript
case 'toggle_clipboard_monitoring':
    // Alt+K - 切换剪贴板监控
    try {
        // 从 storage 读取当前状态
        const result = await chrome.storage.local.get('clipboardMonitoring');
        const currentState = result.clipboardMonitoring || false;
        const newState = !currentState;

        // 更新 storage 状态
        await chrome.storage.local.set({ clipboardMonitoring: newState });
        logger.info(`剪贴板监控状态已切换: ${currentState} -> ${newState}`);

        // 通知当前标签页的 content script（用于显示通知）
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'refreshClipboardMonitoring',
                enabled: newState
            });
        } catch (error) {
            // content script 可能未加载，忽略错误
            logger.debug('Could not notify content script about clipboard monitoring change:', error.message);
        }

        // 如果 popup 打开，它会通过 storage 监听器自动响应
        // 如果 popup 未打开，状态已保存，下次打开时会自动应用
    } catch (error) {
        logger.error('切换剪贴板监控状态失败:', error);
    }
    break;
```

**关键点：**
- 不直接操作 popup 或 content script
- 通过 chrome.storage 作为状态管理中心
- 符合事件驱动架构
- 支持 popup 关闭时切换状态

#### 2. Popup Script (`src/popup/main.js`)

**Storage 变化监听器：**

```javascript
// 监听storage变化
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        // 处理剪贴板监控状态变化
        if (changes.clipboardMonitoring) {
            const newMonitoringState = changes.clipboardMonitoring.newValue;
            appState.clipboardMonitoring = newMonitoringState;
            updateClipboardButtonState(newMonitoringState);

            // 根据新状态启动或停止监控
            if (newMonitoringState) {
                startClipboardMonitoring();
            } else {
                stopClipboardMonitoring();
            }
        }

        // 处理剪贴板内容变化（保持不变）
        if (changes.lastClipboardContent) {
            // ... 处理内容更新
        }
    }
});
```

**关键点：**
- 监听 storage 变化（而非 message）
- 自动启动/停止监控逻辑
- UI 状态自动同步

#### 3. Content Script (`src/content/index.js`)

```javascript
case 'refreshClipboardMonitoring':
    // 更新监控状态
    clipboardMonitor.updateMonitoring(request.enabled);
    sendResponse({ success: true });
    break;
```

**关键点：**
- 接收来自 background 的状态更新
- 显示页面通知

## 状态同步机制

### Storage 数据结构

```javascript
{
    clipboardMonitoring: Boolean,  // 监控状态
    lastClipboardContent: String,   // 最后剪贴板内容
    clipboardHistoryUpdated: Number // 更新时间戳
}
```

### 同步流程

1. **快捷键触发状态变化**
   ```
   Alt+K → background.js → chrome.storage.local.set({clipboardMonitoring: newState})
   ```

2. **Popup 响应状态变化**
   ```
   chrome.storage.onChanged → popup main.js → start/stop monitoring
   ```

3. **Content Script 显示通知**
   ```
   chrome.tabs.sendMessage → content.js → showPageNotification()
   ```

## 优势

### ✅ 解决的问题

1. **无需打开 Popup**：可以在任意页面快速切换
2. **状态持久化**：关闭 popup 后状态仍然保留
3. **多实例同步**：如果未来支持多个 popup，状态自动同步
4. **解耦合**：background/popup/content 之间通过 storage 通信，减少依赖

### ✅ 用户体验

1. **快速操作**：无需打开 popup，直接按键切换
2. **即时反馈**：页面显示通知确认操作
3. **状态一致**：无论通过快捷键还是开关操作，状态保持同步
4. **无缝集成**：与原有的开关操作完全兼容

## 测试验证

### 测试用例

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| 启用监控 | 按 Alt+K | 页面显示"剪贴板监控已启动"，popup 开关为启用 |
| 禁用监控 | 按 Alt+K | 页面显示"剪贴板监控已停止"，popup 开关为禁用 |
| 状态同步 | 快捷键启用 → popup 查看 | 开关状态一致 |
| 反向同步 | 快捷键禁用 → popup 查看 | 开关状态一致 |
| 功能验证 | 启用后复制文本 → 打开 popup | 内容自动填入搜索框 |

### 调试方法

**查看状态变化：**
```javascript
// 在 background service worker 日志中查看
console.log('剪贴板监控状态已切换:', currentState, '->', newState);

// 在 popup console 中查看
console.log('监控状态变化:', newMonitoringState);
```

**手动测试 storage：**
```javascript
// 读取当前状态
await chrome.storage.local.get('clipboardMonitoring')

// 检查 popup 是否响应
// 查看 popup 的 console 日志
```

## 兼容性

### 浏览器支持

- ✅ Microsoft Edge 88+
- ✅ Google Chrome 88+
- ⚠️ Firefox（Clipboard API 支持有限）
- ⚠️ Safari（需要额外权限处理）

### 页面兼容性

- ✅ 普通 HTTP/HTTPS 页面
- ⚠️ `chrome://` 页面（无法注入 content script）
- ⚠️ `edge://` 页面（无法注入 content script）
- ⚠️ `file://` 页面（需要额外权限）

## 性能影响

### Storage 操作

- **频率**：仅状态变化时写入
- **开销**：极小（< 1ms）
- **优化**：使用 localStorage，不触发同步

### Message 传递

- **频率**：仅快捷键触发时发送
- **开销**：可忽略
- **容错**：content script 未加载时不影响功能

### 监控轮询

- **位置**：Popup 内部
- **频率**：500ms（仅 popup 打开时）
- **优化**：关闭 popup 时自动停止

## 错误处理

```javascript
try {
    // 读取状态
    const result = await chrome.storage.local.get('clipboardMonitoring');
} catch (error) {
    logger.error('读取状态失败:', error);
}

try {
    // 写入状态
    await chrome.storage.local.set({ clipboardMonitoring: newState });
} catch (error) {
    logger.error('写入状态失败:', error);
}

try {
    // 通知 content script
    await chrome.tabs.sendMessage(tab.id, {...});
} catch (error) {
    // 忽略错误（content script 可能未加载）
    logger.debug('通知失败:', error.message);
}
```

## 后续改进

### 可能的优化

1. **debounce 快捷键**：避免快速按键导致的状态闪烁
   ```javascript
   let lastToggle = 0;
   const debounceTime = 500; // 500ms 内不重复处理
   ```

2. **声音反馈**：状态切换时播放提示音
   ```javascript
   new Audio(chrome.runtime.getURL('audio/toggle.mp3')).play();
   ```

3. **Badge 提示**：在扩展图标上显示监控状态
   ```javascript
   chrome.action.setBadgeText({ text: newState ? 'ON' : '' });
   chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
   ```

4. **通知配置**：允许用户选择是否显示通知
   ```javascript
   // 在设置中添加选项
   {
        showClipboardNotifications: true,
        playSoundOnToggle: false,
        showBadge: true
   }
   ```

## 总结

Alt+K 快捷键的实现充分利用了 Chrome Extension 的事件驱动特性和 storage 同步机制：

1. **Background** 捕获快捷键，通过 storage 切换状态
2. **Popup** 监听 storage 变化，自动启动/停止监控
3. **Content Script** 接收通知，显示页面反馈

这种方式不仅解决了剪贴板监控的权限问题，还提供了良好的用户体验和代码架构。

**实现特点：**
- ✅ 符合 Manifest V3 规范
- ✅ 利用 storage 作为状态管理中心
- ✅ 解耦各组件，提高可维护性
- ✅ 支持快捷键和 UI 操作的无缝切换
- ✅ 状态持久化，跨会话保持
