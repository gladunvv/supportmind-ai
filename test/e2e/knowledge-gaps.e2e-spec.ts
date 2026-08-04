import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { addMember } from './helpers/members.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type KnowledgeGapBody = {
  id: string;
  question: string;
  status: string;
  frequency: number;
};

describe('Knowledge gaps (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  const askQuestion = (question: string) =>
    request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/ai/ask`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ question })
      .expect(200);

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'gaps-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Knowledge Gaps E2E Org' })
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

  describe('GET /api/organizations/:organizationId/knowledge-gaps', () => {
    it('lists a gap created by an unanswerable question and increments its frequency on repeat', async () => {
      const question = `Unanswerable knowledge-gap question ${Date.now()}`;

      await askQuestion(question);

      const firstResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const firstGap = (firstResponse.body as KnowledgeGapBody[]).find(
        (gap) => gap.question === question,
      );
      expect(firstGap?.status).toBe('open');
      expect(firstGap?.frequency).toBe(1);

      await askQuestion(question);

      const secondResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const secondGap = (secondResponse.body as KnowledgeGapBody[]).find(
        (gap) => gap.question === question,
      );
      expect(secondGap?.frequency).toBe(2);
    });

    it('rejects a support agent, who cannot manage the organization', async () => {
      const agent = await registerUser(app, 'gaps-agent');
      emails.push(agent.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        agent.email,
        'support_agent',
      );

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${agent.accessToken}`)
        .expect(403);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .expect(401);
    });
  });

  describe('PATCH /api/organizations/:organizationId/knowledge-gaps/:knowledgeGapId/status', () => {
    it('resolves a gap and removes it from the open list', async () => {
      const question = `Resolvable knowledge-gap question ${Date.now()}`;
      await askQuestion(question);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      const gap = (listResponse.body as KnowledgeGapBody[]).find(
        (g) => g.question === question,
      )!;

      const patchResponse = await request(app.getHttpServer())
        .patch(
          `/api/organizations/${organizationId}/knowledge-gaps/${gap.id}/status`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect((patchResponse.body as KnowledgeGapBody).status).toBe('resolved');

      const afterResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(
        (afterResponse.body as KnowledgeGapBody[]).some((g) => g.id === gap.id),
      ).toBe(false);
    });

    it('returns 404 for a non-existent knowledge gap', async () => {
      await request(app.getHttpServer())
        .patch(
          `/api/organizations/${organizationId}/knowledge-gaps/does-not-exist/status`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'resolved' })
        .expect(404);
    });

    it('rejects an invalid status value', async () => {
      const question = `Invalid status question ${Date.now()}`;
      await askQuestion(question);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/knowledge-gaps`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      const gap = (listResponse.body as KnowledgeGapBody[]).find(
        (g) => g.question === question,
      )!;

      await request(app.getHttpServer())
        .patch(
          `/api/organizations/${organizationId}/knowledge-gaps/${gap.id}/status`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'archived' })
        .expect(400);
    });
  });
});
