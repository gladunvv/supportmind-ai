import { SupportTone } from '../../../generated/prisma/enums';
import { AiSource } from '../../ai/types/ai-source.type';

export type SupportDraftResponse = {
  id: string;
  customerMessage: string;
  reply: string;
  tone: SupportTone;
  sources: AiSource[];
  riskFlags: string[];
  needsHumanReview: boolean;
  createdAt: Date;
};
