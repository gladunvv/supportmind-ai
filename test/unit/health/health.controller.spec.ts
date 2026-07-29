import { HealthController } from '../../../src/modules/health/health.controller';

jest.mock('../../../src/modules/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('HealthController', () => {
  const healthCheckResult = Object.freeze({ status: 'ok' });

  let health: { check: jest.Mock };
  let prismaHealth: { pingCheck: jest.Mock };
  let prisma: object;
  let controller: HealthController;

  beforeEach(() => {
    health = { check: jest.fn() };
    prismaHealth = { pingCheck: jest.fn() };
    prisma = {};

    controller = new HealthController(
      health as never,
      prismaHealth as never,
      prisma as never,
    );
  });

  it('runs a database ping check against the injected prisma instance', async () => {
    health.check.mockImplementation(
      async (indicators: Array<() => unknown>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
        return healthCheckResult;
      },
    );
    prismaHealth.pingCheck.mockResolvedValue({ database: { status: 'up' } });

    const result = await controller.check();

    expect(prismaHealth.pingCheck).toHaveBeenCalledWith('database', prisma);
    expect(result).toBe(healthCheckResult);
  });
});
