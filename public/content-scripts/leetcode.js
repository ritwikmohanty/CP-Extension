// LeetCode Content Script - Blocks distracting elements
(function() {
  'use strict';

  // Current settings (will be loaded from storage)
  let settings = {
    enabled: false, // DEFAULT TO FALSE - don't block until user enables
    blockEditorial: true,
    blockSolutions: true,
    blockDiscussions: true,
    blockHints: true,
    blockTopics: true,
    blockAI: true
  };

  // Timer state
  let timerState = {
    startTime: null,
    problemId: null,
    hintsRevealed: 0
  };

  let isInitialized = false;
  let observerInstance = null;

  // Load settings from storage
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response) {
        // Check if extension is enabled globally
        if (typeof response.enabled !== 'undefined') {
          settings.enabled = response.enabled;
        }
        // Load platform-specific settings
        if (response.platforms && response.platforms.leetcode) {
          settings = { ...settings, ...response.platforms.leetcode };
        }
        // Load timer state
        if (response.timer) {
          timerState.startTime = response.timer.startTime;
          timerState.problemId = response.timer.currentProblem;
        }
      }
      console.log('CP Focus: Settings loaded', settings);
    } catch (error) {
      console.log('CP Focus: Using default settings (disabled)');
      settings.enabled = false;
    }
  }

  // Apply CSS class to hide elements
  function hideElement(element) {
    if (element && !element.classList.contains('cp-focus-hidden')) {
      element.classList.add('cp-focus-hidden');
      element.setAttribute('data-cp-focus-blocked', 'true');
    }
  }

  // Remove hiding from element
  function showElement(element) {
    if (element) {
      element.classList.remove('cp-focus-hidden');
      element.removeAttribute('data-cp-focus-blocked');
    }
  }

  // Unblock ALL elements (when extension is disabled)
  function unblockAll() {
    document.querySelectorAll('.cp-focus-hidden').forEach(showElement);
    
    // Remove focus indicator
    const indicator = document.getElementById('cp-focus-indicator');
    if (indicator) indicator.remove();
    
    // Remove any hint notifications
    document.querySelectorAll('.cp-focus-hint-notification').forEach(el => el.remove());
  }

  // Block elements based on settings
  function blockElements() {
    // CRITICAL: Check if extension is enabled first
    if (!settings.enabled) {
      unblockAll();
      return;
    }

    // Block Editorial tabs
    if (settings.blockEditorial) {
      blockEditorialElements();
    }

    // Block Solutions tabs
    if (settings.blockSolutions) {
      blockSolutionsElements();
    }

    // Block Discussions
    if (settings.blockDiscussions) {
      blockDiscussionsElements();
    }

    // Block Hints
    if (settings.blockHints) {
      blockHintsElements();
    }

    // Block Topics
    if (settings.blockTopics) {
      blockTopicsElements();
    }

    // Block AI elements
    if (settings.blockAI) {
      blockAIElements();
    }
  }

  // Block Editorial tab and content
  function blockEditorialElements() {
    // By ID
    const editorialTab = document.getElementById('editorial_tab');
    if (editorialTab) {
      hideElement(editorialTab);
      // Hide parent tab button
      const parent = editorialTab.closest('.flexlayout__tab_button') || 
                     editorialTab.closest('[data-layout-path]');
      if (parent) hideElement(parent);
    }

    // By data-layout-path (tb1 is typically editorial)
    document.querySelectorAll('[data-layout-path*="/ts0/tb1"]').forEach(el => {
      hideElement(el);
    });

    // By text content - find tabs with "Editorial" text
    document.querySelectorAll('.flexlayout__tab_button, .flexlayout__tab_button_content').forEach(el => {
      if (el.textContent?.trim() === 'Editorial' || el.textContent?.includes('Editorial')) {
        hideElement(el);
        const parent = el.closest('.flexlayout__tab_button') || el.closest('[data-layout-path]');
        if (parent && parent !== el) hideElement(parent);
      }
    });

    // Additional selectors
    document.querySelectorAll('[data-cy="editorial-tab"], [href*="/editorial"]').forEach(hideElement);
  }

  // Block Solutions tab and content
  function blockSolutionsElements() {
    // By ID
    const solutionsTab = document.getElementById('solutions_tab');
    if (solutionsTab) {
      hideElement(solutionsTab);
      const parent = solutionsTab.closest('.flexlayout__tab_button') || 
                     solutionsTab.closest('[data-layout-path]');
      if (parent) hideElement(parent);
    }

    // By data-layout-path (tb2 is typically solutions)
    document.querySelectorAll('[data-layout-path*="/ts0/tb2"]').forEach(el => {
      hideElement(el);
    });

    // By text content
    document.querySelectorAll('.flexlayout__tab_button, .flexlayout__tab_button_content').forEach(el => {
      if (el.textContent?.trim() === 'Solutions' || el.textContent?.includes('Solutions')) {
        hideElement(el);
        const parent = el.closest('.flexlayout__tab_button') || el.closest('[data-layout-path]');
        if (parent && parent !== el) hideElement(parent);
      }
    });

    // Additional selectors
    document.querySelectorAll('[data-cy="solutions-tab"], [href*="/solutions"]').forEach(hideElement);
  }

  // Block Discussions
  function blockDiscussionsElements() {
    document.querySelectorAll('[data-cy="discussion-tab"], [href*="/discussion"]').forEach(hideElement);
    
    // By text content in tabs
    document.querySelectorAll('.flexlayout__tab_button, .flexlayout__tab_button_content').forEach(el => {
      if (el.textContent?.includes('Discussion')) {
        hideElement(el);
      }
    });

    // Target Discussion elements by text-body class containing "Discussion"
    document.querySelectorAll('.text-body').forEach(el => {
      if (el.textContent?.includes('Discussion')) {
        // Hide the parent group container
        const container = el.closest('.group.flex') || el.closest('.flex-1') || el.closest('.flex.flex-col');
        if (container) hideElement(container);
        hideElement(el);
      }
    });

    // Target the specific structure from DOM: group flex cursor-pointer with Discussion text
    document.querySelectorAll('.group.flex.cursor-pointer').forEach(el => {
      if (el.textContent?.includes('Discussion')) {
        hideElement(el);
      }
    });

    // Block discussion count button (comment icon with number)
    // Target buttons with data-icon="comment" or SVG comment icons
    document.querySelectorAll('button').forEach(btn => {
      // Check if button has comment icon (data-prefix="far" data-icon="comment")
      const hasCommentIcon = btn.querySelector('[data-icon="comment"]') || 
                             btn.querySelector('svg[data-icon="comment"]');
      if (hasCommentIcon) {
        hideElement(btn);
      }
      // Also check for buttons with just a number (discussion count)
      const text = btn.textContent?.trim() || '';
      if (/^\d+$/.test(text) && btn.querySelector('svg')) {
        // Button with just a number and an SVG icon - likely discussion count
        const svg = btn.querySelector('svg');
        if (svg?.getAttribute('data-icon') === 'comment') {
          hideElement(btn);
        }
      }
    });

    // Target by data-icon attribute directly
    document.querySelectorAll('[data-icon="comment"]').forEach(el => {
      const btn = el.closest('button');
      if (btn) hideElement(btn);
    });
  }

  // Block Hints
  function blockHintsElements() {
    // Find hint containers - look for elements containing "Hint" text
    document.querySelectorAll('.flex.flex-col, .group.flex').forEach(el => {
      const text = el.textContent || '';
      // Match "Hint" followed by a number or just "Hint"
      if (/Hint\s*\d*/.test(text) && text.length < 50) {
        hideElement(el);
      }
    });

    // Block hint buttons
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent?.includes('Hint')) {
        hideElement(btn);
      }
    });

    // Block by class patterns
    document.querySelectorAll('[class*="hint" i], [data-cy*="hint"]').forEach(hideElement);
  }

  // Block Topics/Tags
  function blockTopicsElements() {
    // Find topic tag sections
    document.querySelectorAll('.flex.flex-col, .flex.gap-2').forEach(el => {
      const text = el.textContent || '';
      if (text.includes('Topics') && text.length < 200) {
        hideElement(el);
      }
    });

    // Block topic tags
    document.querySelectorAll('[class*="topic-tag"], [href*="/tag/"]').forEach(hideElement);
  }

  // Block AI elements
  function blockAIElements() {
    // Target the specific "Ask Leet" button by aria-label
    document.querySelectorAll('[aria-label="Ask Leet"]').forEach(hideElement);
    document.querySelectorAll('[aria-label*="Ask Leet"]').forEach(hideElement);

    // // Block AI chat tab - the entire tabset with ai-agent in data-layout-path
    // document.querySelectorAll('[data-layout-path*="ai-agent"]').forEach(hideElement);
    // document.querySelectorAll('[data-layout-path*="/ts2"]').forEach(el => {
    //   // Check if this is the AI tab area
    //   if (el.id?.includes('ai') || el.className?.includes('ai') || 
    //       el.querySelector('[data-layout-path*="ai"]')) {
    //     hideElement(el);
    //   }
    // });
    // // Block the flexlayout tabset containing AI
    // document.querySelectorAll('.flexlayout__tabset').forEach(el => {
    //   const layoutPath = el.getAttribute('data-layout-path') || '';
    //   if (layoutPath.includes('ts2') || el.querySelector('[data-layout-path*="ai-agent"]')) {
    //     hideElement(el);
    //   }
    // });
    
    const aiSelectors = [
      '[class*="ask-ai" i]',
      '[class*="leetai" i]',
      '[class*="copilot" i]',
      '[class*="ai-assistant" i]',
      'button[aria-label*="AI" i]',
      '[aria-label*="Leet" i]',
      '[title*="AI Assistant"]',
      '[data-layout-path*="ai"]'
    ];

    aiSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(hideElement);
      } catch (e) {
        // Selector might be invalid, skip
      }
    });

    // By text content - look for Ask Leet, Ask AI, etc.
    document.querySelectorAll('button, a, div[role="button"]').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
      if (text.includes('ask ai') || text.includes('leet ai') || text.includes('copilot') ||
          text.includes('ask leet') || ariaLabel.includes('ask leet') || ariaLabel.includes('leet')) {
        hideElement(el);
      }
    });
  }

  // Create and show the focus mode indicator
  function showFocusModeIndicator() {
    // Don't show if disabled
    if (!settings.enabled) return;
    
    if (document.getElementById('cp-focus-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'cp-focus-indicator';
    indicator.innerHTML = `
      <div class="cp-focus-indicator-content">
        <span class="cp-focus-icon">🎯</span>
        <span class="cp-focus-text">Focus Mode</span>
        <span class="cp-focus-timer" id="cp-focus-timer">00:00</span>
      </div>
    `;
    document.body.appendChild(indicator);

    // Start timer display if timer is active
    if (timerState.startTime) {
      updateTimerDisplay();
      setInterval(updateTimerDisplay, 1000);
    }
  }

  // Update the timer display
  function updateTimerDisplay() {
    const timerElement = document.getElementById('cp-focus-timer');
    if (!timerElement || !timerState.startTime) return;

    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Show hint notification
  function showHintNotification(hintNumber) {
    const messages = [
      "Think about the problem constraints. What data structure would help?",
      "Consider the time complexity. Is there a pattern you can exploit?",
      "Break down the problem into smaller subproblems."
    ];

    const notification = document.createElement('div');
    notification.className = 'cp-focus-hint-notification';
    notification.innerHTML = `
      <div class="cp-focus-hint-content">
        <span class="cp-focus-hint-icon">💡</span>
        <div class="cp-focus-hint-text">
          <strong>Hint ${hintNumber}</strong>
          <p>${messages[hintNumber - 1] || messages[0]}</p>
        </div>
        <button class="cp-focus-hint-dismiss" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    document.body.appendChild(notification);

    // Auto-dismiss after 10 seconds
    setTimeout(() => notification.remove(), 10000);
  }

  // Setup mutation observer for dynamic content
  function setupObserver() {
    if (observerInstance) {
      observerInstance.disconnect();
    }

    observerInstance = new MutationObserver((mutations) => {
      // Only run if enabled
      if (!settings.enabled) return;
      
      // Debounce the blocking
      clearTimeout(window.cpFocusDebounce);
      window.cpFocusDebounce = setTimeout(() => {
        blockElements();
      }, 100);
    });

    observerInstance.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Listen for settings changes from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
      console.log('CP Focus: Settings updated', message.settings);
      if (message.settings) {
        // Update enabled state
        if (typeof message.settings.enabled !== 'undefined') {
          settings.enabled = message.settings.enabled;
        }
        // Update platform settings
        if (message.settings.platforms && message.settings.platforms.leetcode) {
          settings = { ...settings, ...message.settings.platforms.leetcode };
        }
      }
      
      if (settings.enabled) {
        blockElements();
        showFocusModeIndicator();
      } else {
        unblockAll();
      }
    }
    
    if (message.type === 'SHOW_HINT') {
      showHintNotification(message.hintNumber);
    }

    if (message.type === 'TIMER_STARTED') {
      timerState.startTime = message.startTime;
      timerState.problemId = message.problemId;
      updateTimerDisplay();
    }

    if (message.type === 'TIMER_STOPPED') {
      timerState.startTime = null;
    }
  });

  // Initialize the content script
  async function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('CP Focus: Initializing...');
    
    // Load settings first
    await loadSettings();
    
    console.log('CP Focus: Extension enabled:', settings.enabled);

    // Only block and show indicator if enabled
    if (settings.enabled) {
      blockElements();
      showFocusModeIndicator();
      setupObserver();
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run on full page load (for SPAs)
  window.addEventListener('load', () => {
    if (settings.enabled) {
      setTimeout(blockElements, 500);
    }
  });

})();
