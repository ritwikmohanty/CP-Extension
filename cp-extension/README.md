# CP Focus Mode - Chrome Extension

A Chrome extension designed to help competitive programmers focus on problem-solving by blocking distracting elements on coding platforms.

## Features

### 🎯 Focus Mode
- **Block Editorial** - Hides solution/editorial tabs to prevent peeking at solutions
- **Block Solutions** - Hides community solutions and discussions about approaches
- **Block Hints** - Removes hint buttons to encourage independent thinking
- **Block Discussions** - Hides discussion sections and comment counts
- **Block Topics** - Hides topic tags that might reveal the algorithm needed
- **Block AI** - Comprehensive blocking of all AI assistants including:
  - LeetCode's "Ask Leet" AI
  - AI chat tabs and panels
  - Any ChatGPT, Claude, Copilot, Gemini integrations

### ⏱️ Automatic Timer
- Timer automatically starts when you open a problem page
- Tracks time spent on each problem from the moment you open it
- Timer persists across page refreshes and browser sessions
- Visual timer display in the top-right corner of the page
- Draggable indicator with option to hide it

### 💡 AI-Powered Timed Hints System
- **First 20 minutes**: Pure focus time with no hints available
- **Configurable hint intervals**: Set when each of the 3 hints appears (minimum 5-minute gap)
- **AI-Generated Hints**: Uses Google's Gemini AI to generate progressive, helpful hints
- **Context-Aware**: Hints are generated based on:
  - Problem description and constraints
  - LeetCode's native hints (when available)
  - Topic tags
  - Solution approach (without revealing the code)
- **Backend Caching**: Hints are stored server-side, so the same hints are reused for all users on the same problem
- **Visual Hint Icons**: Hint icons appear on the page when unlocked, click to reveal
- **Popup Integration**: View all hints for the current problem in the extension popup

### 🎨 Display Options
- Toggle the focus mode indicator visibility
- Draggable timer position
- Quick close button on the indicator

## Supported Platforms

Currently supported:
- ✅ **LeetCode** (leetcode.com)

Coming soon:
- 🔜 Codeforces
- 🔜 HackerRank
- 🔜 CodeChef
- 🔜 AtCoder

## Architecture

This extension uses a client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Popup UI   │  │  Background  │  │   Content    │      │
│  │   (React)    │  │   Service    │  │   Script     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                   │              │
└───────────────────────────┼───────────────────┼──────────────┘
                            │                   │
                            │   GraphQL API     │
                            │                   ▼
                            │         ┌──────────────────┐
                            │         │  LeetCode API    │
                            │         │  (Problem Data)  │
                            │         └──────────────────┘
                            │
                            ▼
                  ┌──────────────────────┐
                  │   Backend Server     │
                  │  ┌────────────────┐  │
                  │  │  Gemini AI     │  │
                  │  │  (Hints Gen)   │  │
                  │  └────────────────┘  │
                  │  ┌────────────────┐  │
                  │  │  Hints Cache   │  │
                  │  │  (JSON File)   │  │
                  │  └────────────────┘  │
                  └──────────────────────┘
```

## Installation

### 1. Backend Server Setup

The backend server is required for AI-powered hint generation.

```bash
cd cp-extension-backend
npm install
cp .env.example .env
# Add your Gemini API key to .env
npm start
```

Get your Gemini API key from: https://makersuite.google.com/app/apikey

### 2. Chrome Extension Setup

```bash
cd cp-extension
npm install
npm run build:extension
```

Load in Chrome:
- Open `chrome://extensions/`
- Enable "Developer mode" (toggle in top right)
- Click "Load unpacked"
- Select the `dist` folder

### Configuration

Update the backend URL in `public/content-scripts/leetcode.js`:
```javascript
const BACKEND_URL = 'http://localhost:3000'; // or your deployed URL
```

## Usage

1. **Start the backend server** (required for AI hints)
2. **Enable the extension**: Click the extension icon and toggle "Enable Focus Mode"
3. **Configure blocking**: Toggle individual blocking options as needed
4. **Set hint timings**: Customize when each hint unlocks (minimum 20 mins for first hint)
5. **Open a problem**: Navigate to any LeetCode problem page
6. **Focus!**: Distracting elements are automatically hidden and the timer starts
7. **Hints appear**: After the configured time, hint icons appear - click to reveal

## Project Structure

```
CP-Extension/
├── cp-extension/               # Chrome Extension
│   ├── public/
│   │   ├── manifest.json       # Chrome extension manifest
│   │   ├── background.js       # Service worker for settings & timer
│   │   └── content-scripts/
│   │       ├── leetcode.js     # LeetCode-specific content script
│   │       └── leetcode.css    # Styles for hiding elements
│   ├── src/
│   │   ├── App.jsx             # Popup UI component
│   │   └── components/         # React components
│   └── dist/                   # Built extension (load this in Chrome)
│
└── cp-extension-backend/       # Backend Server
    ├── server.js               # Express server with Gemini AI
    ├── hints_cache.json        # Cached hints (auto-generated)
    └── .env                    # API keys (create from .env.example)
```

## Development

```bash
# Extension development
cd cp-extension
npm install
npm run dev           # Development mode (for popup UI)
npm run build:extension  # Build for production

# Backend development
cd cp-extension-backend
npm install
npm run dev           # Development mode with auto-reload
npm start             # Production mode
```

## Tech Stack

- **React 19** - Popup UI
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Chrome Extension Manifest V3** - Modern extension format
- **Express.js** - Backend server
- **Google Gemini AI** - Hint generation
- **LeetCode GraphQL API** - Problem data extraction

## Deployment

### Backend Deployment

For production, deploy the backend to a cloud service:

**Railway:**
1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set the root directory to `cp-extension-backend`
4. Add the `GEMINI_API_KEY` environment variable
5. Deploy!

**Render:**
1. Create a new Web Service on [Render](https://render.com)
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables

After deployment, update `BACKEND_URL` in the extension's content script.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for your own projects!

## Author

Created by [Ritwik Mohanty](https://github.com/ritwikmohanty)