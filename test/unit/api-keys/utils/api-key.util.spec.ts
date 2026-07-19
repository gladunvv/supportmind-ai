import {
  generateRawApiKey,
  getApiKeyPrefix,
  hashApiKey,
} from '../../../../src/modules/api-keys/utils/api-key.util';

describe('API key utilities', () => {
  describe('generateRawApiKey', () => {
    it('generates a key with the expected prefix', () => {
      const key = generateRawApiKey();

      expect(key).toMatch(/^sm_live_/);
    });

    it('generates different keys on subsequent calls', () => {
      const firstKey = generateRawApiKey();
      const secondKey = generateRawApiKey();

      expect(firstKey).not.toBe(secondKey);
    });

    it('generates a key with sufficient entropy', () => {
      const key = generateRawApiKey();
      const randomPart = key.replace(/^sm_live_/, '');

      expect(randomPart.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('hashApiKey', () => {
    it('returns the same hash for the same key', () => {
      const key = 'sm_live_test_key';

      const firstHash = hashApiKey(key);
      const secondHash = hashApiKey(key);

      expect(secondHash).toBe(firstHash);
    });

    it('returns different hashes for different keys', () => {
      const firstHash = hashApiKey('sm_live_first');
      const secondHash = hashApiKey('sm_live_second');

      expect(firstHash).not.toBe(secondHash);
    });

    it('returns a lowercase SHA-256 hexadecimal hash', () => {
      const hash = hashApiKey('sm_live_test_key');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('does not expose the raw key in the hash', () => {
      const key = 'sm_live_super_secret_key';
      const hash = hashApiKey(key);

      expect(hash).not.toContain(key);
    });
  });

  describe('getApiKeyPrefix', () => {
    it('returns only the safe display prefix', () => {
      const key = 'sm_live_abcdefghijklmnopqrstuvwxyz0123456789';

      const prefix = getApiKeyPrefix(key);

      expect(key.startsWith(prefix)).toBe(true);
      expect(prefix.length).toBeLessThan(key.length);
    });

    it('does not return the complete raw key', () => {
      const key = generateRawApiKey();

      const prefix = getApiKeyPrefix(key);

      expect(prefix).not.toBe(key);
    });
  });
});
