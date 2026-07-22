import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebhooksService } from '../../../src/modules/webhooks/webhooks.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../src/modules/audit/audit.service', () => ({
  AuditService: class AuditService {},
}));

describe('WebhooksService', () => {
  const organizationId = 'org_123';
  const webhookEndpointId = 'endpoint_123';

  const actorUser = Object.freeze({
    id: 'user_123',
    email: 'owner@supportmind.dev',
  });

  const endpoint = Object.freeze({
    id: webhookEndpointId,
    organizationId,
    name: 'Production webhook',
    url: 'https://example.com/webhooks/supportmind',
    status: 'active',
    events: ['document_indexed'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    disabledAt: null,
  });

  let prisma: {
    webhookEndpoint: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    webhookDelivery: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let auditService: {
    log: jest.Mock;
  };

  let service: WebhooksService;

  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = {
      webhookEndpoint: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      webhookDelivery: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    auditService = {
      log: jest.fn(),
    };

    service = new WebhooksService(prisma as never, auditService as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createEndpoint', () => {
    it('rejects a plain http url for a non-localhost host', async () => {
      await expect(
        service.createEndpoint(organizationId, actorUser, {
          name: 'Evil hook',
          url: 'http://example.com/webhook',
          events: ['document_indexed'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    });

    it('rejects a hostname that merely contains "localhost" as a substring', async () => {
      await expect(
        service.createEndpoint(organizationId, actorUser, {
          name: 'Spoofed hook',
          url: 'http://localhost.attacker.com/webhook',
          events: ['document_indexed'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    });

    it('accepts an https url, creates the endpoint, and logs an audit entry', async () => {
      prisma.webhookEndpoint.create.mockResolvedValue(endpoint);

      const result = await service.createEndpoint(organizationId, actorUser, {
        name: endpoint.name,
        url: endpoint.url,
        events: ['document_indexed'],
      });

      expect(prisma.webhookEndpoint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            organizationId,
            createdById: actorUser.id,
            name: endpoint.name,
            url: endpoint.url,
            secret: expect.any(String) as string,
            events: ['document_indexed'],
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId: actorUser.id,
          action: 'webhook_endpoint_created',
        }),
      );
      expect(result).toEqual(expect.objectContaining({ ...endpoint }));
      expect(typeof result.secret).toBe('string');
    });

    it('accepts a genuine localhost url for local development', async () => {
      prisma.webhookEndpoint.create.mockResolvedValue(endpoint);

      await expect(
        service.createEndpoint(organizationId, actorUser, {
          name: 'Local dev hook',
          url: 'http://localhost:3000/webhook',
          events: ['document_indexed'],
        }),
      ).resolves.toBeDefined();

      expect(prisma.webhookEndpoint.create).toHaveBeenCalled();
    });
  });

  describe('findEndpoints', () => {
    it('lists endpoints ordered by newest first', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);

      const result = await service.findEndpoints(organizationId);

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([endpoint]);
    });
  });

  describe('disableEndpoint', () => {
    it('throws NotFoundException when the endpoint does not exist', async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue(null);

      await expect(
        service.disableEndpoint(organizationId, webhookEndpointId, actorUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.webhookEndpoint.update).not.toHaveBeenCalled();
    });

    it('disables the endpoint and logs an audit entry', async () => {
      prisma.webhookEndpoint.findFirst.mockResolvedValue({
        id: webhookEndpointId,
        name: endpoint.name,
        url: endpoint.url,
      });
      const disabled = { ...endpoint, status: 'disabled' };
      prisma.webhookEndpoint.update.mockResolvedValue(disabled);

      const result = await service.disableEndpoint(
        organizationId,
        webhookEndpointId,
        actorUser,
      );

      expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: webhookEndpointId },
          data: {
            status: 'disabled',
            disabledAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'webhook_endpoint_disabled',
        }),
      );
      expect(result).toBe(disabled);
    });
  });

  describe('findDeliveries', () => {
    it('paginates deliveries for the organization', async () => {
      const deliveries = [{ id: 'delivery_1' }];
      prisma.$transaction.mockResolvedValue([deliveries, 1]);

      const result = await service.findDeliveries(organizationId, {
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: deliveries,
        meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
      });
    });
  });

  describe('emit', () => {
    beforeEach(() => {
      prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery_1' });
    });

    it('does nothing when there are no matching endpoints', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);
      global.fetch = jest.fn();

      await service.emit({
        organizationId,
        eventType: 'document_indexed',
        payload: {},
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('records a successful delivery', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: webhookEndpointId,
          organizationId,
          url: endpoint.url,
          secret: 'whsec_test',
        },
      ]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      await service.emit({
        organizationId,
        eventType: 'document_indexed',
        payload: { documentId: 'doc_1' },
      });

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery_1' },
          data: {
            status: 'succeeded',
            responseStatus: 200,
            responseBody: 'OK',
            deliveredAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'webhook_delivery_succeeded' }),
      );
    });

    it('records a failed delivery when the endpoint responds with a non-2xx status', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: webhookEndpointId,
          organizationId,
          url: endpoint.url,
          secret: 'whsec_test',
        },
      ]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await service.emit({
        organizationId,
        eventType: 'document_indexed',
        payload: {},
      });

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: 'failed',
            responseStatus: 500,
            responseBody: 'Server error',
            deliveredAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'webhook_delivery_failed' }),
      );
    });

    it('records a failed delivery when the request throws', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: webhookEndpointId,
          organizationId,
          url: endpoint.url,
          secret: 'whsec_test',
        },
      ]);
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      await service.emit({
        organizationId,
        eventType: 'document_indexed',
        payload: {},
      });

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: 'failed',
            errorMessage: 'network down',
            deliveredAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'webhook_delivery_failed' }),
      );
    });
  });
});
