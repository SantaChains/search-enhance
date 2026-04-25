# ERRORS

## [ERR-20260330-001] streamable-mcp-server工具不可用

**Priority**: high
**Status**: pending
**Area**: tools

### 摘要
多个chrome工具返回"Tool not found"错误

### 错误信息
```
Tool chrome_javascript not found
Tool chrome_computer not found
Tool chrome_network_capture not found
Tool chrome_read_page not found
```

### 上下文
尝试使用streamable-mcp-server检查Chrome扩展的service worker状态

### 建议修复
使用get_windows_and_tabs获取可用工具列表，或使用chrome_get_web_content和chrome_screenshot作为替代

### 元数据
- Reproducible: yes
- See Also: LRN-20260330-001

---
