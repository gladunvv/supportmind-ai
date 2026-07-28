import { SearchService } from '../../../src/modules/search/search.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SearchService', () => {
  const organizationId = 'org_123';
  const embedding = [0.1, 0.2, 0.3];

  const results = [
    {
      chunkId: 'chunk_1',
      documentId: 'doc_1',
      documentTitle: 'Refund policy',
      content: 'Annual plans may be reviewed by billing support.',
      score: 0.87,
    },
  ];

  let prisma: { $queryRaw: jest.Mock };
  let embeddingProvider: { embed: jest.Mock };
  let service: SearchService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    embeddingProvider = { embed: jest.fn() };

    service = new SearchService(prisma as never, embeddingProvider as never);
  });

  it('embeds the query and returns the ranked results', async () => {
    embeddingProvider.embed.mockResolvedValue(embedding);
    prisma.$queryRaw.mockResolvedValue(results);

    const result = await service.search(organizationId, {
      query: 'How do refunds work?',
    });

    expect(embeddingProvider.embed).toHaveBeenCalledWith(
      'How do refunds work?',
    );
    expect(result).toBe(results);
  });

  it('scopes the raw query to the organization and the embedded vector', async () => {
    embeddingProvider.embed.mockResolvedValue(embedding);

    let queryRawValues: unknown[] = [];
    prisma.$queryRaw.mockImplementation((...values: unknown[]) => {
      queryRawValues = values;
      return Promise.resolve(results);
    });

    await service.search(organizationId, { query: 'q' });

    const vectorLiteral = `[${embedding.join(',')}]`;
    expect(queryRawValues.slice(1)).toEqual([
      vectorLiteral,
      organizationId,
      vectorLiteral,
    ]);
  });
});
