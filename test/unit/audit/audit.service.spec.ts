import { AuditService } from '../../../src/modules/audit/audit.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AuditService', () => {
  const organizationId = 'org_123';

  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new AuditService(prisma as never);
  });

  describe('log', () => {
    it('creates an audit log entry with the given fields', async () => {
      await service.log({
        organizationId,
        actorUserId: 'user_123',
        action: 'document_uploaded',
        entityType: 'document',
        entityId: 'doc_123',
        metadata: { title: 'Refund policy' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          actorUserId: 'user_123',
          action: 'document_uploaded',
          entityType: 'document',
          entityId: 'doc_123',
          metadata: { title: 'Refund policy' },
        },
      });
    });
  });

  describe('findForOrganization', () => {
    it('paginates with defaults when no page or limit is given', async () => {
      const logs = [{ id: 'log_1' }];
      prisma.$transaction.mockResolvedValue([logs, 45]);

      const result = await service.findForOrganization(organizationId, {});

      expect(result).toEqual({
        data: logs,
        meta: { page: 1, limit: 20, total: 45, totalPages: 3 },
      });
    });

    it('paginates using the requested page and limit', async () => {
      const logs = [{ id: 'log_2' }];
      prisma.$transaction.mockResolvedValue([logs, 5]);

      const result = await service.findForOrganization(organizationId, {
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: logs,
        meta: { page: 2, limit: 10, total: 5, totalPages: 1 },
      });
    });
  });
});
