import { createHmac } from 'node:crypto';
import { createWebhookSignature } from '../../../../src/modules/webhooks/utils/webhook-signature.util';

describe('createWebhookSignature', () => {
  const secret = 'whsec_test_secret';
  const timestamp = '1720000000';
  const body = JSON.stringify({
    event: 'document_indexed',
    data: {
      documentId: 'document_123',
    },
  });

  const input = Object.freeze({
    secret,
    timestamp,
    body,
  });

  it('creates the expected HMAC SHA-256 signature', () => {
    const expectedSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const result = createWebhookSignature(input);

    expect(result).toBe(expectedSignature);
  });

  it('returns the same signature for the same input', () => {
    const firstSignature = createWebhookSignature(input);
    const secondSignature = createWebhookSignature(input);

    expect(secondSignature).toBe(firstSignature);
  });

  it('returns a lowercase hexadecimal SHA-256 signature', () => {
    const result = createWebhookSignature(input);

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when the body changes', () => {
    const firstSignature = createWebhookSignature(input);

    const secondSignature = createWebhookSignature({
      ...input,
      body: JSON.stringify({
        event: 'document_failed',
      }),
    });

    expect(secondSignature).not.toBe(firstSignature);
  });

  it('changes when the timestamp changes', () => {
    const firstSignature = createWebhookSignature(input);

    const secondSignature = createWebhookSignature({
      ...input,
      timestamp: '1720000001',
    });

    expect(secondSignature).not.toBe(firstSignature);
  });

  it('changes when the secret changes', () => {
    const firstSignature = createWebhookSignature(input);

    const secondSignature = createWebhookSignature({
      ...input,
      secret: 'whsec_different_secret',
    });

    expect(secondSignature).not.toBe(firstSignature);
  });
});
