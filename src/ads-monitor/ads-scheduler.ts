import 'dotenv/config';
import * as path from 'path';
import { spawn } from 'child_process';
import { schedule, validate } from 'node-cron';

/* ============================================================
 * Ads Monitor — Auto Import Scheduler (PHASE 7+)
 * ------------------------------------------------------------
 * Chạy nền bằng node-cron, TÁI DÙNG nguyên `ads:import` bằng cách spawn
 * tiến trình con `npm run ads:import`. KHÔNG sửa logic import. Việc đọc
 * Sheet → upsert ads_monitor → refresh lifecycle do chính import.ts đảm
 * nhiệm — scheduler không đụng DB/API/Dashboard.
 *
 * Vì sao spawn tiến trình con (không import trực tiếp):
 *  - `import.ts` tự gọi main() khi nạp module + `process.exit(1)` khi lỗi
 *    → nếu import trực tiếp sẽ làm CRASH scheduler.
 *  - Spawn cô lập lỗi: child crash KHÔNG kéo theo scheduler/server.
 *
 * ĐỘC LẬP với scheduler Content (sync-scheduler.ts) — biến env riêng.
 * Google Sheet Ads cập nhật 09:20 mỗi sáng → mặc định chạy 09:35.
 * ========================================================== */

const DEFAULT_CRON = '35 9 * * *'; // mặc định: 09:35 mỗi ngày (sau khi Sheet cập nhật 09:20). Fallback, không hardcode.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..'); // src/ads-monitor → content-dashboard
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const now = () => new Date().toISOString();
const log = (m: string) => console.log(`[ads-scheduler ${now()}] ${m}`);
const warn = (m: string) => console.warn(`[ads-scheduler ${now()}] ${m}`);
const err = (m: string) => console.error(`[ads-scheduler ${now()}] ${m}`);

/* ---- Cấu hình từ Environment (không hardcode) ---- */
const rawEnabled = (process.env.ADS_SYNC_ENABLED ?? 'true').trim().toLowerCase();
const enabled = rawEnabled !== 'false' && rawEnabled !== '0' && rawEnabled !== 'no';
const cronExpr = (process.env.ADS_SYNC_CRON ?? '').trim() || DEFAULT_CRON;

/* ---- Khóa chống chạy chồng (overlap) ---- */
let isRunning = false;

function runImportOnce(): void {
  if (isRunning) {
    warn('BỎ QUA lần này: lần Import trước CHƯA hoàn thành (chống chạy chồng).');
    return;
  }

  isRunning = true;
  const t0 = Date.now();
  log('Bắt đầu Import → spawn `npm run ads:import` (tái dùng import.ts)…');

  let child;
  try {
    child = spawn(NPM, ['run', 'ads:import'], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'], // in trực tiếp log import (Read/Insert/Update/Lifecycle…)
    });
  } catch (e: any) {
    isRunning = false;
    err(`Không spawn được tiến trình Import: ${e?.message ?? e}. KHÔNG crash, sẽ thử lại lần sau.`);
    return;
  }

  child.on('error', (e) => {
    isRunning = false;
    err(`Tiến trình Import lỗi khi chạy: ${e.message}. KHÔNG crash, sẽ thử lại lần sau.`);
  });

  child.on('exit', (code, signal) => {
    isRunning = false;
    const dur = ((Date.now() - t0) / 1000).toFixed(2);
    if (code === 0) {
      log(`Import hoàn tất sau ${dur}s (exit 0). Lifecycle đã refresh trong import.ts.`);
    } else {
      err(`Import KẾT THÚC LỖI (exit=${code ?? 'null'}, signal=${signal ?? 'null'}) sau ${dur}s. Đã log, KHÔNG crash, tiếp tục vòng lặp.`);
    }
  });
}

/* ============================================================
 * Bootstrap
 * ========================================================== */
log(
  `Cấu hình: ADS_SYNC_ENABLED=${process.env.ADS_SYNC_ENABLED ?? '(unset→true)'} · ` +
    `ADS_SYNC_CRON=${process.env.ADS_SYNC_CRON ?? `(unset→${DEFAULT_CRON})`}`,
);

if (!enabled) {
  warn('ADS_SYNC_ENABLED=false → Scheduler KHÔNG khởi động. Thoát.');
  process.exit(0);
}

if (!validate(cronExpr)) {
  err(`ADS_SYNC_CRON không hợp lệ: "${cronExpr}". Scheduler KHÔNG khởi động.`);
  process.exit(1);
}

schedule(cronExpr, runImportOnce);
log(`Scheduler đang chạy nền. Lịch: "${cronExpr}". Lần Import đầu sẽ theo lịch. Ctrl+C để dừng.`);

process.on('SIGINT', () => { warn('Nhận SIGINT → dừng scheduler.'); process.exit(0); });
process.on('SIGTERM', () => { warn('Nhận SIGTERM → dừng scheduler.'); process.exit(0); });
