// src/utils/textProcessor.test.js

/**
 * Text Processor Test Suite
 * 测试文本处理功能的各项能力
 */

// 导入测试模块
import {
  splitText,
  chineseWordSegmentation,
  intelligentSegmentation,
  detectContentType,
  analyzeTextForMultipleFormats,
  processTextExtraction,
  processPath,
  processLinkGeneration,
  extractEmails,
  extractPhoneNumbers,
  isURL,
  getAvailableSplitRules,
  smartAnalyze,
  chineseAnalyze,
  englishAnalyze,
  codeAnalyze,
  aiAnalyze,
  sentenceAnalyze,
  charBreak,
  removeSymbolsAnalyze,
  randomAnalyze,
  multiRuleAnalyze,
} from './textProcessor.js';

// 导入其他测试依赖
import { processMultiFormat } from './multiFormatProcessor.js';
import { RuleEngine, Tokenizer, ContentDetector } from './textProcessor.js';

// 测试工具
const test = (name, fn) => {
  try {
    fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   错误: ${error.message}`);
    return false;
  }
};

const assertEqual = (actual, expected, message = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\n   预期: ${JSON.stringify(expected)}\n   实际: ${JSON.stringify(actual)}`
    );
  }
};

const assertTrue = (condition, message = '') => {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
};

const assertGreaterThan = (actual, min, message = '') => {
  if (actual <= min) {
    throw new Error(`${message}\n   预期大于 ${min}，实际 ${actual}`);
  }
};

console.log('='.repeat(60));
console.log('Text Processor 测试套件');
console.log('='.repeat(60));
console.log('');

let passed = 0;
const failed = 0;

// ============================================================================
// 1. 基础功能测试
// ============================================================================

console.log('【1. 基础功能测试】');
console.log('-'.repeat(40));

passed += test('isURL - 有效URL', () => {
  assertTrue(isURL('https://github.com/user/repo'));
  assertTrue(isURL('http://example.com/path'));
  assertTrue(isURL('www.google.com'));
});

passed += test('isURL - 无效URL', () => {
  assertTrue(!isURL('not a url'));
  assertTrue(!isURL('ftp://invalid'));
  assertTrue(!isURL(''));
});

passed += test('processTextExtraction - 提取链接', () => {
  const result = processTextExtraction('Check https://github.com and http://example.com ok');
  assertTrue(result.extractedLinks.length >= 2);
  assertTrue(result.extractedLinks.some((l) => l.includes('github.com')));
  assertTrue(result.extractedLinks.some((l) => l.includes('example.com')));
});

passed += test('processTextExtraction - 空输入', () => {
  const result = processTextExtraction('');
  assertEqual(result.cleanedText, '');
  assertEqual(result.extractedLinks, []);
});

console.log('');

// ============================================================================
// 2. 文本分割测试
// ============================================================================

console.log('【2. 文本分割测试】');
console.log('-'.repeat(40));

passed += test('splitText - 英文句子分割', () => {
  const result = splitText('Hello world. This is a test. How are you?', 'english-sentence');
  assertTrue(result.length >= 3);
  assertTrue(result.some((s) => s.includes('Hello')));
  assertTrue(result.some((s) => s.includes('test')));
});

passed += test('splitText - 中文句子分割', () => {
  const result = splitText('你好世界。这是一个测试。你怎么样？', 'chinese-sentence');
  assertTrue(result.length >= 2);
});

passed += test('splitText - 混合句子分割', () => {
  const result = splitText('Hello世界。你好World。混合文本', 'mixed-sentence');
  assertTrue(result.length >= 2);
});

passed += test('splitText - 代码命名分割', () => {
  const result = splitText('camelCase snake_case kebab-case', 'code-naming');
  assertTrue(result.length >= 4);
});

passed += test('splitText - 列表项目分割', () => {
  const result = splitText('1. 第一项\n2. 第二项\n3. 第三项', 'list-items');
  assertTrue(result.length >= 2);
  assertTrue(result.some((s) => s.includes('第一项')));
});

passed += test('splitText - 包裹内容分割', () => {
  const result = splitText('"quoted text" and \'single quotes\'', 'wrapped-content');
  assertTrue(result.some((s) => s.includes('quoted text')));
});

passed += test('splitText - 空格分隔', () => {
  const result = splitText('word1 word2 word3', 'whitespace');
  assertEqual(result.length, 3);
});

passed += test('splitText - 换行分隔', () => {
  const result = splitText('line1\nline2\nline3', 'newline');
  assertEqual(result.length, 3);
});

passed += test('splitText - 组合规则', () => {
  const result = splitText('Hello world. 你好世界。', ['english-sentence', 'chinese-sentence']);
  assertTrue(result.length >= 2);
});

console.log('');

// ============================================================================
// 3. 中文分词测试
// ============================================================================

console.log('【3. 中文分词测试】');
console.log('-'.repeat(40));

passed += test('chineseWordSegmentation - 基础分词', () => {
  const result = chineseWordSegmentation('这是一个测试文本');
  assertTrue(Array.isArray(result));
  assertTrue(result.length > 0);
});

passed += test('chineseWordSegmentation - 使用词典', () => {
  const result = chineseWordSegmentation('中文分词算法测试', { useDictionary: true });
  assertTrue(result.length > 0);
});

passed += test('chineseWordSegmentation - 移除停用词', () => {
  const result = chineseWordSegmentation('的 了 是 在', { removeStopWords: true });
  // 停用词应该被过滤
  assertTrue(!result.includes('的'));
  assertTrue(!result.includes('了'));
});

passed += test('chineseWordSegmentation - 空输入', () => {
  const result = chineseWordSegmentation('');
  assertEqual(result, []);
});

passed += test('intelligentSegmentation - 短文本', () => {
  const result = intelligentSegmentation('测试');
  assertTrue(Array.isArray(result));
});

passed += test('intelligentSegmentation - 长文本', () => {
  const longText =
    '这是一个很长的测试文本，用于测试智能分词功能的性能。中文分词是自然语言处理的基础技术。';
  const result = intelligentSegmentation(longText);
  assertTrue(result.length > 0);
});

console.log('');

// ============================================================================
// 4. 内容类型检测测试
// ============================================================================

console.log('【4. 内容类型检测测试】');
console.log('-'.repeat(40));

passed += test('detectContentType - 英文文本', () => {
  const result = detectContentType('This is an English text with some words');
  assertTrue(result.confidence > 0);
  assertTrue(result.type === 'english_text' || result.type === 'mixed_text');
});

passed += test('detectContentType - 中文文本', () => {
  const result = detectContentType('这是一个中文文本测试');
  assertTrue(result.confidence > 0);
  assertTrue(result.type === 'chinese_text' || result.type === 'mixed-zh');
});

passed += test('detectContentType - URL集合', () => {
  const result = detectContentType('https://github.com and https://example.com');
  assertTrue(result.features.hasUrl === true);
});

passed += test('detectContentType - 邮箱地址', () => {
  const result = detectContentType('Contact: test@example.com');
  assertTrue(result.type === 'contact_info');
});

passed += test('detectContentType - 代码仓库', () => {
  const result = detectContentType('user/repo-name');
  assertTrue(result.features.hasRepo === true);
});

passed += test('detectContentType - 文件路径', () => {
  const result = detectContentType('C:\\Users\\test\\Documents');
  assertTrue(result.features.hasPath === true);
});

passed += test('detectContentType - 空输入', () => {
  const result = detectContentType('');
  assertEqual(result.type, 'empty');
  assertEqual(result.confidence, 1);
});

console.log('');

// ============================================================================
// 5. 多格式分析测试
// ============================================================================

console.log('【5. 多格式分析测试】');
console.log('-'.repeat(40));

passed += test('processMultiFormat - 提取URL', () => {
  const result = processMultiFormat('Visit https://github.com and http://example.com today');
  assertTrue(result.urls.length >= 2);
});

passed += test('processMultiFormat - 提取邮箱', () => {
  const result = processMultiFormat('Email: test@example.com and admin@company.org');
  assertTrue(result.emails.length >= 2);
  assertTrue(result.emails.includes('test@example.com'));
});

passed += test('processMultiFormat - 提取电话号码', () => {
  const result = processMultiFormat('Call 13812345678 or 010-12345678');
  assertTrue(result.phones.length >= 1);
});

passed += test('processMultiFormat - 提取IP地址', () => {
  const result = processMultiFormat('Server at 192.168.1.1 and 10.0.0.1');
  assertTrue(result.ips.length >= 2);
});

passed += test('processMultiFormat - 提取日期', () => {
  const result = processMultiFormat('Date: 2024-01-15 or 2024年1月15日');
  assertTrue(result.dates.length >= 1);
});

passed += test('processMultiFormat - 提取代码仓库', () => {
  const result = processMultiFormat('Check facebook/react or google/angular');
  assertTrue(result.repos.length >= 2);
});

passed += test('processMultiFormat - 混合内容', () => {
  const result = processMultiFormat(
    'Contact test@example.com, visit https://a.com, server 192.168.1.1'
  );
  assertTrue(result.urls.length >= 1);
  assertTrue(result.emails.length >= 1);
  assertTrue(result.ips.length >= 1);
});

passed += test('processMultiFormat - 空输入', () => {
  const result = processMultiFormat('');
  assertEqual(result.urls, []);
  assertEqual(result.emails, []);
  assertEqual(result.phones, []);
});

console.log('');

// ============================================================================
// 6. 路径处理测试
// ============================================================================

console.log('【6. 路径处理测试】');
console.log('-'.repeat(40));

passed += test('processPath - 带引号路径', () => {
  const result = processPath('"C:\\Users\\test\\Documents\\file.txt"');
  assertTrue(Array.isArray(result));
  assertTrue(result.length >= 2);
  assertTrue(result[0].includes('C:\\Users'));
});

passed += test('processPath - 不带引号路径', () => {
  const result = processPath('C:\\Program Files\\test');
  assertTrue(Array.isArray(result));
  assertTrue(result.length >= 2);
});

passed += test('processPath - 空输入', () => {
  const result = processPath('');
  assertEqual(result, null);
});

console.log('');

// ============================================================================
// 7. 仓库链接生成测试
// ============================================================================

console.log('【7. 仓库链接生成测试】');
console.log('-'.repeat(40));

passed += test('processLinkGeneration - GitHub URL', () => {
  const result = processLinkGeneration('https://github.com/facebook/react');
  assertTrue(result !== null);
  assertTrue(result.generatedLinks.length >= 4);
  assertTrue(result.generatedLinks.some((l) => l.includes('github.com')));
  assertTrue(result.generatedLinks.some((l) => l.includes('zread.ai')));
});

passed += test('processLinkGeneration - 简单格式', () => {
  const result = processLinkGeneration('user/repo-name');
  assertTrue(result !== null);
  assertTrue(result.generatedLinks.length >= 4);
});

passed += test('processLinkGeneration - 空输入', () => {
  const result = processLinkGeneration('');
  assertEqual(result, null);
});

console.log('');

// ============================================================================
// 8. 提取功能测试
// ============================================================================

console.log('【8. 提取功能测试】');
console.log('-'.repeat(40));

passed += test('extractEmails - 多个邮箱', () => {
  const result = extractEmails('a@test.com, b@company.org, c@domain.net');
  assertEqual(result.length, 3);
  assertTrue(result.includes('a@test.com'));
});

passed += test('extractEmails - 无邮箱', () => {
  const result = extractEmails('no emails here');
  assertEqual(result, []);
});

passed += test('extractPhoneNumbers - 中国手机号', () => {
  const result = extractPhoneNumbers('Call 13812345678');
  assertTrue(result.length >= 1);
});

passed += test('extractPhoneNumbers - 中国座机', () => {
  const result = extractPhoneNumbers('Phone: 010-12345678');
  assertTrue(result.length >= 1);
});

passed += test('extractPhoneNumbers - 无电话', () => {
  const result = extractPhoneNumbers('no phone numbers');
  assertEqual(result, []);
});

console.log('');

// ============================================================================
// 9. 规则系统测试
// ============================================================================

console.log('【9. 规则系统测试】');
console.log('-'.repeat(40));

passed += test('RuleEngine - 注册规则', () => {
  const engine = new RuleEngine();
  engine.registerRule('test', { id: 'test-rule', name: 'Test' });
  assertTrue(engine.getRules('test').length === 1);
});

passed += test('RuleEngine - 获取规则', () => {
  const engine = new RuleEngine();
  engine.registerRule('test', { id: 'rule1', name: 'Rule 1' });
  engine.registerRule('test', { id: 'rule2', name: 'Rule 2' });
  assertEqual(engine.getRules('test').length, 2);
});

passed += test('Tokenizer - 缓存功能', () => {
  const tok = new Tokenizer();
  const result1 = tok.tokenize('测试文本');
  const result2 = tok.tokenize('测试文本');
  assertEqual(result1, result2);
});

passed += test('ContentDetector - 特征提取', () => {
  const detector = new ContentDetector();
  const result = detector.extractFeatures('test https://github.com');
  assertTrue(result.hasUrl === true);
  assertTrue(result.englishCount > 0);
});

console.log('');

// ============================================================================
// 10. 分割规则列表测试
// ============================================================================

console.log('【10. 分割规则列表测试】');
console.log('-'.repeat(40));

passed += test('getAvailableSplitRules - 获取规则列表', () => {
  const rules = getAvailableSplitRules();
  assertTrue(rules.length >= 8);
  assertTrue(rules.some((r) => r.value === 'english-sentence'));
  assertTrue(rules.some((r) => r.value === 'chinese-sentence'));
  assertTrue(rules.some((r) => r.value === 'mixed-sentence'));
});

console.log('');

// ============================================================================
// 11. 性能测试
// ============================================================================

console.log('【11. 性能测试】');
console.log('-'.repeat(40));

passed += test('性能 - 大量文本分割', () => {
  const longText = 'Hello world. This is a test. '.repeat(100);
  const start = performance.now();
  const result = splitText(longText, 'english-sentence');
  const time = performance.now() - start;
  assertGreaterThan(result.length, 200);
  assertTrue(time < 100, `耗时 ${time}ms 超过100ms限制`);
});

passed += test('性能 - 中文分词性能', () => {
  const text = '中文分词算法测试文本，'.repeat(50);
  const start = performance.now();
  const result = chineseWordSegmentation(text);
  const time = performance.now() - start;
  assertTrue(result.length > 0);
  assertTrue(time < 200, `耗时 ${time}ms 超过200ms限制`);
});

passed += test('性能 - 内容检测性能', () => {
  const text = 'Test https://github.com email@test.com 192.168.1.1'.repeat(50);
  const start = performance.now();
  const result = detectContentType(text);
  const time = performance.now() - start;
  assertTrue(result.type !== 'empty');
  assertTrue(time < 50, `耗时 ${time}ms 超过50ms限制`);
});

console.log('');

// ============================================================================
// 测试结果汇总
// ============================================================================

console.log('='.repeat(60));
console.log('测试结果汇总');
console.log('='.repeat(60));
console.log(`总测试数: ${passed + failed}`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log('');

if (failed === 0) {
  console.log('🎉 所有测试通过！');
} else {
  console.log('⚠️  有测试失败，请检查上方错误信息。');
}

console.log('');

// 导出测试结果
export { passed, failed };
