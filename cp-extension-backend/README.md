# CP Focus Backend Server

Backend server for the CP Focus Mode Chrome extension. It generates and caches hints for LeetCode problems using the Gemini AI API.

## Features

- **AI-Powered Hints**: Uses Google's Gemini AI to generate progressive, helpful hints
- **Caching**: Stores generated hints to avoid redundant API calls
- **Problem Context Aware**: Uses problem description, topics, native hints, and solution approach to generate relevant hints

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_api_key_here
   PORT=3000
   ```

   Get your API key from: https://makersuite.google.com/app/apikey

4. Start the server:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### POST /api/hints
Generate or retrieve cached hints for a problem.

**Request Body:**
```json
{
  "titleSlug": "two-sum",
  "problemData": {
    "title": "Two Sum",
    "titleSlug": "two-sum",
    "content": "<p>Given an array...</p>",
    "difficulty": "Easy",
    "hints": ["Hint 1", "Hint 2"],
    "topicTags": [{"name": "Array"}, {"name": "Hash Table"}],
    "solution": { "body": "..." }
  }
}
```

**Response:**
```json
{
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "cached": false,
  "generatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/hints/:titleSlug
Get cached hints for a problem (if available).

### GET /api/stats
Get cache statistics.

### GET /health
Health check endpoint.

### Deploy to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
