import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { addMember } from './helpers/members.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type ApiKeyBody = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  status: string;
  key?: string;
};

type ExternalAskResponseBody = {
  answer: string;
  sources: Array<{ chunkId: string }>;
  needsHumanReview: boolean;
};

describe('API keys + External API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'apikeys-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'API Keys E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);

    await uploadAndIndexDocument(
      app,
      owner.accessToken,
      organizationId,
      'Refund policy\n\nAnnual plans may be reviewed by billing support. Customers should provide an invoice ID and account email.',
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

  describe('POST /api/organizations/:organizationId/api-keys', () => {
    it('creates a key, returns the raw value once, and hides it from later listings', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/api-keys`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'CI integration' })
        .expect(201);

      const created = createResponse.body as ApiKeyBody;

      expect(created.key).toMatch(/^sm_live_/);
      expect(created.keyPrefix.startsWith('sm_live_')).toBe(true);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/api-keys`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const list = listResponse.body as ApiKeyBody[];
      const listed = list.find((k) => k.id === created.id);

      expect(listed).toBeDefined();
      expect(listed?.key).toBeUndefined();
    });

    it('rejects a non-admin member from creating a key', async () => {
      const agent = await registerUser(app, 'apikeys-agent');
      emails.push(agent.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        agent.email,
        'support_agent',
      );

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/api-keys`)
        .set('Authorization', `Bearer ${agent.accessToken}`)
        .send({ name: 'Should not be created' })
        .expect(403);
    });
  });

  describe('POST /api/v1/ask (external API)', () => {
    it('answers a question using a valid API key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/api-keys`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'External ask key' })
        .expect(201);

      const rawKey = (createResponse.body as ApiKeyBody).key!;

      const askResponse = await request(app.getHttpServer())
        .post('/api/v1/ask')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ question: 'How do annual refunds work?' })
        .expect(200);

      const body = askResponse.body as ExternalAskResponseBody;

      expect(body.sources.length).toBeGreaterThan(0);
      expect(typeof body.answer).toBe('string');
    });

    it('rejects requests without an API key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ask')
        .send({ question: 'How do annual refunds work?' })
        .expect(401);
    });

    it('rejects requests with a garbage bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ask')
        .set('Authorization', 'Bearer not-a-real-key')
        .send({ question: 'How do annual refunds work?' })
        .expect(401);
    });

    it('rejects requests using a revoked key', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/api-keys`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Revoke me' })
        .expect(201);

      const apiKey = createResponse.body as ApiKeyBody;

      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/api-keys/${apiKey.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/ask')
        .set('Authorization', `Bearer ${apiKey.key!}`)
        .send({ question: 'How do annual refunds work?' })
        .expect(401);
    });
  });
});
