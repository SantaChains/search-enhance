/**
 * 统一工具函数模块
 * 提供通用的DOM操作、数据处理、错误处理等工具函数
 */

/**
 * 安全获取DOM元素
 * @param {string} id - 元素ID
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * 安全获取多个DOM元素
 * @param {string} selector - CSS选择器
 * @returns {NodeList}
 */
export function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * 安全获取元素文本
 * @param {HTMLElement|null} el - 元素
 * @returns {string}
 */
export function getText(el) {
  return el ? el.textContent || el.innerText || '' : '';
}

/**
 * 安全设置元素文本
 * @param {HTMLElement|null} el - 元素
 * @param {string} text - 文本
 */
export function setText(el, text) {
  if (el) {
    el.textContent = text;
  }
}

/**
 * 安全显示/隐藏元素
 * @param {HTMLElement|null} el - 元素
 * @param {boolean} visible - 是否显示
 */
export function show(el, visible) {
  if (el) {
    el.style.display = visible ? '' : 'none';
  }
}

/**
 * 安全获取输入值
 * @param {HTMLInputElement|HTMLTextAreaElement|null} el - 输入元素
 * @returns {string}
 */
export function getValue(el) {
  return el ? el.value || '' : '';
}

/**
 * 安全设置输入值
 * @param {HTMLInputElement|HTMLTextAreaElement|null} el - 输入元素
 * @param {string} value - 值
 */
export function setValue(el, value) {
  if (el) {
    el.value = value || '';
  }
}

/**
 * 安全获取checkbox状态
 * @param {HTMLInputElement|null} el - checkbox元素
 * @returns {boolean}
 */
export function getChecked(el) {
  return el ? el.checked : false;
}

/**
 * 安全设置checkbox状态
 * @param {HTMLInputElement|null} el - checkbox元素
 * @param {boolean} checked - 状态
 */
export function setChecked(el, checked) {
  if (el) {
    el.checked = checked;
  }
}

/**
 * 安全解析整数
 * @param {string|number} value - 值
 * @param {number} defaultValue - 默认值
 * @returns {number}
 */
export function parseIntSafe(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 安全解析浮点数
 * @param {string|number} value - 值
 * @param {number} defaultValue - 默认值
 * @returns {number}
 */
export function parseFloatSafe(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout = null;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制(毫秒)
 * @returns {Function}
 */
export function throttle(func, limit = 300) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 安全执行异步函数
 * @param {Function} asyncFunc - 异步函数
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function safeAsync(asyncFunc) {
  try {
    const data = await asyncFunc();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * 安全的JSON解析
 * @param {string} json - JSON字符串
 * @param {any} defaultValue - 解析失败时的默认值
 * @returns {any}
 */
export function jsonParse(json, defaultValue = null) {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * 安全创建对象URL
 * @param {Blob|File} blob - Blob对象
 * @returns {string|null}
 */
export function createObjectURL(blob) {
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * 安全释放对象URL
 * @param {string} url - 对象URL
 */
export function revokeObjectURL(url) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // 忽略错误
  }
}

/**
 * 深度克隆对象
 * @param {any} obj - 要克隆的对象
 * @returns {any}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }
  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * 判断是否为空值
 * @param {any} value - 值
 * @returns {boolean}
 */
export function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

/**
 * 截断文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @returns {string}
 */
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 格式化日期
 * @param {Date|number|string} date - 日期
 * @param {string} locale - 语言
 * @returns {string}
 */
export function formatDate(date, locale = 'zh-CN') {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale);
  } catch {
    return '';
  }
}

/**
 * 格式化相对时间
 * @param {Date|number|string} timestamp - 时间戳
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return formatDate(timestamp);
}

/**
 * 生成唯一ID
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * HTML转义
 * @param {string} text - 文本
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * 移除HTML标签
 * @param {string} html - HTML字符串
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 文本
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从剪贴板读取文本
 * @returns {Promise<string>}
 */
export async function readFromClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

/**
 * 检测URL是否为浏览器主页/内部页面
 * 用于限制快捷键在浏览器主页不执行
 * @param {string} url - 要检测的URL
 * @returns {boolean} 是否为浏览器主页
 */
export function isBrowserHomePage(url) {
  if (!url) return false;

  // 浏览器内部协议列表
  const browserProtocols = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'firefox://',
    'opera://',
    'vivaldi://',
    'brave://'
  ];

  // 检查是否以浏览器内部协议开头
  return browserProtocols.some(protocol => url.toLowerCase().startsWith(protocol));
}

export default {
  $,
  $$,
  getText,
  setText,
  show,
  getValue,
  setValue,
  getChecked,
  setChecked,
  parseIntSafe,
  parseFloatSafe,
  debounce,
  throttle,
  safeAsync,
  jsonParse,
  createObjectURL,
  revokeObjectURL,
  deepClone,
  isEmpty,
  truncate,
  formatDate,
  formatRelativeTime,
  generateId,
  escapeHtml,
  stripHtml,
  copyToClipboard,
  readFromClipboard,
  isBrowserHomePage
};
