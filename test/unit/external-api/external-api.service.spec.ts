import { ExternalApiService } from '../../../src/modules/external-api/external-api.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ExternalApiService', () => {
  const organizationId = 'org_123';
  const apiKeyId = 'apikey_123';

  const searchResult = Object.freeze({
    chunkId: 'chunk_1',
    documentId: 'doc_1',
    documentTitle: 'Refund policy',
    content: 'Annual plans may be reviewed by billing support.',
    score: 0.87,
  });

  const aiAnswer = Object.freeze({
    answer: 'Annual refunds are reviewed by billing support.',
    needsHumanReview: false,
  });

  let searchService: { search: jest.Mock };
  let usageService: { track: jest.Mock };
  let auditService: { log: jest.Mock };
  let aiProvider: { generateAnswer: jest.Mock };
  let knowledgeGapsService: { track: jest.Mock };

  let service: ExternalApiService;

  beforeEach(() => {
    searchService = { search: jest.fn() };
    usageService = { track: jest.fn() };
    auditService = { log: jest.fn() };
    aiProvider = { generateAnswer: jest.fn() };
    knowledgeGapsService = { track: jest.fn() };

    service = new ExternalApiService(
      searchService as never,
      usageService as never,
      auditService as never,
      aiProvider as never,
      knowledgeGapsService as never,
    );
  });

  it('answers the question using retrieved sources and logs usage and audit', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateAnswer.mockResolvedValue(aiAnswer);

    const question = 'How do annual refunds work?';
    const result = await service.ask(organizationId, apiKeyId, { question });

    expect(searchService.search).toHaveBeenCalledWith(organizationId, {
      query: question,
    });
    expect(aiProvider.generateAnswer).toHaveBeenCalledWith({
      question,
      sources: [
        {
          chunkId: searchResult.chunkId,
          documentId: searchResult.documentId,
          documentTitle: searchResult.documentTitle,
          content: searchResult.content,
          score: searchResult.score,
        },
      ],
    });
    expect(usageService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        type: 'api_key_request',
        metadata: {
          apiKeyId,
          endpoint: 'external_ask',
          questionLength: question.length,
          sourcesCount: 1,
          needsHumanReview: false,
        },
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        action: 'api_key_used',
        entityId: apiKeyId,
      }),
    );
    expect(result).toEqual({
      answer: aiAnswer.answer,
      sources: [
        {
          chunkId: searchResult.chunkId,
          documentId: searchResult.documentId,
          documentTitle: searchResult.documentTitle,
          content: searchResult.content,
          score: searchResult.score,
        },
      ],
      needsHumanReview: false,
    });
  });

  it('does not record a knowledge gap when a confident source is found', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateAnswer.mockResolvedValue(aiAnswer);

    await service.ask(organizationId, apiKeyId, { question: 'q' });

    expect(knowledgeGapsService.track).not.toHaveBeenCalled();
  });

  it('records a knowledge gap when no sources are found', async () => {
    searchService.search.mockResolvedValue([]);
    aiProvider.generateAnswer.mockResolvedValue(aiAnswer);

    await service.ask(organizationId, apiKeyId, { question: 'q' });

    expect(knowledgeGapsService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        question: 'q',
        sourcesCount: 0,
        bestScore: undefined,
        reason: 'no_sources',
      }),
    );
  });

  it('records a knowledge gap when the best source score is below the confidence threshold', async () => {
    searchService.search.mockResolvedValue([{ ...searchResult, score: 0.19 }]);
    aiProvider.generateAnswer.mockResolvedValue(aiAnswer);

    await service.ask(organizationId, apiKeyId, { question: 'q' });

    expect(knowledgeGapsService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcesCount: 1,
        bestScore: 0.19,
        reason: 'low_score',
      }),
    );
  });

  it('does not record a knowledge gap when the best score sits exactly at the threshold', async () => {
    searchService.search.mockResolvedValue([{ ...searchResult, score: 0.2 }]);
    aiProvider.generateAnswer.mockResolvedValue(aiAnswer);

    await service.ask(organizationId, apiKeyId, { question: 'q' });

    expect(knowledgeGapsService.track).not.toHaveBeenCalled();
  });
});
