import { TextChunkerService } from '../../../../src/modules/document-ingestion/services/text-chunker.service';

type SplitResult = ReturnType<TextChunkerService['split']>;

function getContents(chunks: SplitResult): string[] {
  return chunks.map((chunk) => chunk.content);
}

describe('TextChunkerService', () => {
  let service: TextChunkerService;

  beforeEach(() => {
    service = new TextChunkerService();
  });

  describe('split', () => {
    it('returns an empty array for empty text', () => {
      const result = service.split('');

      expect(result).toEqual([]);
    });

    it('returns an empty array for whitespace-only text', () => {
      const result = service.split('   \n\t  ');

      expect(result).toEqual([]);
    });

    it('returns one chunk when text fits within the chunk size', () => {
      const text = 'SupportMind helps support teams answer customer questions.';

      const result = service.split(text);

      expect(result).toHaveLength(1);
      expect(result[0]?.content).toBe(text);
      expect(result[0]?.chunkIndex).toBe(0);
    });

    it('does not return empty chunks', () => {
      const text = `
        Refund policy

        Customers can contact billing support.

        Password reset

        Users can reset their password from account settings.
      `;

      const result = service.split(text);

      expect(result.length).toBeGreaterThan(0);

      for (const chunk of result) {
        expect(chunk.content.trim()).not.toBe('');
      }
    });

    it('assigns sequential chunk indexes', () => {
      const text = Array.from(
        { length: 1_000 },
        (_, index) => `Sentence number ${index}.`,
      ).join(' ');

      const result = service.split(text);

      expect(result.map((chunk) => chunk.chunkIndex)).toEqual(
        result.map((_, index) => index),
      );
    });

    it('preserves the original content order', () => {
      const sections = ['FIRST_SECTION', 'SECOND_SECTION', 'THIRD_SECTION'];

      const text = sections
        .map((section) => `${section} ${'content '.repeat(500)}`)
        .join('\n\n');

      const result = service.split(text);
      const reconstructed = getContents(result).join(' ');

      const firstIndex = reconstructed.indexOf('FIRST_SECTION');
      const secondIndex = reconstructed.indexOf('SECOND_SECTION');
      const thirdIndex = reconstructed.indexOf('THIRD_SECTION');

      expect(firstIndex).toBeGreaterThanOrEqual(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(thirdIndex).toBeGreaterThan(secondIndex);
    });

    it('splits sufficiently large text into multiple chunks', () => {
      const text = Array.from(
        { length: 1_000 },
        (_, index) => `Sentence number ${index}.`,
      ).join(' ');

      const result = service.split(text);

      expect(result.length).toBeGreaterThan(1);
    });

    it('produces deterministic results', () => {
      const text = Array.from(
        { length: 500 },
        (_, index) => `Support article sentence ${index}.`,
      ).join(' ');

      const firstResult = service.split(text);
      const secondResult = service.split(text);

      expect(secondResult).toEqual(firstResult);
    });

    it('preserves Unicode characters', () => {
      const text =
        'Клиент может обратиться в поддержку. ' +
        'Пользователь может сбросить пароль. ' +
        'Оплата возвращается после проверки заявки.';

      const result = service.split(text);
      const reconstructed = getContents(result).join(' ');

      expect(reconstructed).toContain('Клиент');
      expect(reconstructed).toContain('Пользователь');
      expect(reconstructed).toContain('Оплата');
    });

    it('provides a positive token count for non-empty chunks', () => {
      const text = Array.from(
        { length: 500 },
        (_, index) => `Support sentence ${index}.`,
      ).join(' ');

      const result = service.split(text);

      for (const chunk of result) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    });
  });
});
