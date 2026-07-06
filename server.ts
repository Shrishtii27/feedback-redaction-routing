import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';

// Import our microservice modules
import { regexScrub, maskOriginalText } from './src/server/scrubber';
import { analyzeFeedback } from './src/server/ai';
import { readDb, saveFeedbackEntry, clearDb, FeedbackEntry } from './src/server/db';

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure database folders exist
const dataDir = path.join(process.cwd(), 'src', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ==================== API ENDPOINTS ====================

// Ingestion API: Recieves feedback, redacts PII, sentiment-analyzes and routes
app.post('/api/feedback', async (req, res) => {
  try {
    const { feedback } = req.body;

    // Validate request
    if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
      return res.status(400).json({
        error: 'Feedback message is required and cannot be empty.'
      });
    }

    // Phase 2 Step 1: Deterministic regex scrubbing (catches credit cards, emails, phones)
    const regexResult = regexScrub(feedback);

    // Phase 2 Step 2: Contextual AI scrubbing and Sentiment Analysis using Open Source LLM / Fallback
    const aiResult = await analyzeFeedback(regexResult.cleanText);

    // Determine the database routing destination based on sentiment
    let routedTo: 'Priority Support' | 'Marketing' | 'General Archive' = 'General Archive';
    if (aiResult.sentiment === 'negative') {
      routedTo = 'Priority Support';
    } else if (aiResult.sentiment === 'positive') {
      routedTo = 'Marketing';
    }

    // Assemble the clean, compliance-safe entry
    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalTextSummary: maskOriginalText(feedback), // Masked safely for operators, never stores raw PII
      redactedText: aiResult.redactedText,
      sentiment: aiResult.sentiment,
      sentimentScores: aiResult.sentimentScores,
      redactedPIICount: regexResult.redactedCount + aiResult.detectedCategories.length,
      detectedCategories: Array.from(new Set([...regexResult.categories, ...aiResult.detectedCategories])),
      routedTo,
      timestamp: new Date().toISOString()
    };

    // Save to the appropriate simulated database
    saveFeedbackEntry(entry);

    // Return the response as required
    return res.status(200).json(entry);
  } catch (err: any) {
    console.error('Error in feedback ingestion endpoint:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred.'
    });
  }
});

// GET simulated databases
app.get('/api/databases', (req, res) => {
  try {
    const db = readDb();
    res.json(db);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read database', message: err.message });
  }
});

// CLEAR simulated databases
app.post('/api/databases/clear', (req, res) => {
  try {
    const emptyDb = clearDb();
    res.json({ message: 'Databases cleared successfully', databases: emptyDb });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clear database', message: err.message });
  }
});

// GET Business Requirements Document (BRD) content
app.get('/api/brd', (req, res) => {
  try {
    const brdPath = path.join(process.cwd(), 'src', 'data', 'BRD.md');
    if (fs.existsSync(brdPath)) {
      const content = fs.readFileSync(brdPath, 'utf8');
      res.json({ content });
    } else {
      res.status(404).json({ error: 'BRD document not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read BRD', message: err.message });
  }
});

// Programmatic integration test runner endpoint
app.post('/api/run-tests', (req, res) => {
  // Execute vitest
  exec('npx vitest run --reporter=json', (error, stdout, stderr) => {
    // Note: Vitest might return exit code 1 if tests fail, but we still want to capture and parse the json
    let parsedResults = null;
    try {
      if (stdout) {
        parsedResults = JSON.parse(stdout);
      }
    } catch (parseErr) {
      console.error('Failed to parse test output:', parseErr);
    }

    res.json({
      success: !error,
      stdout: stdout || '',
      stderr: stderr || '',
      results: parsedResults
    });
  });
});

// ==================== VITE MIDDLEWARE / FRONTEND ====================

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    // Development mode: mount Vite
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted for development.');
  } else {
    // Production / Test mode: serve build artifacts
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('Serving production build files from /dist.');
    } else {
      console.warn('/dist directory not found. Frontend serving will not be available until built.');
    }
  }

  // Start listening only if we are not in testing mode
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

// Start the server only if we are not running under the Vitest test runner
if (process.env.VITEST !== 'true') {
  bootstrap().catch((err) => {
    console.error('Failed to bootstrap server:', err);
  });
}
