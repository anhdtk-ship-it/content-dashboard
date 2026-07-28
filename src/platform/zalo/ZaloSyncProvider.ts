/* ============================================================
 * PHASE 13 — Zalo Sync (SKELETON, ĐỘC LẬP với sync Facebook).
 * Đọc Google Sheet RIÊNG của Zalo (env ZALO_SHEET_ID) → ZaloContent[].
 * Dùng chung GoogleAuthFactory (đọc-only) — KHÔNG đụng sync FB.
 *
 * ⚠️ CHƯA nối dữ liệu thật: cần tên tab + cột của Sheet Zalo. Điền phần TODO
 *    rồi ghi vào bảng zalo_contents (sql/009). Facebook không bị ảnh hưởng.
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../../google-auth';
import { parseDdmmToReal } from '../../date-util';
import { parseContentFormat } from './contentFormat';
import type { ZaloContent } from './ZaloContent';

export class ZaloSyncProvider {
  /** Đọc toàn bộ content Zalo từ Sheet riêng. TODO: hoàn thiện mapping khi có Sheet thật. */
  async fetchRecords(): Promise<ZaloContent[]> {
    const spreadsheetId = process.env.ZALO_SHEET_ID?.trim();
    if (!spreadsheetId) throw new Error('Thiếu ZALO_SHEET_ID (Google Sheet riêng của Zalo).');
    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

    // TODO(Zalo): xác định tên tab + hàng header + tên cột thực tế của Sheet Zalo.
    //   Ví dụ khung xử lý (đổi index cột cho khớp Sheet):
    //   const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Zalo'", valueRenderOption: 'FORMATTED_VALUE' });
    //   ... tìm header, map từng dòng như dưới:
    const _example = (row: string[], idx: Record<string, number>): ZaloContent => ({
      content_code: (row[idx.code] ?? '').trim(),
      assignee_name: (row[idx.assignee] ?? '').trim(),
      content_format: parseContentFormat(row[idx.format]),
      current_status: (row[idx.status] ?? '').trim(),
      upload_date_real: parseDdmmToReal((row[idx.upload] ?? '').trim()),
      test_date_real: parseDdmmToReal((row[idx.test] ?? '').trim()),
    });
    void _example; void sheets;

    // Chưa triển khai đầy đủ — trả rỗng để không ảnh hưởng hệ thống FB.
    return [];
  }
}
