import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type SupportDraftBody = {
  id: string;
  customerMessage: string;
  reply: string;
  tone: string;
  sources: Array<{ chunkId: string }>;
  riskFlags: string[];
  needsHumanReview: boolean;
  createdAt: string;
};

type KnowledgeGapBody = {
  id: string;
  question: string;
};

describe('Support (e2e)', () => {
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

    owner = await registerUser(app, 'support-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Support E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);

    const emptyOrgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Support E2E Empty Org' })
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

  describe('POST /api/organizations/:organizationId/support/draft-reply', () => {
    it('drafts a reply grounded in the knowledge base with a default neutral tone', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ customerMessage: 'How do annual refunds work?' })
        .expect(200);

      const body = response.body as SupportDraftBody;

      expect(body.tone).toBe('neutral');
      expect(body.reply.startsWith('Hello,')).toBe(true);
      expect(body.sources.length).toBeGreaterThan(0);
    });

    it('uses a friendly greeting when the friendly tone is requested', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          customerMessage: 'How do annual refunds work?',
          tone: 'friendly',
        })
        .expect(200);

      const body = response.body as SupportDraftBody;

      expect(body.tone).toBe('friendly');
      expect(body.reply.startsWith('Hi there,')).toBe(true);
    });

    it('flags billing-sensitive messages for review even with a confident source', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ customerMessage: 'I want a refund for my annual plan' })
        .expect(200);

      const body = response.body as SupportDraftBody;

      expect(body.riskFlags).toContain('billing_sensitive');
      expect(body.needsHumanReview).toBe(true);
    });

    it('flags for review and records a knowledge gap when the knowledge base has no documents', async () => {
      const customerMessage = `Unanswerable support question ${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${emptyOrganizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ customerMessage })
        .expect(200);

      const body = response.body as SupportDraftBody;

      expect(body.sources).toEqual([]);
      expect(body.needsHumanReview).toBe(true);
      expect(body.riskFlags).toContain('insufficient_context');

      const gapsResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${emptyOrganizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const gaps = gapsResponse.body as KnowledgeGapBody[];

      expect(gaps.some((gap) => gap.question === customerMessage)).toBe(true);
    });

    it('rejects a customer message shorter than the minimum length', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ customerMessage: 'a' })
        .expect(400);
    });

    it('rejects an invalid tone value', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          customerMessage: 'How do annual refunds work?',
          tone: 'sarcastic',
        })
        .expect(400);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .send({ customerMessage: 'How do annual refunds work?' })
        .expect(401);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'support-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/support/draft-reply`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ customerMessage: 'How do annual refunds work?' })
        .expect(403);
    });
  });
});
