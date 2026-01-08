// Background service worker for CP Focus Mode Extension

// Backend URL for hint generation
const BACKEND_URL = 'http://localhost:5000';

// Default settings - DISABLED BY DEFAULT
const DEFAULT_SETTINGS = {
  enabled: false, // User must explicitly enable
  blockAI: false, // Block AI websites globally
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
    hintIntervals: [20, 25, 30], // minutes for hint 1, 2, 3 (first always >= 20, gap >= 5)
    currentProblem: null,
    startTime: null
  },
  display: {
    showFocusIndicator: true // Option to show/hide the focus mode popup
  },
  problemHistory: {}, // Store timing history for each problem
  problemHints: {}, // Store extracted hints for each problem
  problemRatings: {} // Cache for problem ratings
};

// Load ratings on startup
let ratingMap = new Map();

async function loadRatings() {
  try {
    const response = await fetch(chrome.runtime.getURL('ratings.txt'));
    const text = await response.text();
    const lines = text.split('\n');
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t');
        if (parts.length >= 5) {
            const rating = parseFloat(parts[0]);
            const slug = parts[4];
            if (slug && !isNaN(rating)) {
                ratingMap.set(slug, Math.round(rating)); // Store rounded rating
            }
        }
    }
    console.log(`Loaded ${ratingMap.size} ratings`);
  } catch (error) {
    console.error('Failed to load ratings:', error);
  }
}

loadRatings();

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get('cpFocusSettings');
  if (!settings.cpFocusSettings) {
    await chrome.storage.local.set({ cpFocusSettings: DEFAULT_SETTINGS });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      sendResponse(result.cpFocusSettings || DEFAULT_SETTINGS);
    });
    return true; // Required for async sendResponse
  }

  if (message.type === 'TOGGLE_AI_BLOCKING') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      settings.blockAI = !settings.blockAI;
      chrome.storage.local.set({ cpFocusSettings: settings });
      sendResponse({ success: true, blockAI: settings.blockAI });
    });
    return true;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ cpFocusSettings: message.settings }).then(() => {
      // Notify all tabs to update
      chrome.tabs.query({ url: ['https://leetcode.com/*', 'https://www.leetcode.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: message.settings }).catch(() => {});
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
      
      // Initialize problemHistory if not exists
      if (!settings.problemHistory) {
        settings.problemHistory = {};
      }
      
      // Store or update problem timing
      settings.timer.currentProblem = problemId;
      settings.timer.startTime = startTime;
      
      // Record in problem history
      if (!settings.problemHistory[problemId]) {
        settings.problemHistory[problemId] = {
          firstOpened: startTime,
          sessions: []
        };
      }
      settings.problemHistory[problemId].sessions.push({
        startTime: startTime,
        endTime: null
      });
      
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
      const endTime = Date.now();
      
      // Update problem history with end time
      if (problemId && settings.problemHistory && settings.problemHistory[problemId]) {
        const sessions = settings.problemHistory[problemId].sessions;
        if (sessions.length > 0) {
          sessions[sessions.length - 1].endTime = endTime;
        }
      }
      
      // Clear alarms
      chrome.alarms.clearAll();
      
      settings.timer.currentProblem = null;
      settings.timer.startTime = null;
      chrome.storage.local.set({ cpFocusSettings: settings });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'RECORD_SUBMISSION') {
    const problemId = message.problemId;
    const submissionTime = Date.now();
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      
      if (settings.problemHistory && settings.problemHistory[problemId]) {
        const problemData = settings.problemHistory[problemId];
        const timeSpent = submissionTime - problemData.firstOpened;
        problemData.submittedAt = submissionTime;
        problemData.totalTimeMs = timeSpent;
        problemData.totalTimeFormatted = formatTime(Math.floor(timeSpent / 1000));
        
        chrome.storage.local.set({ cpFocusSettings: settings });
        sendResponse({ 
          success: true, 
          timeSpent: timeSpent,
          formatted: problemData.totalTimeFormatted
        });
      } else {
        sendResponse({ success: false, error: 'No timer data for problem' });
      }
    });
    return true;
  }

  if (message.type === 'GET_PROBLEM_HISTORY') {
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      sendResponse(settings.problemHistory || {});
    });
    return true;
  }

  if (message.type === 'STORE_PROBLEM_HINTS') {
    const problemId = message.problemId;
    const hints = message.hints;
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      if (!settings.problemHints) settings.problemHints = {};
      settings.problemHints[problemId] = hints;
      chrome.storage.local.set({ cpFocusSettings: settings });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_PROBLEM_HINTS') {
    const problemId = message.problemId;
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      const hints = settings.problemHints?.[problemId] || null;
      sendResponse({ hints });
    });
    return true;
  }

  if (message.type === 'GET_HINTS_REVEALED') {
    const problemId = message.problemId;
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      const revealed = settings.problemHistory?.[problemId]?.hintsRevealed || 0;
      sendResponse({ hintsRevealed: revealed });
    });
    return true;
  }

  if (message.type === 'SET_HINTS_REVEALED') {
    const problemId = message.problemId;
    const hintsRevealed = message.hintsRevealed;
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      if (!settings.problemHistory) settings.problemHistory = {};
      if (!settings.problemHistory[problemId]) {
        settings.problemHistory[problemId] = { firstOpened: Date.now(), sessions: [] };
      }
      settings.problemHistory[problemId].hintsRevealed = hintsRevealed;
      chrome.storage.local.set({ cpFocusSettings: settings });
      sendResponse({ success: true });
    });
    return true;
  }

  // Proxy fetch requests to backend (avoids CORS/PNA issues)
  if (message.type === 'FETCH_HINTS_FROM_BACKEND') {
    const { titleSlug, problemData } = message;
    
    (async () => {
      try {
        // First try to get cached hints
        const cacheResponse = await fetch(`${BACKEND_URL}/api/hints/${titleSlug}`);
        if (cacheResponse.ok) {
          const cached = await cacheResponse.json();
          sendResponse({ success: true, hints: cached.hints, cached: true });
          return;
        }

        // If not cached and we have problem data, generate new hints
        if (problemData) {
          const response = await fetch(`${BACKEND_URL}/api/hints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titleSlug, problemData })
          });

          if (response.ok) {
            const data = await response.json();
            sendResponse({ success: true, hints: data.hints, cached: false });
            return;
          } else {
            const errorText = await response.text();
            sendResponse({ success: false, error: `Backend error: ${response.status}` });
            return;
          }
        }

        sendResponse({ success: false, error: 'No cached hints and no problem data provided' });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }


  if (message.type === 'SYNC_SUBMISSIONS') {
    (async () => {
      try {
        const result = await fetchAndSyncSubmissions();
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'GET_PROBLEM_RATING') {
      const slug = message.titleSlug;
      const rating = ratingMap.get(slug);
      sendResponse({ rating: rating || null });
      return true;
  }

  if (message.type === 'GET_BATCH_PROBLEM_RATINGS') {
    const slugs = message.titleSlugs;
    const ratings = {};
    if (Array.isArray(slugs)) {
      slugs.forEach(slug => {
        const rating = ratingMap.get(slug);
        if (rating) {
          ratings[slug] = rating;
        }
      });
    }
    sendResponse({ ratings });
    return true;
  }
});

// Helper function to format time
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

// Handle hint alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('hint_')) {
    const parts = alarm.name.split('_');
    const hintNumber = parseInt(parts[1]);
    const problemId = parts.slice(2).join('_');
    
    // Get stored hints for this problem
    chrome.storage.local.get('cpFocusSettings').then((result) => {
      const settings = result.cpFocusSettings || DEFAULT_SETTINGS;
      const storedHints = settings.problemHints?.[problemId] || null;
      
      // Notify ALL LeetCode tabs (not just active)
      chrome.tabs.query({ url: ['https://leetcode.com/*', 'https://www.leetcode.com/*'] }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'HINT_UNLOCKED', 
            hintNumber,
            problemId,
            storedHints
          }).catch(() => {});
        });
      });
    });
  }
});

async function fetchAndSyncSubmissions() {
  // 1. Get active LeetCode tab
  const tabs = await chrome.tabs.query({ url: ['https://leetcode.com/*', 'https://www.leetcode.com/*'], active: true });
  if (tabs.length === 0) {
      throw new Error('Please open LeetCode to sync');
  }
  const tabId = tabs[0].id;

  // 2. Request data from content script (which has the cookies/session)
  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, { type: 'FETCH_ALL_SUBMISSIONS' });
  } catch (e) {
    console.error("Content script communication error:", e);
    if (e.message.includes("Receiving end does not exist") || e.message.includes("closed")) {
        throw new Error("Please refresh the LeetCode page and try again.");
    }
    throw e;
  }
  
  if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to fetch data from page');
  }

  const { submissions, username } = response.data;
  
  if (!submissions || submissions.length === 0) {
      return { success: true, count: 0 };
  }

  // 3. Send to backend (raw data, as requested)
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/submissions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ submissions, username })
    });
    
    if (!backendRes.ok) {
        throw new Error('Backend failed: ' + backendRes.statusText);
    }
    
    const result = await backendRes.json();
    return { success: true, count: result.count };
  } catch (e) {
     throw new Error('Failed to reach backend at localhost:5000: ' + e.message);
  }
}
