import fs from 'fs';
import path from 'path';

export interface FeedbackEntry {
  id: string;
  originalTextSummary: string; // Masked version of original text for audit trails, never full PII
  redactedText: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScores: {
    positive: number;
    negative: number;
    neutral: number;
  };
  redactedPIICount: number;
  detectedCategories: string[];
  routedTo: 'Priority Support' | 'Marketing' | 'General Archive';
  timestamp: string;
}

const DB_FILE = path.join(process.cwd(), 'src', 'data', 'db.json');

// Ensure database file exists
function ensureDbExists() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      prioritySupport: [],
      marketing: [],
      generalArchive: []
    }, null, 2));
  }
}

interface DbSchema {
  prioritySupport: FeedbackEntry[];
  marketing: FeedbackEntry[];
  generalArchive: FeedbackEntry[];
}

export function readDb(): DbSchema {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading simulated DB, resetting:', err);
    return { prioritySupport: [], marketing: [], generalArchive: [] };
  }
}

export function writeDb(db: DbSchema) {
  ensureDbExists();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Error writing to simulated DB:', err);
  }
}

export function saveFeedbackEntry(entry: FeedbackEntry) {
  const db = readDb();
  if (entry.routedTo === 'Priority Support') {
    db.prioritySupport.unshift(entry);
  } else if (entry.routedTo === 'Marketing') {
    db.marketing.unshift(entry);
  } else {
    db.generalArchive.unshift(entry);
  }
  writeDb(db);
}

export function clearDb() {
  const emptyDb = {
    prioritySupport: [],
    marketing: [],
    generalArchive: []
  };
  writeDb(emptyDb);
  return emptyDb;
}
