import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from '../../../src/modules/auth/auth.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

const mockedArgon2 = jest.mocked(argon2);

describe('AuthService', () => {
  const originalEnv = process.env;

  const user = Object.freeze({
    id: 'user_123',
    email: 'owner@supportmind.dev',
    passwordHash: 'hashed_password',
    refreshTokenHash: 'hashed_refresh_token',
    firstName: 'Vlad',
    lastName: 'Gladun',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const accessToken = 'access_token';
  const refreshToken = 'refresh_token';

  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };

  let service: AuthService;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_ACCESS_SECRET: 'access_secret',
      JWT_REFRESH_SECRET: 'refresh_secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce(accessToken)
        .mockResolvedValueOnce(refreshToken),
      verifyAsync: jest.fn(),
    };

    mockedArgon2.hash.mockReset();
    mockedArgon2.verify.mockReset();
    mockedArgon2.hash.mockImplementation((value: string) =>
      Promise.resolve(
        value === refreshToken ? user.refreshTokenHash : user.passwordHash,
      ),
    );

    service = new AuthService(
      prisma as never,
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('register', () => {
    it('creates a user with normalized email and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await service.register({
        email: ' OWNER@SupportMind.Dev ',
        password: 'StrongPassword123!',
        firstName: user.firstName,
        lastName: user.lastName,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(mockedArgon2.hash).toHaveBeenNthCalledWith(
        1,
        'StrongPassword123!',
      );
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, email: user.email },
        { secret: 'access_secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: user.id, email: user.email },
        { secret: 'refresh_secret', expiresIn: '7d' },
      );
      expect(mockedArgon2.hash).toHaveBeenNthCalledWith(2, refreshToken);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: user.refreshTokenHash },
      });
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        accessToken,
        refreshToken,
      });
    });

    it('rejects an existing email', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.register({
          email: user.email,
          password: 'StrongPassword123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('validates credentials, rotates refresh token, and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await service.login({
        email: ' OWNER@SupportMind.Dev ',
        password: 'StrongPassword123!',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        user.passwordHash,
        'StrongPassword123!',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: user.refreshTokenHash },
      });
      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@supportmind.dev',
          password: 'StrongPassword123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: user.email,
          password: 'WrongPassword123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('validates refresh token, rotates it, and returns new tokens', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(true);

      const result = await service.refresh({
        refreshToken: 'old_refresh_token',
      });

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('old_refresh_token', {
        secret: 'refresh_secret',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        user.refreshTokenHash,
        'old_refresh_token',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: user.refreshTokenHash },
      });
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        accessToken,
        refreshToken,
      });
    });

    it('rejects an invalid JWT refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.refresh({ refreshToken: 'invalid_refresh_token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a refresh token for a missing user', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'old_refresh_token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a refresh token when the stored hash is missing', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
      });
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        refreshTokenHash: null,
      });

      await expect(
        service.refresh({ refreshToken: 'old_refresh_token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a refresh token that does not match the stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(
        service.refresh({ refreshToken: 'old_refresh_token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the refresh token hash', async () => {
      const result = await service.logout(user.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getMe', () => {
    it('returns the current user profile', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      const result = await service.getMe(user.id);

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      });
      expect(result).toBe(user);
    });
  });
});
