/* PlatformModule cho Zalo. */
import type { PlatformModule } from '../types';
import { zaloStatusRule } from './ZaloStatusRule';

export const zaloModule: PlatformModule = {
  platform: 'zalo',
  label: 'Zalo',
  statusRule: zaloStatusRule,
  hasContentFormat: true,        // Zalo dùng content_format (Video/Banner/… — tự do)
  sheetEnvKey: 'ZALO_SHEET_ID',  // Google Sheet RIÊNG của Zalo
};

export { zaloStatusRule, isDuyTri, ZALO_GROUPS } from './ZaloStatusRule';
export { parseContentFormat, UNSPECIFIED_FORMAT_LABEL } from './contentFormat';
export type { ZaloContent, ZaloContentRow } from './ZaloContent';
