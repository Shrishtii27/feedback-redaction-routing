import fs from 'fs';
import path from 'path';
import { PiiItem } from './scrubber';

export interface FeedbackEntry {
  submissionId: string;
  clientName: string;
  originalText: string;
  originalTextSummary: string;
  redactedText: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  sentimentScore: number;
  destinationDatabase: 'Priority Support Database' | 'Marketing Database';
  piiDetected: PiiItem[];
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
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
  }
}

export function readDb(): FeedbackEntry[] {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading simulated DB, resetting:', err);
    return [];
  }
}

export function writeDb(db: FeedbackEntry[]) {
  ensureDbExists();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Error writing to simulated DB:', err);
  }
}

export function saveFeedbackEntry(entry: FeedbackEntry) {
  const db = readDb();
  db.unshift(entry);
  writeDb(db);
}

export function clearDb() {
  writeDb([]);
  return [];
}
