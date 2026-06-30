import { Inject, Injectable } from '@nestjs/common';
import { AiQuestionStatus, AuditLogAction } from '../../generated/prisma/enums';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { AskAiDto } from './dto/ask-ai.dto';
import { AI_PROVIDER, AiProvider } from './providers/ai-provider.interface';
import { AiAnswer } from './types/ai-answer.type';
import { AiSource } from './types/ai-source.type';
import { UsageEventType } from '../../generated/prisma/enums';
import { UsageService } from '../usage/usage.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
    private readonly usageService: UsageService,
    private readonly auditService: AuditService,
  ) {}

  async ask(
    organizationId: string,
    user: AuthUser,
    dto: AskAiDto,
  ): Promise<AiAnswer> {
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

    const aiQuestion = await this.prisma.aiQuestion.create({
      data: {
        organizationId,
        askedById: user.id,
        question: dto.question,
        answer: aiResult.answer,
        needsReview: aiResult.needsHumanReview,
        status: aiResult.needsHumanReview
          ? AiQuestionStatus.needs_review
          : AiQuestionStatus.answered,
        sources,
      },
    });

    await this.usageService.track({
      organizationId,
      userId: user.id,
      type: UsageEventType.ai_question_asked,
      metadata: {
        questionLength: dto.question.length,
        sourcesCount: sources.length,
        needsHumanReview: aiResult.needsHumanReview,
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.ai_question_asked,
      entityType: 'ai_question',
      entityId: aiQuestion.id,
      metadata: {
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
