import { AiService } from '../../../src/modules/ai/ai.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AiService', () => {
  const organizationId = 'org_123';
  const aiQuestionId = 'question_123';

  const actorUser = Object.freeze({
    id: 'user_123',
    email: 'owner@supportmind.dev',
  });

  const searchResult = Object.freeze({
    chunkId: 'chunk_1',
    documentId: 'doc_1',
    documentTitle: 'Refund policy',
    content: 'Annual plans may be reviewed by billing support.',
    score: 0.87,
  });

  let prisma: { aiQuestion: { create: jest.Mock } };
  let searchService: { search: jest.Mock };
  let aiProvider: { generateAnswer: jest.Mock };
  let usageService: { track: jest.Mock };
  let auditService: { log: jest.Mock };
  let knowledgeGapsService: { track: jest.Mock };
  let webhooksService: { emit: jest.Mock };

  let service: AiService;

  beforeEach(() => {
    prisma = { aiQuestion: { create: jest.fn() } };
    searchService = { search: jest.fn() };
    aiProvider = { generateAnswer: jest.fn() };
    usageService = { track: jest.fn() };
    auditService = { log: jest.fn() };
    knowledgeGapsService = { track: jest.fn() };
    webhooksService = { emit: jest.fn() };

    service = new AiService(
      prisma as never,
      searchService as never,
      aiProvider as never,
      usageService as never,
      auditService as never,
      knowledgeGapsService as never,
      webhooksService as never,
    );
  });

  it('answers a confident question, stores it as answered, and skips review signals', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateAnswer.mockResolvedValue({
      answer: 'Annual refunds are reviewed by billing support.',
      needsHumanReview: false,
    });
    prisma.aiQuestion.create.mockResolvedValue({ id: aiQuestionId });

    const result = await service.ask(organizationId, actorUser, {
      question: 'How do annual refunds work?',
    });

    expect(prisma.aiQuestion.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        askedById: actorUser.id,
        question: 'How do annual refunds work?',
        answer: 'Annual refunds are reviewed by billing support.',
        needsReview: false,
        status: 'answered',
        sources: [
          {
            chunkId: searchResult.chunkId,
            documentId: searchResult.documentId,
            documentTitle: searchResult.documentTitle,
            content: searchResult.content,
            score: searchResult.score,
          },
        ],
      },
    });
    expect(usageService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        userId: actorUser.id,
        type: 'ai_question_asked',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorUserId: actorUser.id,
        action: 'ai_question_asked',
        entityId: aiQuestionId,
      }),
    );
    expect(knowledgeGapsService.track).not.toHaveBeenCalled();
    expect(webhooksService.emit).not.toHaveBeenCalled();
    expect(result).toEqual({
      answer: 'Annual refunds are reviewed by billing support.',
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

  it('stores the question as needing review and emits the review webhook', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateAnswer.mockResolvedValue({
      answer: 'This may involve a refund exception.',
      needsHumanReview: true,
    });
    prisma.aiQuestion.create.mockResolvedValue({ id: aiQuestionId });

    await service.ask(organizationId, actorUser, {
      question: 'Can I get an exception refund?',
    });

    expect(prisma.aiQuestion.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        askedById: actorUser.id,
        question: 'Can I get an exception refund?',
        answer: 'This may involve a refund exception.',
        needsReview: true,
        status: 'needs_review',
        sources: [
          {
            chunkId: searchResult.chunkId,
            documentId: searchResult.documentId,
            documentTitle: searchResult.documentTitle,
            content: searchResult.content,
            score: searchResult.score,
          },
        ],
      },
    });
    expect(webhooksService.emit).toHaveBeenCalledWith({
      organizationId,
      eventType: 'ai_question_needs_review',
      payload: {
        aiQuestionId,
        question: 'Can I get an exception refund?',
        sourcesCount: 1,
        needsHumanReview: true,
      },
    });
  });

  it('records a knowledge gap with the actor when no sources are found', async () => {
    searchService.search.mockResolvedValue([]);
    aiProvider.generateAnswer.mockResolvedValue({
      answer: "I don't have information about that.",
      needsHumanReview: false,
    });
    prisma.aiQuestion.create.mockResolvedValue({ id: aiQuestionId });

    await service.ask(organizationId, actorUser, { question: 'q' });

    expect(knowledgeGapsService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorUserId: actorUser.id,
        question: 'q',
        sourcesCount: 0,
        bestScore: undefined,
        reason: 'no_sources',
      }),
    );
  });

  it('records a knowledge gap for a low-confidence answer without emitting a review webhook', async () => {
    searchService.search.mockResolvedValue([{ ...searchResult, score: 0.1 }]);
    aiProvider.generateAnswer.mockResolvedValue({
      answer: 'Best guess answer.',
      needsHumanReview: false,
    });
    prisma.aiQuestion.create.mockResolvedValue({ id: aiQuestionId });

    await service.ask(organizationId, actorUser, { question: 'q' });

    expect(knowledgeGapsService.track).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'low_score', bestScore: 0.1 }),
    );
    expect(webhooksService.emit).not.toHaveBeenCalled();
  });
});
