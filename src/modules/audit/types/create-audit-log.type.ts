import { AuditLogAction } from '../../../generated/prisma/enums';
import { Prisma } from '../../../generated/prisma/client';

export type CreateAuditLogInput = {
  organizationId: string;
  actorUserId?: string;
  action: AuditLogAction;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
};
