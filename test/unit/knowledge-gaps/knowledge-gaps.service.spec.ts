import { NotFoundException } from '@nestjs/common';
import { KnowledgeGapsService } from '../../../src/modules/knowledge-gaps/knowledge-gaps.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('KnowledgeGapsService', () => {
  const organizationId = 'org_123';
  const actorUserId = 'user_123';
  const knowledgeGapId = 'gap_123';

  const gap = Object.freeze({
    id: knowledgeGapId,
    organizationId,
    question: 'How do refunds work?',
    normalizedText: 'how do refunds work',
    status: 'open',
    frequency: 1,
    lastAskedAt: new Date('2026-01-01T00:00:00.000Z'),
    exampleSources: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  let prisma: {
    knowledgeGap: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  let auditService: { log: jest.Mock };
  let usageService: { track: jest.Mock };
  let webhooksService: { emit: jest.Mock };

  let service: KnowledgeGapsService;

  beforeEach(() => {
    prisma = {
      knowledgeGap: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = { log: jest.fn() };
    usageService = { track: jest.fn() };
    webhooksService = { emit: jest.fn() };

    service = new KnowledgeGapsService(
      prisma as never,
      auditService as never,
      usageService as never,
      webhooksService as never,
    );
  });

  describe('track', () => {
    it('normalizes the question before upserting', async () => {
      prisma.knowledgeGap.upsert.mockResolvedValue(gap);

      await service.track({
        organizationId,
        question: '  How DO Refunds Work?! ',
        sourcesCount: 0,
        reason: 'no_sources',
      });

      expect(prisma.knowledgeGap.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_normalizedText: {
              organizationId,
              normalizedText: 'how do refunds work',
            },
          },
        }),
      );
    });

    it('tracks usage regardless of whether the gap is new', async () => {
      prisma.knowledgeGap.upsert.mockResolvedValue({ ...gap, frequency: 4 });

      await service.track({
        organizationId,
        question: gap.question,
        sourcesCount: 0,
        reason: 'no_sources',
      });

      expect(usageService.track).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          type: 'knowledge_gap_detected',
        }),
      );
    });

    it('logs an audit entry and emits a webhook only for a first-time gap', async () => {
      prisma.knowledgeGap.upsert.mockResolvedValue({ ...gap, frequency: 1 });

      await service.track({
        organizationId,
        question: gap.question,
        sourcesCount: 0,
        reason: 'no_sources',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          action: 'knowledge_gap_created',
          entityId: knowledgeGapId,
        }),
      );
      expect(webhooksService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          eventType: 'knowledge_gap_created',
        }),
      );
    });

    it('does not log an audit entry or emit a webhook for a repeated gap', async () => {
      prisma.knowledgeGap.upsert.mockResolvedValue({ ...gap, frequency: 2 });

      await service.track({
        organizationId,
        question: gap.question,
        sourcesCount: 0,
        reason: 'no_sources',
      });

      expect(auditService.log).not.toHaveBeenCalled();
      expect(webhooksService.emit).not.toHaveBeenCalled();
    });
  });

  describe('findOpenForOrganization', () => {
    it('lists open gaps ordered by frequency then recency', async () => {
      prisma.knowledgeGap.findMany.mockResolvedValue([gap]);

      const result = await service.findOpenForOrganization(organizationId);

      expect(prisma.knowledgeGap.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, status: 'open' },
          orderBy: [{ frequency: 'desc' }, { lastAskedAt: 'desc' }],
          take: 100,
        }),
      );
      expect(result).toEqual([gap]);
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when the gap does not exist', async () => {
      prisma.knowledgeGap.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          organizationId,
          knowledgeGapId,
          actorUserId,
          'resolved',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.knowledgeGap.update).not.toHaveBeenCalled();
    });

    it('logs knowledge_gap_resolved when resolving a gap', async () => {
      prisma.knowledgeGap.findFirst.mockResolvedValue({ id: knowledgeGapId });
      prisma.knowledgeGap.update.mockResolvedValue({
        ...gap,
        status: 'resolved',
      });

      await service.updateStatus(
        organizationId,
        knowledgeGapId,
        actorUserId,
        'resolved',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'knowledge_gap_resolved' }),
      );
    });

    it('logs knowledge_gap_ignored for any non-resolved status', async () => {
      prisma.knowledgeGap.findFirst.mockResolvedValue({ id: knowledgeGapId });
      prisma.knowledgeGap.update.mockResolvedValue({
        ...gap,
        status: 'ignored',
      });

      await service.updateStatus(
        organizationId,
        knowledgeGapId,
        actorUserId,
        'ignored',
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'knowledge_gap_ignored' }),
      );
    });
  });
});
