import {
  getPaginationParams,
  getTotalPages,
} from '../../../../src/common/utils/pagination.util';

describe('getPaginationParams', () => {
  it('defaults to page 1 and limit 20 when neither is provided', () => {
    expect(getPaginationParams({})).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    });
  });

  it('computes skip and take for a given page and limit', () => {
    expect(getPaginationParams({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
      take: 10,
    });
  });

  it('falls back to the default limit when only page is provided', () => {
    expect(getPaginationParams({ page: 2 })).toEqual({
      page: 2,
      limit: 20,
      skip: 20,
      take: 20,
    });
  });
});

describe('getTotalPages', () => {
  it('rounds up a non-exact division', () => {
    expect(getTotalPages(45, 20)).toBe(3);
  });

  it('returns an exact page count for an exact division', () => {
    expect(getTotalPages(40, 20)).toBe(2);
  });

  it('returns 0 when there are no items', () => {
    expect(getTotalPages(0, 20)).toBe(0);
  });
});
