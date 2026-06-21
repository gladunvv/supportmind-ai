import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
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

@Processor(DOCUMENT_INGESTION_QUEUE)
@Injectable()
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly textExtractor: TextExtractorService,
    private readonly textChunker: TextChunkerService,
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

      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({
          where: {
            documentId: document.id,
          },
        });

        if (chunks.length > 0) {
          await tx.documentChunk.createMany({
            data: chunks.map((chunk) => ({
              organizationId: document.organizationId,
              documentId: document.id,
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
            })),
          });
        }

        await tx.document.update({
          where: {
            id: document.id,
          },
          data: {
            status: DocumentStatus.indexed,
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
