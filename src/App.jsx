import { useState, useEffect } from 'react';
import './App.css';

const DEFAULT_SETTINGS = {
  enabled: false, // Default to disabled
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
    hintIntervals: [20, 25, 30],
    currentProblem: null,
    startTime: null
  }
};

function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [timerStatus, setTimerStatus] = useState({
    currentProblem: null,
    elapsedSeconds: 0
  });
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    const interval = setInterval(updateTimerStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response) {
          setSettings(response);
        }
      }
    } catch (error) {
      console.log('Using default settings');
    }
    setLoading(false);
  };

  const updateTimerStatus = async () => {
    try {
      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATUS' });
        if (response) {
          setTimerStatus({
            currentProblem: response.currentProblem,
            elapsedSeconds: response.elapsedSeconds
          });
        }
      }
    } catch (error) {
      // Ignore errors
    }
  };

  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    try {
      if (chrome?.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ 
          type: 'UPDATE_SETTINGS', 
          settings: newSettings 
        });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const toggleEnabled = () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    saveSettings(newSettings);
  };

  const toggleLeetCodeOption = (option) => {
    const newSettings = {
      ...settings,
      platforms: {
        ...settings.platforms,
        leetcode: {
          ...settings.platforms.leetcode,
          [option]: !settings.platforms.leetcode[option]
        }
      }
    };
    saveSettings(newSettings);
  };

  const stopTimer = async () => {
    try {
      if (chrome?.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
        setTimerStatus({ currentProblem: null, elapsedSeconds: 0 });
      }
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🎯</span>
          <h1>CP Focus Mode</h1>
        </div>
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={settings.enabled} 
            onChange={toggleEnabled}
          />
          <span className="toggle-slider"></span>
        </label>
      </header>

      {/* Timer Section */}
      {timerStatus.currentProblem && (
        <section className="timer-section">
          <div className="timer-info">
            <span className="timer-icon">⏱️</span>
            <div className="timer-details">
              <span className="timer-problem">{timerStatus.currentProblem}</span>
              <span className="timer-time">{formatTime(timerStatus.elapsedSeconds)}</span>
            </div>
            <button className="timer-stop" onClick={stopTimer}>Stop</button>
          </div>
        </section>
      )}

      {/* LeetCode Section */}
      <section className="platform-section">
        <div className="section-header">
          <h2>
            <span className="platform-icon">💻</span>
            LeetCode
          </h2>
          <label className="toggle-switch small">
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.enabled} 
              onChange={() => toggleLeetCodeOption('enabled')}
              disabled={!settings.enabled}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className={`options-list ${!settings.enabled || !settings.platforms.leetcode.enabled ? 'disabled' : ''}`}>
          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">📝</span>
              Block Editorial
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockEditorial}
              onChange={() => toggleLeetCodeOption('blockEditorial')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>

          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">💡</span>
              Block Solutions
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockSolutions}
              onChange={() => toggleLeetCodeOption('blockSolutions')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>

          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">💬</span>
              Block Discussions
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockDiscussions}
              onChange={() => toggleLeetCodeOption('blockDiscussions')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>

          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">🔍</span>
              Block Hints
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockHints}
              onChange={() => toggleLeetCodeOption('blockHints')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>

          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">🏷️</span>
              Block Topics/Tags
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockTopics}
              onChange={() => toggleLeetCodeOption('blockTopics')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>

          <label className="option-item">
            <span className="option-label">
              <span className="option-icon">🤖</span>
              Block AI Assistant
            </span>
            <input 
              type="checkbox" 
              checked={settings.platforms.leetcode.blockAI}
              onChange={() => toggleLeetCodeOption('blockAI')}
              disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
            />
          </label>
        </div>
      </section>

      {/* Hint Timer Info */}
      <section className="info-section">
        <h3>⏰ Timed Hints</h3>
        <p>When enabled, you'll receive hint reminders at:</p>
        <ul className="hint-times">
          <li>💡 Hint 1 at 20 minutes</li>
          <li>💡 Hint 2 at 25 minutes</li>
          <li>💡 Hint 3 at 30 minutes</li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Focus on solving, not on shortcuts! 💪</p>
      </footer>
    </div>
  );
}

export default App
