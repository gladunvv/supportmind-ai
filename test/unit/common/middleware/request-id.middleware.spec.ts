import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from '../../../../src/common/middleware/request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let next: jest.Mock;
  let setHeader: jest.Mock;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    next = jest.fn();
    setHeader = jest.fn();
  });

  it('reuses an incoming x-request-id header', () => {
    const header = jest.fn().mockReturnValue('incoming-request-id');
    const request = { header } as unknown as Request;
    const response = { setHeader } as unknown as Response;

    middleware.use(request, response, next as NextFunction);

    expect(header).toHaveBeenCalledWith('x-request-id');
    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'incoming-request-id',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a request id when none is provided', () => {
    const header = jest.fn().mockReturnValue(undefined);
    const request = { header } as unknown as Request;
    const response = { setHeader } as unknown as Response;

    middleware.use(request, response, next as NextFunction);

    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a different request id on each call without an incoming header', () => {
    const header = jest.fn().mockReturnValue(undefined);
    const request = { header } as unknown as Request;
    const response = { setHeader } as unknown as Response;

    middleware.use(request, response, next as NextFunction);
    middleware.use(request, response, next as NextFunction);

    const [, firstId] = setHeader.mock.calls[0] as [string, string];
    const [, secondId] = setHeader.mock.calls[1] as [string, string];

    expect(firstId).not.toBe(secondId);
  });
});
