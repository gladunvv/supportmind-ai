import { Injectable, Inject } from '@nestjs/common';
import { AuditLogAction, UsageEventType } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { AI_PROVIDER, AiProvider } from '../ai/providers/ai-provider.interface';
import { AiSource } from '../ai/types/ai-source.type';
import { SearchService } from '../search/search.service';
import { UsageService } from '../usage/usage.service';
import { ExternalAskDto } from './dto/external-ask.dto';

export type ExternalAskResponse = {
  answer: string;
  sources: AiSource[];
  needsHumanReview: boolean;
};

@Injectable()
export class ExternalApiService {
  constructor(
    private readonly searchService: SearchService,
    private readonly usageService: UsageService,
    private readonly auditService: AuditService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
  ) {}

  async ask(
    organizationId: string,
    apiKeyId: string,
    dto: ExternalAskDto,
  ): Promise<ExternalAskResponse> {
    const searchResults = await this.searchService.search(organizationId, {
      query: dto.question,
    });

    const sources: AiSource[] = searchResults.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      content: result.content,
      score: result.score,
    }));

    const aiResult = await this.aiProvider.generateAnswer({
      question: dto.question,
      sources,
    });

    await this.usageService.track({
      organizationId,
      type: UsageEventType.api_key_request,
      metadata: {
        apiKeyId,
        endpoint: 'external_ask',
        questionLength: dto.question.length,
        sourcesCount: sources.length,
        needsHumanReview: aiResult.needsHumanReview,
      },
    });

    await this.auditService.log({
      organizationId,
      action: AuditLogAction.api_key_used,
      entityType: 'api_key',
      entityId: apiKeyId,
      metadata: {
        endpoint: 'external_ask',
        questionLength: dto.question.length,
        sourcesCount: sources.length,
        needsHumanReview: aiResult.needsHumanReview,
      },
    });

    return {
      answer: aiResult.answer,
      sources,
      needsHumanReview: aiResult.needsHumanReview,
    };
  }
}
