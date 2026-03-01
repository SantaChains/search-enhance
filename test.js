// test.js - 功能测试页面脚本

import {
  splitText,
  detectContentType,
  analyzeTextForMultipleFormats,
} from "./src/utils/textProcessor.js";

// 测试用例数据
const testCases = {
  chinese:
    "我今天去了北京大学，参观了图书馆和实验室。天气很好，心情也不错！你觉得怎么样？",
  english:
    "I visited the library today. It was amazing! The books were well organized, and the staff was helpful. Would you like to go there?",
  mixed:
    "我喜欢使用JavaScript编程，特别是React框架。GitHub上有很多open source项目值得学习。",
  code: "getUserInfo updateUserProfile handleSubmitButton user_name order_id create-component func(param1, param2)",
  list: "1. 学习JavaScript\n2. 掌握React框架\n3. 了解Node.js\n• 前端开发\n• 后端开发\n- 数据库设计",
  wrapped:
    '他说："今天天气真好！"然后又补充道："我们去公园走走吧。"（这是个好主意）',
  complex:
    '1. 调用getUserInfo()函数；2. 处理"用户数据"；3. 更新user_profile表；结果：(success)',
};

// 加载测试用例
function loadTestCase(type) {
  document.getElementById("test-input").value = testCases[type] || "";
}

// 执行拆分测试
async function testSplit() {
  const text = document.getElementById("test-input").value.trim();
  if (!text) {
    alert("请输入测试文本");
    return;
  }

  const mode = document.getElementById("mode-select").value;
  let options = {};

  if (mode === "multi") {
    const checkboxes = document.querySelectorAll(
      "#multi-rule-checkboxes input:checked",
    );
    const rules = Array.from(checkboxes).map((cb) => cb.value);
    if (rules.length === 0) {
      alert("请至少选择一个规则");
      return;
    }
    options = { rules };
  }

  try {
    const results = await splitText(text, mode, options);
    displaySplitResults(results, mode);
  } catch (error) {
    console.error("拆分失败:", error);
    alert("拆分失败: " + error.message);
  }
}

// 内容类型检测
function testDetectType() {
  const text = document.getElementById("test-input").value.trim();
  if (!text) {
    alert("请输入测试文本");
    return;
  }

  try {
    const detection = detectContentType(text);
    displayTypeResults(detection);
  } catch (error) {
    console.error("类型检测失败:", error);
    alert("类型检测失败: " + error.message);
  }
}

// 信息提取
function testExtractInfo() {
  const text = document.getElementById("test-input").value.trim();
  if (!text) {
    alert("请输入测试文本");
    return;
  }

  try {
    const formats = analyzeTextForMultipleFormats(text);
    displayExtractResults(formats);
  } catch (error) {
    console.error("信息提取失败:", error);
    alert("信息提取失败: " + error.message);
  }
}

// 清空结果
function clearResult() {
  document.getElementById("test-results").style.display = "none";
  document.getElementById("type-results").style.display = "none";
  document.getElementById("extract-results").style.display = "none";
}

// 显示拆分结果
function displaySplitResults(results, mode) {
  const container = document.getElementById("split-results");

  container.innerHTML = `
    <p><strong>使用模式:</strong> ${mode}</p>
    <p><strong>拆分数量:</strong> ${results.length} 项</p>
    <div class="split-items">
      ${results
        .map(
          (item, index) =>
            `<span class="split-item" title="第${index + 1}项">${escapeHtml(item)}</span>`,
        )
        .join("")}
    </div>
  `;

  document.getElementById("test-results").style.display = "block";
}

// 显示类型检测结果
function displayTypeResults(detection) {
  const container = document.getElementById("type-info");

  container.innerHTML = `
    <p><strong>内容类型:</strong> ${detection.type}</p>
    <p><strong>置信度:</strong> ${(detection.confidence * 100).toFixed(1)}%</p>
    <p><strong>特征:</strong></p>
    <ul>
      ${Object.entries(detection.features)
        .map(([key, value]) => `<li>${key}: ${value}</li>`)
        .join("")}
    </ul>
  `;

  document.getElementById("type-results").style.display = "block";
}

// 显示信息提取结果
function displayExtractResults(formats) {
  const container = document.getElementById("extract-info");

  let html = "";
  for (const item of formats) {
    if (item.data && item.data.length > 0) {
      html += `
        <div>
          <strong>${item.type}:</strong>
          <ul>
            ${item.data.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
          </ul>
        </div>
      `;
    }
  }

  if (!html) {
    html = "<p>未检测到特殊格式内容</p>";
  }

  container.innerHTML = html;
  document.getElementById("extract-results").style.display = "block";
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 初始化事件监听
document.addEventListener("DOMContentLoaded", () => {
  // 测试用例按钮
  document.getElementById("btn-chinese").addEventListener("click", () => loadTestCase("chinese"));
  document.getElementById("btn-english").addEventListener("click", () => loadTestCase("english"));
  document.getElementById("btn-mixed").addEventListener("click", () => loadTestCase("mixed"));
  document.getElementById("btn-code").addEventListener("click", () => loadTestCase("code"));
  document.getElementById("btn-list").addEventListener("click", () => loadTestCase("list"));
  document.getElementById("btn-wrapped").addEventListener("click", () => loadTestCase("wrapped"));
  document.getElementById("btn-complex").addEventListener("click", () => loadTestCase("complex"));

  // 功能按钮
  document.getElementById("btn-test-split").addEventListener("click", testSplit);
  document.getElementById("btn-test-detect").addEventListener("click", testDetectType);
  document.getElementById("btn-test-extract").addEventListener("click", testExtractInfo);
  document.getElementById("btn-clear").addEventListener("click", clearResult);

  // 多规则模式切换
  document.getElementById("mode-select").addEventListener("change", function () {
    const multiSection = document.getElementById("multi-rule-section");
    multiSection.style.display = this.value === "multi" ? "block" : "none";
  });
});
