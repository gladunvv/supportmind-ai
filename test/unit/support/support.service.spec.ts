import { SupportService } from '../../../src/modules/support/support.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SupportService', () => {
  const organizationId = 'org_123';
  const supportDraftId = 'draft_123';

  const actorUser = Object.freeze({
    id: 'user_123',
    email: 'agent@supportmind.dev',
  });

  const searchResult = Object.freeze({
    chunkId: 'chunk_1',
    documentId: 'doc_1',
    documentTitle: 'Refund policy',
    content: 'Annual plans may be reviewed by billing support.',
    score: 0.87,
  });

  const mappedSource = Object.freeze({
    chunkId: searchResult.chunkId,
    documentId: searchResult.documentId,
    documentTitle: searchResult.documentTitle,
    content: searchResult.content,
    score: searchResult.score,
  });

  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  let prisma: { supportDraft: { create: jest.Mock } };
  let searchService: { search: jest.Mock };
  let aiProvider: { generateSupportReply: jest.Mock };
  let usageService: { track: jest.Mock };
  let auditService: { log: jest.Mock };
  let knowledgeGapsService: { track: jest.Mock };
  let webhooksService: { emit: jest.Mock };

  let service: SupportService;

  beforeEach(() => {
    prisma = { supportDraft: { create: jest.fn() } };
    searchService = { search: jest.fn() };
    aiProvider = { generateSupportReply: jest.fn() };
    usageService = { track: jest.fn() };
    auditService = { log: jest.fn() };
    knowledgeGapsService = { track: jest.fn() };
    webhooksService = { emit: jest.fn() };

    service = new SupportService(
      prisma as never,
      searchService as never,
      aiProvider as never,
      usageService as never,
      auditService as never,
      knowledgeGapsService as never,
      webhooksService as never,
    );
  });

  it('defaults to a neutral tone when none is provided', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateSupportReply.mockResolvedValue({
      reply: 'Thanks for reaching out.',
      needsHumanReview: false,
      riskFlags: [],
    });
    prisma.supportDraft.create.mockResolvedValue({
      id: supportDraftId,
      customerMessage: 'Can I get a refund?',
      reply: 'Thanks for reaching out.',
      tone: 'neutral',
      riskFlags: [],
      needsReview: false,
      createdAt,
    });

    await service.draftReply(organizationId, actorUser, {
      customerMessage: 'Can I get a refund?',
    });

    expect(aiProvider.generateSupportReply).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'neutral' }),
    );
  });

  it('generates a draft, stores it, logs usage and audit, and returns the mapped response', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateSupportReply.mockResolvedValue({
      reply: 'Sure, annual refunds are reviewed by billing.',
      needsHumanReview: false,
      riskFlags: [],
    });
    prisma.supportDraft.create.mockResolvedValue({
      id: supportDraftId,
      customerMessage: 'Can I get a refund?',
      reply: 'Sure, annual refunds are reviewed by billing.',
      tone: 'friendly',
      riskFlags: [],
      needsReview: false,
      createdAt,
    });

    const result = await service.draftReply(organizationId, actorUser, {
      customerMessage: 'Can I get a refund?',
      tone: 'friendly',
    });

    expect(searchService.search).toHaveBeenCalledWith(organizationId, {
      query: 'Can I get a refund?',
    });
    expect(prisma.supportDraft.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        createdById: actorUser.id,
        customerMessage: 'Can I get a refund?',
        reply: 'Sure, annual refunds are reviewed by billing.',
        tone: 'friendly',
        sources: [mappedSource],
        riskFlags: [],
        needsReview: false,
      },
      select: expect.any(Object) as object,
    });
    expect(usageService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        userId: actorUser.id,
        type: 'support_reply_generated',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorUserId: actorUser.id,
        action: 'support_draft_generated',
        entityId: supportDraftId,
      }),
    );
    expect(result).toEqual({
      id: supportDraftId,
      customerMessage: 'Can I get a refund?',
      reply: 'Sure, annual refunds are reviewed by billing.',
      tone: 'friendly',
      sources: [mappedSource],
      riskFlags: [],
      needsHumanReview: false,
      createdAt,
    });
  });

  it('emits the review webhook with risk flags when the draft needs human review', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateSupportReply.mockResolvedValue({
      reply: 'This looks like a billing dispute.',
      needsHumanReview: true,
      riskFlags: ['billing_dispute'],
    });
    prisma.supportDraft.create.mockResolvedValue({
      id: supportDraftId,
      customerMessage: 'I was charged twice',
      reply: 'This looks like a billing dispute.',
      tone: 'neutral',
      riskFlags: ['billing_dispute'],
      needsReview: true,
      createdAt,
    });

    await service.draftReply(organizationId, actorUser, {
      customerMessage: 'I was charged twice',
    });

    expect(webhooksService.emit).toHaveBeenCalledWith({
      organizationId,
      eventType: 'support_draft_needs_review',
      payload: {
        supportDraftId,
        sourcesCount: 1,
        riskFlags: ['billing_dispute'],
        needsHumanReview: true,
      },
    });
  });

  it('does not emit a review webhook when human review is not needed', async () => {
    searchService.search.mockResolvedValue([searchResult]);
    aiProvider.generateSupportReply.mockResolvedValue({
      reply: 'Thanks!',
      needsHumanReview: false,
      riskFlags: [],
    });
    prisma.supportDraft.create.mockResolvedValue({
      id: supportDraftId,
      customerMessage: 'q',
      reply: 'Thanks!',
      tone: 'neutral',
      riskFlags: [],
      needsReview: false,
      createdAt,
    });

    await service.draftReply(organizationId, actorUser, {
      customerMessage: 'q',
    });

    expect(webhooksService.emit).not.toHaveBeenCalled();
  });

  it('records a knowledge gap when no sources are found', async () => {
    searchService.search.mockResolvedValue([]);
    aiProvider.generateSupportReply.mockResolvedValue({
      reply: "I don't have information about that.",
      needsHumanReview: false,
      riskFlags: [],
    });
    prisma.supportDraft.create.mockResolvedValue({
      id: supportDraftId,
      customerMessage: 'q',
      reply: "I don't have information about that.",
      tone: 'neutral',
      riskFlags: [],
      needsReview: false,
      createdAt,
    });

    await service.draftReply(organizationId, actorUser, {
      customerMessage: 'q',
    });

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
});
