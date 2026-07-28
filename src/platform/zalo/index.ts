/* PHASE 13 — PlatformModule cho Zalo. */
import type { PlatformModule } from '../types';
import { zaloStatusRule } from './ZaloStatusRule';

export const zaloModule: PlatformModule = {
  platform: 'zalo',
  label: 'Zalo',
  statusRule: zaloStatusRule,
  hasContentFormat: true,        // Zalo dùng content_format (Video/Banner)
  sheetEnvKey: 'ZALO_SHEET_ID',  // Google Sheet RIÊNG của Zalo (đặt env khi triển khai)
};

export { zaloStatusRule };
export { ZALO_CONTENT_FORMATS, parseContentFormat } from './contentFormat';
