import { join } from 'path';
import { LocalStorageProvider } from '../../../../src/modules/documents/storage/local-storage.provider';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  rm: jest.fn(),
}));

import { mkdir, rm, writeFile } from 'fs/promises';

describe('LocalStorageProvider', () => {
  const originalEnv = process.env;

  const mockedMkdir = jest.mocked(mkdir);
  const mockedWriteFile = jest.mocked(writeFile);
  const mockedRm = jest.mocked(rm);

  let provider: LocalStorageProvider;

  beforeEach(() => {
    process.env = { ...originalEnv, UPLOAD_DIR: 'storage/uploads' };
    mockedMkdir.mockReset().mockResolvedValue(undefined);
    mockedWriteFile.mockReset().mockResolvedValue(undefined);
    mockedRm.mockReset().mockResolvedValue(undefined);

    provider = new LocalStorageProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('upload', () => {
    it('ensures the upload directory exists and writes the file with a generated key', async () => {
      const file = {
        originalname: 'refund-policy.md',
        mimetype: 'text/markdown',
        size: 42,
        buffer: Buffer.from('content'),
      };

      const result = await provider.upload(file);

      expect(mockedMkdir).toHaveBeenCalledWith('storage/uploads', {
        recursive: true,
      });
      expect(result.key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/,
      );
      expect(result.path).toBe(join('storage/uploads', result.key));
      expect(mockedWriteFile).toHaveBeenCalledWith(result.path, file.buffer);
    });

    it('preserves the original file extension in the generated key', async () => {
      const file = {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('content'),
      };

      const result = await provider.upload(file);

      expect(result.key.endsWith('.pdf')).toBe(true);
    });

    it('respects a custom UPLOAD_DIR', async () => {
      process.env.UPLOAD_DIR = '/tmp/custom-uploads';
      provider = new LocalStorageProvider();

      const result = await provider.upload({
        originalname: 'note.txt',
        mimetype: 'text/plain',
        size: 4,
        buffer: Buffer.from('note'),
      });

      expect(mockedMkdir).toHaveBeenCalledWith('/tmp/custom-uploads', {
        recursive: true,
      });
      expect(result.path).toBe(join('/tmp/custom-uploads', result.key));
    });
  });

  describe('delete', () => {
    it('force-removes the file at the stored key path', async () => {
      await provider.delete('some-key.md');

      expect(mockedRm).toHaveBeenCalledWith(
        join('storage/uploads', 'some-key.md'),
        { force: true },
      );
    });
  });
});
