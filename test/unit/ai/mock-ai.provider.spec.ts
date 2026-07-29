import { MockAiProvider } from '../../../src/modules/ai/providers/mock-ai.provider';

describe('MockAiProvider', () => {
  let provider: MockAiProvider;

  const source = (score: number, content = 'Annual plans are refundable.') => ({
    chunkId: 'chunk_1',
    documentId: 'doc_1',
    documentTitle: 'Refund policy',
    content,
    score,
  });

  beforeEach(() => {
    provider = new MockAiProvider();
  });

  describe('generateAnswer', () => {
    it('flags for human review and returns a fallback answer when there are no sources', async () => {
      const result = await provider.generateAnswer({
        question: 'How do refunds work?',
        sources: [],
      });

      expect(result.needsHumanReview).toBe(true);
      expect(result.answer).toContain("couldn't find enough information");
    });

    it('does not flag for review when the best source score is at or above the threshold', async () => {
      const result = await provider.generateAnswer({
        question: 'How do refunds work?',
        sources: [source(0.2)],
      });

      expect(result.needsHumanReview).toBe(false);
      expect(result.answer).toContain('Annual plans are refundable.');
    });

    it('flags for review when the best source score is below the threshold', async () => {
      const result = await provider.generateAnswer({
        question: 'How do refunds work?',
        sources: [source(0.19)],
      });

      expect(result.needsHumanReview).toBe(true);
    });
  });

  describe('generateSupportReply', () => {
    it('flags for review with insufficient_context when there are no sources', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'Can I get a refund?',
        tone: 'neutral',
        sources: [],
      });

      expect(result.needsHumanReview).toBe(true);
      expect(result.riskFlags).toEqual(['insufficient_context']);
    });

    it('does not flag for review for a confident, low-risk message', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'How does the trial period work?',
        tone: 'neutral',
        sources: [source(0.8)],
      });

      expect(result.needsHumanReview).toBe(false);
      expect(result.riskFlags).toEqual([]);
    });

    it('flags for review when the best source score is below the threshold, even with no risk keywords', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'How does the trial period work?',
        tone: 'neutral',
        sources: [source(0.1)],
      });

      expect(result.needsHumanReview).toBe(true);
      expect(result.riskFlags).toEqual([]);
    });

    it('flags for review when the message contains a risk keyword, even with a confident source', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'I want a refund for my annual plan',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.needsHumanReview).toBe(true);
      expect(result.riskFlags).toEqual(['billing_sensitive']);
    });

    it('detects legal risk keywords', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'My attorney says this violates the law',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.riskFlags).toContain('legal_risk');
    });

    it('detects customer escalation keywords', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'I am furious and want to cancel immediately',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.riskFlags).toContain('customer_escalation');
    });

    it('detects multiple risk categories in the same message', async () => {
      const result = await provider.generateSupportReply({
        customerMessage:
          'I am furious, this is a chargeback and I will call my attorney',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.riskFlags).toEqual(
        expect.arrayContaining([
          'legal_risk',
          'customer_escalation',
          'billing_sensitive',
        ]),
      );
      expect(result.riskFlags).toHaveLength(3);
    });

    it('detects risk keywords case-insensitively', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'I NEED A REFUND NOW',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.riskFlags).toContain('billing_sensitive');
    });

    it('uses a friendly greeting for the friendly tone', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'How does the trial period work?',
        tone: 'friendly',
        sources: [source(0.9)],
      });

      expect(result.reply.startsWith('Hi there,')).toBe(true);
    });

    it('uses a short closing for the concise tone', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'How does the trial period work?',
        tone: 'concise',
        sources: [source(0.9)],
      });

      expect(result.reply).toContain('Best,\nSupport Team');
      expect(result.reply).not.toContain('let us know if you have any other');
    });

    it('uses the default greeting and closing for other tones', async () => {
      const result = await provider.generateSupportReply({
        customerMessage: 'How does the trial period work?',
        tone: 'neutral',
        sources: [source(0.9)],
      });

      expect(result.reply.startsWith('Hello,')).toBe(true);
      expect(result.reply).toContain(
        'Please let us know if you have any other questions.',
      );
    });
  });
});
