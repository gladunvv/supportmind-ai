import { UsageEventType } from '../../../generated/prisma/enums';

export type TrackUsageEventInput = {
  organizationId: string;
  userId?: string;
  type: UsageEventType;
  quantity?: number;
  metadata?: Record<string, any>;
};
