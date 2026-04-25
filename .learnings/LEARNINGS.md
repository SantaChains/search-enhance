# LEARNINGS

## [LRN-20260330-001] best_practice

**Priority**: high
**Status**: pending
**Area**: tools

### 内容
使用streamable-mcp-server时，可用工具子集随连接状态动态变化，不能依赖工具名称猜测。发现chrome_javascript、chrome_computer、chrome_network_capture、chrome_read_page等工具返回"Tool not found"错误。实际可用的chrome相关工具只有：get_windows_and_tabs、chrome_navigate、chrome_get_web_content、chrome_screenshot、chrome_click_element、chrome_fill_or_select、chrome_keyboard、chrome_handle_dialog、chrome_network_request、chrome_console、chrome_bookmark_add、chrome_bookmark_delete、chrome_bookmark_search、chrome_history、chrome_handle_download、chrome_switch_tab、chrome_close_tabs、chrome_network_capture、chrome_request_element_selection、performance_start_trace、performance_stop_trace、performance_analyze_insight。

### 建议修复
使用MCP工具前先调用get_windows_and_tabs确认可用性子集，或者在错误时自动尝试替代方法。

### 元数据
- Source: error
- See Also: ERR-20260330-001

---

## [LRN-20260330-002] best_practice

**Priority**: critical
**Status**: pending
**Area**: tools

### 内容
actionbook skill启动独立的CDP模式浏览器，与用户已打开的Chrome浏览器是不同实例。在这种模式下检查扩展状态得到的结果（如service worker状态、扩展消息响应）都是针对新启动的浏览器实例，不是用户真实的Chrome环境。应该直接使用streamable-mcp-server连接到用户的真实Chrome浏览器。

### 建议修复
检查用户Chrome扩展状态时，必须使用streamable-mcp-server而非actionbook。actionbook只适合在没有用户真实Chrome环境需求时使用（如自动化测试、爬虫等）。

### 元数据
- Source: correction
- See Also: ERR-20260330-001

---

## [LRN-20260330-003] best_practice

**Priority**: medium
**Status**: pending
**Area**: tools

### 内容
chrome:// URLs在streamable-mcp-server中可能无法正常渲染，get_web_content返回的是最近活动的标签页内容而非目标chrome://页面内容。

### 建议修复
对于chrome://extensions等内部页面，可能需要通过截图或用户手动确认来验证。

### 元数据
- Source: error

---
