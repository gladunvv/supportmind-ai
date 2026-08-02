import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import {
  registerUser,
  RegisteredUser,
  uniqueEmail,
} from './helpers/register-user.helper';

type MembershipBody = {
  id: string;
  role: string;
  user: { id: string; email: string };
};

async function addMember(
  app: INestApplication<App>,
  accessToken: string,
  organizationId: string,
  email: string,
  role: string,
) {
  const response = await request(app.getHttpServer())
    .post(`/api/organizations/${organizationId}/members`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ email, role })
    .expect(201);

  return response.body as MembershipBody;
}

describe('Members (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'members-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Members E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);
  }, 30_000);

  afterAll(async () => {
    if (organizationIds.length > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }
    if (emails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }

    await app.close();
  }, 20_000);

  describe('POST /api/organizations/:organizationId/members', () => {
    it('adds an already-registered user as a member with the given role', async () => {
      const candidate = await registerUser(app, 'members-agent');
      emails.push(candidate.email);

      const membership = await addMember(
        app,
        owner.accessToken,
        organizationId,
        candidate.email,
        'support_agent',
      );

      expect(membership.role).toBe('support_agent');
      expect(membership.user.email).toBe(candidate.email);
    });

    it('rejects adding a user who has not registered', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: uniqueEmail('never-registered'), role: 'viewer' })
        .expect(404);
    });

    it('rejects adding the same member twice', async () => {
      const candidate = await registerUser(app, 'members-duplicate');
      emails.push(candidate.email);

      await addMember(
        app,
        owner.accessToken,
        organizationId,
        candidate.email,
        'viewer',
      );

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: candidate.email, role: 'viewer' })
        .expect(409);
    });
  });

  describe('GET /api/organizations/:organizationId/members', () => {
    it('lists all members with their roles', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const list = response.body as MembershipBody[];

      expect(
        list.some((m) => m.user.email === owner.email && m.role === 'owner'),
      ).toBe(true);
    });
  });

  describe('PATCH /api/organizations/:organizationId/members/:membershipId/role', () => {
    it('changes a member role', async () => {
      const candidate = await registerUser(app, 'members-role-change');
      emails.push(candidate.email);

      const membership = await addMember(
        app,
        owner.accessToken,
        organizationId,
        candidate.email,
        'viewer',
      );

      const response = await request(app.getHttpServer())
        .patch(
          `/api/organizations/${organizationId}/members/${membership.id}/role`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect((response.body as MembershipBody).role).toBe('admin');
    });

    it('prevents demoting the last owner', async () => {
      const soleOwnerUser = await registerUser(app, 'members-sole-owner');
      emails.push(soleOwnerUser.email);

      const soleOrgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .send({ name: 'Members Sole Owner Org' })
        .expect(201);
      const soleOrgId = (soleOrgResponse.body as { id: string }).id;
      organizationIds.push(soleOrgId);

      const membersResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${soleOrgId}/members`)
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .expect(200);
      const ownerMembership = (membersResponse.body as MembershipBody[]).find(
        (m) => m.role === 'owner',
      )!;

      await request(app.getHttpServer())
        .patch(
          `/api/organizations/${soleOrgId}/members/${ownerMembership.id}/role`,
        )
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .send({ role: 'admin' })
        .expect(400);
    });

    it('allows demoting an owner when another owner exists', async () => {
      const secondOwner = await registerUser(app, 'members-second-owner');
      emails.push(secondOwner.email);

      const soleOwnerUser = await registerUser(app, 'members-demote-owner');
      emails.push(soleOwnerUser.email);

      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .send({ name: 'Members Demote Owner Org' })
        .expect(201);
      const orgId = (orgResponse.body as { id: string }).id;
      organizationIds.push(orgId);

      await addMember(
        app,
        soleOwnerUser.accessToken,
        orgId,
        secondOwner.email,
        'owner',
      );

      const membersResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${orgId}/members`)
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .expect(200);
      const firstOwnerMembership = (
        membersResponse.body as MembershipBody[]
      ).find((m) => m.user.email === soleOwnerUser.email)!;

      await request(app.getHttpServer())
        .patch(
          `/api/organizations/${orgId}/members/${firstOwnerMembership.id}/role`,
        )
        .set('Authorization', `Bearer ${soleOwnerUser.accessToken}`)
        .send({ role: 'admin' })
        .expect(200);
    });
  });

  describe('DELETE /api/organizations/:organizationId/members/:membershipId', () => {
    it('removes a member', async () => {
      const candidate = await registerUser(app, 'members-remove');
      emails.push(candidate.email);

      const membership = await addMember(
        app,
        owner.accessToken,
        organizationId,
        candidate.email,
        'viewer',
      );

      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/members/${membership.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(
        (response.body as MembershipBody[]).some((m) => m.id === membership.id),
      ).toBe(false);
    });
  });

  describe('role-based access control', () => {
    it('denies a viewer from managing members or generating support replies', async () => {
      const viewerUser = await registerUser(app, 'members-viewer-rbac');
      emails.push(viewerUser.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        viewerUser.email,
        'viewer',
      );

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${viewerUser.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${viewerUser.accessToken}`)
        .send({ customerMessage: 'How do annual refunds work?' })
        .expect(403);
    });

    it('allows a support agent to draft support replies but not manage members', async () => {
      const agentUser = await registerUser(app, 'members-agent-rbac');
      emails.push(agentUser.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        agentUser.email,
        'support_agent',
      );

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${agentUser.accessToken}`)
        .send({ customerMessage: 'How do trials work?' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${agentUser.accessToken}`)
        .send({ email: uniqueEmail('irrelevant'), role: 'viewer' })
        .expect(403);
    });
  });
});
