import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { addMember } from './helpers/members.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type UsageSummaryBody = {
  periodStart: string;
  periodEnd: string;
  items: Array<{ type: string; quantity: number }>;
};

describe('Usage (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'usage-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Usage E2E Org' })
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

  describe('GET /api/organizations/:organizationId/usage', () => {
    it('reports current month usage including the document upload', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/usage`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const body = response.body as UsageSummaryBody;

      const uploaded = body.items.find(
        (item) => item.type === 'document_uploaded',
      );
      expect(uploaded?.quantity).toBeGreaterThanOrEqual(1);
    });

    it('rejects an admin, since usage is restricted to billing management', async () => {
      const admin = await registerUser(app, 'usage-admin');
      emails.push(admin.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        admin.email,
        'admin',
      );

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/usage`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(403);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/usage`)
        .expect(401);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'usage-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/usage`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });
  });
});
