import { ApiKeyStatus } from '../../../generated/prisma/enums';

export type ApiKeyResponse = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
};
