import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentStatus } from '../../../generated/prisma/enums';
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

        await this.usageService.track({
          organizationId: document.organizationId,
          type: UsageEventType.embedding_generated,
          quantity: chunks.length,
          metadata: {
            documentId: document.id,
            chunksCount: chunks.length,
          },
        });
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

      throw error;
    }
  }
}
