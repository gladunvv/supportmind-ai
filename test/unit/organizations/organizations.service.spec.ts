import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from '../../../src/modules/organizations/organizations.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('OrganizationsService', () => {
  const userId = 'user_123';

  const organization = Object.freeze({
    id: 'org_123',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    description: 'A company',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  let tx: {
    organization: {
      create: jest.Mock;
    };
    membership: {
      create: jest.Mock;
    };
  };

  let prisma: {
    $transaction: jest.Mock;
    organization: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    membership: {
      findMany: jest.Mock;
    };
  };

  let auditService: { log: jest.Mock };

  let service: OrganizationsService;

  beforeEach(() => {
    tx = {
      organization: {
        create: jest.fn(),
      },
      membership: {
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
      organization: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      membership: {
        findMany: jest.fn(),
      },
    };

    auditService = { log: jest.fn() };

    service = new OrganizationsService(prisma as never, auditService as never);
  });

  describe('create', () => {
    it('creates an organization with a slug and an owner membership', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      tx.organization.create.mockResolvedValue(organization);

      const result = await service.create(userId, {
        name: ' Acme Inc. ',
        description: ' A company ',
      });

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'acme-inc' },
        select: { id: true },
      });
      expect(tx.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme Inc.',
          slug: 'acme-inc',
          description: 'A company',
        },
      });
      expect(tx.membership.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: organization.id,
          role: 'owner',
        },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: organization.id,
          actorUserId: userId,
          action: 'organization_created',
        }),
      );
      expect(result).toBe(organization);
    });

    it('appends a counter to the slug when it is already taken', async () => {
      prisma.organization.findUnique
        .mockResolvedValueOnce({ id: 'other_org' })
        .mockResolvedValueOnce(null);
      tx.organization.create.mockResolvedValue(organization);

      await service.create(userId, { name: 'Acme Inc.' });

      expect(prisma.organization.findUnique).toHaveBeenNthCalledWith(1, {
        where: { slug: 'acme-inc' },
        select: { id: true },
      });
      expect(prisma.organization.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'acme-inc-2' },
        select: { id: true },
      });
      expect(tx.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme Inc.',
          slug: 'acme-inc-2',
          description: undefined,
        },
      });
    });
  });

  describe('findAllForUser', () => {
    it('returns non-archived organizations with the caller role', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { role: 'owner', organization },
      ]);

      const result = await service.findAllForUser(userId);

      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            organization: { archivedAt: null },
          },
        }),
      );
      expect(result).toEqual([{ ...organization, role: 'owner' }]);
    });
  });

  describe('findOneForMember', () => {
    it('returns the organization when found', async () => {
      prisma.organization.findFirst.mockResolvedValue(organization);

      const result = await service.findOneForMember(organization.id);

      expect(prisma.organization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: organization.id, archivedAt: null },
        }),
      );
      expect(result).toBe(organization);
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneForMember('missing_org'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the organization does not exist', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.update('missing_org', userId, { name: 'New name' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('trims name and description before updating', async () => {
      prisma.organization.findFirst.mockResolvedValue({ id: organization.id });
      prisma.organization.update.mockResolvedValue(organization);

      const result = await service.update(organization.id, userId, {
        name: ' New name ',
        description: ' New description ',
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: organization.id },
          data: { name: 'New name', description: 'New description' },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: organization.id,
          actorUserId: userId,
          action: 'organization_updated',
        }),
      );
      expect(result).toBe(organization);
    });
  });

  describe('archive', () => {
    it('throws NotFoundException when the organization does not exist', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(
        service.archive('missing_org', userId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('sets archivedAt when the organization exists', async () => {
      prisma.organization.findFirst.mockResolvedValue({ id: organization.id });
      prisma.organization.update.mockResolvedValue(organization);

      const result = await service.archive(organization.id, userId);

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: organization.id },
        data: { archivedAt: expect.any(Date) as Date },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: organization.id,
          actorUserId: userId,
          action: 'organization_archived',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
