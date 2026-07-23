import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from '../../../src/modules/documents/documents.service';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('DocumentsService', () => {
  const originalEnv = process.env;

  const organizationId = 'org_123';
  const uploadedById = 'user_123';
  const documentId = 'doc_123';

  const file = Object.freeze({
    originalname: 'refund-policy.md',
    mimetype: 'text/markdown',
    size: 1024,
    buffer: Buffer.from('Refund policy content'),
  });

  const storedFile = Object.freeze({
    key: 'stored_123.md',
    path: 'storage/uploads/stored_123.md',
  });

  const document = Object.freeze({
    id: documentId,
    organizationId,
    title: 'refund-policy',
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    status: 'uploaded',
  });

  let prisma: {
    document: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  let storageProvider: {
    upload: jest.Mock;
    delete: jest.Mock;
  };

  let documentIngestionService: {
    enqueueDocumentProcessing: jest.Mock;
  };

  let usageService: { track: jest.Mock };
  let auditService: { log: jest.Mock };

  let service: DocumentsService;

  beforeEach(() => {
    process.env = { ...originalEnv, MAX_DOCUMENT_SIZE_MB: '10' };

    prisma = {
      document: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    storageProvider = {
      upload: jest.fn(),
      delete: jest.fn(),
    };

    documentIngestionService = {
      enqueueDocumentProcessing: jest.fn(),
    };

    usageService = { track: jest.fn() };
    auditService = { log: jest.fn() };

    service = new DocumentsService(
      prisma as never,
      storageProvider,
      documentIngestionService as never,
      usageService as never,
      auditService as never,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('upload', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.upload(organizationId, uploadedById, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('rejects unsupported mime types', async () => {
      await expect(
        service.upload(organizationId, uploadedById, {
          ...file,
          mimetype: 'application/zip',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('rejects files larger than MAX_DOCUMENT_SIZE_MB', async () => {
      process.env.MAX_DOCUMENT_SIZE_MB = '1';

      await expect(
        service.upload(organizationId, uploadedById, {
          ...file,
          size: 2 * 1024 * 1024,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storageProvider.upload).not.toHaveBeenCalled();
    });

    it('stores the file, creates the document, and enqueues ingestion', async () => {
      storageProvider.upload.mockResolvedValue(storedFile);
      prisma.document.create.mockResolvedValue(document);

      const result = await service.upload(organizationId, uploadedById, file);

      expect(storageProvider.upload).toHaveBeenCalledWith(file);
      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            organizationId,
            uploadedById,
            title: 'refund-policy',
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageKey: storedFile.key,
            status: 'uploaded',
          },
        }),
      );
      expect(
        documentIngestionService.enqueueDocumentProcessing,
      ).toHaveBeenCalledWith({
        documentId: document.id,
        organizationId: document.organizationId,
      });
      expect(usageService.track).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          userId: uploadedById,
          type: 'document_uploaded',
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId: uploadedById,
          action: 'document_uploaded',
        }),
      );
      expect(result).toBe(document);
    });
  });

  describe('findAll', () => {
    it('lists non-deleted documents ordered by newest first', async () => {
      prisma.document.findMany.mockResolvedValue([document]);

      const result = await service.findAll(organizationId);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId,
            deletedAt: null,
            status: { not: 'deleted' },
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([document]);
    });
  });

  describe('findOne', () => {
    it('returns the document when found', async () => {
      prisma.document.findFirst.mockResolvedValue(document);

      const result = await service.findOne(organizationId, documentId);

      expect(result).toBe(document);
    });

    it('throws NotFoundException when the document does not exist', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(organizationId, 'missing_doc'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the document does not exist', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(organizationId, 'missing_doc', uploadedById),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(storageProvider.delete).not.toHaveBeenCalled();
    });

    it('deletes the stored file and soft-deletes the document', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: documentId,
        title: document.title,
        originalName: document.originalName,
        storageKey: storedFile.key,
      });

      const result = await service.remove(
        organizationId,
        documentId,
        uploadedById,
      );

      expect(storageProvider.delete).toHaveBeenCalledWith(storedFile.key);
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: documentId },
          data: {
            status: 'deleted',
            deletedAt: expect.any(Date) as Date,
          },
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          actorUserId: uploadedById,
          action: 'document_deleted',
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });
});
