import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationMemberGuard } from '../../../../src/modules/organizations/guards/organization-member.guard';
import { RequestWithOrganization } from '../../../../src/modules/organizations/types/request-with-organization.type';

jest.mock('../../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('OrganizationMemberGuard', () => {
  let request: Partial<RequestWithOrganization>;

  let prisma: {
    membership: {
      findFirst: jest.Mock;
    };
  };

  let guard: OrganizationMemberGuard;

  const createContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    request = {
      user: { id: 'user_123', email: 'owner@supportmind.dev' },
      params: { organizationId: 'org_123' },
    };

    prisma = {
      membership: {
        findFirst: jest.fn(),
      },
    };

    guard = new OrganizationMemberGuard(prisma as never);
  });

  it('rejects requests without a user context', async () => {
    request.user = undefined;

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('rejects requests without an organization id', async () => {
    request.params = {};

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects requests with a non-string organization id', async () => {
    request.params = { organizationId: ['org_123', 'org_456'] };

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects users who are not members of the organization', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_123',
        organizationId: 'org_123',
        organization: { archivedAt: null },
      },
      select: { role: true, organizationId: true },
    });
  });

  it('attaches the membership role and allows access', async () => {
    prisma.membership.findFirst.mockResolvedValue({
      role: 'admin',
      organizationId: 'org_123',
    });

    const result = await guard.canActivate(createContext());

    expect(result).toBe(true);
    expect(request.organization).toEqual({
      id: 'org_123',
      role: 'admin',
    });
  });
});
