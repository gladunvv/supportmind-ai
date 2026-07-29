import { toPgVector } from '../../../src/modules/embeddings/utils/vector-sql.util';

describe('toPgVector', () => {
  it('formats a vector as a pgvector literal', () => {
    expect(toPgVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });

  it('formats an empty vector', () => {
    expect(toPgVector([])).toBe('[]');
  });

  it('formats negative and integer values', () => {
    expect(toPgVector([-1, 0, 1])).toBe('[-1,0,1]');
  });
});
