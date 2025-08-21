// src/content/index.js

(() => {
  const IFRAME_ID = 'enhance-search-buddy-iframe';

  function toggleFloatingView() {
    const existingIframe = document.getElementById(IFRAME_ID);

    if (existingIframe) {
      existingIframe.remove();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = chrome.runtime.getURL('src/popup/index.html?view=floating');
    iframe.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      height: 600px;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2147483647; /* Ensure it's on top */
      background-color: white;
    `;

    document.body.appendChild(iframe);
  }

  // This script is executed every time the command is triggered.
  toggleFloatingView();
})();