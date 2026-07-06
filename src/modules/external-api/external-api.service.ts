import { Injectable, Inject } from '@nestjs/common';
import { AuditLogAction, UsageEventType } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { AI_PROVIDER, AiProvider } from '../ai/providers/ai-provider.interface';
import { AiSource } from '../ai/types/ai-source.type';
import { SearchService } from '../search/search.service';
import { UsageService } from '../usage/usage.service';
import { ExternalAskDto } from './dto/external-ask.dto';
import { KnowledgeGapsService } from '../knowledge-gaps/knowledge-gaps.service';

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
    private readonly knowledgeGapsService: KnowledgeGapsService,
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

    const bestScore = sources[0]?.score;

    if (sources.length === 0 || bestScore === undefined || bestScore < 0.2) {
      await this.knowledgeGapsService.track({
        organizationId,
        question: dto.question,
        sourcesCount: sources.length,
        bestScore,
        reason: sources.length === 0 ? 'no_sources' : 'low_score',
      });
    }

    return {
      answer: aiResult.answer,
      sources,
      needsHumanReview: aiResult.needsHumanReview,
    };
  }
}
