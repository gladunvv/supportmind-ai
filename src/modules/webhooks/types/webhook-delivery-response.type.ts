import {
  WebhookDeliveryStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums';

export type WebhookDeliveryResponse = {
  id: string;
  organizationId: string;
  webhookEndpointId: string;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
};
