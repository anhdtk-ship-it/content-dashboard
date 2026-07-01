import { google, sheets_v4 } from 'googleapis';

/* ============================================================
 * GoogleAuthFactory (PHASE 12) — nguồn DUY NHẤT khởi tạo Google auth
 * ------------------------------------------------------------
 * Thứ tự ưu tiên credentials:
 *   1) GOOGLE_CREDENTIALS_JSON  — nội dung Service Account JSON dạng chuỗi
 *      (dùng cho Railway/cloud — KHÔNG cần file, không cần thư mục credentials).
 *   2) GOOGLE_CREDENTIALS_PATH  — đường dẫn file JSON (máy local, giữ nguyên như cũ).
 *   3) Không có cả hai → throw Error rõ ràng.
 *
 * Mặc định scope chỉ-đọc Sheets. KHÔNG chứa business logic (dùng chung
 * cho Content Sync, Ads Sync và mọi script đọc Google Sheets).
 * ========================================================== */

export const SHEETS_READONLY = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/** Tạo GoogleAuth theo thứ tự ưu tiên JSON (env) → PATH (file) → throw. */
export function createGoogleAuth(scopes: string[] = SHEETS_READONLY): InstanceType<typeof google.auth.GoogleAuth> {
  const json = process.env.GOOGLE_CREDENTIALS_JSON?.trim();
  if (json) {
    let credentials: Record<string, any>;
    try {
      credentials = JSON.parse(json);
    } catch (e) {
      throw new Error('GOOGLE_CREDENTIALS_JSON không phải JSON hợp lệ: ' + (e instanceof Error ? e.message : String(e)));
    }
    return new google.auth.GoogleAuth({ credentials, scopes });
  }

  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH?.trim();
  if (keyFile) {
    return new google.auth.GoogleAuth({ keyFile, scopes });
  }

  throw new Error(
    'Thiếu credentials Google: đặt GOOGLE_CREDENTIALS_JSON (ưu tiên — Railway/cloud) ' +
    'hoặc GOOGLE_CREDENTIALS_PATH (file JSON — máy local).',
  );
}

/** Tiện ích: trả sẵn Sheets client (v4) đã xác thực. */
export function createSheetsClient(scopes: string[] = SHEETS_READONLY): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: createGoogleAuth(scopes) });
}
