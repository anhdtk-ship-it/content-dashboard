import 'dotenv/config';
import { google } from 'googleapis';

async function main(): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

  if (!spreadsheetId) {
    throw new Error('Thiếu biến môi trường GOOGLE_SHEET_ID trong file .env');
  }
  if (!credentialsPath) {
    throw new Error('Thiếu biến môi trường GOOGLE_CREDENTIALS_PATH trong file .env');
  }

  // Xác thực bằng Service Account (chỉ cần quyền đọc để lấy metadata)
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

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
