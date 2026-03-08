/**
 * 统一导出导入 Schema 定义模块
 * 提供标准化的数据结构和导入导出逻辑
 */

// Schema 常量定义
export const APP_NAME = 'Decide Search';
export const SCHEMA_VERSION = '2.0';
export const SCHEMA_URL =
  'https://github.com/SantaChains/search-enhance/blob/main/test/sample.schema.json';

// 导出类型枚举
export const EXPORT_TYPES = {
  FULL: 'full', // 完整备份
  SETTINGS: 'settings', // 仅设置
  LINK_HISTORY: 'linkHistory', // 仅链接历史
  CLIPBOARD_HISTORY: 'clipboardHistory' // 仅剪贴板历史
};

// 导入上下文枚举
export const IMPORT_CONTEXTS = {
  SETTINGS: 'settings', // 在设置页面导入
  LINK_HISTORY: 'linkHistory', // 在链接历史页面导入
  CLIPBOARD_HISTORY: 'clipboardHistory' // 在剪贴板历史页面导入
};

// 旧格式类型检测标识
export const LEGACY_FORMATS = {
  OLD_SETTINGS: 'oldSettings', // 旧版设置（包含 searchEngines）
  OLD_LINK_HISTORY: 'oldLinkHistory', // 旧版链接历史（直接是数组）
  OLD_CLIPBOARD_HISTORY: 'oldClipboardHistory' // 旧版剪贴板历史
};

/**
 * 创建标准化的导出数据结构
 * @param {string} exportType - 导出类型
 * @param {string} exportedBy - 导出来源
 * @param {Object} data - 实际数据
 * @returns {Object} 标准化的导出数据
 */
export function createExportData(exportType, exportedBy, data) {
  return {
    $schema: SCHEMA_URL,
    metadata: {
      appName: APP_NAME,
      version: SCHEMA_VERSION,
      exportType,
      exportDate: new Date().toISOString(),
      exportedBy
    },
    data: {
      ...(data.settings && { settings: data.settings }),
      ...(data.linkHistory && { linkHistory: data.linkHistory }),
      ...(data.clipboardHistory && { clipboardHistory: data.clipboardHistory })
    }
  };
}

/**
 * 验证数据是否符合 Schema 规范
 * @param {Object} data - 待验证的数据
 * @returns {Object} 验证结果 { valid: boolean, error?: string }
 */
export function validateSchema(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '数据格式无效' };
  }

  // 检查 metadata 是否存在
  if (!data.metadata) {
    return { valid: false, error: '缺少 metadata 字段' };
  }

  const { metadata } = data;

  // 检查必需字段
  if (!metadata.appName) {
    return { valid: false, error: '缺少 metadata.appName' };
  }

  if (!metadata.version) {
    return { valid: false, error: '缺少 metadata.version' };
  }

  if (!metadata.exportType) {
    return { valid: false, error: '缺少 metadata.exportType' };
  }

  // 检查 exportType 是否有效
  const validTypes = Object.values(EXPORT_TYPES);
  if (!validTypes.includes(metadata.exportType)) {
    return { valid: false, error: `无效的 exportType: ${metadata.exportType}` };
  }

  // 检查 data 是否存在
  if (!data.data || typeof data.data !== 'object') {
    return { valid: false, error: '缺少 data 字段' };
  }

  return { valid: true };
}

/**
 * 检测数据是否为旧格式
 * @param {Object} data - 待检测的数据
 * @returns {string|null} 旧格式类型或 null
 */
export function detectLegacyFormat(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // 如果已有 metadata，说明是新格式
  if (data.metadata) {
    return null;
  }

  // 检测旧版设置格式（包含 searchEngines 数组）
  if (data.searchEngines && Array.isArray(data.searchEngines)) {
    return LEGACY_FORMATS.OLD_SETTINGS;
  }

  // 检测旧版链接历史格式（直接是数组或包含 type: 'allData'）
  if (data.type === 'allData' && data.data) {
    // 这是 v2.0 之前的中间格式
    if (data.data.linkHistory || data.data.clipboardHistory) {
      return LEGACY_FORMATS.OLD_LINK_HISTORY;
    }
    if (data.data.settings) {
      return LEGACY_FORMATS.OLD_SETTINGS;
    }
  }

  // 检测旧版剪贴板历史格式（包含 type: 'clipboardHistory'）
  if (data.type === 'clipboardHistory' && data.history) {
    return LEGACY_FORMATS.OLD_CLIPBOARD_HISTORY;
  }

  // 检测纯数组格式（可能是旧版链接历史或剪贴板历史）
  if (Array.isArray(data)) {
    // 根据数组内容推断类型
    if (data.length > 0) {
      const firstItem = data[0];
      if (firstItem.url !== undefined) {
        return LEGACY_FORMATS.OLD_LINK_HISTORY;
      }
      if (firstItem.text !== undefined) {
        return LEGACY_FORMATS.OLD_CLIPBOARD_HISTORY;
      }
    }
    return LEGACY_FORMATS.OLD_LINK_HISTORY; // 默认假设为链接历史
  }

  return null;
}

/**
 * 将旧格式数据转换为新格式
 * @param {Object} legacyData - 旧格式数据
 * @param {string} legacyType - 旧格式类型
 * @param {string} targetContext - 目标上下文（用于确定 exportType）
 * @returns {Object} 新格式数据
 */
export function convertLegacyToNew(legacyData, legacyType, targetContext) {
  const exportDate = new Date().toISOString();

  switch (legacyType) {
  case LEGACY_FORMATS.OLD_SETTINGS:
    // 旧版设置格式转换
    if (legacyData.type === 'allData' && legacyData.data) {
      // v2.0 之前的中间格式
      return {
        $schema: SCHEMA_URL,
        metadata: {
          appName: APP_NAME,
          version: SCHEMA_VERSION,
          exportType: EXPORT_TYPES.FULL,
          exportDate,
          exportedBy: IMPORT_CONTEXTS.SETTINGS
        },
        data: legacyData.data
      };
    }
    // 纯设置格式
    return {
      $schema: SCHEMA_URL,
      metadata: {
        appName: APP_NAME,
        version: SCHEMA_VERSION,
        exportType: EXPORT_TYPES.SETTINGS,
        exportDate,
        exportedBy: IMPORT_CONTEXTS.SETTINGS
      },
      data: {
        settings: legacyData
      }
    };

  case LEGACY_FORMATS.OLD_LINK_HISTORY: {
    // 旧版链接历史格式转换
    if (legacyData.type === 'allData' && legacyData.data?.linkHistory) {
      return {
        $schema: SCHEMA_URL,
        metadata: {
          appName: APP_NAME,
          version: SCHEMA_VERSION,
          exportType: EXPORT_TYPES.FULL,
          exportDate,
          exportedBy: IMPORT_CONTEXTS.LINK_HISTORY
        },
        data: legacyData.data
      };
    }
    // 纯数组格式
    const linkItems = Array.isArray(legacyData) ? legacyData : legacyData.history || [];
    return {
      $schema: SCHEMA_URL,
      metadata: {
        appName: APP_NAME,
        version: SCHEMA_VERSION,
        exportType: EXPORT_TYPES.LINK_HISTORY,
        exportDate,
        exportedBy: IMPORT_CONTEXTS.LINK_HISTORY
      },
      data: {
        linkHistory: {
          items: linkItems,
          settings: legacyData.settings || { enabled: true, maxItems: 100 }
        }
      }
    };
  }

  case LEGACY_FORMATS.OLD_CLIPBOARD_HISTORY: {
    // 旧版剪贴板历史格式转换
    const clipboardItems = legacyData.history || (Array.isArray(legacyData) ? legacyData : []);
    return {
      $schema: SCHEMA_URL,
      metadata: {
        appName: APP_NAME,
        version: SCHEMA_VERSION,
        exportType: EXPORT_TYPES.CLIPBOARD_HISTORY,
        exportDate,
        exportedBy: IMPORT_CONTEXTS.CLIPBOARD_HISTORY
      },
      data: {
        clipboardHistory: {
          items: clipboardItems,
          settings: legacyData.settings || { enabled: true, maxItems: 100, autoSave: true }
        }
      }
    };
  }

  default:
    // 未知格式，尝试智能推断
    return {
      $schema: SCHEMA_URL,
      metadata: {
        appName: APP_NAME,
        version: SCHEMA_VERSION,
        exportType: EXPORT_TYPES.FULL,
        exportDate,
        exportedBy: targetContext || IMPORT_CONTEXTS.SETTINGS
      },
      data: {
        settings: legacyData.settings || legacyData
      }
    };
  }
}

/**
 * 获取导入策略
 * @param {string} importContext - 导入上下文
 * @param {string} exportType - 导出类型
 * @returns {Object} 导入策略 { canImport: boolean, targetDataKey?: string, error?: string }
 */
export function getImportStrategy(importContext, exportType) {
  // 导入策略矩阵
  const strategies = {
    [IMPORT_CONTEXTS.SETTINGS]: {
      [EXPORT_TYPES.FULL]: { canImport: true, targetDataKey: null }, // 导入所有
      [EXPORT_TYPES.SETTINGS]: { canImport: true, targetDataKey: 'settings' },
      [EXPORT_TYPES.LINK_HISTORY]: { canImport: true, targetDataKey: 'linkHistory' },
      [EXPORT_TYPES.CLIPBOARD_HISTORY]: { canImport: true, targetDataKey: 'clipboardHistory' }
    },
    [IMPORT_CONTEXTS.LINK_HISTORY]: {
      [EXPORT_TYPES.FULL]: { canImport: true, targetDataKey: 'linkHistory' }, // 只提取 linkHistory
      [EXPORT_TYPES.SETTINGS]: { canImport: false, error: '无法在链接历史页面导入设置数据' },
      [EXPORT_TYPES.LINK_HISTORY]: { canImport: true, targetDataKey: 'linkHistory' },
      [EXPORT_TYPES.CLIPBOARD_HISTORY]: {
        canImport: false,
        error: '数据类型不匹配：这是剪贴板历史数据，请在剪贴板历史页面导入'
      }
    },
    [IMPORT_CONTEXTS.CLIPBOARD_HISTORY]: {
      [EXPORT_TYPES.FULL]: { canImport: true, targetDataKey: 'clipboardHistory' }, // 只提取 clipboardHistory
      [EXPORT_TYPES.SETTINGS]: { canImport: false, error: '无法在剪贴板历史页面导入设置数据' },
      [EXPORT_TYPES.LINK_HISTORY]: {
        canImport: false,
        error: '数据类型不匹配：这是链接历史数据，请在链接历史页面导入'
      },
      [EXPORT_TYPES.CLIPBOARD_HISTORY]: { canImport: true, targetDataKey: 'clipboardHistory' }
    }
  };

  const contextStrategies = strategies[importContext];
  if (!contextStrategies) {
    return { canImport: false, error: '未知的导入上下文' };
  }

  const strategy = contextStrategies[exportType];
  if (!strategy) {
    return { canImport: false, error: `不支持的导出类型: ${exportType}` };
  }

  return strategy;
}

/**
 * 根据导入上下文提取对应数据
 * @param {Object} data - 标准化数据对象
 * @param {string} importContext - 导入上下文
 * @returns {Object} 提取结果 { success: boolean, data?: any, error?: string }
 */
export function extractDataForContext(data, importContext) {
  const { metadata, data: dataContent } = data;

  // 获取导入策略
  const strategy = getImportStrategy(importContext, metadata.exportType);

  if (!strategy.canImport) {
    return { success: false, error: strategy.error };
  }

  // 如果 targetDataKey 为 null，说明要导入所有数据
  if (strategy.targetDataKey === null) {
    return { success: true, data: dataContent };
  }

  // 提取特定数据分区
  const targetData = dataContent[strategy.targetDataKey];
  if (!targetData) {
    return { success: false, error: `数据文件中缺少 ${strategy.targetDataKey} 分区` };
  }

  return { success: true, data: { [strategy.targetDataKey]: targetData } };
}

/**
 * 解析并标准化导入数据
 * @param {string|Object} rawData - 原始导入数据（JSON字符串或对象）
 * @param {string} importContext - 导入上下文
 * @returns {Object} 解析结果 { success: boolean, data?: Object, error?: string, isLegacy?: boolean }
 */
export function parseImportData(rawData, importContext) {
  try {
    // 解析 JSON
    let parsedData;
    if (typeof rawData === 'string') {
      parsedData = JSON.parse(rawData);
    } else {
      parsedData = rawData;
    }

    // 检测是否为旧格式
    const legacyType = detectLegacyFormat(parsedData);
    if (legacyType) {
      // 转换为新格式
      const convertedData = convertLegacyToNew(parsedData, legacyType, importContext);
      return {
        success: true,
        data: convertedData,
        isLegacy: true,
        legacyType
      };
    }

    // 验证新格式
    const validation = validateSchema(parsedData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return { success: true, data: parsedData, isLegacy: false };
  } catch (error) {
    return { success: false, error: `解析数据失败: ${error.message}` };
  }
}

/**
 * 创建链接历史导出数据
 * @param {Array} items - 链接历史项
 * @param {Object} settings - 链接历史设置
 * @returns {Object} 标准化的导出数据
 */
export function createLinkHistoryExport(items, settings) {
  return createExportData(EXPORT_TYPES.LINK_HISTORY, IMPORT_CONTEXTS.LINK_HISTORY, {
    linkHistory: {
      items,
      settings
    }
  });
}

/**
 * 创建剪贴板历史导出数据
 * @param {Array} items - 剪贴板历史项
 * @param {Object} settings - 剪贴板历史设置
 * @returns {Object} 标准化的导出数据
 */
export function createClipboardHistoryExport(items, settings) {
  return createExportData(EXPORT_TYPES.CLIPBOARD_HISTORY, IMPORT_CONTEXTS.CLIPBOARD_HISTORY, {
    clipboardHistory: {
      items,
      settings
    }
  });
}

/**
 * 创建设置导出数据
 * @param {Object} settings - 设置对象
 * @returns {Object} 标准化的导出数据
 */
export function createSettingsExport(settings) {
  return createExportData(EXPORT_TYPES.SETTINGS, IMPORT_CONTEXTS.SETTINGS, { settings });
}

/**
 * 创建完整备份导出数据
 * @param {Object} settings - 设置对象
 * @param {Object} linkHistory - 链接历史数据
 * @param {Object} clipboardHistory - 剪贴板历史数据
 * @returns {Object} 标准化的导出数据
 */
export function createFullExport(settings, linkHistory, clipboardHistory) {
  return createExportData(EXPORT_TYPES.FULL, IMPORT_CONTEXTS.SETTINGS, {
    settings,
    linkHistory,
    clipboardHistory
  });
}

// 默认导出
export default {
  APP_NAME,
  SCHEMA_VERSION,
  SCHEMA_URL,
  EXPORT_TYPES,
  IMPORT_CONTEXTS,
  LEGACY_FORMATS,
  createExportData,
  validateSchema,
  detectLegacyFormat,
  convertLegacyToNew,
  getImportStrategy,
  extractDataForContext,
  parseImportData,
  createLinkHistoryExport,
  createClipboardHistoryExport,
  createSettingsExport,
  createFullExport
};
