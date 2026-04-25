// src/popup/modules/index.js
// Popup模块统一导出

export { initLinkHistoryModule } from './linkHistoryModule.js';
export { initClipboardHistoryModule } from './clipboardHistoryModule.js';
export { initTokenHistoryModule } from './tokenHistoryModule.js';
export { initTextProcessorModule } from './textProcessorModule.js';
export { initUIModule } from './uiModule.js';
export { initElements } from './elementCache.js';
export {
  updateFeaturePanels,
  processExtract,
  processLinkGen,
  processMultiFormat
} from './featureProcessors.js';
