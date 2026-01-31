# Alt+K 快捷键测试指南

## 功能说明

按 `Alt+K` 快捷键可以全局切换剪贴板监控状态，无需手动点击 popup 中的开关。

## 测试场景

### 测试 1：通过快捷键启用监控

**步骤：**
1. 在任意网页上，按 `Alt+K`
2. 观察页面右上角是否显示通知："剪贴板监控已启动"
3. 打开扩展 popup（点击图标或按 `Alt+L`）
4. 检查"剪贴板监控"开关是否为启用状态

**预期结果：**
- ✅ 页面显示成功通知（绿色）
- ✅ Popup 开关状态为启用
- ✅ Service Worker 日志显示："剪贴板监控状态已切换: false -> true"

### 测试 2：通过快捷键禁用监控

**步骤：**
1. 在网页上按 `Alt+K`（监控已启用）
2. 观察页面右上角是否显示通知："剪贴板监控已停止"
3. 打开扩展 popup
4. 检查开关是否为禁用状态

**预期结果：**
- ✅ 页面显示信息通知（蓝色）
- ✅ Popup 开关状态为禁用
- ✅ Service Worker 日志显示："剪贴板监控状态已切换: true -> false"

### 测试 3：快捷键与开关同步

**步骤：**
1. 在网页上按 `Alt+K` 启用监控
2. 打开 popup，确认开关为启用
3. 在 popup 中点击开关禁用监控
4. 关闭 popup，再次按 `Alt+K`
5. 打开 popup 检查开关状态

**预期结果：**
- ✅ 步骤 2：开关状态为启用
- ✅ 步骤 3：监控停止，开关变为禁用
- ✅ 步骤 5：开关状态为启用（Alt+K 再次启用）

### 测试 4：监控功能正常工作

**步骤：**
1. 按 `Alt+K` 启用监控
2. 复制一段文本（例如：test content）
3. 按 `Alt+L` 打开 popup
4. 检查搜索框是否自动填入复制的内容
5. 检查剪贴板历史是否添加了新条目

**预期结果：**
- ✅ Popup 搜索框显示复制的文本
- ✅ 剪贴板历史列表包含新内容
- ✅ 页面显示通知（如果 content script 已加载）

### 测试 5：在特殊页面使用快捷键

**步骤：**
1. 访问 `edge://extensions/` 或 `chrome://settings/`
2. 按 `Alt+K`

**预期结果：**
- ⚠️ 快捷键可能不工作（浏览器限制在特殊页面注入 content script）
- 这是预期行为，不影响正常网页的使用

## 调试信息

### 查看 Service Worker 日志

1. 访问 `edge://extensions/` 或 `chrome://extensions/`
2. 找到 "Decide search" 扩展
3. 点击 "Service Worker" 链接
4. 在日志中查看：
   ```
   [Background] 剪贴板监控状态已切换: false -> true
   [Background] 剪贴板监控状态已切换: true -> false
   ```

### 查看 Content Script 日志

1. 在网页上按 F12 打开开发者工具
2. 切换到 Console 标签
3. 执行：
   ```javascript
   // 检查接收到的消息
   // 应该能看到 '剪贴板监控已启动' 等日志
   ```

### 查看 Popup 日志

1. 右键点击扩展图标
2. 选择 "审查弹出内容"（Inspect popup）
3. 查看 Console 日志
4. 应该能看到：
   ```
   [Popup] 剪贴板监控已启动
   [Popup] 检测到剪贴板内容变化
   ```

## 常见问题

### 问题 1：快捷键无反应

**症状：**
按 `Alt+K` 没有任何反应

**排查步骤：**
1. 检查扩展是否已加载
2. 访问 `edge://extensions/shortcuts` 或 `chrome://extensions/shortcuts`
3. 确认 "全局剪贴板监控" 快捷键设置为 `Alt+K`
4. 检查是否有其他扩展占用 `Alt+K`
5. 查看 Service Worker 日志是否有错误

**解决方案：**
- 重新加载扩展
- 在快捷键设置页面重新绑定 `Alt+K`
- 重启浏览器

### 问题 2：状态不同步

**症状：**
按 `Alt+K` 后，popup 开关状态不更新

**排查步骤：**
1. 检查 storage 是否正常工作：
   ```javascript
   await chrome.storage.local.get('clipboardMonitoring')
   ```
2. 查看 popup Console 是否有错误
3. 检查 storage 监听器是否正常注册

**解决方案：**
- 关闭并重新打开 popup
- 重新加载扩展
- 清除扩展数据（谨慎操作）

### 问题 3：监控启动但无反应

**症状：**
按 `Alt+K` 显示"已启动"，但复制内容后无反应

**排查步骤：**
1. 确认 popup 是否打开（需要在后台运行）
2. 检查 Clipboard API 权限：
   ```javascript
   await navigator.permissions.query({name: 'clipboard-read'})
   ```
3. 手动测试读取剪贴板：
   ```javascript
   await navigator.clipboard.readText()
   ```
4. 查看 popup 日志是否有错误

**解决方案：**
- 确保 popup 处于打开状态
- 检查浏览器权限设置
- 重新启用扩展的剪贴板权限

## 代码逻辑

### 数据流

```
用户按 Alt+K
    ↓
background.js (onCommand)
    ↓
chrome.storage.local.set({clipboardMonitoring: newState})
    ↓
chrome.storage.onChanged (popup 监听)
    ↓
updateClipboardButtonState()
    ↓
if (newState) startClipboardMonitoring() else stopClipboardMonitoring()
    ↓
setInterval/checkClipboard() 或清除定时器
```

### 关键代码

**background.js:**
```javascript
case 'toggle_clipboard_monitoring':
    const result = await chrome.storage.local.get('clipboardMonitoring');
    const currentState = result.clipboardMonitoring || false;
    const newState = !currentState;
    await chrome.storage.local.set({ clipboardMonitoring: newState });
```

**popup/main.js:**
```javascript
chrome.storage.onChanged.addListener((changes, area) => {
    if (changes.clipboardMonitoring) {
        const newMonitoringState = changes.clipboardMonitoring.newValue;
        appState.clipboardMonitoring = newMonitoringState;
        updateClipboardButtonState(newMonitoringState);
        if (newMonitoringState) {
            startClipboardMonitoring();
        } else {
            stopClipboardMonitoring();
        }
    }
});
```

## 测试结果记录

| 测试场景 | 结果 | 备注 |
|---------|------|------|
| Alt+K 启用监控 | ⬜ 通过 ⬜ 失败 | |
| Alt+K 禁用监控 | ⬜ 通过 ⬜ 失败 | |
| 快捷键与开关同步 | ⬜ 通过 ⬜ 失败 | |
| 监控功能正常工作 | ⬜ 通过 ⬜ 失败 | |
| 特殊页面测试 | ⬜ 通过 ⬜ 失败 | |

## 总结

Alt+K 快捷键的实现原理：
1. Background 捕获快捷键事件
2. 通过 storage 切换状态（而非直接操作）
3. Popup 监听 storage 变化并响应
4. 实现状态同步和监控控制

这种方式的优点：
- ✅ 无需关心 popup 是否打开
- ✅ 状态持久化
- ✅ 多个 popup 实例（如果有）能同步状态
- ✅ 符合 Chrome Extension 的事件驱动模型
