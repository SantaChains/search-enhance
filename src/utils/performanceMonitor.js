/**
 * 性能监控工具
 * 功能：收集和报告关键性能指标
 * 入参：无
 * 出参：performanceMonitor 实例
 */

import { createLogger } from './logger.js';

const logger = createLogger('[Performance]');

// 性能指标定义
const METRICS = {
  clipboardPoll: 'clipboardPollTime',
  splitText: 'splitTextTime',
  storageWrite: 'storageWriteTime',
  storageRead: 'storageReadTime',
  aiAnalyze: 'aiAnalyzeTime',
  renderUI: 'renderUITime'
};

// 性能数据存储器
const performanceData = {
  [METRICS.clipboardPoll]: [],
  [METRICS.splitText]: [],
  [METRICS.storageWrite]: [],
  [METRICS.storageRead]: [],
  [METRICS.aiAnalyze]: [],
  [METRICS.renderUI]: []
};

// 配置
const CONFIG = {
  maxSamples: 100, // 每个指标最大样本数
  slowThreshold: 100, // 慢操作阈值（ms）
  reportInterval: 60000 // 报告间隔（1 分钟）
};

/**
 * 开始计时
 * @param {string} metricName - 指标名称
 * @returns {number} 开始时间戳
 */
export function startTimer(metricName) {
  return performance.now();
}

/**
 * 结束计时并记录数据
 * @param {string} metricName - 指标名称
 * @param {number} startTime - 开始时间戳
 * @param {object} metadata - 额外元数据
 */
export function endTimer(metricName, startTime, metadata = {}) {
  const duration = performance.now() - startTime;

  // 记录数据
  if (performanceData[metricName]) {
    performanceData[metricName].push({
      duration,
      timestamp: Date.now(),
      ...metadata
    });

    // 限制样本数量
    if (performanceData[metricName].length > CONFIG.maxSamples) {
      performanceData[metricName].shift();
    }
  }

  // 检查是否为慢操作
  if (duration > CONFIG.slowThreshold) {
    logger.warn(`慢操作检测：${metricName} = ${duration.toFixed(2)}ms`, metadata);
  }

  return duration;
}

/**
 * 获取指标统计数据
 * @param {string} metricName - 指标名称
 * @returns {object} 统计数据
 */
export function getMetricStats(metricName) {
  const samples = performanceData[metricName] || [];

  if (samples.length === 0) {
    return {
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
      p95: 0,
      p99: 0
    };
  }

  const durations = samples.map((s) => s.duration).sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;

  return {
    count: durations.length,
    avg: Math.round(avg * 100) / 100,
    min: Math.round(durations[0] * 100) / 100,
    max: Math.round(durations[durations.length - 1] * 100) / 100,
    p95: Math.round(durations[Math.floor(durations.length * 0.95)] * 100) / 100,
    p99: Math.round(durations[Math.floor(durations.length * 0.99)] * 100) / 100
  };
}

/**
 * 获取所有性能报告
 * @returns {object} 性能报告
 */
export function getPerformanceReport() {
  const report = {};

  for (const [metricName, samples] of Object.entries(performanceData)) {
    report[metricName] = {
      ...getMetricStats(metricName),
      recentSamples: samples.slice(-10).map((s) => ({
        duration: Math.round(s.duration * 100) / 100,
        timestamp: s.timestamp
      }))
    };
  }

  // 总体健康度评估
  const slowMetrics = Object.entries(report)
    .filter(([, stats]) => stats.avg > CONFIG.slowThreshold)
    .map(([name]) => name);

  report.health = {
    score: slowMetrics.length === 0 ? 100 : Math.max(0, 100 - slowMetrics.length * 20),
    slowMetrics,
    status:
      slowMetrics.length === 0 ? 'excellent' : slowMetrics.length <= 2 ? 'good' : 'needs_attention'
  };

  return report;
}

/**
 * 清空性能数据
 * @param {string} metricName - 指标名称（可选，清空指定指标）
 */
export function clearMetrics(metricName) {
  if (metricName && performanceData[metricName]) {
    performanceData[metricName] = [];
  } else {
    for (const key of Object.keys(performanceData)) {
      performanceData[key] = [];
    }
  }
}

/**
 * 更新配置
 * @param {object} newConfig - 新配置
 */
export function updateConfig(newConfig) {
  Object.assign(CONFIG, newConfig);
}

/**
 * 获取配置
 * @returns {object} 当前配置
 */
export function getConfig() {
  return { ...CONFIG };
}

// 导出指标常量
export { METRICS };

// 导出单例
export const performanceMonitor = {
  startTimer,
  endTimer,
  getMetricStats,
  getPerformanceReport,
  clearMetrics,
  updateConfig,
  getConfig,
  METRICS
};

export default performanceMonitor;
