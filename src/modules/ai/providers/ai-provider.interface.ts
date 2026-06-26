import { SupportTone } from '../../../generated/prisma/enums';
import { AiSource } from '../types/ai-source.type';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type GenerateAnswerInput = {
  question: string;
  sources: AiSource[];
};

export type GenerateAnswerResult = {
  answer: string;
  needsHumanReview: boolean;
};

export type GenerateSupportReplyInput = {
  customerMessage: string;
  tone: SupportTone;
  sources: AiSource[];
};

export type GenerateSupportReplyResult = {
  reply: string;
  needsHumanReview: boolean;
  riskFlags: string[];
};

export interface AiProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult>;

  generateSupportReply(
    input: GenerateSupportReplyInput,
  ): Promise<GenerateSupportReplyResult>;
}
