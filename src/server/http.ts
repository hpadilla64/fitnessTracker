import { NextResponse } from 'next/server';
import type { ApiError } from '@/types/api';

export function apiError(error: string, status: number, code?: ApiError['code']) {
  return NextResponse.json<ApiError>(code ? { error, code } : { error }, { status });
}
export const noData = () => apiError('No data imported yet', 503, 'NO_DATA');
export const internal = (e: unknown) =>
  apiError(e instanceof Error ? e.message : 'Internal error', 500, 'INTERNAL');
