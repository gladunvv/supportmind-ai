import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';

type OrganizationBody = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

describe('Organizations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  const organizationIds: string[] = [];
  const emails: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);

    owner = await registerUser(app, 'org-owner');
    emails.push(owner.email);
  });

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
  });

  describe('POST /api/organizations', () => {
    it('creates an organization and makes the caller its owner', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Acme Support', description: 'Acme support org' })
        .expect(201);

      const body = response.body as OrganizationBody;
      organizationIds.push(body.id);

      expect(body.name).toBe('Acme Support');
      expect(body.slug).toBe('acme-support');

      const listResponse = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const list = listResponse.body as Array<
        OrganizationBody & { role: string }
      >;
      const created = list.find((org) => org.id === body.id);

      expect(created?.role).toBe('owner');

      const auditLog = await prisma.auditLog.findFirst({
        where: { organizationId: body.id, action: 'organization_created' },
      });
      expect(auditLog?.actorUserId).toBe(owner.userId);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'No auth org' })
        .expect(401);
    });
  });

  describe('GET /api/organizations/:organizationId', () => {
    let organizationId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Acme Details Org' })
        .expect(201);

      organizationId = (response.body as OrganizationBody).id;
      organizationIds.push(organizationId);
    });

    it('returns the organization for a member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect((response.body as OrganizationBody).id).toBe(organizationId);
    });

    it('rejects a user who is not a member of the organization', async () => {
      const outsider = await registerUser(app, 'org-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });

    it('rejects a non-existent organization without leaking its existence', async () => {
      await request(app.getHttpServer())
        .get('/api/organizations/does-not-exist')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/organizations/:organizationId', () => {
    let organizationId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Acme Update Org' })
        .expect(201);

      organizationId = (response.body as OrganizationBody).id;
      organizationIds.push(organizationId);
    });

    it('allows the owner to update the organization', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Acme Updated Name' })
        .expect(200);

      expect((response.body as OrganizationBody).name).toBe(
        'Acme Updated Name',
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: { organizationId, action: 'organization_updated' },
      });
      expect(auditLog?.actorUserId).toBe(owner.userId);
    });

    it('rejects a non-member from updating the organization', async () => {
      const outsider = await registerUser(app, 'org-update-outsider');
      emails.push(outsider.email);

      await request(app.getHttpServer())
        .patch(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ name: 'Hijacked name' })
        .expect(403);
    });
  });

  describe('DELETE /api/organizations/:organizationId', () => {
    let organizationId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Acme Archive Org' })
        .expect(201);

      organizationId = (response.body as OrganizationBody).id;
      organizationIds.push(organizationId);
    });

    it('archives the organization and hides it from subsequent access', async () => {
      await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(403);

      const listResponse = await request(app.getHttpServer())
        .get('/api/organizations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const list = listResponse.body as OrganizationBody[];
      expect(list.some((org) => org.id === organizationId)).toBe(false);

      const auditLog = await prisma.auditLog.findFirst({
        where: { organizationId, action: 'organization_archived' },
      });
      expect(auditLog?.actorUserId).toBe(owner.userId);
    });
  });
});
