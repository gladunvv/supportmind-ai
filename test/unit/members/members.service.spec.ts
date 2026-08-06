import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from '../../../src/modules/members/members.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('MembersService', () => {
  const organizationId = 'org_123';
  const membershipId = 'membership_123';
  const actorUserId = 'actor_123';

  const user = Object.freeze({
    id: 'user_123',
    email: 'agent@supportmind.dev',
  });

  let prisma: {
    membership: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  let auditService: { log: jest.Mock };

  let service: MembersService;

  beforeEach(() => {
    prisma = {
      membership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    auditService = { log: jest.fn() };

    service = new MembersService(prisma as never, auditService as never);
  });

  describe('findAll', () => {
    it('lists members of a non-archived organization ordered by join date', async () => {
      const members = [{ id: membershipId, role: 'admin' }];
      prisma.membership.findMany.mockResolvedValue(members);

      const result = await service.findAll(organizationId);

      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId,
            organization: { archivedAt: null },
          },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toBe(members);
    });
  });

  describe('addMember', () => {
    it('normalizes the email before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.membership.create.mockResolvedValue({
        id: membershipId,
        role: 'support_agent',
        user,
      });

      await service.addMember(organizationId, actorUserId, {
        email: ' Agent@SupportMind.Dev ',
        role: 'support_agent',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: user.email } }),
      );
    });

    it('throws NotFoundException when the user is not registered', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(organizationId, actorUserId, {
          email: user.email,
          role: 'support_agent',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.membership.findUnique.mockResolvedValue({ id: membershipId });

      await expect(
        service.addMember(organizationId, actorUserId, {
          email: user.email,
          role: 'support_agent',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it('creates a membership and logs an audit entry', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.membership.findUnique.mockResolvedValue(null);
      const created = { id: membershipId, role: 'support_agent', user };
      prisma.membership.create.mockResolvedValue(created);

      const result = await service.addMember(organizationId, actorUserId, {
        email: user.email,
        role: 'support_agent',
      });

      expect(prisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: user.id,
            organizationId,
            role: 'support_agent',
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId,
          action: 'member_added',
          entityId: membershipId,
        }),
      );
      expect(result).toBe(created);
    });
  });

  describe('updateRole', () => {
    it('throws NotFoundException when the membership does not exist', async () => {
      prisma.membership.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateRole(organizationId, membershipId, actorUserId, {
          role: 'admin',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when demoting the last owner', async () => {
      prisma.membership.findFirst
        .mockResolvedValueOnce({ id: membershipId, role: 'owner' })
        .mockResolvedValueOnce(null);

      await expect(
        service.updateRole(organizationId, membershipId, actorUserId, {
          role: 'admin',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.membership.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            organizationId,
            id: { not: membershipId },
            role: 'owner',
          },
        }),
      );
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('demotes an owner when another owner exists and logs an audit entry', async () => {
      prisma.membership.findFirst
        .mockResolvedValueOnce({ id: membershipId, role: 'owner' })
        .mockResolvedValueOnce({ id: 'other_membership' });
      const updated = { id: membershipId, role: 'admin' };
      prisma.membership.update.mockResolvedValue(updated);

      const result = await service.updateRole(
        organizationId,
        membershipId,
        actorUserId,
        { role: 'admin' },
      );

      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membershipId },
          data: { role: 'admin' },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId,
          action: 'member_role_updated',
          entityId: membershipId,
          metadata: { previousRole: 'owner', newRole: 'admin' },
        }),
      );
      expect(result).toBe(updated);
    });

    it('updates a non-owner without checking for another owner', async () => {
      prisma.membership.findFirst.mockResolvedValueOnce({
        id: membershipId,
        role: 'viewer',
      });
      const updated = { id: membershipId, role: 'admin' };
      prisma.membership.update.mockResolvedValue(updated);

      await service.updateRole(organizationId, membershipId, actorUserId, {
        role: 'admin',
      });

      expect(prisma.membership.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.membership.update).toHaveBeenCalled();
    });

    it('keeps an owner as owner without checking for another owner', async () => {
      prisma.membership.findFirst.mockResolvedValueOnce({
        id: membershipId,
        role: 'owner',
      });
      const updated = { id: membershipId, role: 'owner' };
      prisma.membership.update.mockResolvedValue(updated);

      await service.updateRole(organizationId, membershipId, actorUserId, {
        role: 'owner',
      });

      expect(prisma.membership.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.membership.update).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('throws NotFoundException when the membership does not exist', async () => {
      prisma.membership.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.removeMember(organizationId, membershipId, actorUserId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when removing the last owner', async () => {
      prisma.membership.findFirst
        .mockResolvedValueOnce({ id: membershipId, role: 'owner' })
        .mockResolvedValueOnce(null);

      await expect(
        service.removeMember(organizationId, membershipId, actorUserId),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it('removes an owner when another owner exists and logs an audit entry', async () => {
      prisma.membership.findFirst
        .mockResolvedValueOnce({ id: membershipId, role: 'owner' })
        .mockResolvedValueOnce({ id: 'other_membership' });

      const result = await service.removeMember(
        organizationId,
        membershipId,
        actorUserId,
      );

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: { id: membershipId },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId,
          action: 'member_removed',
          entityId: membershipId,
          metadata: { previousRole: 'owner' },
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('removes a non-owner without checking for another owner', async () => {
      prisma.membership.findFirst.mockResolvedValueOnce({
        id: membershipId,
        role: 'viewer',
      });

      const result = await service.removeMember(
        organizationId,
        membershipId,
        actorUserId,
      );

      expect(prisma.membership.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: { id: membershipId },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
