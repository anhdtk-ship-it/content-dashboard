/* ============================================================
 * DbSyncQueue (VERCEL MIGRATION) — Debounce + Maximum Wait + Mutex, TRẠNG THÁI LƯU Ở SUPABASE
 * (bảng `sync_debounce`, migration 012), thay cho SyncQueue.ts (setTimeout trong RAM).
 * ------------------------------------------------------------
 * Lý do: trên Vercel (serverless), mỗi request có thể chạy trên instance khác nhau,
 * không share RAM → 1 timer hẹn "60s sau" đặt trong biến instance KHÔNG đảm bảo còn
 * sống để bắn. Toàn bộ trạng thái debounce (pending/first_signal_at/last_signal_at/
 * running/claimed_at) chuyển sang lưu ở DB; việc "khi nào thực sự chạy Sync" do 1 route
 * tick (gọi từ cron ngoài mỗi ~1 phút, xem tickRoutes.ts) quyết định qua RPC atomic.
 *
 * enqueue() vẫn trả về NGAY cho webhook (contract 202 không đổi) — chỉ ghi tín hiệu.
 * tick() do route /api/cron/tick/* gọi — claim quyền chạy rồi mới thực sự gọi runFn().
 * ========================================================== */
import { createSupa } from '../platform/db';

export type QueueKey = 'content' | 'zalo';

export interface DebounceRow {
  queue_key: QueueKey;
  pending: boolean;
  running: boolean;
  first_signal_at: string | null;
  last_signal_at: string | null;
  claimed_at: string | null;
  last_result: any | null;
  last_run_at: string | null;
  updated_at: string;
}

export interface TickConfig { debounceMs: number; maxWaitMs: number; stuckMs?: number }
export interface TickOutcome { ranSync: boolean; result?: any; row: DebounceRow | null }

const DEFAULT_STUCK_MS = 540_000; // 9 phút — an toàn hơn maxDuration function (60s) nhiều lần

export class DbSyncQueue {
  private readonly key: QueueKey;
  private readonly supa = createSupa();

  constructor(key: QueueKey) {
    this.key = key;
  }

  /** Webhook gọi khi nhận tín hiệu "Sheet đã đổi". KHÔNG tự chạy Sync. */
  async enqueue(): Promise<void> {
    const { error } = await this.supa.rpc('sync_enqueue', { p_key: this.key });
    if (error) throw error;
  }

  /** Đọc trạng thái hiện tại (cho endpoint /status). */
  async getState(): Promise<DebounceRow | null> {
    const { data, error } = await this.supa.from('sync_debounce').select('*').eq('queue_key', this.key).maybeSingle();
    if (error) throw error;
    return (data as DebounceRow) ?? null;
  }

  /**
   * Gọi từ route tick (cron ngoài). Claim quyền chạy qua RPC atomic; nếu claim được thì
   * chạy `runFn()` thật (đọc Sheet + upsert DB), rồi ghi kết quả lại. Nếu không claim được
   * (chưa hết debounce, hoặc đang có lần chạy khác) → trả về ranSync=false, không làm gì thêm.
   */
  async tick(cfg: TickConfig, runFn: () => Promise<any>): Promise<TickOutcome> {
    const { data: claimed, error: claimErr } = await this.supa.rpc('sync_tick_claim', {
      p_key: this.key,
      p_debounce_ms: cfg.debounceMs,
      p_max_wait_ms: cfg.maxWaitMs,
      p_stuck_ms: cfg.stuckMs ?? DEFAULT_STUCK_MS,
    });
    if (claimErr) throw claimErr;

    // RPC trả về 1 row (setof) hoặc null — supabase-js với hàm trả `returns table`/single row
    // có thể trả về object hoặc array 1 phần tử tùy driver; chuẩn hoá cả 2 trường hợp.
    const row: DebounceRow | null = Array.isArray(claimed) ? (claimed[0] ?? null) : (claimed ?? null);
    if (!row) return { ranSync: false, row: await this.getState() };

    let result: any;
    try {
      result = await runFn();
    } catch (e: any) {
      result = { status: 'failed', error: e?.message ?? String(e) };
    }

    const { error: finishErr } = await this.supa.rpc('sync_tick_finish', { p_key: this.key, p_result: result });
    if (finishErr) throw finishErr;

    return { ranSync: true, result, row: await this.getState() };
  }
}
