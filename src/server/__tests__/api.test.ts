import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
// We import the app from our server file
import { app } from '../../../server';

describe('Customer Feedback Ingestion Pipeline & Routing API', () => {
  beforeAll(async () => {
    // Ensure simulated DB is cleared or set to initial state for testing
    await request(app).post('/api/databases/clear');
  });

  it('should successfully ingest, redact credit card PII, and route positive feedback (Payload Test)', async () => {
    const payload = {
      feedback: 'I absolutely love this new banking interface! Excellent speed, though I was worried when I accidentally pasted my card number 4111-2222-3333-4444 into the chat. But overall, it is amazing!'
    };

    const response = await request(app)
      .post('/api/feedback')
      .send(payload)
      .set('Accept', 'application/json');

    // Verify response code
    expect(response.status).toBe(200);

    // Verify response structure
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('redactedText');
    expect(response.body).toHaveProperty('sentiment');
    expect(response.body).toHaveProperty('routedTo');
    expect(response.body).toHaveProperty('redactedPIICount');

    // Verify PII is redacted in the clean feedback
    expect(response.body.redactedText).not.toContain('4111-2222-3333-4444');
    expect(response.body.redactedText).toContain('[REDACTED]');

    // Verify routing is correct
    expect(response.body.sentiment).toBe('positive');
    expect(response.body.routedTo).toBe('Marketing');
    expect(response.body.redactedPIICount).toBeGreaterThanOrEqual(1);

    // Query databases to ensure it was saved to the marketing database
    const dbRes = await request(app).get('/api/databases');
    expect(dbRes.status).toBe(200);
    expect(dbRes.body.marketing.length).toBe(1);
    expect(dbRes.body.marketing[0].redactedText).toContain('[REDACTED]');
    expect(dbRes.body.marketing[0].redactedText).not.toContain('4111-2222-3333-4444');
  });

  it('should successfully ingest, redact composite PII, and route negative feedback (Composite Case)', async () => {
    const payload = {
      feedback: 'The portal is completely broken. I spent 2 hours trying to contact help at srivastava123.shrishti@gmail.com or by phone 123-456-7890. This is terrible service.'
    };

    const response = await request(app)
      .post('/api/feedback')
      .send(payload)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.sentiment).toBe('negative');
    expect(response.body.routedTo).toBe('Priority Support');

    // Both email and phone must be redacted
    expect(response.body.redactedText).not.toContain('srivastava123.shrishti@gmail.com');
    expect(response.body.redactedText).not.toContain('123-456-7890');
    expect(response.body.redactedText).toContain('[REDACTED]');
    expect(response.body.redactedPIICount).toBeGreaterThanOrEqual(2);

    // Query databases to ensure it was saved to the priority support database
    const dbRes = await request(app).get('/api/databases');
    expect(dbRes.body.prioritySupport.length).toBe(1);
    expect(dbRes.body.prioritySupport[0].routedTo).toBe('Priority Support');
  });

  it('should return a 400 Bad Request for an empty feedback payload (Edge Case Test)', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ feedback: '' })
      .set('Accept', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('is required');
  });

  it('should return a 400 Bad Request for missing body (Edge Case Test)', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({})
      .set('Accept', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should process and route sample_data.json correctly (Sample Data Test)', async () => {
    // Clear databases first
    await request(app).post('/api/databases/clear');

    const filePath = path.join(process.cwd(), 'src', 'data', 'sample_data.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const samples = JSON.parse(fileContent);

    for (const sample of samples) {
      const response = await request(app)
        .post('/api/feedback')
        .send({ feedback: sample.feedback })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('redactedText');
      expect(response.body).toHaveProperty('sentiment');
      expect(response.body).toHaveProperty('routedTo');
      
      // Ensure PII is redacted if there was PII
      if (sample.feedback.includes('4111-2222-3333-4444')) {
        expect(response.body.redactedText).not.toContain('4111-2222-3333-4444');
        expect(response.body.redactedText).toContain('[REDACTED]');
      }
      if (sample.feedback.includes('test.user@gmail.com')) {
        expect(response.body.redactedText).not.toContain('test.user@gmail.com');
        expect(response.body.redactedText).toContain('[REDACTED]');
      }
      if (sample.feedback.includes('123-45-6789')) {
        expect(response.body.redactedText).not.toContain('123-45-6789');
        expect(response.body.redactedText).toContain('[REDACTED]');
      }
      if (sample.feedback.includes('555-891-2045')) {
        expect(response.body.redactedText).not.toContain('555-891-2045');
        expect(response.body.redactedText).toContain('[REDACTED]');
      }
    }

    // Retrieve database state and verify entries are stored
    const dbRes = await request(app).get('/api/databases');
    expect(dbRes.status).toBe(200);
    
    // There are 4 samples: 1 Priority Support, 1 Marketing, 2 General Archive
    expect(dbRes.body.prioritySupport.length).toBe(1);
    expect(dbRes.body.marketing.length).toBe(1);
    expect(dbRes.body.generalArchive.length).toBe(2);
  });
});
