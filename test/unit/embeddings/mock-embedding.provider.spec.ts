import { MockEmbeddingProvider } from '../../../src/modules/embeddings/providers/mock-embedding.provider';

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    provider = new MockEmbeddingProvider();
  });

  describe('embed', () => {
    it('returns a 1536-dimension vector', async () => {
      const vector = await provider.embed('How do refunds work?');

      expect(vector).toHaveLength(1536);
    });

    it('is deterministic for the same input text', async () => {
      const first = await provider.embed('How do refunds work?');
      const second = await provider.embed('How do refunds work?');

      expect(first).toEqual(second);
    });

    it('produces different vectors for different input text', async () => {
      const first = await provider.embed('How do refunds work?');
      const second = await provider.embed('How do I reset my password?');

      expect(first).not.toEqual(second);
    });

    it('returns a normalized (unit-length) vector', async () => {
      const vector = await provider.embed('How do refunds work?');
      const magnitude = Math.sqrt(
        vector.reduce((sum, value) => sum + value * value, 0),
      );

      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('embedMany', () => {
    it('embeds each text independently and matches single embed() output', async () => {
      const texts = ['How do refunds work?', 'How do I reset my password?'];

      const many = await provider.embedMany(texts);
      const first = await provider.embed(texts[0]);
      const second = await provider.embed(texts[1]);

      expect(many).toEqual([first, second]);
    });

    it('returns an empty array for no input texts', async () => {
      const many = await provider.embedMany([]);

      expect(many).toEqual([]);
    });
  });
});
