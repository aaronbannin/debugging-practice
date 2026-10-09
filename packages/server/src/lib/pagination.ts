import { PAGE_SIZE_DEFAULT, type Page } from '@dp/shared';

export function offsetFor(page: number, pageSize: number): number {
  const size = Math.max(pageSize, PAGE_SIZE_DEFAULT);
  return (page - 1) * size;
}

export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

export function buildPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return {
    items,
    total,
    page,
    page_size: pageSize,
    page_count: pageCount(total, pageSize),
  };
}
