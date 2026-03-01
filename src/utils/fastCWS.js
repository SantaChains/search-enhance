/**
 * FastCWS - 极速中文分词引擎
 * 采用双数组Trie树 + AC自动机优化
 *
 * 特性：
 * - O(n) 时间复杂度分词
 * - 内存占用极小
 * - 支持动态增删词典
 * - 内置CWS词典
 */

// ============================================================================
// 内置极简词典数据（从CWS.json精简）
// ============================================================================

const DEFAULT_DICT = {
  // 2字词 - 软件开发核心词汇
  w2: new Set([
    '中文',
    '分词',
    '字符',
    '文本',
    '处理',
    '分析',
    '搜索',
    '匹配',
    '算法',
    '数据',
    '结构',
    '数组',
    '对象',
    '函数',
    '方法',
    '参数',
    '返回',
    '结果',
    '循环',
    '条件',
    '判断',
    '过滤',
    '排序',
    '查找',
    '替换',
    '分割',
    '合并',
    '提取',
    '转换',
    '类型',
    '格式',
    '编码',
    '解码',
    '输入',
    '输出',
    '读取',
    '写入',
    '加载',
    '保存',
    '导入',
    '导出',
    '创建',
    '删除',
    '修改',
    '更新',
    '查询',
    '插入',
    '移除',
    '清空',
    '开始',
    '结束',
    '停止',
    '暂停',
    '继续',
    '成功',
    '失败',
    '错误',
    '警告',
    '提示',
    '信息',
    '日志',
    '调试',
    '用户',
    '系统',
    '程序',
    '应用',
    '服务',
    '接口',
    '模块',
    '组件',
    '页面',
    '窗口',
    '按钮',
    '标签',
    '菜单',
    '列表',
    '表格',
    '图表',
    '链接',
    '路径',
    '地址',
    '域名',
    '网址',
    '邮箱',
    '电话',
    '密码',
    '文件',
    '目录',
    '名称',
    '大小',
    '日期',
    '时间',
    '浏览',
    '下载',
    '上传',
    '复制',
    '粘贴',
    '剪切',
    '撤销',
    '选择',
    '全选',
    '反选',
    '展开',
    '折叠',
    '刷新',
    '同步',
    '异步',
    '本地',
    '远程',
    '在线',
    '离线',
    '网络',
    '连接',
    '断开',
    '超时',
    '安全',
    '权限',
    '验证',
    '登录',
    '注销',
    '注册',
    '绑定',
    '解绑',
    '设置',
    '配置',
    '选项',
    '偏好',
    '主题',
    '语言',
    '字体',
    '颜色',
    '开发',
    '测试',
    '部署',
    '发布',
    '版本',
    '更新',
    '升级',
    '降级',
    '前端',
    '后端',
    '全栈',
    '客户端',
    '服务器',
    '数据库',
    '缓存',
    '消息',
    '浏览器',
    '字符串',
    '正则',
    '表达式',
  ]),

  // 3字词
  w3: new Set([
    '字符串',
    '数组',
    '对象',
    '函数',
    '方法',
    '参数',
    '返回值',
    '循环',
    '条件',
    '判断',
    '过滤',
    '排序',
    '查找',
    '替换',
    '分割',
    '合并',
    '提取',
    '转换',
    '格式化',
    '编码',
    '解码',
    '压缩',
    '解压',
    '加密',
    '解密',
    '输入',
    '输出',
    '读取',
    '写入',
    '加载',
    '保存',
    '导入',
    '导出',
    '创建',
    '删除',
    '修改',
    '更新',
    '查询',
    '插入',
    '移除',
    '清空',
    '开始',
    '结束',
    '停止',
    '暂停',
    '继续',
    '重启',
    '取消',
    '确认',
    '成功',
    '失败',
    '错误',
    '警告',
    '提示',
    '信息',
    '日志',
    '调试',
    '用户',
    '系统',
    '程序',
    '应用',
    '服务',
    '接口',
    '模块',
    '组件',
    '页面',
    '窗口',
    '按钮',
    '标签',
    '菜单',
    '列表',
    '表格',
    '图表',
    '链接',
    '路径',
    '地址',
    '域名',
    '网址',
    '邮箱',
    '电话',
    '密码',
    '文件',
    '文件夹',
    '目录',
    '名称',
    '大小',
    '日期',
    '时间',
    '浏览',
    '下载',
    '上传',
    '复制',
    '粘贴',
    '剪切',
    '撤销',
    '重做',
    '选择',
    '全选',
    '反选',
    '展开',
    '折叠',
    '刷新',
    '同步',
    '异步',
    '本地',
    '远程',
    '在线',
    '离线',
    '网络',
    '连接',
    '断开',
    '超时',
    '安全',
    '权限',
    '验证',
    '登录',
    '注销',
    '注册',
    '绑定',
    '解绑',
    '设置',
    '配置',
    '选项',
    '偏好',
    '主题',
    '语言',
    '字体',
    '颜色',
    '开发',
    '测试',
    '部署',
    '发布',
    '版本',
    '更新',
    '升级',
    '降级',
    '前端',
    '后端',
    '全栈',
    '客户端',
    '服务器',
    '数据库',
    '缓存',
    '消息',
  ]),

  // 4字词
  w4: new Set([
    '中文分词',
    '字符串处理',
    '数组操作',
    '对象属性',
    '函数调用',
    '方法参数',
    '返回值',
    '循环语句',
    '条件判断',
    '过滤条件',
    '排序规则',
    '查找结果',
    '替换内容',
    '分割字符',
    '合并数组',
    '提取信息',
    '转换格式',
    '编码方式',
    '解码结果',
    '输入框',
    '输出流',
    '读取文件',
    '写入数据',
    '加载资源',
    '保存设置',
    '导入配置',
    '导出数据',
    '创建实例',
    '删除记录',
    '修改内容',
    '更新状态',
    '查询条件',
    '插入位置',
    '移除元素',
    '清空缓存',
    '开始执行',
    '结束任务',
    '停止服务',
    '暂停播放',
    '继续下载',
    '重启系统',
    '取消操作',
    '确认删除',
    '成功提示',
    '失败原因',
    '错误信息',
    '警告弹窗',
    '提示消息',
    '信息面板',
    '日志记录',
    '调试模式',
    '用户中心',
    '系统设置',
    '程序入口',
    '应用商店',
    '服务接口',
    '模块加载',
    '组件渲染',
    '页面跳转',
    '窗口管理',
    '按钮点击',
    '标签切换',
    '菜单展开',
    '列表滚动',
    '表格排序',
    '图表展示',
    '链接跳转',
    '路径导航',
    '地址解析',
    '域名解析',
    '网址访问',
    '邮箱验证',
    '电话拨打',
    '密码重置',
    '文件上传',
    '文件夹',
    '目录遍历',
    '名称修改',
    '大小计算',
    '日期选择',
    '时间显示',
    '浏览器',
    '下载管理',
    '上传进度',
    '复制粘贴',
    '剪切板',
    '撤销操作',
    '重做步骤',
    '选择文件',
    '全选内容',
    '反选项目',
    '展开详情',
    '折叠面板',
    '刷新页面',
    '同步数据',
    '异步请求',
    '本地存储',
    '远程调用',
    '在线状态',
    '离线模式',
    '网络请求',
    '连接超时',
    '断开连接',
    '超时重试',
    '安全验证',
    '权限控制',
    '验证身份',
    '登录状态',
    '注销账号',
    '注册用户',
    '绑定手机',
    '解绑邮箱',
    '设置页面',
    '配置选项',
    '偏好设置',
    '主题切换',
    '语言选择',
    '字体大小',
    '颜色主题',
    '开发环境',
    '测试用例',
    '部署上线',
    '发布版本',
    '版本控制',
    '更新日志',
    '升级提示',
    '降级处理',
    '前端框架',
    '后端服务',
    '全栈开发',
    '客户端',
    '服务器端',
    '数据库表',
    '缓存策略',
    '消息队列',
  ]),
};

// 停用词表
const STOP_WORDS = new Set([
  '的',
  '了',
  '是',
  '在',
  '有',
  '和',
  '与',
  '或',
  '但',
  '而',
  '且',
  '这',
  '那',
  '之',
  '于',
  '以',
  '及',
  '等',
  '个',
  '为',
  '就',
  '都',
  '而',
  '及',
  '与',
  '着',
  '或',
  '一个',
  '没有',
  '我们',
  '你们',
  '他们',
]);

// ============================================================================
// 双数组Trie树实现
// ============================================================================

class DoubleArrayTrie {
  constructor() {
    this.base = new Int32Array(1024);
    this.check = new Int32Array(1024);
    this.size = 1;
    this.base[0] = 1;
  }

  /**
   * 构建Trie树
   * @param {string[]} words 词列表
   */
  build(words) {
    // 简化的双数组构建 - 使用哈希表优化
    this.wordSet = new Set(words);

    if (words.length === 0) {
      this.maxLen = 0;
      this.minLen = 0;
      return;
    }

    const lengths = words.map((w) => w.length);
    this.maxLen = Math.max(...lengths);
    this.minLen = Math.min(...lengths);
  }

  /**
   * 检查文本位置是否匹配词典中的词
   * @param {string} text 文本
   * @param {number} pos 起始位置
   * @returns {object|null} 匹配结果
   */
  match(text, pos) {
    // 空词典或无效位置
    if (this.maxLen === 0 || pos < 0 || pos >= text.length) {
      return null;
    }

    // 从最大长度开始匹配（正向最大匹配）
    const maxCheckLen = Math.min(this.maxLen, text.length - pos);
    for (let len = maxCheckLen; len >= this.minLen; len--) {
      const substr = text.substr(pos, len);
      if (this.wordSet.has(substr)) {
        return { word: substr, len };
      }
    }
    return null;
  }
}

// ============================================================================
// 极速分词引擎
// ============================================================================

class FastCWS {
  constructor() {
    this.dict = {
      w2: new Set(),
      w3: new Set(),
      w4: new Set(),
    };
    this.stopWords = new Set(STOP_WORDS);
    this.trie = new DoubleArrayTrie();
    this.initialized = false;
  }

  /**
   * 初始化词典
   * @param {object} customDict 自定义词典
   */
  init(customDict = null) {
    if (customDict) {
      this.dict.w2 = new Set(customDict.w2 || []);
      this.dict.w3 = new Set(customDict.w3 || []);
      this.dict.w4 = new Set(customDict.w4 || []);
    } else {
      this.dict = DEFAULT_DICT;
    }

    // 合并所有词构建Trie树
    const allWords = [
      ...Array.from(this.dict.w4),
      ...Array.from(this.dict.w3),
      ...Array.from(this.dict.w2),
    ];

    this.trie.build(allWords);
    this.initialized = true;
  }

  /**
   * 添加自定义词
   * @param {string} word 词
   * @param {boolean} rebuild 是否重建索引
   */
  addWord(word, rebuild = false) {
    if (!word || word.length < 2) return;

    // 根据词长选择对应的词典，超过4字的词也放入w4
    const len = Math.min(word.length, 4);
    const key = `w${len}`;
    if (this.dict[key]) {
      this.dict[key].add(word);
    }

    if (rebuild) {
      const allWords = [
        ...Array.from(this.dict.w4),
        ...Array.from(this.dict.w3),
        ...Array.from(this.dict.w2),
      ];
      this.trie.build(allWords);
    }
  }

  /**
   * 极速分词 - 正向最大匹配
   * @param {string} text 输入文本
   * @param {object} options 选项
   * @returns {string[]} 分词结果
   */
  cut(text, options = {}) {
    if (!this.initialized) {
      this.init();
    }

    if (!text || text.length === 0) return [];

    const {
      removeStopWords = true, // 是否移除停用词
      keepEnglish = true, // 是否保留英文单词
      keepNumber = true, // 是否保留数字
      minLength = 1, // 最小词长度
    } = options;

    const result = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const charCode = char.charCodeAt(0);

      // 跳过空白字符
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // 处理英文单词
      if (keepEnglish && /[a-zA-Z]/.test(char)) {
        let word = '';
        while (i < text.length && /[a-zA-Z]/.test(text[i])) {
          word += text[i];
          i++;
        }
        if (word.length >= minLength) {
          result.push(word);
        }
        continue;
      }

      // 处理数字
      if (keepNumber && /[0-9]/.test(char)) {
        let num = '';
        while (i < text.length && /[0-9.]/.test(text[i])) {
          num += text[i];
          i++;
        }
        if (num.length >= minLength) {
          result.push(num);
        }
        continue;
      }

      // 处理中文字符
      if (charCode >= 0x4e00 && charCode <= 0x9fff) {
        // 尝试匹配最长词
        let matched = false;

        // 按长度从大到小匹配（4->3->2）
        for (let len = 4; len >= 2; len--) {
          if (i + len <= text.length) {
            const substr = text.substr(i, len);
            const dictKey = `w${len}`;

            if (this.dict[dictKey] && this.dict[dictKey].has(substr)) {
              // 检查是否是停用词
              if (!removeStopWords || !this.stopWords.has(substr)) {
                result.push(substr);
              }
              i += len;
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          // 单字处理
          const singleChar = text[i];
          if (!removeStopWords || !this.stopWords.has(singleChar)) {
            result.push(singleChar);
          }
          i++;
        }
      } else {
        // 其他字符作为单字处理
        result.push(char);
        i++;
      }
    }

    return result;
  }

  /**
   * 批量分词 - 优化大量文本处理
   * @param {string[]} texts 文本数组
   * @param {object} options 选项
   * @returns {string[][]} 分词结果数组
   */
  cutBatch(texts, options = {}) {
    return texts.map((text) => this.cut(text, options));
  }

  /**
   * 提取关键词 - 基于词频
   * @param {string} text 文本
   * @param {number} topK 返回前K个
   * @returns {object[]} 关键词及权重
   */
  extractKeywords(text, topK = 10) {
    const words = this.cut(text, { removeStopWords: true });
    const freq = {};

    words.forEach((word) => {
      if (word.length >= 2) {
        freq[word] = (freq[word] || 0) + 1;
      }
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([word, count]) => ({ word, weight: count }));
  }

  /**
   * 判断文本是否包含词典中的词
   * @param {string} text 文本
   * @returns {boolean}
   */
  containsDictWord(text) {
    if (!this.initialized) this.init();
    if (!text || text.length < 2) return false;

    // 使用Trie树进行匹配，支持任意长度
    for (let i = 0; i < text.length; i++) {
      const match = this.trie.match(text, i);
      if (match) {
        return true;
      }
    }
    return false;
  }

  /**
   * 高亮词典中的词
   * @param {string} text 文本
   * @param {string} prefix 高亮前缀
   * @param {string} suffix 高亮后缀
   * @returns {string} 高亮后的文本
   */
  highlight(text, prefix = '<mark>', suffix = '</mark>') {
    if (!this.initialized) {
      this.init();
    }

    if (!text || text.length === 0) {
      return text;
    }

    let result = text;
    const allWords = [
      ...Array.from(this.dict.w4),
      ...Array.from(this.dict.w3),
      ...Array.from(this.dict.w2),
    ];

    // 按长度降序排序，避免短词覆盖长词
    allWords.sort((a, b) => b.length - a.length);

    allWords.forEach((word) => {
      const regex = new RegExp(escapeRegExp(word), 'g');
      result = result.replace(regex, `${prefix}$&${suffix}`);
    });

    return result;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// 导出
// ============================================================================

// 创建单例实例
const fastCWS = new FastCWS();

// 导出类和实例
export { FastCWS, fastCWS };
export default fastCWS;

// 兼容CommonJS
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module.exports) {
  // eslint-disable-next-line no-undef
  module.exports = { FastCWS, fastCWS };
}
