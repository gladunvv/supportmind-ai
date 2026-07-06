import { Inject, Injectable } from '@nestjs/common';
import { AuditLogAction, SupportTone } from '../../generated/prisma/enums';
import { AI_PROVIDER, AiProvider } from '../ai/providers/ai-provider.interface';
import { AiSource } from '../ai/types/ai-source.type';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { DraftSupportReplyDto } from './dto/draft-support-reply.dto';
import { SupportDraftResponse } from './types/support-draft-response.type';
import { UsageEventType } from '../../generated/prisma/enums';
import { UsageService } from '../usage/usage.service';
import { AuditService } from '../audit/audit.service';
import { KnowledgeGapsService } from '../knowledge-gaps/knowledge-gaps.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
    private readonly usageService: UsageService,
    private readonly auditService: AuditService,
    private readonly knowledgeGapsService: KnowledgeGapsService,
  ) {}

  async draftReply(
    organizationId: string,
    user: AuthUser,
    dto: DraftSupportReplyDto,
  ): Promise<SupportDraftResponse> {
    const tone = dto.tone ?? SupportTone.neutral;

    const searchResults = await this.searchService.search(organizationId, {
      query: dto.customerMessage,
    });

    const sources: AiSource[] = searchResults.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      content: result.content,
      score: result.score,
    }));

    const aiResult = await this.aiProvider.generateSupportReply({
      customerMessage: dto.customerMessage,
      tone,
      sources,
    });

    const supportDraft = await this.prisma.supportDraft.create({
      data: {
        organizationId,
        createdById: user.id,
        customerMessage: dto.customerMessage,
        reply: aiResult.reply,
        tone,
        sources,
        riskFlags: aiResult.riskFlags,
        needsReview: aiResult.needsHumanReview,
      },
      select: {
        id: true,
        customerMessage: true,
        reply: true,
        tone: true,
        sources: true,
        riskFlags: true,
        needsReview: true,
        createdAt: true,
      },
    });

    await this.usageService.track({
      organizationId,
      userId: user.id,
      type: UsageEventType.support_reply_generated,
      metadata: {
        supportDraftId: supportDraft.id,
        messageLength: dto.customerMessage.length,
        sourcesCount: sources.length,
        riskFlags: aiResult.riskFlags,
        needsHumanReview: aiResult.needsHumanReview,
      },
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.support_draft_generated,
      entityType: 'support_draft',
      entityId: supportDraft.id,
      metadata: {
        messageLength: dto.customerMessage.length,
        sourcesCount: sources.length,
        riskFlags: aiResult.riskFlags,
        needsHumanReview: aiResult.needsHumanReview,
      },
    });
    const bestScore = sources[0]?.score;

    if (sources.length === 0 || bestScore === undefined || bestScore < 0.2) {
      await this.knowledgeGapsService.track({
        organizationId,
        actorUserId: user.id,
        question: dto.customerMessage,
        sourcesCount: sources.length,
        bestScore,
        reason: sources.length === 0 ? 'no_sources' : 'low_score',
      });
    }

    return {
      id: supportDraft.id,
      customerMessage: supportDraft.customerMessage,
      reply: supportDraft.reply,
      tone: supportDraft.tone,
      sources,
      riskFlags: supportDraft.riskFlags,
      needsHumanReview: supportDraft.needsReview,
      createdAt: supportDraft.createdAt,
    };
  }
}
