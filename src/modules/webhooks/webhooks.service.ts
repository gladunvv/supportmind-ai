import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import {
  AuditLogAction,
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
} from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { EmitWebhookEventInput } from './types/emit-webhook-event.type';
import { WebhookDeliveryResponse } from './types/webhook-delivery-response.type';
import { WebhookEndpointResponse } from './types/webhook-endpoint-response.type';
import { createWebhookSignature } from './utils/webhook-signature.util';

const WEBHOOK_ENDPOINT_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  url: true,
  status: true,
  events: true,
  createdAt: true,
  updatedAt: true,
  disabledAt: true,
} satisfies Prisma.WebhookEndpointSelect;

const WEBHOOK_DELIVERY_SELECT = {
  id: true,
  organizationId: true,
  webhookEndpointId: true,
  eventType: true,
  status: true,
  responseStatus: true,
  responseBody: true,
  errorMessage: true,
  createdAt: true,
  deliveredAt: true,
} satisfies Prisma.WebhookDeliverySelect;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createEndpoint(
    organizationId: string,
    user: AuthUser,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpointResponse & { secret: string }> {
    if (!dto.url.startsWith('https://') && !dto.url.includes('localhost')) {
      throw new BadRequestException(
        'Webhook URL must use HTTPS, except localhost for development',
      );
    }

    const secret = this.generateSecret();

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId,
        createdById: user.id,
        name: dto.name,
        url: dto.url,
        secret,
        events: dto.events,
      },
      select: WEBHOOK_ENDPOINT_SELECT,
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.webhook_endpoint_created,
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
      metadata: {
        name: endpoint.name,
        url: endpoint.url,
        events: endpoint.events,
      },
    });

    return {
      ...endpoint,
      secret,
    };
  }

  async findEndpoints(
    organizationId: string,
  ): Promise<WebhookEndpointResponse[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: {
        organizationId,
      },
      select: WEBHOOK_ENDPOINT_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async disableEndpoint(
    organizationId: string,
    webhookEndpointId: string,
    user: AuthUser,
  ): Promise<WebhookEndpointResponse> {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        id: webhookEndpointId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        url: true,
      },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const disabledEndpoint = await this.prisma.webhookEndpoint.update({
      where: {
        id: endpoint.id,
      },
      data: {
        status: WebhookEndpointStatus.disabled,
        disabledAt: new Date(),
      },
      select: WEBHOOK_ENDPOINT_SELECT,
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.webhook_endpoint_disabled,
      entityType: 'webhook_endpoint',
      entityId: endpoint.id,
      metadata: {
        name: endpoint.name,
        url: endpoint.url,
      },
    });

    return disabledEndpoint;
  }

  async findDeliveries(
    organizationId: string,
  ): Promise<WebhookDeliveryResponse[]> {
    return this.prisma.webhookDelivery.findMany({
      where: {
        organizationId,
      },
      select: WEBHOOK_DELIVERY_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async emit(input: EmitWebhookEventInput): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        organizationId: input.organizationId,
        status: WebhookEndpointStatus.active,
        events: {
          has: input.eventType,
        },
      },
      select: {
        id: true,
        organizationId: true,
        url: true,
        secret: true,
      },
    });

    await Promise.all(
      endpoints.map((endpoint) => this.deliverToEndpoint(endpoint, input)),
    );
  }

  private async deliverToEndpoint(
    endpoint: {
      id: string;
      organizationId: string;
      url: string;
      secret: string;
    },
    input: EmitWebhookEventInput,
  ): Promise<void> {
    const payload = {
      event: input.eventType,
      organizationId: input.organizationId,
      data: input.payload,
      createdAt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createWebhookSignature({
      secret: endpoint.secret,
      timestamp,
      body,
    });

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        organizationId: endpoint.organizationId,
        webhookEndpointId: endpoint.id,
        eventType: input.eventType,
        payload: payload as Prisma.InputJsonObject,
        status: WebhookDeliveryStatus.pending,
      },
      select: {
        id: true,
      },
    });

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-supportmind-event': input.eventType,
          'x-supportmind-timestamp': timestamp,
          'x-supportmind-signature': signature,
        },
        body,
      });

      const responseBody = await response.text();

      await this.prisma.webhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: response.ok
            ? WebhookDeliveryStatus.succeeded
            : WebhookDeliveryStatus.failed,
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 2000),
          deliveredAt: new Date(),
        },
      });

      await this.auditService.log({
        organizationId: endpoint.organizationId,
        action: response.ok
          ? AuditLogAction.webhook_delivery_succeeded
          : AuditLogAction.webhook_delivery_failed,
        entityType: 'webhook_delivery',
        entityId: delivery.id,
        metadata: {
          webhookEndpointId: endpoint.id,
          eventType: input.eventType,
          responseStatus: response.status,
        },
      });
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: WebhookDeliveryStatus.failed,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown webhook error',
          deliveredAt: new Date(),
        },
      });

      await this.auditService.log({
        organizationId: endpoint.organizationId,
        action: AuditLogAction.webhook_delivery_failed,
        entityType: 'webhook_delivery',
        entityId: delivery.id,
        metadata: {
          webhookEndpointId: endpoint.id,
          eventType: input.eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private generateSecret(): string {
    return `whsec_${randomBytes(32).toString('base64url')}`;
  }
}
