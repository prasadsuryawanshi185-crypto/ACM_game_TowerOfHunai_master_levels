// ============================================================
// DSA Launchpad — Tower of Hanoi Server
// Express + MongoDB backend for the Spider-Verse themed game
// ============================================================

require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();

// ==========================================
// CONFIGURATION
// ==========================================
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'dsa_launchpad';

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// DATABASE SETUP & CACHE
// ==========================================
let cachedClient = null;
let cachedDb = null;
let gameResultsCollection = null;
let leaderboardCache = { 3: [], 4: [], 5: [] };
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Connect to MongoDB. Supports serverless connection caching (Vercel).
 * Does NOT crash the server if connection fails.
 */
async function connectDB() {
  if (cachedClient && cachedDb && gameResultsCollection) {
    return; // Use cached connection in serverless environments
  }
  
  try {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB isn't available
      connectTimeoutMS: 5000,
    });
    await client.connect();
    
    cachedClient = client;
    cachedDb = client.db(DB_NAME);
    gameResultsCollection = cachedDb.collection('gameResults');

    // Create indexes for performance
    await gameResultsCollection.createIndex({ score: -1, timeTaken: 1 });
    await gameResultsCollection.createIndex({ participantName: 1, diskCount: 1, completedAt: -1 });

    console.log(`Connected to MongoDB database: ${DB_NAME}`);

    // Initial cache population
    await updateLeaderboardCache();

    // Handle connection loss
    client.on('close', () => {
      console.error('MongoDB connection lost');
      cachedClient = null;
      cachedDb = null;
      gameResultsCollection = null;
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('API endpoints will return 503 until database is available.');
    cachedClient = null;
    cachedDb = null;
    gameResultsCollection = null;
  }
}

/** Middleware: check if database is available, attempt lazy connect for serverless */
async function requireDB(req, res, next) {
  if (!gameResultsCollection) {
    await connectDB();
  }
  
  if (!gameResultsCollection) {
    return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  }
  next();
}

/**
 * Refresh the in-memory leaderboard cache from the database.
 * Called periodically and after every new submission.
 */
async function updateLeaderboardCache() {
  if (!gameResultsCollection) return;
  try {
    const fetchTop = async (diskCount) => {
      // Fetch all for the diskCount and sort in memory to safely handle older records missing 'level'
      const rawResults = await gameResultsCollection.find({ diskCount }).toArray();
      
      const mappedResults = rawResults.map(entry => ({
        ...entry,
        level: entry.level || 3 // Older master levels records default to 3
      }));

      // Sort Priority: Level (DESC) -> Score (DESC) -> Time Taken (ASC)
      mappedResults.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTaken || 0) - (b.timeTaken || 0);
      });

      const topResults = mappedResults.slice(0, 100); // Top 100
        
      return topResults.map((entry, index) => ({
        rank: index + 1,
        participantName: entry.participantName,
        participantId: entry.participantId,
        level: entry.level || 3, // Support new level property
        diskCount: entry.diskCount,
        moves: entry.moves,
        minimumMoves: entry.minimumMoves,
        timeTaken: entry.timeTaken,
        score: entry.score,
        completedAt: entry.completedAt,
        _id: entry._id,
      }));
    };

    leaderboardCache = {
      3: await fetchTop(3),
      4: await fetchTop(4),
      5: await fetchTop(5)
    };
    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error('Failed to update leaderboard cache:', error.message);
  }
}

// ==========================================
// SCORING LOGIC
// ==========================================

/**
 * Calculate score server-side for Master Levels (3 -> 4 -> 5 disks combined).
 * Never trust client-sent scores.
 *
 * Formula:
 *   minimumMoves = 53 (7 + 15 + 31)
 *   moveEfficiency = min(1, minimumMoves / max(1, moves))   [0..1]
 *   timeEfficiency = min(1, 300 / max(1, timeTaken))        [0..1]
 *   score = round((moveEfficiency * 0.7 + timeEfficiency * 0.3) * 1000)
 *
 * Score is capped at 1000.
 * 70% weight on move efficiency, 30% on time efficiency.
 * The 300s reference means completing all 3 levels in ≤5 minutes gives full time credit.
 */
function calculateScore(level, moves, timeTaken) {
  const minMoves = level === 1 ? 7 : level === 2 ? 22 : 53;
  const timeRef = level === 1 ? 60 : level === 2 ? 180 : 300;
  
  const moveEfficiency = Math.min(1, minMoves / Math.max(1, moves));
  const timeEfficiency = Math.min(1, timeRef / Math.max(1, timeTaken));
  const score = Math.round((moveEfficiency * 0.7 + timeEfficiency * 0.3) * 1000);
  
  return {
    minimumMoves: minMoves,
    score: Math.min(1000, score),
  };
}

// ==========================================
// API ROUTES
// ==========================================

// Health Check (always works, even without DB)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: gameResultsCollection ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Submit Game Result
app.post('/api/submit', requireDB, async (req, res) => {
  try {
    const { participantName, participantId, level, moves, timeTaken } = req.body;

    // --- VALIDATION ---
    if (!participantName || typeof participantName !== 'string' || participantName.trim().length < 2) {
      return res.status(400).json({ error: 'participantName must be at least 2 characters' });
    }

    const name = participantName.trim().substring(0, 50); // Cap at 50 chars
    const parsedLevel = parseInt(level, 10) || 3; // Default to 3 for final submission if not specified

    const parsedMoves = parseInt(moves, 10);
    const minMoves = parsedLevel === 1 ? 7 : parsedLevel === 2 ? 22 : 53;
    if (isNaN(parsedMoves) || parsedMoves < minMoves) {
      return res.status(400).json({ error: `moves must be at least ${minMoves} for Level ${parsedLevel}` });
    }

    const parsedTimeTaken = parseFloat(timeTaken);
    if (isNaN(parsedTimeTaken) || parsedTimeTaken <= 0 || parsedTimeTaken > 1200) {
      return res.status(400).json({ error: 'timeTaken must be between 1 and 1200 seconds' });
    }

    // --- UPSERT CHECK ---
    const filter = { participantName: name };
    const existing = await gameResultsCollection.findOne(filter);
    
    // Prevent older/duplicate requests from downgrading progress
    if (existing && existing.level > parsedLevel) {
      return res.status(200).json({ message: 'Higher level already recorded', ignored: true });
    }

    // --- CALCULATE SCORE ---
    const { minimumMoves, score } = calculateScore(parsedLevel, parsedMoves, parsedTimeTaken);
    const now = new Date();

    const resultDoc = {
      participantId: (participantId || '').trim().substring(0, 20) || null,
      diskCount: 5, // Keep diskCount = 5 to maintain compatibility with existing queries if any
      level: parsedLevel,
      moves: parsedMoves,
      minimumMoves,
      timeTaken: Math.round(parsedTimeTaken),
      score,
      completedAt: now.toISOString(),
      ipAddress: req.ip || 'unknown',
    };

    const update = {
      $set: resultDoc,
      $setOnInsert: { participantName: name, createdAt: now.toISOString() }
    };

    await gameResultsCollection.updateOne(filter, update, { upsert: true });

    // Refresh cache immediately
    await updateLeaderboardCache();

    // Find participant's rank in the updated cache
    const rank = leaderboardCache[5].findIndex(
      e => e.participantName === name
    ) + 1;

    res.status(201).json({
      message: 'Result submitted successfully',
      result: {
        participantName: name,
        level: resultDoc.level,
        moves: resultDoc.moves,
        minimumMoves: resultDoc.minimumMoves,
        timeTaken: resultDoc.timeTaken,
        score: resultDoc.score,
        completedAt: resultDoc.completedAt,
      },
      rank: rank > 0 ? rank : null,
    });
  } catch (error) {
    console.error('POST /api/submit error:', error.message);
    res.status(500).json({ error: 'Failed to submit result. Please try again.' });
  }
});

// Get Leaderboard (served from cache)
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (!gameResultsCollection) {
      await connectDB();
    }

    // Refresh cache if stale (but don't fail if DB is down — serve stale cache)
    if (gameResultsCollection && (!leaderboardCache[3] || Date.now() - lastCacheUpdate > CACHE_TTL)) {
      await updateLeaderboardCache();
    }

    // Strip _id from response
    const cleanCache = {
      3: (leaderboardCache[3] || []).map(({ _id, ipAddress, ...rest }) => rest),
      4: (leaderboardCache[4] || []).map(({ _id, ipAddress, ...rest }) => rest),
      5: (leaderboardCache[5] || []).map(({ _id, ipAddress, ...rest }) => rest)
    };

    res.json({
      leaderboard: cleanCache,
      lastUpdated: lastCacheUpdate ? new Date(lastCacheUpdate).toISOString() : null,
    });
  } catch (error) {
    console.error('GET /api/leaderboard error:', error.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get Specific Participant's Results
app.get('/api/leaderboard/:participantName', requireDB, async (req, res) => {
  try {
    const name = (req.params.participantName || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'participantName is required' });
    }

    const results = await gameResultsCollection
      .find({ participantName: name })
      .sort({ score: -1, timeTaken: 1 })
      .project({ ipAddress: 0 })
      .toArray();

    res.json({ results });
  } catch (error) {
    console.error('GET /api/leaderboard/:name error:', error.message);
    res.status(500).json({ error: 'Failed to fetch participant results' });
  }
});

// ==========================================
// SPA FALLBACK
// ==========================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// START SERVER / EXPORT FOR VERCEL
// ==========================================

if (process.env.VERCEL) {
  // ----------------------------------------------------
  // VERCEL SERVERLESS ENVIRONMENT
  // ----------------------------------------------------
  // In a serverless environment, Vercel handles the listening.
  // We don't use setInterval because background processes are frozen.
  // Connections and caching will happen lazily on requests.
  module.exports = app;
} else {
  // ----------------------------------------------------
  // LOCAL / STANDARD NODE ENVIRONMENT
  // ----------------------------------------------------
  async function startServer() {
    await connectDB();

    // Periodic cache refresh (if DB is connected)
    setInterval(() => {
      if (gameResultsCollection) {
        updateLeaderboardCache();
      }
    }, CACHE_TTL);

    app.listen(PORT, () => {
      console.log(`DSA Launchpad — Tower of Hanoi server running on http://localhost:${PORT}`);
      console.log(`Game:        http://localhost:${PORT}/`);
      console.log(`Leaderboard: http://localhost:${PORT}/leaderboard.html`);
      console.log(`API Health:  http://localhost:${PORT}/api/health`);
    });
  }

  startServer();
}
