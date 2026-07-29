const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock(
  '@generated/prisma/client',
  () => ({
    PrismaClient: class {
      $connect = mockConnect;
      $disconnect = mockDisconnect;
    },
  }),
  { virtual: true },
);

const PrismaPgMock = jest.fn();
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: PrismaPgMock,
}));

import { PrismaService } from '../../../src/modules/prisma/prisma.service';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    PrismaPgMock.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when DATABASE_URL is not configured', () => {
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).toThrow('DATABASE_URL is not defined');
  });

  it('configures the pg adapter with the database URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    new PrismaService();

    expect(PrismaPgMock).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:5432/db',
    });
  });

  it('connects on module init and disconnects on module destroy', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    const service = new PrismaService();

    await service.onModuleInit();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
