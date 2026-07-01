import 'dotenv/config';
import { google } from 'googleapis';
import { createGoogleAuth } from './google-auth';

async function main(): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error('Thiếu biến môi trường GOOGLE_SHEET_ID trong file .env');
  }

  // Xác thực bằng Service Account qua GoogleAuthFactory (JSON env → PATH file)
  const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

  // Lấy metadata của spreadsheet (không đọc dữ liệu trong ô)
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    // includeGridData mặc định là false => không tải dữ liệu các ô
    fields: 'properties.title,sheets.properties.title',
  });

  const title = res.data.properties?.title ?? '(không có tên)';
  const sheetList = res.data.sheets ?? [];
  const sheetNames = sheetList.map((s) => s.properties?.title ?? '(không tên)');

  console.log('✅ Kết nối Google Sheets thành công!');
  console.log('-----------------------------------');
  console.log(`Tên Spreadsheet : ${title}`);
  console.log(`Tổng số sheet   : ${sheetNames.length}`);
  console.log('Danh sách sheet :');
  sheetNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`);
  });
}

main().catch((err) => {
  console.error('❌ Kết nối thất bại:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
