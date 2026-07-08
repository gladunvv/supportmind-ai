import { WebhookEventType } from '../../../generated/prisma/enums';

export type EmitWebhookEventInput = {
  organizationId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
};
