import { NotFoundException } from '@nestjs/common';
import { ApiKeysService } from '../../../src/modules/api-keys/api-keys.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ApiKeysService', () => {
  const organizationId = 'org_123';
  const apiKeyId = 'apikey_123';

  const actorUser = Object.freeze({
    id: 'user_123',
    email: 'owner@supportmind.dev',
  });

  const apiKeyRecord = Object.freeze({
    id: apiKeyId,
    organizationId,
    name: 'Local integration',
    keyPrefix: 'sm_live_abcdef12',
    status: 'active',
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    revokedAt: null,
  });

  let prisma: {
    apiKey: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  let auditService: { log: jest.Mock };

  let service: ApiKeysService;

  beforeEach(() => {
    prisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = { log: jest.fn() };

    service = new ApiKeysService(prisma as never, auditService as never);
  });

  describe('create', () => {
    it('generates a key, stores its hash, and returns the raw key once', async () => {
      prisma.apiKey.create.mockResolvedValue(apiKeyRecord);

      const result = await service.create(organizationId, actorUser, {
        name: 'Local integration',
      });

      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            organizationId,
            createdById: actorUser.id,
            name: 'Local integration',
            keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
            keyPrefix: expect.stringMatching(/^sm_live_/) as string,
          },
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId: actorUser.id,
          action: 'api_key_created',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          ...apiKeyRecord,
          key: expect.any(String) as string,
        }),
      );
      expect(result.key.startsWith('sm_live_')).toBe(true);
    });
  });

  describe('findAll', () => {
    it('lists API keys ordered by newest first', async () => {
      prisma.apiKey.findMany.mockResolvedValue([apiKeyRecord]);

      const result = await service.findAll(organizationId);

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([apiKeyRecord]);
    });
  });

  describe('revoke', () => {
    it('throws NotFoundException when the key does not exist', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke(organizationId, apiKeyId, actorUser),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('revokes the key and logs an audit entry', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({
        id: apiKeyId,
        name: apiKeyRecord.name,
        keyPrefix: apiKeyRecord.keyPrefix,
      });
      const revoked = { ...apiKeyRecord, status: 'revoked' };
      prisma.apiKey.update.mockResolvedValue(revoked);

      const result = await service.revoke(organizationId, apiKeyId, actorUser);

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: apiKeyId },
          data: {
            status: 'revoked',
            revokedAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'api_key_revoked' }),
      );
      expect(result).toBe(revoked);
    });
  });

  describe('validateRawKey', () => {
    it('returns null when no key matches the hash', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.validateRawKey('sm_live_unknown');

      expect(result).toBeNull();
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('returns null when the key has been revoked', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: apiKeyId,
        organizationId,
        keyPrefix: apiKeyRecord.keyPrefix,
        status: 'revoked',
      });

      const result = await service.validateRawKey('sm_live_revoked_key');

      expect(result).toBeNull();
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('returns the key context and touches lastUsedAt for an active key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: apiKeyId,
        organizationId,
        keyPrefix: apiKeyRecord.keyPrefix,
        status: 'active',
      });

      const result = await service.validateRawKey('sm_live_active_key');

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: apiKeyId },
          data: { lastUsedAt: expect.any(Date) as Date },
        }),
      );
      expect(result).toEqual({
        apiKeyId,
        organizationId,
        keyPrefix: apiKeyRecord.keyPrefix,
      });
    });
  });
});
