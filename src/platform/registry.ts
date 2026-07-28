/* ============================================================
 * PHASE 13 — PLATFORM REGISTRY.
 * Điểm vào DUY NHẤT để tầng dùng lấy cấu hình/StatusRule theo nền tảng.
 * "Dashboard chỉ gọi interface chung" = lấy PlatformModule ở đây rồi dùng `.statusRule`.
 * Chỉ THÊM MỚI — không đụng Facebook.
 * ========================================================== */
import type { Platform, PlatformModule } from './types';
import { facebookModule } from './facebook';
import { zaloModule } from './zalo';

const REGISTRY: Record<Platform, PlatformModule> = {
  facebook: facebookModule,
  zalo: zaloModule,
};

/** Lấy cấu hình 1 nền tảng. Ném lỗi nếu nền tảng chưa hỗ trợ. */
export function getPlatform(p: Platform): PlatformModule {
  const m = REGISTRY[p];
  if (!m) throw new Error(`Nền tảng chưa hỗ trợ: ${p}`);
  return m;
}

/** Danh sách nền tảng đang hỗ trợ (cho menu/bộ chọn). */
export function listPlatforms(): PlatformModule[] {
  return Object.values(REGISTRY);
}

export { facebookModule, zaloModule };
export type { Platform, PlatformModule, StatusRule, ContentFormat, StatusStyle } from './types';
