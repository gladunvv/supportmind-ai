import { AiSource } from './ai-source.type';

export type AiAnswer = {
  answer: string;
  sources: AiSource[];
  needsHumanReview: boolean;
};
