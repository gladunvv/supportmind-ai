import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../../../src/modules/auth/guards/permissions.guard';
import { Permission } from '../../../../src/modules/auth/types/permission.type';
import { RequestWithOrganization } from '../../../../src/modules/organizations/types/request-with-organization.type';

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let request: Partial<RequestWithOrganization>;
  let guard: PermissionsGuard;

  const createContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    request = {};
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows access when no permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows access when the required permissions array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('throws ForbiddenException when the organization context is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.AskAi]);
    request.organization = undefined;

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when the role lacks a required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.ManageOrganization,
    ]);
    request.organization = { id: 'org_123', role: 'viewer' as never };

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when only some of several required permissions are present', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.AskAi,
      Permission.ManageOrganization,
    ]);
    request.organization = { id: 'org_123', role: 'support_agent' as never };

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('allows access when the role has all required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.AskAi,
      Permission.GenerateSupportReply,
    ]);
    request.organization = { id: 'org_123', role: 'support_agent' as never };

    expect(guard.canActivate(createContext())).toBe(true);
  });
});
