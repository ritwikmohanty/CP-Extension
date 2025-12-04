# CP Focus Mode - Complete Codebase

## Overview

CP Focus Mode is a Chrome extension ecosystem for competitive programmers. It blocks distractions on LeetCode, provides AI-powered timed hints, and tracks sessions.

Components:
- Chrome Extension (Popup UI + content scripts)
- Background Service (Settings + timer)
- Backend Server (AI hint generation + caching)

## Core Features

### Focus Mode Blocking
- Editorial tabs and solutions
- Community solutions and discussions
- Hint buttons and topic tags
- AI assistants (LeetCode's "Ask Leet", ChatGPT, Claude, etc.)

### Automatic Problem Timer
- Starts on problem page load
- Tracks elapsed time
- Persists across refreshes
- Draggable timer display

### AI-Powered Timed Hints
- 0-20 minutes: No hints
- 3 progressive AI-generated hints unlock at configurable intervals
- Context-aware from problem data
- Backend cached per problem

### Settings Management
- Per-platform toggles
- Custom hint intervals
- Display options

## Project Structure

```
CP-Extension/
├── cp-extension/                      # Chrome Extension
│   ├── public/
│   │   ├── manifest.json              # Extension manifest (v3)
│   │   ├── background.js              # Service worker
│   │   ├── content-scripts/
│   │   │   ├── leetcode.js            # Blocking logic
│   │   │   └── leetcode.css           # Hiding styles
│   │   ├── icons/                     # Extension icons
│   │   └── index.html                 # Popup template
│   ├── src/
│   │   ├── App.jsx                    # Main popup component
│   │   ├── index.css                  # Tailwind + custom styles
│   │   ├── components/ui/             # UI components
│   │   ├── lib/utils.js               # Utilities
│   │   └── main.jsx                   # React entry
│   ├── scripts/
│   │   ├── generate-icons.js          # Icon generation
│   │   └── copy-extension-files.js    # Build helper
│   ├── vite.config.js                 # Vite config
│   ├── package.json
│   └── dist/                          # Build output
│
├── cp-extension-backend/              # Backend Server
│   ├── server.js                      # Express + Gemini AI
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
└── README.md                          # This file
```

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Vite, Lucide React, Radix UI
- **Backend**: Express.js, Google Gemini AI, LeetCode GraphQL API
- **Build**: Chrome Manifest V3, npm

## Quick Start

### Prerequisites
- Node.js 16+, npm
- Chrome browser
- Gemini API key

### Setup

```bash
# Clone repo
git clone https://github.com/yourusername/cp-focus-mode.git
cd CP-Extension

# Install extension
cd cp-extension
npm install

# Install backend
cd ../cp-extension-backend
npm install
```

### Backend Setup

```bash
cd cp-extension-backend
cp .env.example .env
# Add GEMINI_API_KEY to .env
npm start
```

### Build Extension

```bash
cd ../cp-extension
npm run build:extension
```

### Load in Chrome

1. `chrome://extensions/` → Developer mode → Load unpacked → Select `dist/`

## Key Files Explained

### Extension
- `public/manifest.json`: Manifest with permissions and scripts
- `public/background.js`: Service worker for settings, timer, hints proxy
- `public/content-scripts/leetcode.js`: Blocks elements, manages timer, loads hints
- `src/App.jsx`: Popup UI with settings and hints viewer
- `src/index.css`: Tailwind config + custom styles

### Backend
- `server.js`: Express server with Gemini AI integration, MongoDB caching

## How It Works

### User Opens Problem
1. Content script loads settings
2. Blocks elements if enabled
3. Starts timer via background service
4. Loads hints from backend
5. Shows timer indicator
6. Unlocks hints at intervals

### Hint Generation
1. Backend checks MongoDB cache
2. If miss, calls Gemini with problem data
3. Generates 3 progressive hints
4. Caches and returns

## Configuration

### Backend (.env)
```
GEMINI_API_KEY=your_key
PORT=3000
MONGODB_URI=mongodb://localhost:27017/cp-focus-hints
```

## Development

```bash
# Extension
cd cp-extension
npm run dev  # Hot-reload popup
npm run build:extension  # Build

# Backend
cd cp-extension-backend
npm run dev  # Auto-reload
```

## Troubleshooting

- Backend: Check GEMINI_API_KEY, MongoDB connection
- Extension: Enable in popup, refresh page, check console
- Hints: Verify backend running, check CORS

## License

MIT
