// AI Website Blocking Content Script

(function() {
  'use strict';

  // List of AI websites to block
  const AI_WEBSITES = [
    'chatgpt.com',
    'www.chatgpt.com',
    'openai.com',
    'www.openai.com',
    'gemini.google.com',
    'claude.ai',
    'www.claude.ai',
    'perplexity.ai',
    'www.perplexity.ai',
    'bing.com', // Bing chat
    'www.bing.com',
    'copilot.microsoft.com',
    'www.copilot.microsoft.com',
    'cohere.com',
    'www.cohere.com',
    'huggingface.co',
    'www.huggingface.co',
    'poe.com',
    'www.poe.com',
    'stack-ai.com',
    'www.stack-ai.com',
    'grok.com',
    'www.grok.com',
    'x.ai',
    'www.x.ai',
    'replicate.com',
    'www.replicate.com',
    'replit.com',
    'www.replit.com',
    'tabnine.com',
    'www.tabnine.com',
    'cursor.sh',
    'www.cursor.sh',
    'codeium.com',
    'www.codeium.com',
    'blackbox.ai',
    'www.blackbox.ai',
    'phind.com',
    'www.phind.com',
    'aider.chat',
    'www.aider.chat',
    'v0.dev',
    'www.v0.dev',
    'bolt.new',
    'www.bolt.new',
    'lovable.dev',
    'www.lovable.dev'
  ];

  let focusSettings = {};
  let isAIBlockingEnabled = false;

  // Initialize settings
  function loadSettings() {
    chrome.runtime.sendMessage(
      { type: 'GET_SETTINGS' },
      (response) => {
        focusSettings = response || {};
        isAIBlockingEnabled = focusSettings.blockAI;

        if (isAIBlockingEnabled) {
          checkAndBlockAI();
        }
      }
    );
  }

  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
      focusSettings = message.settings || {};
      isAIBlockingEnabled = focusSettings.blockAI;

      if (isAIBlockingEnabled) {
        checkAndBlockAI();
      }
    }
  });

  // Check if current site is an AI website
  function isAIWebsite() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();

    for (let site of AI_WEBSITES) {
      if (hostname.includes(site) || href.includes(site)) {
        return true;
      }
    }
    return false;
  }

  // Block AI websites
  function checkAndBlockAI() {
    if (isAIBlockingEnabled && isAIWebsite()) {
      // Redirect to blocking page
      const blockPageUrl = chrome.runtime.getURL('ai-blocked.html');
      window.location.replace(blockPageUrl);
    }
  }

  // Initialize on page load
  loadSettings();

  // Also check periodically in case settings change
  setInterval(() => {
    loadSettings();
  }, 5000);
})();
