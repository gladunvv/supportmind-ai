import { createHmac } from 'crypto';

export function createWebhookSignature(input: {
  secret: string;
  timestamp: string;
  body: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest('hex');
}
