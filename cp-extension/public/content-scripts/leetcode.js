// LeetCode Content Script - Blocks distracting elements
(function () {
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

  // Display settings
  let displaySettings = {
    showFocusIndicator: true
  };

  // Timer settings
  let timerSettings = {
    hintIntervals: [20, 25, 30]
  };

  // Timer state
  let timerState = {
    startTime: null,
    problemId: null,
    hintsRevealed: 0
  };

  // Generated hints from backend (AI-powered)
  let generatedHints = {
    hints: [], // Array of 3 hints from Gemini
    loaded: false,
    loading: false,
    error: null
  };

  // Track which hint icons have been shown
  let hintIconsShown = [false, false, false];

  let isInitialized = false;
  let observerInstance = null;
  let timerInterval = null;
  let hintCheckInterval = null;

  // Get the current problem ID from URL
  function getCurrentProblemId() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch problem data from LeetCode GraphQL API
   */
  async function fetchProblemData(titleSlug) {
    const query = `
      query getProblemDetails($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          content
          difficulty
          hints
          topicTags {
            name
            slug
          }
          solution {
            id
            canSeeDetail
            paidOnly
            hasVideoSolution
            content
          }
        }
      }
    `;

    try {
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { titleSlug }
        })
      });

      const data = await response.json();
      return data.data?.question || null;
    } catch (error) {

      return null;
    }
  }

  /**
   * Fetch hints from backend via background script (avoids CORS/PNA issues)
   */
  async function fetchHintsFromBackend(titleSlug, problemData) {

    
    try {
      // If no problem data provided, fetch it first
      if (!problemData) {

        problemData = await fetchProblemData(titleSlug);
      }

      if (!problemData) {

        return null;
      }

      // Use background script to fetch from backend (bypasses CORS/PNA)

      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_HINTS_FROM_BACKEND',
        titleSlug,
        problemData: {
          title: problemData.title,
          titleSlug: problemData.titleSlug,
          content: problemData.content,
          difficulty: problemData.difficulty,
          hints: problemData.hints || [],
          topicTags: problemData.topicTags || [],
          solution: problemData.solution
        }
      });

      if (response?.success && response.hints) {

        return response.hints;
      } else {

        return null;
      }
    } catch (error) {

      return null;
    }
  }

  /**
   * Load hints for the current problem
   */
  async function loadHintsForProblem() {
    const problemId = getCurrentProblemId();
    if (!problemId || generatedHints.loading) return;

    // Check if we already have hints loaded for this problem
    if (generatedHints.loaded && generatedHints.hints.length > 0) {

      return;
    }

    generatedHints.loading = true;
    generatedHints.error = null;

    try {
      // Try to get from local storage first (for offline/fast access)
      const storedResponse = await chrome.runtime.sendMessage({
        type: 'GET_PROBLEM_HINTS',
        problemId: problemId
      });

      if (storedResponse?.hints?.length === 3) {
        generatedHints.hints = storedResponse.hints;
        generatedHints.loaded = true;
        generatedHints.loading = false;

        return;
      }

      // Fetch from backend
      const hints = await fetchHintsFromBackend(problemId);
      
      if (hints && hints.length === 3) {
        generatedHints.hints = hints;
        generatedHints.loaded = true;

        // Store in local storage for quick access
        await chrome.runtime.sendMessage({
          type: 'STORE_PROBLEM_HINTS',
          problemId: problemId,
          hints: hints
        });
      } else {
        generatedHints.error = 'Failed to generate hints';
      }
    } catch (error) {

      generatedHints.error = error.message;
    }

    generatedHints.loading = false;
  }

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
          timerSettings.hintIntervals = response.timer.hintIntervals || [20, 25, 30];
        }
        // Load display settings
        if (response.display) {
          displaySettings.showFocusIndicator = response.display.showFocusIndicator !== false;
        }
      }

    } catch (error) {

      settings.enabled = false;
    }
  }

  // Start timer for current problem (auto-start when problem page opens)
  async function startTimerForProblem() {
    const problemId = getCurrentProblemId();
    if (!problemId) return;

    // Check if timer is already running for this problem
    if (timerState.problemId === problemId && timerState.startTime) {

      return;
    }

    // Start a new timer for this problem
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_TIMER',
        problemId: problemId
      });
      if (response && response.success) {
        timerState.startTime = response.startTime;
        timerState.problemId = problemId;

      }
    } catch (error) {

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

    // Remove hint icons container
    const hintIconsContainer = document.getElementById('cp-focus-hint-icons');
    if (hintIconsContainer) hintIconsContainer.remove();

    // Remove any hint notifications
    document.querySelectorAll('.cp-focus-hint-notification').forEach(el => el.remove());
    document.querySelectorAll('.cp-focus-hint-available-notification').forEach(el => el.remove());
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
      // Skip our own CP Focus elements
      if (el.closest('[class*="cp-focus"]') || el.className?.includes('cp-focus')) return;
      
      const text = el.textContent || '';
      // Match "Hint" followed by a number or just "Hint"
      if (/Hint\s*\d*/.test(text) && text.length < 50) {
        hideElement(el);
      }
    });

    // Block hint buttons
    document.querySelectorAll('button').forEach(btn => {
      // Skip our own CP Focus elements
      if (btn.closest('[class*="cp-focus"]') || btn.className?.includes('cp-focus')) return;
      
      if (btn.textContent?.includes('Hint')) {
        hideElement(btn);
      }
    });

    // Block by class patterns - EXCLUDE our own CP Focus elements
    document.querySelectorAll('[class*="hint" i]:not([class*="cp-focus"]), [data-cy*="hint"]:not([class*="cp-focus"])').forEach(el => {
      // Double check to not hide our elements
      if (!el.className?.includes('cp-focus') && !el.closest('[class*="cp-focus"]')) {
        hideElement(el);
      }
    });
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

  // Block AI elements - Enhanced to block all AI applications
  function blockAIElements() {
    // Target the specific "Ask Leet" button by aria-label
    document.querySelectorAll('[aria-label="Ask Leet"]').forEach(hideElement);
    document.querySelectorAll('[aria-label*="Ask Leet"]').forEach(hideElement);

    // Block the AI chat tab and entire AI panel
    document.querySelectorAll('[data-layout-path*="ai-agent"]').forEach(hideElement);

    const aiSelectors = [
      '[class*="ask-ai" i]',
      '[class*="leetai" i]',
      '[class*="ai-assistant" i]',
      '[class*="ai-chat" i]',
      'button[aria-label*="AI" i]',
      '[aria-label*="Leet" i]',
      '[title*="AI Assistant"]',
      '[title*="AI" i]',
      '[data-layout-path*="ai"]',
      '[id*="ai-chat" i]',
      '[id*="assistant" i]'
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
        text.includes('ask leet') || ariaLabel.includes('ask leet') || ariaLabel.includes('leet') ||
        text.includes('chatgpt') || text.includes('claude') || text.includes('gemini') ||
        text.includes('ai assistant') || text.includes('ai chat') || text.includes('ask assistant')) {
        hideElement(el);
      }
    });

    // Block AI tabs in the tab bar
    document.querySelectorAll('.flexlayout__tab_button, .flexlayout__tab_button_content').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes('ai') || text.includes('leet') || text.includes('assistant') || 
          text.includes('copilot') || text.includes('chat')) {
        // Don't hide if it's just "Editorial" or other legitimate tabs
        if (!text.includes('editorial') && !text.includes('description') && !text.includes('solutions')) {
          hideElement(el);
          const parent = el.closest('.flexlayout__tab_button') || el.closest('[data-layout-path]');
          if (parent && parent !== el) hideElement(parent);
        }
      }
    });
  }

  // Create and show the focus mode indicator
  function showFocusModeIndicator() {
    // Don't show if disabled or user chose to hide it
    if (!settings.enabled || !displaySettings.showFocusIndicator) return;

    if (document.getElementById('cp-focus-indicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'cp-focus-indicator';
    indicator.className = 'cp-focus-draggable';
    indicator.innerHTML = `
      <div class="cp-focus-indicator-content">
        <div class="cp-focus-drag-handle">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </div>
        <div class="cp-focus-status">
          <span class="cp-focus-dot"></span>
          <span class="cp-focus-text">Focus Mode</span>
        </div>
        <div class="cp-focus-divider"></div>
        <span class="cp-focus-timer" id="cp-focus-timer">00:00</span>
        <button class="cp-focus-close" id="cp-focus-close" title="Hide indicator">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
    document.body.appendChild(indicator);

    // Add close button handler
    const closeBtn = document.getElementById('cp-focus-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        indicator.remove();
        // Note: This just hides for current session, doesn't change settings
      });
    }

    // Make it draggable
    makeElementDraggable(indicator);

    // Start timer interval
    startTimerInterval();
  }

  // Draggable logic
  function makeElementDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector('.cp-focus-drag-handle') || elmnt;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      elmnt.style.right = 'auto'; // Clear right if set
      elmnt.style.bottom = 'auto'; // Clear bottom if set
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Start the timer display interval
  function startTimerInterval() {
    // Clear any existing interval
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    // Update immediately
    updateTimerDisplay();

    // Update every second
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  // Update the timer display
  function updateTimerDisplay() {
    const timerElement = document.getElementById('cp-focus-timer');
    if (!timerElement) return;

    if (!timerState.startTime) {
      timerElement.textContent = '00:00';
      return;
    }

    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Check if we should show hint icons
    checkAndShowHintIcons(minutes);
  }

  /**
   * Check elapsed time and show hint icons when appropriate
   */
  function checkAndShowHintIcons(elapsedMinutes) {
    if (!generatedHints.loaded || generatedHints.hints.length === 0) return;

    timerSettings.hintIntervals.forEach((intervalMinutes, index) => {
      if (elapsedMinutes >= intervalMinutes && !hintIconsShown[index]) {
        hintIconsShown[index] = true;
        showHintIcon(index + 1);
        
        // Notify the user
        notifyHintAvailable(index + 1);
      }
    });
  }

  /**
   * Show a hint icon in the DOM (appears after the specified time)
   */
  function showHintIcon(hintNumber) {
    const containerId = 'cp-focus-hint-icons';
    let container = document.getElementById(containerId);
    
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'cp-focus-hint-icons-container';
      document.body.appendChild(container);
    }

    // Check if this hint icon already exists
    if (document.getElementById(`cp-focus-hint-icon-${hintNumber}`)) return;

    const hintIcon = document.createElement('button');
    hintIcon.id = `cp-focus-hint-icon-${hintNumber}`;
    hintIcon.className = 'cp-focus-hint-icon-btn';
    hintIcon.innerHTML = `
      <span class="cp-focus-hint-icon-number">${hintNumber}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.663 17h4.673M12 3v1M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
        <path d="M12 12v5"/>
      </svg>
    `;
    hintIcon.title = `Click to view Hint ${hintNumber}`;
    
    hintIcon.addEventListener('click', () => {
      showHintNotification(hintNumber);
    });

    container.appendChild(hintIcon);
  }

  /**
   * Notify user that a hint is available
   */
  function notifyHintAvailable(hintNumber) {
    // Create a subtle notification
    const notification = document.createElement('div');
    notification.className = 'cp-focus-hint-available-notification';
    notification.innerHTML = `
      <span>💡 Hint ${hintNumber} is now available!</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(notification);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('cp-focus-fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  /**
   * Show hint notification with the AI-generated hint
   */
  function showHintNotification(hintNumber, storedHints) {
    // Remove any existing hint notification
    document.querySelectorAll('.cp-focus-hint-notification').forEach(el => el.remove());

    let hintContent = '';
    let hintSource = 'ai';

    // Use the hints from storedHints parameter or generatedHints
    const hints = storedHints || generatedHints.hints;

    if (hints && hints.length >= hintNumber) {
      hintContent = hints[hintNumber - 1];
    } else {
      // Fallback if hints not available yet
      hintContent = getFallbackHint(hintNumber);
      hintSource = 'fallback';
    }

    const notification = document.createElement('div');
    notification.className = 'cp-focus-hint-notification';
    notification.innerHTML = `
      <div class="cp-focus-hint-content">
        <span class="cp-focus-hint-icon-emoji">💡</span>
        <div class="cp-focus-hint-text">
          <strong>Hint ${hintNumber}${hintSource === 'ai' ? '' : ' (Generating...)'}</strong>
          <p>${hintContent}</p>
        </div>
        <button class="cp-focus-hint-dismiss" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    document.body.appendChild(notification);

    // Update hints revealed count
    timerState.hintsRevealed = Math.max(timerState.hintsRevealed, hintNumber);
    chrome.runtime.sendMessage({
      type: 'SET_HINTS_REVEALED',
      problemId: timerState.problemId,
      hintsRevealed: timerState.hintsRevealed
    }).catch(() => {});

    // Auto-dismiss after 30 seconds (longer since these are AI hints)
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('cp-focus-fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 30000);
  }

  /**
   * Get fallback hint if AI hints not available
   */
  function getFallbackHint(hintNumber) {
    const fallbackHints = {
      1: "Take a moment to re-read the problem. What are the key constraints and patterns in the examples?",
      2: "Think about the time complexity needed. What data structure could help optimize your approach?",
      3: "Consider edge cases: empty input, single element, maximum constraints. How does your solution handle them?"
    };
    return fallbackHints[hintNumber] || fallbackHints[1];
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

      if (message.settings) {
        // Update enabled state
        if (typeof message.settings.enabled !== 'undefined') {
          settings.enabled = message.settings.enabled;
        }
        // Update platform settings
        if (message.settings.platforms && message.settings.platforms.leetcode) {
          settings = { ...settings, ...message.settings.platforms.leetcode };
        }
        // Update display settings
        if (message.settings.display) {
          displaySettings.showFocusIndicator = message.settings.display.showFocusIndicator !== false;
        }
        // Update timer settings
        if (message.settings.timer) {
          timerSettings.hintIntervals = message.settings.timer.hintIntervals || [20, 25, 30];
        }
      }

      if (settings.enabled) {
        blockElements();
        // Handle focus indicator visibility
        const existingIndicator = document.getElementById('cp-focus-indicator');
        if (displaySettings.showFocusIndicator && !existingIndicator) {
          showFocusModeIndicator();
        } else if (!displaySettings.showFocusIndicator && existingIndicator) {
          existingIndicator.remove();
        }
      } else {
        unblockAll();
      }
    }

    if (message.type === 'SHOW_HINT') {
      showHintNotification(message.hintNumber, message.storedHints || generatedHints.hints);
    }

    if (message.type === 'HINT_UNLOCKED') {
      // Hint time has been reached - show the icon and notification
      const hintNumber = message.hintNumber;
      if (!hintIconsShown[hintNumber - 1]) {
        hintIconsShown[hintNumber - 1] = true;
        showHintIcon(hintNumber);
        notifyHintAvailable(hintNumber);
      }
    }

    if (message.type === 'TIMER_STARTED') {
      timerState.startTime = message.startTime;
      timerState.problemId = message.problemId;
      updateTimerDisplay();
    }

    if (message.type === 'TIMER_STOPPED') {
      timerState.startTime = null;
    }

    if (message.type === 'GET_CURRENT_HINTS') {
      // Return the current problem's hints for the popup
      sendResponse({
        problemId: getCurrentProblemId(),
        hints: generatedHints.hints,
        hintsRevealed: timerState.hintsRevealed,
        loaded: generatedHints.loaded
      });
      return true;
    }
  });

  // Initialize the content script
  async function init() {
    if (isInitialized) return;
    isInitialized = true;



    // Load settings first
    await loadSettings();



    // Always load hints for the current problem (for caching), regardless of enabled state
    const problemId = getCurrentProblemId();
    if (problemId) {

      // Load hints from backend immediately (for caching)
      loadHintsForProblem().then(() => {

      }).catch(err => {

      });
    }

    // Only block and show indicator if enabled
    if (settings.enabled) {
      // Auto-start timer when problem page is opened
      if (problemId) {
        // Check if this is a different problem or no timer running
        if (timerState.problemId !== problemId || !timerState.startTime) {
          await startTimerForProblem();
        }
      }

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

  // Listen for URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // URL changed - check if it's a new problem
      const problemId = getCurrentProblemId();
      if (problemId && problemId !== timerState.problemId) {
        // New problem - reset hints state
        generatedHints = { hints: [], loaded: false, loading: false, error: null };
        hintIconsShown = [false, false, false];
        
        // Remove old hint icons
        const oldContainer = document.getElementById('cp-focus-hint-icons');
        if (oldContainer) oldContainer.remove();
        
        // Always load hints for caching (regardless of enabled state)

        loadHintsForProblem().then(() => {

        });
        
        // Only start timer if enabled
        if (settings.enabled) {
          startTimerForProblem();
        }
      }
    }
  }).observe(document, { subtree: true, childList: true });

})();
