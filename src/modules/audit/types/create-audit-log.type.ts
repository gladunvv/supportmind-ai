import { AuditLogAction } from '../../../generated/prisma/enums';

export type CreateAuditLogInput = {
  organizationId: string;
  actorUserId?: string;
  action: AuditLogAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};
