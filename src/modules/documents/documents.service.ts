import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage/storage-provider.interface';
import { UploadedDocumentFile } from './types/uploaded-file.type';
import { DocumentIngestionService } from '../document-ingestion/services/document-ingestion.service';
import type { Prisma } from '../../generated/prisma/client';

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
]);

const DOCUMENT_SELECT = {
  id: true,
  organizationId: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
    private readonly documentIngestionService: DocumentIngestionService,
  ) {}

  async upload(
    organizationId: string,
    uploadedById: string,
    file: UploadedDocumentFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    this.validateFile(file);

    const storedFile = await this.storageProvider.upload(file);

    const document = await this.prisma.document.create({
      data: {
        organizationId,
        uploadedById,
        title: this.createTitleFromOriginalName(file.originalname),
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: storedFile.key,
        status: DocumentStatus.uploaded,
      },
      select: DOCUMENT_SELECT,
    });

    await this.documentIngestionService.enqueueDocumentProcessing({
      documentId: document.id,
      organizationId: document.organizationId,
    });

    return document;
  }

  async findAll(organizationId: string) {
    return this.prisma.document.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: {
          not: DocumentStatus.deleted,
        },
      },
      select: this.documentSelect(),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
        status: {
          not: DocumentStatus.deleted,
        },
      },
      select: this.documentSelect(),
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async remove(
    organizationId: string,
    documentId: string,
  ): Promise<{ success: true }> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
        status: {
          not: DocumentStatus.deleted,
        },
      },
      select: {
        id: true,
        storageKey: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.storageProvider.delete(document.storageKey);

    await this.prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        status: DocumentStatus.deleted,
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  private validateFile(file: UploadedDocumentFile): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed types: .txt, .md, .pdf',
      );
    }

    const maxSizeMb = Number(process.env.MAX_DOCUMENT_SIZE_MB ?? 10);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size must be less than ${maxSizeMb}MB`,
      );
    }
  }

  private createTitleFromOriginalName(originalName: string): string {
    return originalName.replace(/\.[^/.]+$/, '');
  }

  private documentSelect() {
    return {
      id: true,
      organizationId: true,
      title: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      uploadedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    };
  }
}
