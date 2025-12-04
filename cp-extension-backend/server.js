/**
 * CP Focus Mode Backend Server
 * Generates and caches hints for LeetCode problems using Gemini AI
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Cache file path
const CACHE_FILE = path.join(__dirname, 'hints_cache.json');

// Load cache from file
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return {};
}

// Save cache to file
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// In-memory cache (loaded from file on startup)
let hintsCache = loadCache();

/**
 * Generate hints using Gemini AI
 */
async function generateHints(problemData) {
  const { title, titleSlug, content, difficulty, hints, topicTags, solution } = problemData;

  // Build the prompt
  const topicsStr = topicTags?.map(t => t.name).join(', ') || 'Not specified';
  const nativeHintsStr = hints?.length > 0 ? hints.join('\n') : 'No native hints available';
  
  // Clean HTML from content
  const cleanContent = content?.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '';
  
  // Extract solution approach if available (without revealing full code)
  let solutionApproach = '';
  if (solution?.body) {
    // Try to extract just the approach/explanation, not the code
    const approachMatch = solution.body.match(/## Approach[^#]*/i) || 
                          solution.body.match(/### Approach[^#]*/i) ||
                          solution.body.match(/## Solution[^#]*/i);
    if (approachMatch) {
      solutionApproach = approachMatch[0].replace(/<[^>]*>/g, ' ').substring(0, 500);
    }
  }

  const prompt = `You are a competitive programming mentor. Generate exactly 3 progressive hints for the following LeetCode problem. 

IMPORTANT RULES:
1. Hints should guide the student to the solution WITHOUT revealing it completely
2. Each hint should be more specific than the previous one
3. NEVER include actual code or pseudocode
4. NEVER reveal the complete algorithm name directly in early hints
5. Hint 1: Very general - identify the problem pattern or key observation
6. Hint 2: More specific - suggest the data structure or technique to consider
7. Hint 3: Most detailed - provide the key insight needed to implement, but not the implementation itself
8. Keep each hint to 1-3 sentences maximum
9. Use encouraging language

Problem: ${title}
Difficulty: ${difficulty}
Topics: ${topicsStr}

Problem Description (summary):
${cleanContent.substring(0, 1000)}

Native LeetCode Hints (use these as reference):
${nativeHintsStr}

${solutionApproach ? `Solution Approach Reference:\n${solutionApproach}` : ''}

Generate the hints in the following JSON format:
{
  "hint1": "Your first hint here",
  "hint2": "Your second hint here", 
  "hint3": "Your third hint here"
}

Only respond with the JSON object, nothing else.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return [parsed.hint1, parsed.hint2, parsed.hint3];
    }
    
    throw new Error('Failed to parse Gemini response');
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * POST /api/hints
 * Generate or retrieve cached hints for a problem
 */
app.post('/api/hints', async (req, res) => {
  try {
    const { titleSlug, problemData } = req.body;

    if (!titleSlug) {
      return res.status(400).json({ error: 'titleSlug is required' });
    }

    // Check cache first
    if (hintsCache[titleSlug]) {
      console.log(`Cache hit for: ${titleSlug}`);
      return res.json({
        hints: hintsCache[titleSlug].hints,
        cached: true,
        generatedAt: hintsCache[titleSlug].generatedAt
      });
    }

    // If no problem data provided, we can't generate
    if (!problemData) {
      return res.status(400).json({ 
        error: 'problemData is required for first-time hint generation',
        cached: false
      });
    }

    console.log(`Generating hints for: ${titleSlug}`);
    
    // Generate new hints
    const hints = await generateHints(problemData);
    
    // Cache the hints
    hintsCache[titleSlug] = {
      hints,
      generatedAt: new Date().toISOString(),
      title: problemData.title,
      difficulty: problemData.difficulty
    };
    
    // Save to file
    saveCache(hintsCache);
    console.log(`Hints cached for ${titleSlug}. Total cached problems: ${Object.keys(hintsCache).length}`);
    
    res.json({
      hints,
      cached: false,
      generatedAt: hintsCache[titleSlug].generatedAt
    });

  } catch (error) {
    console.error('Error generating hints:', error);
    res.status(500).json({ 
      error: 'Failed to generate hints',
      message: error.message
    });
  }
});

/**
 * GET /api/hints/:titleSlug
 * Get cached hints for a problem (if available)
 */
app.get('/api/hints/:titleSlug', (req, res) => {
  const { titleSlug } = req.params;
  
  if (hintsCache[titleSlug]) {
    return res.json({
      hints: hintsCache[titleSlug].hints,
      cached: true,
      generatedAt: hintsCache[titleSlug].generatedAt
    });
  }
  
  res.status(404).json({ 
    error: 'Hints not found for this problem',
    cached: false
  });
});

/**
 * GET /api/stats
 * Get cache statistics
 */
app.get('/api/stats', (req, res) => {
  const problemCount = Object.keys(hintsCache).length;
  res.json({
    cachedProblems: problemCount,
    problems: Object.keys(hintsCache).map(slug => ({
      slug,
      title: hintsCache[slug].title,
      difficulty: hintsCache[slug].difficulty,
      generatedAt: hintsCache[slug].generatedAt
    }))
  });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cachedProblems: Object.keys(hintsCache).length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`CP Focus Backend running on port ${PORT}`);
  console.log(`Cached problems: ${Object.keys(hintsCache).length}`);
});
