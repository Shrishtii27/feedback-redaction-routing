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
    const { feedbackText, clientName } = req.body;

    // Validate request
    if (!feedbackText || typeof feedbackText !== 'string' || feedbackText.trim().length < 3) {
      return res.status(400).json({
        error: 'Validation failed: feedbackText is empty or malformed'
      });
    }

    const channel = clientName || 'Web Portal';

    // Phase 1: Deterministic regex scrubbing
    const regexResult = regexScrub(feedbackText);

    // Phase 2: Contextual AI scrubbing and Sentiment Analysis using Open Source LLM / Fallback
    const aiResult = await analyzeFeedback(regexResult.cleanText);

    // Determine the database routing destination based on sentiment
    const destinationDatabase = aiResult.sentiment === 'Positive' ? 'Marketing Database' : 'Priority Support Database';

    // Combine piiDetected items
    const piiDetected = [...regexResult.piiDetected, ...aiResult.piiDetected];

    // Assemble the clean, compliance-safe entry matching target app
    const entry: FeedbackEntry = {
      submissionId: `fb-${Math.random().toString(36).substring(2, 11)}`,
      clientName: channel,
      originalText: feedbackText,
      originalTextSummary: maskOriginalText(feedbackText),
      redactedText: aiResult.redactedText,
      sentiment: aiResult.sentiment,
      sentimentScore: aiResult.sentimentScore,
      destinationDatabase,
      piiDetected,
      timestamp: new Date().toISOString()
    };

    // Save to the appropriate simulated database
    saveFeedbackEntry(entry);

    // Return the response as required
    return res.status(200).json({
      status: 'success',
      data: entry
    });
  } catch (err: any) {
    console.error('Error in feedback ingestion endpoint:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred.'
    });
  }
});

// GET database history logs
app.get('/api/feedback/history', (req, res) => {
  try {
    const db = readDb();
    res.json({
      status: 'success',
      data: db
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read database', message: err.message });
  }
});

// GET database stats telemetry
app.get('/api/feedback/stats', (req, res) => {
  try {
    const history = readDb();
    const totalSubmissions = history.length;
    const priorityCount = history.filter(x => x.destinationDatabase === 'Priority Support Database').length;
    const marketingCount = history.filter(x => x.destinationDatabase === 'Marketing Database').length;
    
    // Sum of redacted PII items across all logs
    const totalRedactions = history.reduce((sum, entry) => sum + entry.piiDetected.length, 0);

    // Compute counts by PII category type
    const piiTypeCounts: Record<string, number> = {
      EMAIL: 0,
      PHONE: 0,
      CREDIT_CARD: 0,
      HEALTH_ID: 0,
      NAME: 0,
      ADDRESS: 0
    };

    history.forEach(entry => {
      entry.piiDetected.forEach(item => {
        if (piiTypeCounts[item.type] !== undefined) {
          piiTypeCounts[item.type]++;
        } else {
          piiTypeCounts[item.type] = 1;
        }
      });
    });

    res.json({
      totalSubmissions,
      priorityCount,
      marketingCount,
      totalRedactions,
      piiTypeCounts
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate stats', message: err.message });
  }
});

// CLEAR simulated databases
app.post('/api/feedback/clear', (req, res) => {
  try {
    clearDb();
    res.json({ status: 'success', message: 'Simulated databases purged successfully' });
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
