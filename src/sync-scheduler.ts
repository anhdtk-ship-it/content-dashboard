import 'dotenv/config';
import * as path from 'path';
import { spawn } from 'child_process';
import { schedule, validate } from 'node-cron';

/* ============================================================
 * Auto Sync Scheduler (P4)
 * ------------------------------------------------------------
 * Chạy nền bằng node-cron, TÁI DÙNG nguyên `sync-all-content.ts`
 * bằng cách spawn `npm run sync` (tiến trình con). KHÔNG sửa logic
 * sync. Việc ghi `sync_logs` (started_at/finished_at/rows_read/
 * inserted/updated/status/errors) do chính sync-all-content.ts đảm
 * nhiệm — scheduler không đụng DB/API/Dashboard.
 *
 * Vì sao spawn tiến trình con (không import trực tiếp):
 *  - `sync-all-content.ts` tự gọi main() khi nạp module và gọi
 *    `process.exit(1)` khi lỗi → nếu import sẽ làm CRASH scheduler.
 *  - Spawn cô lập lỗi: child crash KHÔNG kéo theo scheduler/server.
 * ========================================================== */

const DEFAULT_CRON = '*/15 * * * *'; // mặc định: 15 phút/lần (không hardcode — chỉ là fallback)
const PROJECT_ROOT = path.resolve(__dirname, '..'); // .../content-dashboard
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const now = () => new Date().toISOString();
const log = (m: string) => console.log(`[scheduler ${now()}] ${m}`);
const warn = (m: string) => console.warn(`[scheduler ${now()}] ${m}`);
const err = (m: string) => console.error(`[scheduler ${now()}] ${m}`);

/* ---- Đọc cấu hình từ Environment (không hardcode) ---- */
const rawEnabled = (process.env.SYNC_ENABLED ?? 'true').trim().toLowerCase();
const enabled = rawEnabled !== 'false' && rawEnabled !== '0' && rawEnabled !== 'no';
const cronExpr = (process.env.SYNC_CRON ?? '').trim() || DEFAULT_CRON;

/* ---- Khóa chống chạy chồng (overlap) ---- */
let isRunning = false;

function runSyncOnce(): void {
  // (4) Không cho phép chạy chồng: lần trước chưa xong → bỏ qua + ghi log lý do.
  if (isRunning) {
    warn('BỎ QUA lần này: lần Sync trước CHƯA hoàn thành (chống chạy chồng).');
    return;
  }

  isRunning = true;
  const t0 = Date.now();
  log('Bắt đầu Sync → spawn `npm run sync` (tái dùng sync-all-content.ts)…');

  let child;
  try {
    child = spawn(NPM, ['run', 'sync'], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ['ignore', 'inherit', 'inherit'], // in trực tiếp log của sync (gồm bản ghi sync_logs)
    });
  } catch (e: any) {
    // (6) Lỗi spawn cũng không được crash.
    isRunning = false;
    err(`Không spawn được tiến trình Sync: ${e?.message ?? e}. KHÔNG crash, sẽ thử lại lần sau.`);
    return;
  }

  child.on('error', (e) => {
    // (6) Lỗi tiến trình con → log, không crash, tiếp tục vòng lặp.
    isRunning = false;
    err(`Tiến trình Sync lỗi khi chạy: ${e.message}. KHÔNG crash, sẽ thử lại lần sau.`);
  });

  child.on('exit', (code, signal) => {
    isRunning = false; // mở khóa để lần kế tiếp được phép chạy
    const dur = ((Date.now() - t0) / 1000).toFixed(2);
    if (code === 0) {
      log(`Sync hoàn tất sau ${dur}s (exit 0). Bản ghi sync_logs do sync-all-content.ts ghi.`);
    } else {
      // process.exit(1) bên trong sync khi có lỗi nghiêm trọng → chỉ giết child.
      err(`Sync KẾT THÚC LỖI (exit=${code ?? 'null'}, signal=${signal ?? 'null'}) sau ${dur}s. Đã log, KHÔNG crash, tiếp tục vòng lặp.`);
    }
  });
}

/* ============================================================
 * Bootstrap
 * ========================================================== */
log(
  `Cấu hình: SYNC_ENABLED=${process.env.SYNC_ENABLED ?? '(unset→true)'} · ` +
    `SYNC_CRON=${process.env.SYNC_CRON ?? `(unset→${DEFAULT_CRON})`}`,
);

// (3) SYNC_ENABLED=false → không chạy.
if (!enabled) {
  warn('SYNC_ENABLED=false → Scheduler KHÔNG khởi động. Thoát.');
  process.exit(0);
}

// (2) Validate biểu thức cron đọc từ env.
if (!validate(cronExpr)) {
  err(`SYNC_CRON không hợp lệ: "${cronExpr}". Scheduler KHÔNG khởi động.`);
  process.exit(1);
}

schedule(cronExpr, runSyncOnce);
log(`Scheduler đang chạy nền. Lịch: "${cronExpr}". Lần Sync đầu sẽ theo lịch. Ctrl+C để dừng.`);

// Giữ tiến trình sống + tắt êm.
process.on('SIGINT', () => { warn('Nhận SIGINT → dừng scheduler.'); process.exit(0); });
process.on('SIGTERM', () => { warn('Nhận SIGTERM → dừng scheduler.'); process.exit(0); });
