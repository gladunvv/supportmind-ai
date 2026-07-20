import { UsersService } from '../../../src/modules/users/users.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsersService', () => {
  const user = Object.freeze({
    id: 'user_123',
    email: 'owner@supportmind.dev',
    passwordHash: 'hashed_password',
    refreshTokenHash: 'hashed_refresh_token',
    firstName: 'Vlad',
    lastName: 'Gladun',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };

  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    service = new UsersService(prisma as never);
  });

  describe('findById', () => {
    it('returns the user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById(user.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(result).toBe(user);
    });

    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('missing_id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns the user by email', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findByEmail(user.email);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(result).toBe(user);
    });

    it('returns null when the email is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('missing@supportmind.dev');

      expect(result).toBeNull();
    });
  });
});
