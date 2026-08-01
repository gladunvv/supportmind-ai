import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import {
  DocumentBody,
  waitForDocumentStatus,
} from './helpers/documents.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'doc-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Docs E2E Org' })
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

  describe('POST /api/organizations/:organizationId/documents', () => {
    it('uploads a markdown document and indexes it through the background pipeline', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .attach(
          'file',
          Buffer.from(
            'Refund policy\n\nAnnual plans may be reviewed by billing support.',
          ),
          {
            filename: 'refund-policy.md',
            contentType: 'text/markdown',
          },
        )
        .expect(201);

      const body = response.body as DocumentBody;

      expect(body.originalName).toBe('refund-policy.md');
      expect(body.mimeType).toBe('text/markdown');
      expect(['uploaded', 'processing', 'indexed']).toContain(body.status);

      const indexed = await waitForDocumentStatus(
        app,
        owner.accessToken,
        organizationId,
        body.id,
        ['indexed', 'failed'],
      );

      expect(indexed.status).toBe('indexed');
    }, 15_000);

    it('rejects an unsupported file type', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .attach('file', Buffer.from('binary content'), {
          filename: 'archive.zip',
          contentType: 'application/zip',
        })
        .expect(400);
    });

    it('rejects a request without a file', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'doc-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .attach('file', Buffer.from('content'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        })
        .expect(403);
    });
  });

  describe('GET /api/organizations/:organizationId/documents', () => {
    it('lists uploaded documents for the organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const list = response.body as DocumentBody[];

      expect(list.length).toBeGreaterThan(0);
      expect(list.every((doc) => doc.organizationId === organizationId)).toBe(
        true,
      );
    });
  });

  describe('DELETE /api/organizations/:organizationId/documents/:documentId', () => {
    it('removes a document once it has finished processing', async () => {
      const uploadResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/documents`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .attach('file', Buffer.from('Temporary note content'), {
          filename: 'temp-note.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      const documentId = (uploadResponse.body as DocumentBody).id;

      // Wait for the background ingestion job to reach a terminal state
      // before deleting, so cleanup doesn't race the in-flight job.
      await waitForDocumentStatus(
        app,
        owner.accessToken,
        organizationId,
        documentId,
        ['indexed', 'failed'],
      );

      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    }, 15_000);
  });
});
