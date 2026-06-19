import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { StorageProvider, StoredFile } from './storage-provider.interface';
import { UploadedDocumentFile } from '../types/uploaded-file.type';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir = process.env.UPLOAD_DIR ?? 'storage/uploads';

  async upload(file: UploadedDocumentFile): Promise<StoredFile> {
    await mkdir(this.uploadDir, { recursive: true });

    const extension = extname(file.originalname);
    const key = `${randomUUID()}${extension}`;
    const path = join(this.uploadDir, key);

    await writeFile(path, file.buffer);

    return {
      key,
      path,
    };
  }

  async delete(key: string): Promise<void> {
    const path = join(this.uploadDir, key);

    await rm(path, {
      force: true,
    });
  }
}
