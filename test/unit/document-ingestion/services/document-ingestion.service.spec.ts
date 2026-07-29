import { DocumentIngestionService } from '../../../../src/modules/document-ingestion/services/document-ingestion.service';

describe('DocumentIngestionService', () => {
  let queue: { add: jest.Mock };
  let service: DocumentIngestionService;

  beforeEach(() => {
    queue = { add: jest.fn() };
    service = new DocumentIngestionService(queue as never);
  });

  it('enqueues a process-document job with retry and cleanup options', async () => {
    await service.enqueueDocumentProcessing({
      documentId: 'doc_123',
      organizationId: 'org_123',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'process-document',
      { documentId: 'doc_123', organizationId: 'org_123' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });
});
