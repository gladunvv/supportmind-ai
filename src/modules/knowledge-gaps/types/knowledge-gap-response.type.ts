import { KnowledgeGapStatus } from '../../../generated/prisma/enums';

export type KnowledgeGapResponse = {
  id: string;
  organizationId: string;
  question: string;
  normalizedText: string;
  status: KnowledgeGapStatus;
  frequency: number;
  lastAskedAt: Date;
  exampleSources: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};
