import { UploadedDocumentFile } from '../types/uploaded-document-file.type';

export type StoredFile = {
  key: string;
  path: string;
};

export interface StorageProvider {
  upload(file: UploadedDocumentFile): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
