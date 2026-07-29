import { ROLE_PERMISSIONS } from '../../../../src/modules/auth/permissions/role-permissions';
import { Permission } from '../../../../src/modules/auth/types/permission.type';

describe('ROLE_PERMISSIONS', () => {
  it('grants the owner every permission', () => {
    expect(new Set(ROLE_PERMISSIONS.owner)).toEqual(
      new Set(Object.values(Permission)),
    );
  });

  it('does not grant the admin billing management', () => {
    expect(ROLE_PERMISSIONS.admin).not.toContain(Permission.ManageBilling);
  });

  it('grants the admin every permission except billing', () => {
    const expected = Object.values(Permission).filter(
      (permission) => permission !== Permission.ManageBilling,
    );

    expect(new Set(ROLE_PERMISSIONS.admin)).toEqual(new Set(expected));
  });

  it('limits the support agent to AI and support reply permissions', () => {
    expect(new Set(ROLE_PERMISSIONS.support_agent)).toEqual(
      new Set([Permission.AskAi, Permission.GenerateSupportReply]),
    );
  });

  it('limits the viewer to asking AI questions', () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual([Permission.AskAi]);
  });

  it('never grants a lower role more permissions than a higher role', () => {
    const roleOrder = ['viewer', 'support_agent', 'admin', 'owner'] as const;

    for (let i = 0; i < roleOrder.length - 1; i += 1) {
      const lower = new Set(ROLE_PERMISSIONS[roleOrder[i]]);
      const higher = new Set(ROLE_PERMISSIONS[roleOrder[i + 1]]);

      for (const permission of lower) {
        expect(higher.has(permission)).toBe(true);
      }
    }
  });
});
