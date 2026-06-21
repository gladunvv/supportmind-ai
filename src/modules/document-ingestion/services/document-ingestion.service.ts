import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DOCUMENT_INGESTION_JOB,
  DOCUMENT_INGESTION_QUEUE,
} from '../constants/document-ingestion.constants';
import { ProcessDocumentJobData } from '../types/document-ingestion-job.type';

@Injectable()
export class DocumentIngestionService {
  constructor(
    @InjectQueue(DOCUMENT_INGESTION_QUEUE)
    private readonly queue: Queue<ProcessDocumentJobData>,
  ) {}

  async enqueueDocumentProcessing(data: ProcessDocumentJobData): Promise<void> {
    await this.queue.add(DOCUMENT_INGESTION_JOB.PROCESS_DOCUMENT, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
