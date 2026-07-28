/* PHASE 13 — content_format CHỈ dành cho Zalo (Facebook KHÔNG dùng). */
import type { ContentFormat } from '../types';

export const ZALO_CONTENT_FORMATS: ContentFormat[] = ['Video', 'Banner'];

/** Chuẩn hoá giá trị content_format từ Sheet Zalo → 'Video' | 'Banner' | null. */
export function parseContentFormat(v: unknown): ContentFormat | null {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (s === 'video') return 'Video';
  if (s === 'banner') return 'Banner';
  return null;
}

export type { ContentFormat };
