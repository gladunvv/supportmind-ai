import type { Job } from 'bullmq';
import { DocumentIngestionProcessor } from '../../../../src/modules/document-ingestion/processors/document-ingestion.processor';
import { ProcessDocumentJobData } from '../../../../src/modules/document-ingestion/types/document-ingestion-job.type';

jest.mock('../../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'test_id',
}));

describe('DocumentIngestionProcessor', () => {
  const documentId = 'doc_123';
  const organizationId = 'org_123';

  const document = Object.freeze({
    id: documentId,
    organizationId,
    storageKey: 'doc_123.md',
    mimeType: 'text/markdown',
  });

  const chunks = [{ content: 'chunk one', chunkIndex: 0, tokenCount: 3 }];

  let tx: {
    documentChunk: { deleteMany: jest.Mock };
    $executeRaw: jest.Mock;
    document: { update: jest.Mock };
  };

  let prisma: {
    document: { update: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  let textExtractor: { extractText: jest.Mock };
  let textChunker: { split: jest.Mock };
  let embeddingProvider: { embedMany: jest.Mock };
  let usageService: { track: jest.Mock };
  let auditService: { log: jest.Mock };
  let webhooksService: { emit: jest.Mock };

  let processor: DocumentIngestionProcessor;

  const createJob = (
    data: ProcessDocumentJobData = { documentId, organizationId },
  ) =>
    ({
      name: 'process-document',
      data,
    }) as unknown as Job<ProcessDocumentJobData>;

  beforeEach(() => {
    tx = {
      documentChunk: { deleteMany: jest.fn() },
      $executeRaw: jest.fn(),
      document: { update: jest.fn() },
    };

    prisma = {
      document: { update: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    };

    textExtractor = { extractText: jest.fn() };
    textChunker = { split: jest.fn() };
    embeddingProvider = { embedMany: jest.fn() };
    usageService = { track: jest.fn() };
    auditService = { log: jest.fn() };
    webhooksService = { emit: jest.fn() };

    processor = new DocumentIngestionProcessor(
      prisma as never,
      textExtractor as never,
      textChunker as never,
      embeddingProvider as never,
      usageService as never,
      auditService as never,
      webhooksService as never,
    );
  });

  it('ignores jobs with an unexpected job name', async () => {
    await processor.process({
      name: 'some-other-job',
      data: { documentId, organizationId },
    } as unknown as Job<ProcessDocumentJobData>);

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });

  it('extracts, chunks, embeds, stores chunks, and marks the document indexed', async () => {
    prisma.document.findFirst.mockResolvedValue(document);
    textExtractor.extractText.mockResolvedValue('raw text');
    textChunker.split.mockReturnValue(chunks);
    embeddingProvider.embedMany.mockResolvedValue([[0.1, 0.2]]);

    await processor.process(createJob());

    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: documentId },
      data: { status: 'processing' },
    });
    expect(textExtractor.extractText).toHaveBeenCalledWith(
      document.storageKey,
      document.mimeType,
    );
    expect(embeddingProvider.embedMany).toHaveBeenCalledWith(['chunk one']);
    expect(tx.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: document.id },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.document.update).toHaveBeenCalledWith({
      where: { id: document.id },
      data: { status: 'indexed' },
    });
    expect(usageService.track).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        type: 'document_indexed',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        action: 'document_indexed',
      }),
    );
  });

  it('emits the document_indexed webhook only after the transaction has committed', async () => {
    prisma.document.findFirst.mockResolvedValue(document);
    textExtractor.extractText.mockResolvedValue('raw text');
    textChunker.split.mockReturnValue(chunks);
    embeddingProvider.embedMany.mockResolvedValue([[0.1, 0.2]]);

    await processor.process(createJob());

    expect(webhooksService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        eventType: 'document_indexed',
      }),
    );

    const emitOrder = webhooksService.emit.mock.invocationCallOrder[0];
    const txUpdateOrder = tx.document.update.mock.invocationCallOrder[0];
    const auditOrder = auditService.log.mock.invocationCallOrder[0];
    const executeRawOrder = tx.$executeRaw.mock.invocationCallOrder[0];

    expect(emitOrder).toBeGreaterThan(txUpdateOrder);
    expect(emitOrder).toBeGreaterThan(auditOrder);
    expect(emitOrder).toBeGreaterThan(executeRawOrder);
  });

  it('marks the document failed and emits document_failed, without emitting document_indexed, when the transaction fails', async () => {
    prisma.document.findFirst.mockResolvedValue(document);
    textExtractor.extractText.mockResolvedValue('raw text');
    textChunker.split.mockReturnValue(chunks);
    embeddingProvider.embedMany.mockResolvedValue([[0.1, 0.2]]);
    tx.document.update.mockImplementation(() => {
      throw new Error('transaction timeout');
    });

    await expect(processor.process(createJob())).rejects.toThrow(
      'transaction timeout',
    );

    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: documentId },
      data: { status: 'failed' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document_failed' }),
    );
    expect(webhooksService.emit).toHaveBeenCalledTimes(1);
    expect(webhooksService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'document_failed' }),
    );
  });

  it('marks the document failed when it cannot be found for ingestion', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(processor.process(createJob())).rejects.toThrow(
      'Document not found for ingestion',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: documentId },
      data: { status: 'failed' },
    });
    expect(webhooksService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'document_failed' }),
    );
  });
});
