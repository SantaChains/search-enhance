# 🎯 Decide Search - 智能文本处理与搜索增强

一个功能强大的浏览器扩展，专为提升文本处理和搜索体验而设计。支持多种启动方式、智能文本分析和实时剪贴板监控。兼容Microsoft Edge和Google Chrome浏览器。

## ✨ 核心特性

### 🚀 多种启动方式

- **悬浮窗模式**：按 `Alt+L` 在任何网页上打开悬浮搜索框
- **弹窗模式**：点击浏览器工具栏扩展图标
- **侧边栏模式**：右键扩展图标选择"在侧边栏中打开"
- **快捷键操作**：支持多种快捷键组合，如 `Alt+K` 切换剪贴板监控

### 🔧 智能文本处理

- **路径转换**：Windows路径自动转换为4种格式（原始路径、Unix路径、转义路径、File URL）
- **链接生成**：输入`用户名/仓库名`自动生成GitHub、ZRead、DeepWiki、Context7等平台链接
- **文本拆分**：支持按空格、换行、标点、中英文句子等多种方式拆分文本
- **多格式分析**：同时识别路径、链接、邮箱、电话等多种格式
- **中文分词**：支持智能中文分词功能，提升文本分析准确性

### 📋 剪贴板监控

- **实时监控**：自动检测剪贴板内容变化
- **智能填充**：检测到新内容时自动填入搜索框
- **一键开关**：可随时启用/禁用监控功能
- **剪贴板历史**：自动记录剪贴板历史，支持批量操作

### 🎨 用户体验优化

- **自适应输入框**：支持多行文本，高度自动调整
- **平滑拖拽**：右下角拖拽手柄，60fps流畅调整高度
- **响应式布局**：根据窗口宽度智能调整控件位置
- **点击区域扩展**：点击整个开关区域即可切换功能
- **批量操作**：支持多选、批量复制等高效操作

## 🛠️ 安装方法

### 快速安装

1. 打开Edge浏览器，访问 `edge://extensions/`
2. 开启"开发人员模式"
3. 点击"加载解压缩的扩展"
4. 选择项目根目录并确认

### 其他浏览器

- **Google Chrome**：访问 `chrome://extensions/`，开启开发者模式后加载扩展
- **其他Chromium浏览器**：类似步骤加载扩展

## 📖 使用指南

### 基本操作

1. **启动扩展**：按 `Alt+L` 或点击扩展图标
2. **输入文本**：在搜索框中输入或粘贴内容
3. **选择功能**：通过开关选择所需的处理方式
4. **查看结果**：在结果区域查看处理后的内容
5. **一键复制**：点击复制按钮获取结果

### 三大核心功能

#### 🔄 提取和拆解

- **路径处理**：自动识别Windows路径并转换为多种格式
- **链接提取**：从文本中提取所有URL链接
- **文本清洗**：去除中文字符、标点符号，规范化文本
- **智能拆分**：支持6种拆分方式，可视化选择和批量复制

#### 🔗 链接生成

- **仓库识别**：自动识别`用户名/仓库名`格式
- **多平台生成**：一键生成GitHub、ZRead、DeepWiki、Context7链接
- **反向解析**：输入任一平台链接，生成其他平台对应链接
- **链接历史**：自动记录生成的链接，方便后续使用

#### 📊 多格式分析

- **同时检测**：一次分析识别多种文本格式
- **统一显示**：卡片式布局展示所有结果
- **智能分类**：自动分类路径、链接、联系信息等
- **批量操作**：支持多选和批量复制

### 高级功能

- **搜索引擎管理**：支持自定义搜索引擎
- **历史记录**：自动保存搜索历史，支持导出
- **配置同步**：支持配置文件导入导出
- **快捷操作**：丰富的键盘快捷键支持
- **批量处理**：支持批量文本操作，提升工作效率

## ⚙️ 设置选项

通过设置页面（点击齿轮图标），您可以：

- 🔍 管理搜索引擎列表（增删改查、设置默认）
- 📚 设置历史记录保存数量
- 📋 配置剪贴板监控选项
- 📤 导出/导入配置文件
- 🎨 调整界面显示选项
- ⚡ 配置快捷键和启动方式

## � 技术特性

### 现代化架构

- **Manifest V3**：采用最新扩展标准
- **ES6模块**：模块化代码组织
- **异步编程**：Promise/async-await模式
- **性能优化**：requestAnimationFrame、防抖处理

### 技术栈

- **前端技术**：原生JavaScript、HTML5、CSS3
- **模块化设计**：ES6模块系统
- **本地存储**：Chrome Storage API
- **权限管理**：最小化权限申请

### 项目结构

```
search-enhance/
├── icons/             # 扩展图标
├── src/
│   ├── background/    # 后台服务
│   ├── content/       # 内容脚本
│   ├── popup/         # 弹窗界面
│   ├── settings/      # 设置页面
│   └── utils/         # 工具函数
├── manifest.json      # 扩展配置
├── package.json       # 项目配置
└── README.md          # 项目文档
```

### 核心模块

- **textProcessor.js**：文本处理核心功能
- **storage.js**：本地存储管理
- **linkHistory.js**：链接历史记录
- **main.js**：弹窗主逻辑

### 用户体验

- **平滑动画**：60fps流畅交互体验
- **智能布局**：ResizeObserver响应式设计
- **视觉反馈**：即时操作反馈和状态提示
- **无障碍支持**：完整键盘导航

### 安全性

- **权限最小化**：仅申请必要权限
- **本地存储**：所有数据保存在用户本地
- **输入验证**：严格的用户输入验证
- **XSS防护**：安全的DOM操作

## 🎯 使用场景

- **开发者**：快速处理文件路径、仓库链接、代码片段
- **研究人员**：批量处理文献链接、数据清洗、文本分析
- **内容创作者**：文本拆分、格式转换、多平台链接生成
- **日常用户**：智能搜索、剪贴板管理、快速链接生成

## 📊 项目统计

- 🗂️ **文件数量**：30+个核心文件
- 📝 **代码行数**：约4000行
- 🔧 **功能模块**：10+个主要模块
- 📋 **支持格式**：15+种文本格式
- ⚙️ **配置选项**：20+个可配置选项

## 🚀 版本历史

- **v2.1.0** (当前版本)
  - ✨ 新增平滑拖拽功能
  - 🎨 优化响应式布局
  - 📋 增强剪贴板监控
  - 🔧 标准化按钮设计
  - 🐛 修复内容安全策略问题
  - 📚 完善链接历史记录功能
  - 🔍 增强智能文本拆分功能
  - 🎯 新增GitHub仓库智能识别
  - 🌐 优化多平台链接生成
  - 📝 新增中文分词功能
  - 🚀 新增批量操作功能

- **v2.0.0**
  - 🎯 完整功能实现
  - 🌐 界面完全中文化
  - 📊 多格式同步分析
  - 📋 剪贴板监听功能
  - 🔧 路径转换与链接生成
  - 📝 文本拆分与清洗

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境

```bash
# 克隆项目
git clone https://github.com/SantaChains/search-enhance.git

# 进入项目目录
cd search-enhance

# 在Edge中加载扩展进行测试
```

### 测试

- 使用 `test.html` 进行功能测试
- 查看浏览器控制台确认无错误
- 测试各种文本格式的处理结果

## 📄 许可证

MIT License - 详见项目根目录

## 📞 支持

- 📖 查看项目文档了解详细功能
- 🛠️ 参考安装说明解决安装问题
- 🐛 通过GitHub Issues提交问题

---

**开发者**：SantaChains  
**最后更新**：2026年2月  
**版本**：v2.1.0  
**兼容性**：Microsoft Edge (Chromium) 88+、Google Chrome 88+  
**技术支持**：通过GitHub Issues和项目文档  │
├─────────────────────────────────────┤
│  搜索输入区                         │
├─────────────────────────────────────┤
│  功能选择区（选项卡）               │
├─────────────────────────────────────┤
│  结果显示区                         │
├─────────────────────────────────────┤
│  历史记录区                         │
└─────────────────────────────────────┘
```

---

## 🔧 功能详解

### 1. 路径转换功能

#### 支持的转换类型

**输入示例**：`D:\Users\Name\Documents\file.txt`

| 转换类型 | 输出示例 | 用途 |
|---------|---------|------|
| **原始路径** | `D:\Users\Name\Documents\file.txt` | 保持原样 |
| **Unix路径** | `/d/Users/Name/Documents/file.txt` | WSL/Linux 使用 |
| **转义路径** | `D:\\Users\\Name\\Documents\\file.txt` | 编程字符串 |
| **File URL** | `file:///D:/Users/Name/Documents/file.txt` | 浏览器打开 |

#### 批量处理
- 支持多行路径同时转换
- 每行路径独立处理
- 结果一键复制

### 2. 链接生成功能

#### 支持的仓库格式

**短格式**：`username/repo`
- 自动识别为 GitHub 仓库
- 生成多平台链接

**完整URL**：`https://github.com/username/repo`
- 反向解析仓库信息
- 生成其他平台对应链接

#### 生成的链接类型

| 平台 | 链接格式 | 用途 |
|-----|---------|------|
| **GitHub** | `https://github.com/{user}/{repo}` | 源码仓库 |
| **ZRead** | `https://zread.ai/{user}/{repo}` | AI 阅读分析 |
| **DeepWiki** | `https://deepwiki.com/{user}/{repo}` | 文档 wiki |
| **Context7** | `https://context7.com/{user}/{repo}` | 代码分析 |

### 3. 文本拆分功能

#### 智能分析模式

系统自动检测内容类型并选择最佳策略：

```javascript
// 代码示例
function example() {
  return "智能识别代码";
}
```

**识别结果**：
- 代码类型：JavaScript
- 建议模式：代码分析
- 拆分结果：函数、变量、字符串

#### 多规则组合使用

**使用场景**：清洗混合文本

1. 选择"多规则组合"模式
2. 点击规则按钮（按顺序应用）：
   - 符号分词 → 去除空格 → 中英分词
3. 查看操作历史
4. 可撤销或重置

### 4. 剪贴板历史功能

#### 自动分类标签

| 标签 | 触发条件 | 说明 |
|-----|---------|------|
| `url` | 内容为有效URL | 链接类型 |
| `code` | 匹配代码模式 | 代码片段 |
| `chinese` | 包含中文字符 | 中文内容 |
| `english` | 包含英文字符 | 英文内容 |
| `multiline` | 包含换行符 | 多行文本 |

#### 搜索和过滤

**全文搜索**：
- 搜索内容文本
- 搜索预览文本
- 搜索标签

**标签过滤**：
- 全部 / URL / 代码 / 文本

### 5. 链接历史功能

#### 搜索引擎识别

自动提取搜索查询的引擎：

| 搜索引擎 | 查询参数 | 示例 |
|---------|---------|------|
| Google | `q` | `google.com/search?q=query` |
| Bing | `q` | `bing.com/search?q=query` |
| 百度 | `wd`/`word` | `baidu.com/s?wd=query` |
| DuckDuckGo | `q` | `duckduckgo.com/?q=query` |
| 360搜索 | `q` | `so.com/s?q=query` |
| 搜狗 | `query` | `sogou.com/web?query=query` |

#### 统计信息

```json
{
  "totalItems": 150,
  "totalLinks": 100,
  "totalSearches": 50,
  "todayItems": 10,
  "topDomains": [
    { "domain": "github.com", "count": 30 },
    { "domain": "google.com", "count": 25 }
  ],
  "topSearchQueries": [
    { "query": "javascript tutorial", "count": 5 },
    { "query": "python docs", "count": 3 }
  ]
}
```

---

## ⚙️ 配置说明

### 设置项详解

#### 搜索引擎设置

```javascript
{
  "name": "Google",
  "url": "https://www.google.com/search?q=%s",
  "icon": "🔍",
  "default": true
}
```

#### 剪贴板历史设置

```javascript
{
  "maxItems": 100,        // 最大记录条数 (10-1000)
  "enabled": true,        // 是否启用
  "autoSave": true        // 自动保存
}
```

#### 链接历史设置

```javascript
{
  "maxItems": 1000,       // 最大记录条数
  "enabled": true         // 是否启用
}
```

### 配置文件导入导出

**导出配置**：
1. 打开设置页面
2. 点击"导出配置"
3. 保存 JSON 文件

**导入配置**：
1. 打开设置页面
2. 点击"导入配置"
3. 选择 JSON 文件

---

## 🏗️ 技术架构

### 项目结构

```
search-enhance/
├── 📁 icons/                      # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── 📁 src/
│   ├── 📁 background/             # 后台服务脚本
│   │   └── background.js          # 后台主逻辑
│   │
│   ├── 📁 content/                # 内容脚本
│   │   └── content.js             # 页面注入逻辑
│   │
│   ├── 📁 popup/                  # 弹窗界面
│   │   ├── index.html             # 弹窗 HTML
│   │   ├── main.js                # 弹窗主逻辑
│   │   ├── style.css              # 基础样式
│   │   └── new-style.css          # 新样式系统
│   │
│   ├── 📁 settings/               # 设置页面
│   │   ├── settings.html
│   │   └── settings.js
│   │
│   └── 📁 utils/                  # 工具模块
│       ├── textProcessor.js       # 文本处理核心
│       ├── multiRuleAnalyzer.js   # 多规则分析器
│       ├── storage.js             # 存储管理
│       ├── linkHistory.js         # 链接历史管理
│       ├── clipboardHistory.js    # 剪贴板历史管理
│       └── logger.js              # 日志工具
│
├── 📄 manifest.json               # 扩展配置 (Manifest V3)
├── 📄 package.json                # 项目配置
├── 📄 test.html                   # 功能测试页面
├── 📄 exam.html                   # 分词测试页面
└── 📄 README.md                   # 项目文档
```

### 核心模块说明

#### textProcessor.js
文本处理核心模块，提供：
- 智能内容类型检测
- 多种分词算法实现
- 路径转换和链接生成
- 多规则组合分析

#### multiRuleAnalyzer.js
多规则分析器，实现：
- 11个独立分词规则
- 规则冲突检测
- 顺序执行引擎
- 历史记录管理

#### linkHistory.js
链接历史管理，提供：
- 链接记录和查询
- 搜索引擎识别
- 统计报表生成
- 导入导出功能

#### clipboardHistory.js
剪贴板历史管理，提供：
- 内容自动分类
- 标签系统
- 全文搜索
- 持久化存储

### 数据流图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户输入    │────▶│  文本处理器  │────▶│  结果显示    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  多规则分析  │
                    │  链接生成   │
                    │  路径转换   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Chrome存储  │
                    └─────────────┘
```

### 技术栈

| 类别 | 技术 | 说明 |
|-----|------|------|
| **标准** | Manifest V3 | Chrome 扩展最新标准 |
| **语言** | ES6+ JavaScript | 现代 JavaScript 特性 |
| **模块** | ES6 Modules | 模块化代码组织 |
| **存储** | Chrome Storage API | 本地持久化存储 |
| **样式** | CSS3 + 变量 | 现代化样式系统 |
| **API** | Clipboard API | 剪贴板读写 |
| **权限** | 最小化原则 | 仅申请必要权限 |

---

## 📚 API文档

### 文本处理 API

#### splitText(text, mode, options)

拆分文本内容。

**参数**：
| 参数 | 类型 | 说明 |
|-----|------|------|
| `text` | string | 要处理的文本 |
| `mode` | string | 拆分模式 |
| `options` | object | 可选配置 |

**模式列表**：
- `smart` - 智能分析
- `chinese` - 中文分析
- `english` - 英文分析
- `code` - 代码分析
- `ai` - AI分析
- `sentence` - 整句分析
- `halfSentence` - 半句分析
- `removeSymbols` - 去除符号
- `charBreak` - 字符断行
- `random` - 随机分词
- `multi` - 多规则组合

**示例**：
```javascript
import { splitText } from './utils/textProcessor.js';

// 智能分词
const results = await splitText("Hello World! 你好世界！", "smart");

// 多规则组合
const results = await splitText(text, "multi", {
  rules: ["symbolSplit", "whitespaceSplit", "removeWhitespace"]
});
```

### 链接历史 API

#### linkHistoryManager.addLink(url, title, source, options)

添加链接到历史记录。

**示例**：
```javascript
import linkHistoryManager from './utils/linkHistory.js';

// 添加普通链接
await linkHistoryManager.addLink(
  "https://github.com/user/repo",
  "My Repository",
  "clipboard"
);

// 添加搜索查询
await linkHistoryManager.addLink(
  "https://google.com/search?q=test",
  "",
  "search"
);
```

#### linkHistoryManager.getHistory(options)

获取链接历史。

**选项**：
| 选项 | 类型 | 说明 |
|-----|------|------|
| `type` | string | 过滤类型 |
| `search` | string | 搜索关键词 |
| `dateRange` | object | 日期范围 |
| `sortBy` | string | 排序字段 |
| `limit` | number | 限制条数 |

### 剪贴板历史 API

#### clipboardHistoryManager.addItem(text, options)

添加剪贴板内容。

**示例**：
```javascript
import clipboardHistoryManager from './utils/clipboardHistory.js';

await clipboardHistoryManager.addItem("复制的内容", {
  source: "clipboard"
});
```

#### clipboardHistoryManager.exportHistory(format)

导出历史记录。

**格式**：`json` | `csv` | `txt`

---

## 🧪 测试指南

### 功能测试

打开 `test.html` 进行功能测试：

```bash
# 启动本地服务器
npx serve .

# 访问测试页面
open http://localhost:3000/test.html
```

### 分词测试

打开 `exam.html` 进行分词算法测试：

```bash
open http://localhost:3000/exam.html
```

### 单元测试

```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test -- textProcessor
```

---

## 📊 版本历史

### v2.2.0 (2026-02-08)

#### ✨ 新增功能
- **剪贴板历史管理模块**：完整的剪贴板历史管理功能
  - 持久化存储和设置接口
  - 智能内容分类（URL、代码、文本）
  - 标签系统和全文搜索
  - 导入导出功能（JSON/CSV/TXT）
  - 可配置的最大条数
- **链接历史增强**：
  - 搜索引擎查询自动提取
  - 支持 8 大搜索引擎
  - 搜索查询独立记录
  - 统计报表功能
- **多规则组合优化**：
  - 操作历史显示
  - 撤销功能改进
  - UI 布局优化

#### 🔧 改进优化
- 符号分词算法修复
- 整句/半句分析保留标点
- 剪贴板历史 UI 与链接历史一致
- 性能优化和内存管理

#### 🐛 问题修复
- 修复符号分词无效问题
- 修复多规则组合 UI 显示问题
- 修复历史记录重复问题

### v2.1.0 (2026-01-15)

- ✨ 新增平滑拖拽功能
- 🎨 优化响应式布局
- 📋 增强剪贴板监控
- 🔧 标准化按钮设计
- 🐛 修复内容安全策略问题
- 📚 完善链接历史记录功能
- 🔍 增强智能文本拆分功能
- 🎯 新增 GitHub 仓库智能识别
- 🌐 优化多平台链接生成
- 📝 新增中文分词功能
- 🚀 新增批量操作功能

### v2.0.0 (2025-12-01)

- 🎯 完整功能实现
- 🌐 界面完全中文化
- 📊 多格式同步分析
- 📋 剪贴板监听功能
- 🔧 路径转换与链接生成
- 📝 文本拆分与清洗

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/SantaChains/search-enhance.git

# 进入项目目录
cd search-enhance

# 安装依赖
npm install

# 在 Edge/Chrome 中加载扩展进行测试
```

### 代码规范

- 使用 ES6+ 语法
- 遵循 JSDoc 注释规范
- 保持代码模块化
- 添加适当的错误处理

### 提交规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

```
MIT License

Copyright (c) 2026 SantaChains

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 支持与反馈

- 📧 **Email**: [your-email@example.com]
- 🐛 **Issues**: [GitHub Issues](https://github.com/SantaChains/search-enhance/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/SantaChains/search-enhance/discussions)

---

<p align="center">
  <strong>Made with ❤️ by SantaChains</strong>
</p>

<p align="center">
  最后更新：2026年2月8日 | 版本：v2.2.0
</p>
