import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOCUMENT_INGESTION_QUEUE } from './constants/document-ingestion.constants';
import { DocumentIngestionProcessor } from './processors/document-ingestion.processor';
import { DocumentIngestionService } from './services/document-ingestion.service';
import { TextChunkerService } from './services/text-chunker.service';
import { TextExtractorService } from './services/text-extractor.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    EmbeddingsModule,
    BullModule.registerQueue({
      name: DOCUMENT_INGESTION_QUEUE,
    }),
    UsageModule,
  ],
  providers: [
    DocumentIngestionService,
    DocumentIngestionProcessor,
    TextExtractorService,
    TextChunkerService,
  ],
  exports: [DocumentIngestionService],
})
export class DocumentIngestionModule {}
