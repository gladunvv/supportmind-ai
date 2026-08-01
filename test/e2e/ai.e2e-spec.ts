import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type AiAskResponseBody = {
  answer: string;
  sources: Array<{ chunkId: string; documentId: string; score: number }>;
  needsHumanReview: boolean;
};

type KnowledgeGapBody = {
  id: string;
  question: string;
  status: string;
};

describe('AI (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  let emptyOrganizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'ai-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'AI E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);

    const emptyOrgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'AI E2E Empty Org' })
      .expect(201);
    emptyOrganizationId = (emptyOrgResponse.body as { id: string }).id;
    organizationIds.push(emptyOrganizationId);

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

  describe('POST /api/organizations/:organizationId/ai/ask', () => {
    it('answers a question grounded in the indexed knowledge base', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/ai/ask`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ question: 'How do annual refunds work?' })
        .expect(200);

      const body = response.body as AiAskResponseBody;

      expect(typeof body.answer).toBe('string');
      expect(body.answer.length).toBeGreaterThan(0);
      expect(body.sources.length).toBeGreaterThan(0);
      expect(typeof body.needsHumanReview).toBe('boolean');
    });

    it('flags for review and records a knowledge gap when the knowledge base has no documents', async () => {
      const question = `Unanswerable question ${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${emptyOrganizationId}/ai/ask`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ question })
        .expect(200);

      const body = response.body as AiAskResponseBody;

      expect(body.sources).toEqual([]);
      expect(body.needsHumanReview).toBe(true);

      const gapsResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${emptyOrganizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const gaps = gapsResponse.body as KnowledgeGapBody[];

      expect(gaps.some((gap) => gap.question === question)).toBe(true);
    });

    it('rejects a question shorter than the minimum length', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/ai/ask`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ question: 'a' })
        .expect(400);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/ai/ask`)
        .send({ question: 'How do annual refunds work?' })
        .expect(401);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'ai-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/ai/ask`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ question: 'How do annual refunds work?' })
        .expect(403);
    });
  });
});
