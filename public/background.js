// Background service worker for CP Focus Mode Extension

// Default settings - DISABLED BY DEFAULT
const DEFAULT_SETTINGS = {
  enabled: false, // User must explicitly enable
  platforms: {
    leetcode: {
      enabled: false,
      blockEditorial: true,
      blockSolutions: true,
      blockDiscussions: true,
      blockHints: true,
      blockTopics: true,
      blockAI: true
    }
  },
  timer: {
    enabled: false,
    hintIntervals: [20, 25, 30], // minutes for hint 1, 2, 3
    currentProblem: null,
    startTime: null
  }
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get('cpFocusSettings');
  if (!settings.cpFocusSettings) {
    await chrome.storage.local.set({ cpFocusSettings: DEFAULT_SETTINGS });
  }
  console.log('CP Focus Mode extension installed');
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      sendResponse(result.cpFocusSettings || DEFAULT_SETTINGS);
    });
    return true; // Required for async sendResponse
  }

  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ cpFocusSettings: message.settings }).then(() => {
      // Notify all tabs to update
      chrome.tabs.query({ url: ['https://leetcode.com/*', 'https://www.leetcode.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: message.settings });
        });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'START_TIMER') {
    const problemId = message.problemId;
    const startTime = Date.now();
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      settings.timer.currentProblem = problemId;
      settings.timer.startTime = startTime;
      chrome.storage.local.set({ cpFocusSettings: settings });
      
      // Set alarms for hints
      settings.timer.hintIntervals.forEach((minutes, index) => {
        chrome.alarms.create(`hint_${index + 1}_${problemId}`, {
          delayInMinutes: minutes
        });
      });
      
      sendResponse({ success: true, startTime });
    });
    return true;
  }

  if (message.type === 'GET_TIMER_STATUS') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      const elapsed = settings.timer.startTime 
        ? Math.floor((Date.now() - settings.timer.startTime) / 1000)
        : 0;
      sendResponse({
        currentProblem: settings.timer.currentProblem,
        startTime: settings.timer.startTime,
        elapsedSeconds: elapsed
      });
    });
    return true;
  }

  if (message.type === 'STOP_TIMER') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      const problemId = settings.timer.currentProblem;
      
      // Clear alarms
      chrome.alarms.clearAll();
      
      settings.timer.currentProblem = null;
      settings.timer.startTime = null;
      chrome.storage.local.set({ cpFocusSettings: settings });
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle hint alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('hint_')) {
    const parts = alarm.name.split('_');
    const hintNumber = parseInt(parts[1]);
    const problemId = parts.slice(2).join('_');
    
    // Notify the active LeetCode tab
    chrome.tabs.query({ url: ['https://leetcode.com/*', 'https://www.leetcode.com/*'], active: true }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'SHOW_HINT', 
          hintNumber,
          problemId 
        });
      });
    });
  }
});
