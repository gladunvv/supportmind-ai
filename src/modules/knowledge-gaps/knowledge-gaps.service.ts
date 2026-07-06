import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  AuditLogAction,
  KnowledgeGapStatus,
  UsageEventType,
} from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { UsageService } from '../usage/usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeGapResponse } from './types/knowledge-gap-response.type';

const KNOWLEDGE_GAP_SELECT = {
  id: true,
  organizationId: true,
  question: true,
  normalizedText: true,
  status: true,
  frequency: true,
  lastAskedAt: true,
  exampleSources: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeGapSelect;

export type TrackKnowledgeGapInput = {
  organizationId: string;
  actorUserId?: string;
  question: string;
  sourcesCount: number;
  bestScore?: number;
  reason: string;
};

@Injectable()
export class KnowledgeGapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly usageService: UsageService,
  ) {}

  async track(input: TrackKnowledgeGapInput): Promise<void> {
    const normalizedText = this.normalizeQuestion(input.question);

    const gap = await this.prisma.knowledgeGap.upsert({
      where: {
        organizationId_normalizedText: {
          organizationId: input.organizationId,
          normalizedText,
        },
      },
      create: {
        organizationId: input.organizationId,
        question: input.question,
        normalizedText,
        frequency: 1,
        lastAskedAt: new Date(),
        metadata: {
          reason: input.reason,
          sourcesCount: input.sourcesCount,
          bestScore: input.bestScore,
        },
      },
      update: {
        frequency: {
          increment: 1,
        },
        lastAskedAt: new Date(),
        metadata: {
          reason: input.reason,
          sourcesCount: input.sourcesCount,
          bestScore: input.bestScore,
        },
      },
      select: KNOWLEDGE_GAP_SELECT,
    });

    await this.usageService.track({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      type: UsageEventType.knowledge_gap_detected,
      metadata: {
        knowledgeGapId: gap.id,
        reason: input.reason,
        sourcesCount: input.sourcesCount,
        bestScore: input.bestScore,
      },
    });

    if (gap.frequency === 1) {
      await this.auditService.log({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: AuditLogAction.knowledge_gap_created,
        entityType: 'knowledge_gap',
        entityId: gap.id,
        metadata: {
          question: input.question,
          reason: input.reason,
          sourcesCount: input.sourcesCount,
          bestScore: input.bestScore,
        },
      });
    }
  }

  async findOpenForOrganization(
    organizationId: string,
  ): Promise<KnowledgeGapResponse[]> {
    return this.prisma.knowledgeGap.findMany({
      where: {
        organizationId,
        status: KnowledgeGapStatus.open,
      },
      select: KNOWLEDGE_GAP_SELECT,
      orderBy: [
        {
          frequency: 'desc',
        },
        {
          lastAskedAt: 'desc',
        },
      ],
      take: 100,
    });
  }

  async updateStatus(
    organizationId: string,
    knowledgeGapId: string,
    actorUserId: string,
    status: KnowledgeGapStatus,
  ): Promise<KnowledgeGapResponse> {
    const gap = await this.prisma.knowledgeGap.findFirst({
      where: {
        id: knowledgeGapId,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!gap) {
      throw new NotFoundException('Knowledge gap not found');
    }

    const updatedGap = await this.prisma.knowledgeGap.update({
      where: {
        id: gap.id,
      },
      data: {
        status,
      },
      select: KNOWLEDGE_GAP_SELECT,
    });

    await this.auditService.log({
      organizationId,
      actorUserId,
      action:
        status === KnowledgeGapStatus.resolved
          ? AuditLogAction.knowledge_gap_resolved
          : AuditLogAction.knowledge_gap_ignored,
      entityType: 'knowledge_gap',
      entityId: updatedGap.id,
      metadata: {
        status,
        question: updatedGap.question,
      },
    });

    return updatedGap;
  }

  private normalizeQuestion(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
}
