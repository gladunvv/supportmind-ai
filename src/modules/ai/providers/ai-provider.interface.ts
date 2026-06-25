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

export interface AiProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult>;
}
