import { AuditLogAction } from '../../../generated/prisma/enums';

export type AuditLogResponse = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: AuditLogAction;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  actorUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};
