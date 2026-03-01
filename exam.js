// exam.js - 分词功能测试页面脚本

import {
  splitText,
  smartAnalyze,
  chineseAnalyze,
  englishAnalyze,
  detectContentType,
} from "./src/utils/textProcessor.js";

let currentMode = "smart";

// 示例数据
const examples = {
  chinese: `中文分词是中文文本处理的基础步骤，在浏览器扩展中实现智能搜索功能需要高效的分词算法。本项目使用增强的正向最大匹配算法，支持智能分词策略和结果优化。`,
  mixed: `我喜欢使用JavaScript编程，特别是React框架。GitHub上有很多open source项目值得学习。

今天天气很好，我去公园散步，看到了很多美丽的花朵。`,
  code: `function getUserInfo(userId) {
  return fetch(\`/api/users/\${userId}\`)
    .then(res => res.json())
    .then(data => data.profile);
}

const handleSubmit = async (formData) => {
  await validateForm(formData);
  await saveToDatabase(formData);
};`,
};

// 加载示例
function loadExample(type) {
  document.getElementById("test-text").value = examples[type] || "";
}

// 测试分词
async function testSegmentation() {
  const text = document.getElementById("test-text").value;
  const resultContainer = document.getElementById("segmentation-result");
  const statsContainer = document.getElementById("stats");

  if (!text.trim()) {
    resultContainer.textContent = "请输入要分词的文本";
    statsContainer.style.display = "none";
    return;
  }

  try {
    let results;
    let modeName;

    switch (currentMode) {
      case "smart":
        results = smartAnalyze(text);
        modeName = "智能分析";
        break;
      case "chinese":
        results = chineseAnalyze(text);
        modeName = "中文分析";
        break;
      case "english":
        results = englishAnalyze(text);
        modeName = "英文分析";
        break;
      case "multi":
        const checkboxes = document.querySelectorAll("#multi-rule-checkboxes input:checked");
        const rules = Array.from(checkboxes).map((cb) => cb.value);
        if (rules.length === 0) {
          resultContainer.textContent = "请至少选择一个规则";
          statsContainer.style.display = "none";
          return;
        }
        results = await splitText(text, "multi", { rules });
        modeName = "多规则组合";
        break;
      default:
        results = await splitText(text, currentMode);
        modeName = getModeName(currentMode);
    }

    let resultText = `【${modeName}】\n`;
    resultText += `分词数量: ${results.length}\n`;
    resultText += "-".repeat(50) + "\n";
    resultText += results.join(" / ");

    resultContainer.textContent = resultText;

    const detection = detectContentType(text);
    statsContainer.innerHTML = `
      <strong>内容类型:</strong> ${detection.type} |
      <strong>置信度:</strong> ${(detection.confidence * 100).toFixed(1)}% |
      <strong>字符数:</strong> ${text.length} |
      <strong>分词数:</strong> ${results.length}
    `;
    statsContainer.style.display = "block";
  } catch (error) {
    resultContainer.textContent = "测试出错: " + error.message;
    statsContainer.style.display = "none";
    console.error(error);
  }
}

// 清空结果
function clearResult() {
  document.getElementById("segmentation-result").textContent =
    "请点击上方按钮进行测试";
  document.getElementById("stats").style.display = "none";
}

// 获取模式名称
function getModeName(mode) {
  const names = {
    code: "代码分析",
    sentence: "整句分析",
    halfSentence: "半句分析",
    removeSymbols: "去除符号",
    charBreak: "字符断行",
    random: "随机分词",
    multi: "多规则组合",
  };
  return names[mode] || mode;
}

// 初始化事件监听
document.addEventListener("DOMContentLoaded", () => {
  // 模式切换
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentMode = tab.dataset.mode;

      // 显示/隐藏多规则选项
      const multiSection = document.getElementById("multi-rule-section");
      multiSection.style.display = currentMode === "multi" ? "block" : "none";
    });
  });

  // 示例按钮
  document.getElementById("btn-example-chinese").addEventListener("click", () => loadExample("chinese"));
  document.getElementById("btn-example-mixed").addEventListener("click", () => loadExample("mixed"));
  document.getElementById("btn-example-code").addEventListener("click", () => loadExample("code"));

  // 功能按钮
  document.getElementById("btn-test").addEventListener("click", testSegmentation);
  document.getElementById("btn-clear").addEventListener("click", clearResult);

  // 页面加载后自动测试
  setTimeout(testSegmentation, 500);
});

