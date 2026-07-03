import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ApiKeyStatus, AuditLogAction } from '../../generated/prisma/enums';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyContext } from './types/api-key-context.type';
import { ApiKeyResponse } from './types/api-key-response.type';
import {
  generateRawApiKey,
  getApiKeyPrefix,
  hashApiKey,
} from './utils/api-key.util';

const API_KEY_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  keyPrefix: true,
  status: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
} satisfies Prisma.ApiKeySelect;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    user: AuthUser,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponse & { key: string }> {
    const rawKey = generateRawApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getApiKeyPrefix(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        createdById: user.id,
        name: dto.name,
        keyHash,
        keyPrefix,
      },
      select: API_KEY_SELECT,
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.api_key_created,
      entityType: 'api_key',
      entityId: apiKey.id,
      metadata: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
      },
    });

    return {
      ...apiKey,
      key: rawKey,
    };
  }

  async findAll(organizationId: string): Promise<ApiKeyResponse[]> {
    return this.prisma.apiKey.findMany({
      where: {
        organizationId,
      },
      select: API_KEY_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revoke(
    organizationId: string,
    apiKeyId: string,
    user: AuthUser,
  ): Promise<ApiKeyResponse> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const revokedApiKey = await this.prisma.apiKey.update({
      where: {
        id: apiKey.id,
      },
      data: {
        status: ApiKeyStatus.revoked,
        revokedAt: new Date(),
      },
      select: API_KEY_SELECT,
    });

    await this.auditService.log({
      organizationId,
      actorUserId: user.id,
      action: AuditLogAction.api_key_revoked,
      entityType: 'api_key',
      entityId: apiKey.id,
      metadata: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
      },
    });

    return revokedApiKey;
  }

  async validateRawKey(rawKey: string): Promise<ApiKeyContext | null> {
    const keyHash = hashApiKey(rawKey);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: {
        keyHash,
      },
      select: {
        id: true,
        organizationId: true,
        keyPrefix: true,
        status: true,
      },
    });

    if (!apiKey || apiKey.status !== ApiKeyStatus.active) {
      return null;
    }

    await this.prisma.apiKey.update({
      where: {
        id: apiKey.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return {
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId,
      keyPrefix: apiKey.keyPrefix,
    };
  }
}
