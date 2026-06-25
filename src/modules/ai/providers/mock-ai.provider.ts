import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  GenerateAnswerInput,
  GenerateAnswerResult,
} from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
    if (input.sources.length === 0) {
      return Promise.resolve({
        answer:
          "I couldn't find enough information in the knowledge base to answer this confidently.",
        needsHumanReview: true,
      });
    }

    const bestSource = input.sources[0];

    return Promise.resolve({
      answer: [
        `Based on the knowledge base, ${this.createAnswerFromSource(bestSource.content)}`,
        '',
        'This answer was generated from the most relevant available document chunk.',
      ].join('\n'),
      needsHumanReview: bestSource.score < 0.2,
    });
  }

  private createAnswerFromSource(content: string): string {
    const firstParagraph = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');

    return firstParagraph || 'there is limited relevant information available.';
  }
}
