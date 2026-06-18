export type StoredFile = {
  key: string;
  path: string;
};

export interface StorageProvider {
  upload(file: Express.Multer.File): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
