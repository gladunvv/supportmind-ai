import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type SearchResultBody = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
};

describe('Search (e2e)', () => {
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

    owner = await registerUser(app, 'search-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Search E2E Org' })
      .expect(201);
    organizationId = (orgResponse.body as { id: string }).id;
    organizationIds.push(organizationId);

    const emptyOrgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Search E2E Empty Org' })
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

  describe('POST /api/organizations/:organizationId/search', () => {
    it('returns matching chunks for a relevant query', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/search`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ query: 'How do annual refunds work?' })
        .expect(200);

      const results = response.body as SearchResultBody[];

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toEqual(
        expect.objectContaining({
          chunkId: expect.any(String) as string,
          documentId: expect.any(String) as string,
          documentTitle: 'refund-policy',
          content: expect.any(String) as string,
          score: expect.any(Number) as number,
        }),
      );
    });

    it('returns no results for an organization with no indexed documents', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${emptyOrganizationId}/search`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ query: 'How do annual refunds work?' })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('rejects a query shorter than the minimum length', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/search`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ query: 'a' })
        .expect(400);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/search`)
        .send({ query: 'How do annual refunds work?' })
        .expect(401);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'search-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/search`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ query: 'How do annual refunds work?' })
        .expect(403);
    });
  });
});
