import {
  WebhookEndpointStatus,
  WebhookEventType,
} from '../../../generated/prisma/enums';

export type WebhookEndpointResponse = {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  status: WebhookEndpointStatus;
  events: WebhookEventType[];
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
};
