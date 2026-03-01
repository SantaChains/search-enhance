// debug.js - 调试测试页面脚本

import {
  splitText,
  detectContentType,
  smartAnalyze,
  chineseAnalyze,
  englishAnalyze,
} from "./src/utils/textProcessor.js";
import { getSettings, saveSettings } from "./src/utils/storage.js";

const results = [];
let passCount = 0;
let failCount = 0;

function log(message, type = "info") {
  const container = document.getElementById("logContainer");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function addResult(name, passed, message = "") {
  results.push({ name, passed, message });
  const div = document.createElement("div");
  div.className = `result ${passed ? "pass" : "fail"}`;
  div.innerHTML = `${passed ? "✅" : "❌"} <strong>${name}</strong>${message ? "<br><small>" + message + "</small>" : ""}`;
  document.getElementById("results").appendChild(div);

  if (passed) {
    passCount++;
    document.getElementById("passCount").textContent = passCount;
  } else {
    failCount++;
    document.getElementById("failCount").textContent = failCount;
  }
}

// 测试1: 检查Chrome API可用性
async function testChromeAPI() {
  log("检查Chrome API可用性...", "info");

  const checks = [];

  checks.push({
    name: "chrome对象",
    passed: typeof chrome !== "undefined",
  });

  if (typeof chrome !== "undefined" && chrome.runtime) {
    checks.push({ name: "chrome.runtime", passed: true });
    checks.push({
      name: "chrome.runtime.sendMessage",
      passed: typeof chrome.runtime.sendMessage === "function",
    });
    checks.push({
      name: "chrome.runtime.onMessage",
      passed: !!chrome.runtime.onMessage,
    });

    if (chrome.storage) {
      checks.push({
        name: "chrome.storage.local",
        passed: !!chrome.storage.local,
      });
    } else {
      checks.push({
        name: "chrome.storage",
        passed: false,
        message: "storage API不可用",
      });
    }
  } else {
    checks.push({
      name: "chrome.runtime",
      passed: false,
      message: "runtime API不可用",
    });
  }

  const allPassed = checks.every((c) => c.passed);
  addResult(
    "Chrome API检查",
    allPassed,
    checks
      .filter((c) => !c.passed)
      .map((c) => c.name + ": " + c.message)
      .join(", "),
  );

  checks.forEach((c) =>
    log(`${c.passed ? "✓" : "✗"} ${c.name}`, c.passed ? "info" : "error"),
  );

  return allPassed;
}

// 测试2: 检查剪贴板API
async function testClipboardAPI() {
  log("检查剪贴板API...", "info");

  const checks = [];

  if (navigator.clipboard) {
    checks.push({ name: "navigator.clipboard", passed: true });

    try {
      await navigator.clipboard.readText();
      checks.push({ name: "clipboard.readText", passed: true });
    } catch (e) {
      checks.push({
        name: "clipboard.readText",
        passed: false,
        message: e.name + ": " + e.message,
      });
    }

    try {
      await navigator.clipboard.writeText("test");
      checks.push({ name: "clipboard.writeText", passed: true });
    } catch (e) {
      checks.push({
        name: "clipboard.writeText",
        passed: false,
        message: e.name + ": " + e.message,
      });
    }
  } else {
    checks.push({
      name: "navigator.clipboard",
      passed: false,
      message: "clipboard API不可用",
    });
  }

  const allPassed = checks.every((c) => c.passed);
  addResult(
    "剪贴板API检查",
    allPassed,
    checks
      .filter((c) => !c.passed)
      .map((c) => c.name + ": " + c.message)
      .join(", "),
  );

  checks.forEach((c) =>
    log(`${c.passed ? "✓" : "✗"} ${c.name}`, c.passed ? "info" : "error"),
  );

  return allPassed;
}

// 测试3: 检查Storage数据
async function testStorage() {
  log("检查Storage数据...", "info");

  try {
    const result = await chrome.storage.local.get([
      "globalMonitoringEnabled",
      "globalClipboardContent",
    ]);
    log(`globalMonitoringEnabled: ${result.globalMonitoringEnabled}`, "info");
    log(
      `globalClipboardContent长度: ${result.globalClipboardContent?.length || 0}`,
      "info",
    );
    addResult(
      "Storage读取",
      true,
      `监控状态: ${result.globalMonitoringEnabled}, 内容长度: ${result.globalClipboardContent?.length || 0}`,
    );
    return true;
  } catch (e) {
    log(`✗ Storage读取失败: ${e.message}`, "error");
    addResult("Storage读取", false, e.message);
    return false;
  }
}

// 测试4: 发送消息到Background
async function testMessaging() {
  log("测试消息传递...", "info");

  try {
    const response = await chrome.runtime.sendMessage({
      action: "getGlobalMonitoringState",
    });
    log(`响应: ${JSON.stringify(response)}`, "info");
    addResult("消息通信", true, `监控状态: ${response?.isActive}`);
    return true;
  } catch (e) {
    log(`✗ 消息通信失败: ${e.message}`, "error");
    addResult("消息通信", false, e.message);
    return false;
  }
}

// 测试5: 检查Content Script状态
function testContentScript() {
  log("检查Content Script状态...", "info");

  // 在独立测试页面中，Content Script不会自动注入
  // 所以__searchBuddyGlobal会是undefined，这是预期的行为
  if (window.__searchBuddyGlobal) {
    const state = window.__searchBuddyGlobal.getState();
    log(`监控状态: ${state.isMonitoring}`, "info");
    log(`最后内容长度: ${state.lastContent?.length || 0}`, "info");
    addResult(
      "Content Script状态",
      true,
      `监控: ${state.isMonitoring}, 内容: ${state.lastContent?.length || 0}字符`,
    );
    return true;
  } else {
    // 在独立测试页面中，这是预期行为，标记为信息而非错误
    log("ℹ Content Script未注入（在测试页面中是正常的）", "info");
    addResult(
      "Content Script状态",
      true,
      "未注入（测试页面正常）- 请在普通网页中测试此功能",
    );
    return true;
  }
}

// 测试6: 测试文本处理器
async function testTextProcessor() {
  log("测试文本处理器...", "info");

  const tests = [
    {
      name: "智能分析",
      fn: smartAnalyze,
      input: "Hello World 你好世界 123",
      expectMin: 4,
    },
    {
      name: "中文分析",
      fn: chineseAnalyze,
      input: "今天天气很好，我去公园散步。",
      expectMin: 3,
    },
    {
      name: "英文分析",
      fn: englishAnalyze,
      input: "getUserInfo handleSubmit",
      expectMin: 4,
    },
  ];

  let allPassed = true;
  for (const test of tests) {
    try {
      const result = test.fn(test.input);
      const passed = result.length >= test.expectMin;
      log(
        `${passed ? "✓" : "✗"} ${test.name}: ${result.length} 项`,
        passed ? "info" : "error",
      );
      if (!passed) allPassed = false;
    } catch (e) {
      log(`✗ ${test.name} 失败: ${e.message}`, "error");
      allPassed = false;
    }
  }

  try {
    const detection = detectContentType("https://github.com/user/repo");
    const passed = detection.type === "url_collection";
    log(
      `${passed ? "✓" : "✗"} 内容类型检测: ${detection.type}`,
      passed ? "info" : "error",
    );
    if (!passed) allPassed = false;
  } catch (e) {
    log(`✗ 内容类型检测失败: ${e.message}`, "error");
    allPassed = false;
  }

  try {
    const result = await splitText("Hello 你好 123", "smart");
    const passed = result.length >= 3;
    log(
      `${passed ? "✓" : "✗"} splitText: ${result.length} 项`,
      passed ? "info" : "error",
    );
    if (!passed) allPassed = false;
  } catch (e) {
    log(`✗ splitText 失败: ${e.message}`, "error");
    allPassed = false;
  }

  addResult(
    "文本处理器",
    allPassed,
    allPassed ? "所有测试通过" : "部分测试失败",
  );
  return allPassed;
}

// 测试7: 测试存储模块
async function testStorageModule() {
  log("测试存储模块...", "info");

  try {
    const settings = await getSettings();
    log(`✓ 获取设置成功`, "info");

    // 测试保存设置 - saveSettings返回boolean
    const testSettings = { ...settings, testFlag: true };
    const saveSuccess = await saveSettings(testSettings);

    if (!saveSuccess) {
      log(`✗ 保存设置失败`, "error");
      addResult("存储模块", false, "保存设置失败");
      return false;
    }
    log(`✓ 保存设置成功`, "info");

    // 验证保存的内容
    const newSettings = await getSettings();
    const passed = newSettings.testFlag === true;
    log(`${passed ? "✓" : "✗"} 验证设置保存`, passed ? "info" : "error");

    // 清理测试标记
    delete testSettings.testFlag;
    await saveSettings(testSettings);

    addResult("存储模块", passed, passed ? "读写正常" : "读写失败");
    return passed;
  } catch (e) {
    log(`✗ 存储模块测试失败: ${e.message}`, "error");
    addResult("存储模块", false, e.message);
    return false;
  }
}

// 运行所有测试
async function runTests() {
  log("=".repeat(50), "info");
  log("开始测试...", "info");

  await testChromeAPI();
  await testClipboardAPI();
  await testStorage();
  await testMessaging();
  testContentScript();
  await testTextProcessor();
  await testStorageModule();

  log("=".repeat(50), "info");
  log(`测试完成: 通过 ${passCount}, 失败 ${failCount}`, "info");
}

// 初始化事件监听
document.addEventListener("DOMContentLoaded", () => {
  // 手动测试按钮
  document.getElementById("testNotification").addEventListener("click", () => {
    if (
      window.__searchBuddyGlobal &&
      window.__searchBuddyGlobal.showNotification
    ) {
      window.__searchBuddyGlobal.showNotification(
        "测试通知 " + new Date().toLocaleTimeString(),
        "success",
      );
      log("✓ 手动触发通知", "info");
    } else {
      log("✗ 无法显示通知", "error");
      alert("通知功能仅在扩展环境中可用");
    }
  });

  document
    .getElementById("testClipboardRead")
    .addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        log(
          `剪贴板内容: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
          "info",
        );
        if (
          window.__searchBuddyGlobal &&
          window.__searchBuddyGlobal.showNotification
        ) {
          window.__searchBuddyGlobal.showNotification(
            "读取成功: " + text.substring(0, 20) + "...",
            "info",
          );
        }
      } catch (e) {
        log(`✗ 读取失败: ${e.message}`, "error");
      }
    });

  document
    .getElementById("testToggleMonitoring")
    .addEventListener("click", async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "toggleGlobalMonitoring",
        });
        log(`切换监控: ${response.isActive}`, "info");
        if (
          window.__searchBuddyGlobal &&
          window.__searchBuddyGlobal.showNotification
        ) {
          window.__searchBuddyGlobal.showNotification(
            `监控已${response.isActive ? "开启" : "关闭"}`,
            response.isActive ? "success" : "info",
          );
        }
      } catch (e) {
        log(`✗ 切换失败: ${e.message}`, "error");
      }
    });

  document
    .getElementById("testOpenSidePanel")
    .addEventListener("click", async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          log("✓ 侧边栏已打开", "info");
        }
      } catch (e) {
        log(`✗ 打开失败: ${e.message}`, "error");
      }
    });

  document
    .getElementById("testTextProcessor")
    .addEventListener("click", async () => {
      await testTextProcessor();
    });

  document.getElementById("testStorage").addEventListener("click", async () => {
    await testStorageModule();
  });

  // 页面加载后运行测试
  setTimeout(runTests, 500);
});
