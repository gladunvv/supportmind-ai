import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class TextExtractorService {
  private readonly uploadDir = process.env.UPLOAD_DIR ?? 'storage/uploads';

  async extractText(storageKey: string, mimeType: string): Promise<string> {
    const filePath = join(this.uploadDir, storageKey);

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return readFile(filePath, 'utf8');
    }

    if (mimeType === 'application/pdf') {
      throw new UnsupportedMediaTypeException(
        'PDF text extraction is not implemented yet',
      );
    }

    throw new UnsupportedMediaTypeException('Unsupported document type');
  }
}
