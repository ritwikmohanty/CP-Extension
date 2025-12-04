import { useState, useEffect } from 'react';
import {
  Timer,
  Code2,
  FileText,
  Lightbulb,
  MessageSquare,
  Tags,
  Bot,
  Target,
  FileCode,
  Clock,
  Eye,
  EyeOff,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Switch } from './components/ui/switch';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';

const DEFAULT_SETTINGS = {
  enabled: false, // Default to disabled
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
    hintIntervals: [20, 25, 30],
    currentProblem: null,
    startTime: null
  },
  display: {
    showFocusIndicator: true
  }
};

function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [timerStatus, setTimerStatus] = useState({
    currentProblem: null,
    elapsedSeconds: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentHints, setCurrentHints] = useState({
    hints: [],
    hintsRevealed: 0,
    loaded: false
  });
  const [expandedHint, setExpandedHint] = useState(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    const interval = setInterval(updateTimerStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load hints when timer status changes
  useEffect(() => {
    if (timerStatus.currentProblem) {
      loadCurrentHints();
    }
  }, [timerStatus.currentProblem]);

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

  const loadCurrentHints = async () => {
    try {
      if (chrome?.tabs?.query && chrome?.tabs?.sendMessage) {
        // Get the active LeetCode tab
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
          url: ['https://leetcode.com/*', 'https://www.leetcode.com/*']
        });

        if (tabs.length > 0) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CURRENT_HINTS' });
          if (response) {
            setCurrentHints({
              hints: response.hints || [],
              hintsRevealed: response.hintsRevealed || 0,
              loaded: response.loaded || false
            });
          }
        }
      }
    } catch (error) {
      // Tab might not be a LeetCode page
    }
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

  const toggleEnabled = (checked) => {
    const newSettings = { ...settings, enabled: checked };
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

  const toggleDisplayOption = (option) => {
    const newSettings = {
      ...settings,
      display: {
        ...settings.display,
        [option]: !settings.display?.[option]
      }
    };
    saveSettings(newSettings);
  };

  const toggleAIBlocking = (checked) => {
    const newSettings = { ...settings, blockAI: checked };
    saveSettings(newSettings);
  };

  const updateHintInterval = (index, value) => {
    // Validate: first hint always >= 20, minimum 5 min gap between hints
    const intervals = [...(settings.timer.hintIntervals || [20, 25, 30])];
    let newValue = parseInt(value) || 20;

    // First hint must be >= 20
    if (index === 0) {
      newValue = Math.max(20, newValue);
    }

    // Ensure minimum 5 min gap from previous hint
    if (index > 0) {
      const minValue = intervals[index - 1] + 5;
      newValue = Math.max(minValue, newValue);
    }

    intervals[index] = newValue;

    // Adjust subsequent hints to maintain 5 min gap
    for (let i = index + 1; i < intervals.length; i++) {
      if (intervals[i] < intervals[i - 1] + 5) {
        intervals[i] = intervals[i - 1] + 5;
      }
    }

    const newSettings = {
      ...settings,
      timer: {
        ...settings.timer,
        hintIntervals: intervals
      }
    };
    saveSettings(newSettings);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground font-sans selection:bg-primary/20">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">CP Focus</h1>
            <p className="text-xs text-muted-foreground font-medium">Stay Locked In</p>
          </div>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={toggleEnabled}
          className="data-[state=checked]:bg-primary"
        />
      </header>

      <main className="space-y-4">
        {/* AI Website Blocker Card */}
        <Card className={cn("transition-all duration-200", settings.blockAI ? "border-primary/50 bg-primary/5" : "opacity-80")}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 font-medium">
                <Bot className={cn("h-4 w-4", settings.blockAI ? "text-primary" : "text-muted-foreground")} />
                Block AI Assistants
              </CardTitle>
              <Switch
                checked={settings.blockAI}
                onCheckedChange={toggleAIBlocking}
                className="scale-90 data-[state=checked]:bg-primary"
              />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Prevent access to AI tools during problem solving sessions to build self-reliance.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Copilot'].map((site) => (
                <span
                  key={site}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                    settings.blockAI
                      ? "bg-background border-primary/20 text-primary/80"
                      : "bg-muted border-transparent text-muted-foreground"
                  )}
                >
                  {site}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Timer Card - without stop button */}
        <div className={cn("transition-all duration-300 ease-in-out", timerStatus.currentProblem ? "opacity-100 translate-y-0" : "hidden opacity-0 -translate-y-4")}>
          <Card className="border-primary/20 bg-primary/5 shadow-md overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Timer className="h-24 w-24" />
            </div>
            <CardContent className="p-4 flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                  <Timer className="h-4 w-4" />
                  <span>Focus Timer</span>
                </div>
                <div className="text-2xl font-mono font-bold tracking-wider">
                  {formatTime(timerStatus.elapsedSeconds)}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {timerStatus.currentProblem}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Settings */}
        <Card className={cn("transition-opacity duration-200", !settings.enabled && "opacity-60 grayscale-[0.5]")}>
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-500" />
                LeetCode
              </CardTitle>
              <Switch
                checked={settings.platforms.leetcode.enabled}
                onCheckedChange={() => toggleLeetCodeOption('enabled')}
                disabled={!settings.enabled}
                className="scale-90"
              />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <div className="grid gap-1">
              <OptionItem
                icon={FileText}
                label="Block Editorial"
                checked={settings.platforms.leetcode.blockEditorial}
                onChange={() => toggleLeetCodeOption('blockEditorial')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
              <OptionItem
                icon={FileCode}
                label="Block Solutions"
                checked={settings.platforms.leetcode.blockSolutions}
                onChange={() => toggleLeetCodeOption('blockSolutions')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
              <OptionItem
                icon={MessageSquare}
                label="Block Discussions"
                checked={settings.platforms.leetcode.blockDiscussions}
                onChange={() => toggleLeetCodeOption('blockDiscussions')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
              <OptionItem
                icon={Lightbulb}
                label="Block Hints"
                checked={settings.platforms.leetcode.blockHints}
                onChange={() => toggleLeetCodeOption('blockHints')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
              <OptionItem
                icon={Tags}
                label="Block Topics"
                checked={settings.platforms.leetcode.blockTopics}
                onChange={() => toggleLeetCodeOption('blockTopics')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
              <OptionItem
                icon={Bot}
                label="Block AI Assistant"
                checked={settings.platforms.leetcode.blockAI}
                onChange={() => toggleLeetCodeOption('blockAI')}
                disabled={!settings.enabled || !settings.platforms.leetcode.enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Info Section - Hint Timing Settings */}
        <Card className="bg-muted/30 border-dashed shadow-none">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Clock className="h-3 w-3" />
              Timed Hints
            </div>
            <p className="text-xs text-muted-foreground">
              First 20 mins: No hints (focus time)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">
                    Hint {index + 1}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={index === 0 ? 20 : (settings.timer?.hintIntervals?.[index - 1] || 20) + 5}
                      value={settings.timer?.hintIntervals?.[index] || [20, 25, 30][index]}
                      onChange={(e) => updateHintInterval(index, e.target.value)}
                      disabled={!settings.enabled}
                      className={cn(
                        "w-full h-7 px-2 text-xs rounded border bg-background text-foreground",
                        "focus:outline-none focus:ring-1 focus:ring-primary",
                        !settings.enabled && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    <span className="text-[10px] text-muted-foreground">m</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Min 5 min gap between hints
            </p>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card className={cn("transition-opacity duration-200", !settings.enabled && "opacity-60")}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Display
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <OptionItem
              icon={settings.display?.showFocusIndicator ? Eye : EyeOff}
              label="Show Focus Indicator"
              checked={settings.display?.showFocusIndicator !== false}
              onChange={() => toggleDisplayOption('showFocusIndicator')}
              disabled={!settings.enabled}
            />
          </CardContent>
        </Card>

        {/* Hints Section - Only show when on a problem page */}
        {timerStatus.currentProblem && currentHints.hints.length > 0 && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Hints for {timerStatus.currentProblem}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {currentHints.hints.map((hint, index) => {
                const hintNumber = index + 1;
                const elapsedMinutes = Math.floor(timerStatus.elapsedSeconds / 60);
                const hintInterval = settings.timer?.hintIntervals?.[index] || [20, 25, 30][index];
                const isUnlocked = elapsedMinutes >= hintInterval;
                const isExpanded = expandedHint === hintNumber;

                return (
                  <div
                    key={hintNumber}
                    className={cn(
                      "rounded-lg border transition-all",
                      isUnlocked
                        ? "border-yellow-500/30 bg-yellow-500/10"
                        : "border-muted bg-muted/30 opacity-60"
                    )}
                  >
                    <button
                      className="w-full p-2 flex items-center justify-between text-left"
                      onClick={() => isUnlocked && setExpandedHint(isExpanded ? null : hintNumber)}
                      disabled={!isUnlocked}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isUnlocked ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground"
                        )}>
                          {hintNumber}
                        </span>
                        <span className="text-xs font-medium">
                          {isUnlocked ? `Hint ${hintNumber}` : `Unlocks at ${hintInterval}m`}
                        </span>
                      </div>
                      {isUnlocked && (
                        isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    {isExpanded && isUnlocked && (
                      <div className="px-3 pb-3 pt-1">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {hint}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              {!currentHints.loaded && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading hints...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mt-8 text-center">
        <p className="text-[10px] text-muted-foreground/60 font-medium">
          Focus on solving, not on shortcuts! 💪
        </p>
      </footer>
    </div>
  );
}

function OptionItem({ icon: Icon, label, checked, onChange, disabled }) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-lg transition-colors select-none",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"
    )} onClick={!disabled ? onChange : undefined}>
      <div className="flex items-center gap-3">
        <div className={cn("p-1.5 rounded-md bg-muted text-muted-foreground transition-colors", checked && "bg-primary/10 text-primary")}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={cn("h-4 w-4 rounded border flex items-center justify-center transition-colors",
        checked ? "bg-primary border-primary" : "border-input bg-background",
        disabled && "opacity-50"
      )}>
        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"><polyline points="20 6 9 17 4 12"></polyline></svg>}
      </div>
    </div>
  )
}

export default App;
