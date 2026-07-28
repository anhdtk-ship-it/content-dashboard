/* PHASE 13 — PlatformModule cho Facebook. Chỉ mô tả cấu hình; KHÔNG đụng code FB đang chạy. */
import type { PlatformModule } from '../types';
import { facebookStatusRule } from './FacebookStatusRule';

export const facebookModule: PlatformModule = {
  platform: 'facebook',
  label: 'Facebook',
  statusRule: facebookStatusRule,
  hasContentFormat: false,          // FB KHÔNG dùng content_format
  sheetEnvKey: 'GOOGLE_SHEET_ID',   // Sheet FB hiện tại (giữ nguyên)
};

export { facebookStatusRule };
