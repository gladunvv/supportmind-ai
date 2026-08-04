import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { addMember } from './helpers/members.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type AuditLogBody = {
  action: string;
  entityType: string;
  actorUserId: string | null;
};

type AuditLogPage = {
  data: AuditLogBody[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

describe('Audit logs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'audit-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Audit E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);

    await uploadAndIndexDocument(
      app,
      owner.accessToken,
      organizationId,
      'Refund policy\n\nAnnual plans may be reviewed by billing support.',
      'refund-policy.md',
      'text/markdown',
    );
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

  describe('GET /api/organizations/:organizationId/audit-logs', () => {
    it('records the document upload performed by the caller', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const page = response.body as AuditLogPage;

      const uploadEntry = page.data.find(
        (entry) => entry.action === 'document_uploaded',
      );
      expect(uploadEntry?.actorUserId).toBe(owner.userId);
    });

    it('records the background indexing job without an actor', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const page = response.body as AuditLogPage;
      const indexedEntry = page.data.find(
        (entry) => entry.action === 'document_indexed',
      );

      expect(indexedEntry).toBeDefined();
    });

    it('paginates results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const page = response.body as AuditLogPage;

      expect(page.data).toHaveLength(1);
      expect(page.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('rejects a support agent, who lacks audit log visibility', async () => {
      const agent = await registerUser(app, 'audit-agent');
      emails.push(agent.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        agent.email,
        'support_agent',
      );

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .set('Authorization', `Bearer ${agent.accessToken}`)
        .expect(403);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .expect(401);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'audit-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/audit-logs`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });
  });
});
