import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../src/modules/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const originalEnv = process.env;

  let request: {
    headers: {
      authorization?: string;
    };
    user?: {
      id: string;
      email: string;
    };
  };

  let jwtService: {
    verifyAsync: jest.Mock;
  };

  let guard: JwtAuthGuard;

  const createContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_ACCESS_SECRET: 'access_secret',
    };

    request = {
      headers: {},
    };

    jwtService = {
      verifyAsync: jest.fn(),
    };

    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects requests without an authorization header', async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects authorization headers that are not Bearer tokens', async () => {
    request.headers.authorization = 'Basic token';

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('attaches the authenticated user to the request', async () => {
    request.headers.authorization = 'Bearer access_token';
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user_123',
      email: 'owner@supportmind.dev',
    });

    const result = await guard.canActivate(createContext());

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access_token', {
      secret: 'access_secret',
    });
    expect(request.user).toEqual({
      id: 'user_123',
      email: 'owner@supportmind.dev',
    });
    expect(result).toBe(true);
  });

  it('rejects invalid or expired access tokens', async () => {
    request.headers.authorization = 'Bearer invalid_token';
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(request.user).toBeUndefined();
  });
});
