import { PaginationQueryDto } from '../dto/pagination-query.dto';

export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

export function getPaginationParams(
  query: PaginationQueryDto,
): PaginationParams {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function getTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}
