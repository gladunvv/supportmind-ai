import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../../../../src/modules/api-keys/guards/api-key.guard';

jest.mock('../../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ApiKeyGuard', () => {
  let request: {
    headers: { authorization?: string };
    apiKey?: { apiKeyId: string; organizationId: string; keyPrefix: string };
  };

  let apiKeysService: { validateRawKey: jest.Mock };

  let guard: ApiKeyGuard;

  const createContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    request = { headers: {} };

    apiKeysService = { validateRawKey: jest.fn() };

    guard = new ApiKeyGuard(apiKeysService as never);
  });

  it('rejects requests without an authorization header', async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(apiKeysService.validateRawKey).not.toHaveBeenCalled();
  });

  it('rejects authorization headers that are not Bearer tokens', async () => {
    request.headers.authorization = 'Basic sm_live_abc';

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(apiKeysService.validateRawKey).not.toHaveBeenCalled();
  });

  it('rejects an invalid or revoked API key', async () => {
    request.headers.authorization = 'Bearer sm_live_invalid';
    apiKeysService.validateRawKey.mockResolvedValue(null);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(apiKeysService.validateRawKey).toHaveBeenCalledWith(
      'sm_live_invalid',
    );
  });

  it('attaches the API key context and allows access', async () => {
    request.headers.authorization = 'Bearer sm_live_valid';
    const apiKeyContext = {
      apiKeyId: 'apikey_123',
      organizationId: 'org_123',
      keyPrefix: 'sm_live_abcdef12',
    };
    apiKeysService.validateRawKey.mockResolvedValue(apiKeyContext);

    const result = await guard.canActivate(createContext());

    expect(result).toBe(true);
    expect(request.apiKey).toEqual(apiKeyContext);
  });
});
