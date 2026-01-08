/**
 * CP Focus Mode Backend Server
 * Generates and caches hints for LeetCode problems using Gemini AI + MongoDB
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cp-focus-hints";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Connect to MongoDB
mongoose.connect(MONGODB_URI).catch((err) => {
  console.error("MongoDB connection failed:", err.message);
  console.error("Make sure MongoDB is running: mongod");
});

// Define Hints Schema
const hintsSchema = new mongoose.Schema({
  titleSlug: { type: String, unique: true, required: true },
  title: String,
  difficulty: String,
  hints: [String],
  generatedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Hints = mongoose.model("Hints", hintsSchema);

// Define Submission Schema


// CORS configuration - handle Private Network Access (PNA) preflight
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "10mb" }));

/**
 * Generate hints using Gemini AI
 */
async function generateHints(problemData) {
  const { title, titleSlug, content, difficulty, hints, topicTags, solution } =
    problemData;

  // Build the prompt
  const topicsStr = topicTags?.map((t) => t.name).join(", ") || "Not specified";
  const nativeHintsStr =
    hints?.length > 0 ? hints.join("\n") : "No native hints available";

  // Clean HTML from content
  const cleanContent =
    content
      ?.replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "";

  // Extract solution approach if available (without revealing full code)
  let solutionApproach = "";
  if (solution?.body) {
    // Try to extract just the approach/explanation, not the code
    const approachMatch =
      solution.body.match(/## Approach[^#]*/i) ||
      solution.body.match(/### Approach[^#]*/i) ||
      solution.body.match(/## Solution[^#]*/i);
    if (approachMatch) {
      solutionApproach = approachMatch[0]
        .replace(/<[^>]*>/g, " ")
        .substring(0, 500);
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

${solutionApproach ? `Solution Approach Reference:\n${solutionApproach}` : ""}

Generate the hints in the following JSON format:
{
  "hint1": "Your first hint here",
  "hint2": "Your second hint here", 
  "hint3": "Your third hint here"
}

Only respond with the JSON object, nothing else.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return [parsed.hint1, parsed.hint2, parsed.hint3];
    }

    throw new Error("Failed to parse Gemini response");
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

/**
 * POST /api/hints
 * Generate or retrieve cached hints for a problem
 */
app.post("/api/hints", async (req, res) => {
  try {
    const { titleSlug, problemData } = req.body;

    if (!titleSlug) {
      return res.status(400).json({ error: "titleSlug is required" });
    }

    // Check MongoDB cache first
    let cachedRecord = await Hints.findOne({ titleSlug });
    if (cachedRecord) {
      return res.json({
        hints: cachedRecord.hints,
        cached: true,
        generatedAt: cachedRecord.generatedAt,
      });
    }

    // If no problem data provided, we can't generate
    if (!problemData) {
      return res.status(400).json({
        error: "problemData is required for first-time hint generation",
        cached: false,
      });
    }

    // Generate new hints
    const hints = await generateHints(problemData);

    // Save to MongoDB
    const newRecord = new Hints({
      titleSlug,
      title: problemData.title,
      difficulty: problemData.difficulty,
      hints,
      generatedAt: new Date(),
    });

    await newRecord.save();

    res.json({
      hints,
      cached: false,
      generatedAt: newRecord.generatedAt,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate hints",
      message: error.message,
    });
  }
});

/**
 * GET /api/hints/:titleSlug
 * Get cached hints for a problem (if available)
 */
app.get("/api/hints/:titleSlug", async (req, res) => {
  try {
    const { titleSlug } = req.params;

    const record = await Hints.findOne({ titleSlug });
    if (record) {
      return res.json({
        hints: record.hints,
        cached: true,
        generatedAt: record.generatedAt,
      });
    }

    res.status(404).json({
      error: "Hints not found for this problem",
      cached: false,
    });
  } catch (error) {
    res.status(500).json({ error: "Database error", message: error.message });
  }
});

/**
 * GET /api/stats
 * Get cache statistics
 */
app.get("/api/stats", async (req, res) => {
  try {
    const totalProblems = await Hints.countDocuments();
    const problems = await Hints.find(
      {},
      { titleSlug: 1, title: 1, difficulty: 1, generatedAt: 1 }
    );

    res.json({
      cachedProblems: totalProblems,
      problems: problems.map((p) => ({
        slug: p.titleSlug,
        title: p.title,
        difficulty: p.difficulty,
        generatedAt: p.generatedAt
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Database error", message: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Define Submission Schema
const submissionSchema = new mongoose.Schema({
  submissionId: { type: String, unique: true, required: true },
  username: { type: String, required: true }, // Added username
  title: String,
  titleSlug: String,
  timestamp: Date,
  status: String,
  lang: String,
  runtime: String,
  memory: String,
  code: String, // Optional
  fetchedAt: { type: Date, default: Date.now }
});

const Submission = mongoose.model('Submission', submissionSchema);

/**
 * POST /api/submissions
 * Store user submissions
 */
app.post('/api/submissions', async (req, res) => {
  try {
    const { submissions, username } = req.body;

    if (!Array.isArray(submissions)) {
      return res.status(400).json({ error: 'submissions array is required' });
    }

    if (!username) {
        return res.status(400).json({ error: 'username is required' });
    }

    let upserted = 0;

    // Process in bulk
    const operations = submissions.map(sub => ({
      updateOne: {
        filter: { submissionId: sub.id },
        update: {
          $set: {
            submissionId: sub.id,
            username: username,
            title: sub.title,
            titleSlug: sub.title_slug,
            timestamp: new Date(parseInt(sub.timestamp) * 1000),
            status: sub.status_display,
            lang: sub.lang,
            runtime: sub.runtime,
            memory: sub.memory,
            // url: sub.url
          }
        },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      const result = await Submission.bulkWrite(operations);
      upserted = result.upsertedCount + result.modifiedCount;
    }

    res.json({
      message: 'Submissions synced successfully',
      count: upserted
    });

  } catch (error) {
    console.error('Submission sync error:', error);
    res.status(500).json({ error: 'Failed to sync submissions', message: error.message });
  }

});

// Start server
app.listen(PORT, async () => {
  // Wait for MongoDB connection
  if (mongoose.connection.readyState === 1) {
    const count = await Hints.countDocuments();
    console.log(`CP Focus Backend running on port ${PORT} with MongoDB`);
  } else {
    console.log(
      `CP Focus Backend running on port ${PORT} (MongoDB connecting...)`
    );
  }
});
