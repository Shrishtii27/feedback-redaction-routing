import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
// We import the app from our server file
import { app } from '../../../server';

describe('Customer Feedback Ingestion Pipeline & Routing API', () => {
  beforeAll(async () => {
    // Ensure simulated DB is cleared or set to initial state for testing
    await request(app).post('/api/feedback/clear');
  });

  it('should successfully ingest, redact credit card PII, and route positive feedback (Payload Test)', async () => {
    const payload = {
      feedbackText: 'I absolutely love this new banking interface! Excellent speed, though I was worried when I accidentally pasted my card number 4111-2222-3333-4444 into the chat. But overall, it is amazing!',
      clientName: 'Web Portal'
    };

    const response = await request(app)
      .post('/api/feedback')
      .send(payload)
      .set('Accept', 'application/json');

    // Verify response code
    expect(response.status).toBe(200);

    // Verify response structure
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('data');
    
    const data = response.body.data;
    expect(data).toHaveProperty('submissionId');
    expect(data).toHaveProperty('redactedText');
    expect(data).toHaveProperty('sentiment');
    expect(data).toHaveProperty('destinationDatabase');
    expect(data).toHaveProperty('piiDetected');

    // Verify PII is redacted in the clean feedback
    expect(data.redactedText).not.toContain('4111-2222-3333-4444');
    expect(data.redactedText).toContain('[REDACTED_CARD]');

    // Verify routing is correct
    expect(data.sentiment).toBe('Positive');
    expect(data.destinationDatabase).toBe('Marketing Database');
    expect(data.piiDetected.length).toBeGreaterThanOrEqual(1);

    // Query history to ensure it was saved
    const historyRes = await request(app).get('/api/feedback/history');
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.data[0].redactedText).toContain('[REDACTED_CARD]');
    expect(historyRes.body.data[0].redactedText).not.toContain('4111-2222-3333-4444');
  });

  it('should successfully ingest, redact composite PII, and route negative feedback (Composite Case)', async () => {
    const payload = {
      feedbackText: 'The portal is completely broken. I spent 2 hours trying to contact help at srivastava123.shrishti@gmail.com or by phone 123-456-7890. This is terrible service.',
      clientName: 'iOS App'
    };

    const response = await request(app)
      .post('/api/feedback')
      .send(payload)
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    
    const data = response.body.data;
    expect(data.sentiment).toBe('Negative');
    expect(data.destinationDatabase).toBe('Priority Support Database');

    // Both email and phone must be redacted
    expect(data.redactedText).not.toContain('srivastava123.shrishti@gmail.com');
    expect(data.redactedText).not.toContain('123-45-6789');
    expect(data.redactedText).toContain('[REDACTED_EMAIL]');
    expect(data.redactedText).toContain('[REDACTED_PHONE]');
    expect(data.piiDetected.length).toBeGreaterThanOrEqual(2);
  });

  it('should return a 400 Bad Request for an empty feedback payload (Edge Case Test)', async () => {
    const response = await request(app)
      .post('/api/feedback')
      .send({ feedbackText: '', clientName: 'Android App' })
      .set('Accept', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Validation failed');
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
    await request(app).post('/api/feedback/clear');

    const filePath = path.join(process.cwd(), 'src', 'data', 'sample_data.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const samples = JSON.parse(fileContent);

    for (const sample of samples) {
      const response = await request(app)
        .post('/api/feedback')
        .send({ feedbackText: sample.feedback, clientName: 'Web Portal' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      const data = response.body.data;
      expect(data).toHaveProperty('submissionId');
      expect(data).toHaveProperty('redactedText');
      expect(data).toHaveProperty('sentiment');
      expect(data).toHaveProperty('destinationDatabase');
      
      // Ensure PII is redacted if there was PII
      if (sample.feedback.includes('4111-2222-3333-4444')) {
        expect(data.redactedText).not.toContain('4111-2222-3333-4444');
        expect(data.redactedText).toContain('[REDACTED_CARD]');
      }
      if (sample.feedback.includes('test.user@gmail.com')) {
        expect(data.redactedText).not.toContain('test.user@gmail.com');
        expect(data.redactedText).toContain('[REDACTED_EMAIL]');
      }
      if (sample.feedback.includes('123-45-6789')) {
        expect(data.redactedText).not.toContain('123-45-6789');
        expect(data.redactedText).toContain('[REDACTED_HEALTH_ID]');
      }
      if (sample.feedback.includes('555-891-2045')) {
        expect(data.redactedText).not.toContain('555-891-2045');
        expect(data.redactedText).toContain('[REDACTED_PHONE]');
      }
    }

    // Retrieve database stats and verify telemetry matches
    const statsRes = await request(app).get('/api/feedback/stats');
    expect(statsRes.status).toBe(200);
    
    // There are 4 samples: 1 Priority Support, 1 Marketing, 2 Priority Support (since neutral goes there)
    expect(statsRes.body.totalSubmissions).toBe(4);
    expect(statsRes.body.marketingCount).toBe(1);
    expect(statsRes.body.priorityCount).toBe(3);
  });
});
