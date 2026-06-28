import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackUsageEventInput } from './types/track-usage-event.type';
import { UsageSummary } from './types/usage-summary.type';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async track(input: TrackUsageEventInput): Promise<void> {
    await this.prisma.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        quantity: input.quantity ?? 1,
        metadata: input.metadata,
      },
    });
  }

  async getCurrentMonthSummary(organizationId: string): Promise<UsageSummary> {
    const now = new Date();

    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const grouped = await this.prisma.usageEvent.groupBy({
      by: ['type'],
      where: {
        organizationId,
        createdAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return {
      periodStart,
      periodEnd,
      items: grouped.map((item) => ({
        type: item.type,
        quantity: item._sum.quantity ?? 0,
      })),
    };
  }
}
