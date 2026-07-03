import { createHash, randomBytes } from 'crypto';

const API_KEY_PREFIX = 'sm_live';

export function generateRawApiKey(): string {
  const secret = randomBytes(32).toString('base64url');
  return `${API_KEY_PREFIX}_${secret}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function getApiKeyPrefix(rawKey: string): string {
  const parts = rawKey.split('_');

  if (parts.length < 3) {
    return rawKey.slice(0, 12);
  }

  return `${parts[0]}_${parts[1]}_${parts[2].slice(0, 8)}`;
}
