import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AuditLogAction,
  DocumentStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DOCUMENT_INGESTION_JOB,
  DOCUMENT_INGESTION_QUEUE,
} from '../constants/document-ingestion.constants';
import { TextChunkerService } from '../services/text-chunker.service';
import { TextExtractorService } from '../services/text-extractor.service';
import { ProcessDocumentJobData } from '../types/document-ingestion-job.type';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from '../../embeddings/providers/embedding-provider.interface';
import { toPgVector } from '../../embeddings/utils/vector-sql.util';
import { UsageEventType } from '../../../generated/prisma/enums';
import { UsageService } from '../../usage/usage.service';

import { createId } from '@paralleldrive/cuid2';
import { AuditService } from '../../audit/audit.service';

import { WebhookEventType } from '../../../generated/prisma/enums';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Processor(DOCUMENT_INGESTION_QUEUE)
@Injectable()
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly textExtractor: TextExtractorService,
    private readonly textChunker: TextChunkerService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly usageService: UsageService,
    private readonly auditService: AuditService,
    private readonly webhooksService: WebhooksService,
  ) {
    super();
  }

  async process(job: Job<ProcessDocumentJobData>): Promise<void> {
    if (job.name !== DOCUMENT_INGESTION_JOB.PROCESS_DOCUMENT) {
      this.logger.warn(`Unknown job received: ${job.name}`);
      return;
    }

    const data = job.data;

    const documentId: string = data.documentId;
    const organizationId: string = data.organizationId;

    await this.prisma.document.update({
      where: {
        id: documentId,
      },
      data: {
        status: DocumentStatus.processing,
      },
    });

    try {
      const document = await this.prisma.document.findFirst({
        where: {
          id: documentId,
          organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          organizationId: true,
          storageKey: true,
          mimeType: true,
        },
      });

      if (!document) {
        throw new Error('Document not found for ingestion');
      }

      const text = await this.textExtractor.extractText(
        document.storageKey,
        document.mimeType,
      );

      const chunks = this.textChunker.split(text);
      const embeddings = await this.embeddingProvider.embedMany(
        chunks.map((chunk) => chunk.content),
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({
          where: {
            documentId: document.id,
          },
        });

        for (const [index, chunk] of chunks.entries()) {
          const embedding = embeddings[index];

          await tx.$executeRaw`
            INSERT INTO "document_chunks" (
              "id",
              "organizationId",
              "documentId",
              "content",
              "chunkIndex",
              "tokenCount",
              "embedding",
              "createdAt"
            )
            VALUES (
              ${createId()},
              ${document.organizationId},
              ${document.id},
              ${chunk.content},
              ${chunk.chunkIndex},
              ${chunk.tokenCount},
              ${toPgVector(embedding)}::vector,
              NOW()
            )
          `;
        }

        await tx.document.update({
          where: {
            id: document.id,
          },
          data: {
            status: DocumentStatus.indexed,
          },
        });
        await this.usageService.track({
          organizationId: document.organizationId,
          type: UsageEventType.document_indexed,
          metadata: {
            documentId: document.id,
            chunksCount: chunks.length,
          },
        });

        await this.auditService.log({
          organizationId: document.organizationId,
          action: AuditLogAction.document_indexed,
          entityType: 'document',
          entityId: document.id,
          metadata: {
            chunksCount: chunks.length,
          },
        });
      });

      await this.webhooksService.emit({
        organizationId: document.organizationId,
        eventType: WebhookEventType.document_indexed,
        payload: {
          documentId: document.id,
          chunksCount: chunks.length,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to process document ${documentId}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.prisma.document.update({
        where: {
          id: documentId,
        },
        data: {
          status: DocumentStatus.failed,
        },
      });

      await this.auditService.log({
        organizationId,
        action: AuditLogAction.document_failed,
        entityType: 'document',
        entityId: documentId,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      await this.webhooksService.emit({
        organizationId,
        eventType: WebhookEventType.document_failed,
        payload: {
          documentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }
}
