import { UnsupportedMediaTypeException } from '@nestjs/common';
import { join } from 'path';
import { TextExtractorService } from '../../../../src/modules/document-ingestion/services/text-extractor.service';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';

describe('TextExtractorService', () => {
  const originalEnv = process.env;

  const mockedReadFile = jest.mocked(readFile);

  let service: TextExtractorService;

  beforeEach(() => {
    process.env = { ...originalEnv, UPLOAD_DIR: 'storage/uploads' };
    mockedReadFile.mockReset();

    service = new TextExtractorService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads plain text files from the upload directory', async () => {
    mockedReadFile.mockResolvedValue('Refund policy content');

    const result = await service.extractText('doc.txt', 'text/plain');

    expect(mockedReadFile).toHaveBeenCalledWith(
      join('storage/uploads', 'doc.txt'),
      'utf8',
    );
    expect(result).toBe('Refund policy content');
  });

  it('reads markdown files from the upload directory', async () => {
    mockedReadFile.mockResolvedValue('# Refund policy');

    const result = await service.extractText('doc.md', 'text/markdown');

    expect(mockedReadFile).toHaveBeenCalledWith(
      join('storage/uploads', 'doc.md'),
      'utf8',
    );
    expect(result).toBe('# Refund policy');
  });

  it('rejects PDF files as not yet implemented', async () => {
    await expect(
      service.extractText('doc.pdf', 'application/pdf'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    expect(mockedReadFile).not.toHaveBeenCalled();
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      service.extractText('doc.zip', 'application/zip'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });
});
