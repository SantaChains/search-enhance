/**
 * 功能处理器模块
 * 功能: 提取与拆解、链接生成、多格式分析的核心逻辑
 * 入参: state, elements
 * 出参: 各处理函数
 */

import {
  splitText,
  processPath,
  processLinkGeneration,
  analyzeTextForMultipleFormats,
  ANALYZE_MODES
} from '../../utils/textProcessor.js';

// 更新功能面板显示状态
export function updateFeaturePanels(state, elements) {
  const showExtract = elements.switchExtract?.checked;
  const showLinkGen = elements.switchLinkGen?.checked;
  const showMultiFormat = elements.switchMultiFormat?.checked;

  if (elements.extractContainer) {
    elements.extractContainer.style.display = showExtract ? 'block' : 'none';
  }
  if (elements.linkGenContainer) {
    elements.linkGenContainer.style.display = showLinkGen ? 'block' : 'none';
  }
  if (elements.multiFormatContainer) {
    elements.multiFormatContainer.style.display = showMultiFormat ? 'block' : 'none';
  }

  const text = elements.searchInput?.value.trim();
  if (text) {
    if (showExtract) processExtract(text, state, elements);
    if (showLinkGen) processLinkGen(text, state, elements);
    if (showMultiFormat) processMultiFormat(text, state, elements);
  }
}

// 提取和拆解功能
export function processExtract(text, state, elements) {
  if (!text) return;

  const paths = processPath(text);
  if (paths?.length > 0) {
    elements.pathConversionTool?.style.display &&
      (elements.pathConversionTool.style.display = 'block');
    renderPathConversion(paths, elements);
  } else {
    elements.pathConversionTool?.style.display &&
      (elements.pathConversionTool.style.display = 'none');
  }

  const urlRegex = /https?:\/\/[^\s<>"{}|^`[\]]+/gi;
  const links = text.match(urlRegex) || [];
  if (links.length > 0) {
    elements.linkExtractionResult?.style.display &&
      (elements.linkExtractionResult.style.display = 'block');
    renderLinkExtraction([...new Set(links)], elements);
  } else {
    elements.linkExtractionResult?.style.display &&
      (elements.linkExtractionResult.style.display = 'none');
  }

  elements.textSplittingTool?.style.display && (elements.textSplittingTool.style.display = 'block');
  processTextSplit(text, state, elements);
}

// 渲染路径转换结果
function renderPathConversion(paths, elements) {
  if (!elements.pathConversionResult) return;

  elements.pathConversionResult.innerHTML = paths
    .map(
      (path, index) => `
      <div class="path-item" data-index="${index}" data-original="${path}">
        <code>${escapeHtml(path)}</code>
        <button class="copy-path-btn" data-path="${path}">复制</button>
      </div>
    `
    )
    .join('');

  elements.pathConversionResult.querySelectorAll('.copy-path-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.path);
    });
  });
}

// 渲染链接提取结果
function renderLinkExtraction(links, elements) {
  if (!elements.linkExtractionResult) return;

  elements.linkExtractionResult.innerHTML = `
    <h5>提取的链接 (${links.length})</h5>
    <div class="link-list">
      ${links
        .map(
          (link) => `
        <div class="link-item">
          <a href="${link}" target="_blank" title="${link}">${truncateText(link, 50)}</a>
          <button class="copy-link-btn" data-link="${link}">复制</button>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  elements.linkExtractionResult.querySelectorAll('.copy-link-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.link);
    });
  });
}

// 文本拆分处理
async function processTextSplit(text, state, elements) {
  const mode = elements.splitDelimiterSelect?.value || 'smart';

  if (elements.multiRuleButtons) {
    elements.multiRuleButtons.style.display = mode === 'multi' ? 'block' : 'none';
  }

  try {
    let tokens = [];
    if (mode === 'multi') {
      tokens = await splitText(text, 'multi', { rules: state.multiRuleSequence });
    } else {
      tokens = await splitText(text, mode);
    }

    state.splitTokens = tokens;
    renderSplitOutput(tokens, state, elements);
  } catch (error) {
    console.error('文本拆分失败:', error);
  }
}

// 渲染拆分输出
function renderSplitOutput(tokens, state, elements) {
  if (!elements.splitOutputContainer) return;

  elements.splitOutputContainer.innerHTML = tokens
    .map(
      (token, index) => `
      <div class="split-item ${state.selectedTokens.has(index) ? 'selected' : ''}" data-index="${index}">
        <input type="checkbox" ${state.selectedTokens.has(index) ? 'checked' : ''}>
        <span>${escapeHtml(token)}</span>
      </div>
    `
    )
    .join('');
}

// 链接生成功能
export function processLinkGen(text, state, elements) {
  if (!text || !elements.linkGenResult) return;

  const result = processLinkGeneration(text);
  elements.linkGenResult.innerHTML = `
    <div class="link-gen-result">
      ${result
        .map(
          (item) => `
        <div class="link-gen-item">
          <span class="engine-name">${item.engine}</span>
          <a href="${item.url}" target="_blank">${truncateText(item.url, 60)}</a>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

// 多格式分析功能
export function processMultiFormat(text, state, elements) {
  if (!text || !elements.multiFormatResult) return;

  const result = analyzeTextForMultipleFormats(text);
  elements.multiFormatResult.innerHTML = `
    <div class="multi-format-result">
      ${Object.entries(result)
        .map(
          ([mode, data]) => `
        <div class="format-item">
          <h5>${ANALYZE_MODES[mode] || mode}</h5>
          <pre>${escapeHtml(data.text || data)}</pre>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

// 工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
