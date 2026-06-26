import { Injectable } from '@nestjs/common';
import {
  AiProvider,
  GenerateAnswerInput,
  GenerateAnswerResult,
  GenerateSupportReplyInput,
  GenerateSupportReplyResult,
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

  generateSupportReply(
    input: GenerateSupportReplyInput,
  ): Promise<GenerateSupportReplyResult> {
    if (input.sources.length === 0) {
      return Promise.resolve({
        reply: [
          'Hi,',
          '',
          'Thanks for reaching out. I do not have enough information in the knowledge base to answer this confidently, so I will ask a teammate to review this request.',
          '',
          'Best,',
          'Support Team',
        ].join('\n'),
        needsHumanReview: true,
        riskFlags: ['insufficient_context'],
      });
    }

    const bestSource = input.sources[0];
    const riskFlags = this.detectRiskFlags(input.customerMessage);

    return Promise.resolve({
      reply: this.createSupportReply({
        customerMessage: input.customerMessage,
        sourceContent: bestSource.content,
        tone: input.tone,
      }),
      needsHumanReview: bestSource.score < 0.2 || riskFlags.length > 0,
      riskFlags,
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

  private createSupportReply(input: {
    customerMessage: string;
    sourceContent: string;
    tone: string;
  }): string {
    const sourceSummary = this.createAnswerFromSource(input.sourceContent);

    const greeting = input.tone === 'friendly' ? 'Hi there,' : 'Hello,';

    const closing =
      input.tone === 'concise'
        ? 'Best,\nSupport Team'
        : 'Please let us know if you have any other questions.\n\nBest,\nSupport Team';

    return [
      greeting,
      '',
      'Thanks for reaching out.',
      '',
      `Based on our current policy, ${sourceSummary}`,
      '',
      closing,
    ].join('\n');
  }

  private detectRiskFlags(customerMessage: string): string[] {
    const normalized = customerMessage.toLowerCase();
    const flags: string[] = [];

    if (
      normalized.includes('legal') ||
      normalized.includes('lawsuit') ||
      normalized.includes('attorney')
    ) {
      flags.push('legal_risk');
    }

    if (
      normalized.includes('angry') ||
      normalized.includes('furious') ||
      normalized.includes('cancel immediately')
    ) {
      flags.push('customer_escalation');
    }

    if (
      normalized.includes('refund') ||
      normalized.includes('chargeback') ||
      normalized.includes('payment')
    ) {
      flags.push('billing_sensitive');
    }

    return flags;
  }
}
