import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createWebhookSignature } from '../../src/modules/webhooks/utils/webhook-signature.util';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uploadAndIndexDocument } from './helpers/documents.helper';
import { addMember } from './helpers/members.helper';
import { registerUser, RegisteredUser } from './helpers/register-user.helper';
import {
  startWebhookReceiver,
  WebhookReceiver,
} from './helpers/webhook-receiver.helper';

type WebhookEndpointBody = {
  id: string;
  url: string;
  status: string;
  events: string[];
  secret?: string;
};

type WebhookDeliveryBody = {
  eventType: string;
  status: string;
};

describe('Webhooks (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: RegisteredUser;
  let organizationId: string;
  let receiver: WebhookReceiver;
  const emails: string[] = [];
  const organizationIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
    receiver = await startWebhookReceiver();

    owner = await registerUser(app, 'webhooks-owner');
    emails.push(owner.email);

    const orgResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Webhooks E2E Org' })
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

    await receiver.close();
    await app.close();
  }, 20_000);

  describe('POST /api/organizations/:organizationId/webhooks', () => {
    it('rejects a plain http url for a non-localhost host', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Evil hook',
          url: 'http://evil.example.com/hook',
          events: ['document_indexed'],
        })
        .expect(400);
    });

    it('rejects a hostname that merely contains "localhost" as a substring', async () => {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Spoofed hook',
          url: 'http://localhost.attacker.com/hook',
          events: ['document_indexed'],
        })
        .expect(400);
    });

    it('rejects a non-admin member from creating a webhook endpoint', async () => {
      const agent = await registerUser(app, 'webhooks-agent');
      emails.push(agent.email);
      await addMember(
        app,
        owner.accessToken,
        organizationId,
        agent.email,
        'support_agent',
      );

      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${agent.accessToken}`)
        .send({
          name: 'Should not be created',
          url: `http://127.0.0.1:${receiver.port}/hook`,
          events: ['document_indexed'],
        })
        .expect(403);
    });
  });

  describe('webhook delivery', () => {
    it('delivers a signed document_indexed event to a registered endpoint', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'E2E receiver',
          url: `http://127.0.0.1:${receiver.port}/hook`,
          events: ['document_indexed'],
        })
        .expect(201);

      const endpoint = createResponse.body as WebhookEndpointBody;
      expect(endpoint.secret).toBeDefined();

      const deliveryPromise = receiver.waitForDelivery();

      await uploadAndIndexDocument(
        app,
        owner.accessToken,
        organizationId,
        'Refund policy\n\nAnnual plans may be reviewed by billing support.',
        'refund-policy.md',
        'text/markdown',
      );

      const delivery = await deliveryPromise;

      expect(delivery.headers['x-supportmind-event']).toBe('document_indexed');
      const timestamp = delivery.headers['x-supportmind-timestamp'] as string;
      const signature = delivery.headers['x-supportmind-signature'] as string;
      expect(timestamp).toBeDefined();
      expect(signature).toBeDefined();

      const expectedSignature = createWebhookSignature({
        secret: endpoint.secret!,
        timestamp,
        body: delivery.body,
      });
      expect(signature).toBe(expectedSignature);

      const payload = JSON.parse(delivery.body) as { event: string };
      expect(payload.event).toBe('document_indexed');

      const deliveriesResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/webhooks/deliveries`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const deliveries = (
        deliveriesResponse.body as { data: WebhookDeliveryBody[] }
      ).data;
      expect(
        deliveries.some(
          (d) => d.eventType === 'document_indexed' && d.status === 'succeeded',
        ),
      ).toBe(true);
    }, 20_000);
  });

  describe('DELETE /api/organizations/:organizationId/webhooks/:webhookEndpointId', () => {
    it('disables an endpoint so it no longer receives events', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'To be disabled',
          url: `http://127.0.0.1:${receiver.port}/hook`,
          events: ['document_indexed'],
        })
        .expect(201);

      const endpoint = createResponse.body as WebhookEndpointBody;

      const disableResponse = await request(app.getHttpServer())
        .delete(`/api/organizations/${organizationId}/webhooks/${endpoint.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect((disableResponse.body as WebhookEndpointBody).status).toBe(
        'disabled',
      );

      const listResponse = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}/webhooks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const listed = (listResponse.body as WebhookEndpointBody[]).find(
        (e) => e.id === endpoint.id,
      );
      expect(listed?.status).toBe('disabled');
    });
  });
});
