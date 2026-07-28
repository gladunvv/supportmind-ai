import { UsageService } from '../../../src/modules/usage/usage.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsageService', () => {
  const organizationId = 'org_123';

  let prisma: {
    usageEvent: { create: jest.Mock; groupBy: jest.Mock };
  };

  let service: UsageService;

  beforeEach(() => {
    prisma = {
      usageEvent: { create: jest.fn(), groupBy: jest.fn() },
    };

    service = new UsageService(prisma as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('track', () => {
    it('defaults quantity to 1 when not provided', async () => {
      await service.track({
        organizationId,
        type: 'document_uploaded',
      });

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          userId: undefined,
          type: 'document_uploaded',
          quantity: 1,
          metadata: undefined,
        },
      });
    });

    it('passes through the provided quantity, userId, and metadata', async () => {
      await service.track({
        organizationId,
        userId: 'user_123',
        type: 'api_key_request',
        quantity: 3,
        metadata: { endpoint: 'external_ask' },
      });

      expect(prisma.usageEvent.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          userId: 'user_123',
          type: 'api_key_request',
          quantity: 3,
          metadata: { endpoint: 'external_ask' },
        },
      });
    });
  });

  describe('getCurrentMonthSummary', () => {
    it('scopes to the current UTC month and maps summed quantities', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
      prisma.usageEvent.groupBy.mockResolvedValue([
        { type: 'document_uploaded', _sum: { quantity: 5 } },
        { type: 'ai_question_asked', _sum: { quantity: null } },
      ]);

      const result = await service.getCurrentMonthSummary(organizationId);

      expect(prisma.usageEvent.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: {
          organizationId,
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lt: new Date('2026-08-01T00:00:00.000Z'),
          },
        },
        _sum: { quantity: true },
      });
      expect(result).toEqual({
        periodStart: new Date('2026-07-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-01T00:00:00.000Z'),
        items: [
          { type: 'document_uploaded', quantity: 5 },
          { type: 'ai_question_asked', quantity: 0 },
        ],
      });
    });

    it('rolls the period over into January when the current month is December', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-12-20T00:00:00.000Z'));
      prisma.usageEvent.groupBy.mockResolvedValue([]);

      const result = await service.getCurrentMonthSummary(organizationId);

      expect(result.periodStart).toEqual(new Date('2026-12-01T00:00:00.000Z'));
      expect(result.periodEnd).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    });
  });
});
