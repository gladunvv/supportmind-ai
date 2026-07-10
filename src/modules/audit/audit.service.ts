import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogResponse } from './types/audit-log-response.type';
import { CreateAuditLogInput } from './types/create-audit-log.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../../common/types/paginated-response.type';
import {
  getPaginationParams,
  getTotalPages,
} from '../../common/utils/pagination.util';

const AUDIT_LOG_SELECT = {
  id: true,
  organizationId: true,
  actorUserId: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actorUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }

  async findForOrganization(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<AuditLogResponse>> {
    const pagination = getPaginationParams(query);

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
        },
        select: AUDIT_LOG_SELECT,
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.auditLog.count({
        where: {
          organizationId,
        },
      }),
    ]);

    return {
      data: logs,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: getTotalPages(total, pagination.limit),
      },
    };
  }
}
