/* ============================================================
 * SyncQueue (PHASE 12) — Debounce + Maximum Wait + Mutex
 * ------------------------------------------------------------
 * Nhận tín hiệu "Sheet đã đổi" (từ webhook) và quyết định KHI NÀO
 * chạy Sync thật. KHÔNG tự đọc Sheet / ghi DB — chỉ hẹn giờ gọi
 * `runFn` (ContentSyncService).
 *
 * Quy tắc:
 *  - Debounce: mỗi tín hiệu reset timer về `debounceMs` (mặc định 60s).
 *  - Maximum Wait: không bao giờ trễ quá `maxWaitMs` (mặc định 5 phút)
 *    kể từ tín hiệu ĐẦU TIÊN của chu kỳ → luôn buộc Sync trong 5 phút.
 *  - Mutex: đang Sync mà có tín hiệu mới → đánh dấu `pending`, KHÔNG
 *    chạy chồng; Sync xong sẽ mở chu kỳ debounce mới cho các thay đổi đó.
 * ========================================================== */

export interface QueueState {
  running: boolean;        // đang chạy Sync
  scheduled: boolean;      // đã hẹn giờ (timer đang chạy)
  pending: boolean;        // có tín hiệu tới trong lúc đang Sync
  firstRequestAt: number | null; // mốc tín hiệu đầu của chu kỳ
  nextFireAt: number | null;     // thời điểm dự kiến chạy
  lastEnqueueAt: number | null;
  triggerCount: number;    // số tín hiệu trong chu kỳ hiện tại
  lastResult: any | null;  // kết quả Sync gần nhất
  lastRunAt: number | null;
}

export interface EnqueueInfo { scheduled: boolean; willFireInMs: number | null; busy: boolean }

type Logger = (m: string) => void;

export class SyncQueue {
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly runFn: () => Promise<any>;
  private readonly log: Logger;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstRequestAt: number | null = null;
  private nextFireAt: number | null = null;
  private lastEnqueueAt: number | null = null;
  private running = false;
  private pending = false;
  private triggerCount = 0;
  private lastResult: any = null;
  private lastRunAt: number | null = null;

  constructor(cfg: { debounceMs: number; maxWaitMs: number; runFn: () => Promise<any>; log?: Logger }) {
    this.debounceMs = cfg.debounceMs;
    this.maxWaitMs = cfg.maxWaitMs;
    this.runFn = cfg.runFn;
    this.log = cfg.log ?? (() => {});
  }

  /** Nhận 1 tín hiệu thay đổi. Trả thông tin lịch chạy. */
  enqueue(): EnqueueInfo {
    const now = Date.now();
    this.lastEnqueueAt = now;
    this.triggerCount++;

    // Đang Sync → không chạy chồng; nhớ để mở chu kỳ mới sau khi xong.
    if (this.running) {
      this.pending = true;
      this.log('Đang Sync → tín hiệu mới được xếp hàng (sẽ chạy chu kỳ mới sau khi xong).');
      return { scheduled: false, willFireInMs: null, busy: true };
    }

    if (this.firstRequestAt == null) this.firstRequestAt = now;
    if (this.timer) clearTimeout(this.timer);

    // Debounce, nhưng KẸP trong Maximum Wait kể từ tín hiệu đầu tiên.
    const elapsed = now - this.firstRequestAt;
    const wait = Math.max(0, Math.min(this.debounceMs, this.maxWaitMs - elapsed));
    this.nextFireAt = now + wait;
    this.timer = setTimeout(() => { void this.fire(); }, wait);
    return { scheduled: true, willFireInMs: wait, busy: false };
  }

  private async fire(): Promise<void> {
    this.timer = null;
    this.nextFireAt = null;
    this.firstRequestAt = null;
    const triggers = this.triggerCount;
    this.triggerCount = 0;
    this.running = true;
    this.log(`Debounce hết hạn (gộp ${triggers} tín hiệu) → chạy Sync.`);
    try {
      this.lastResult = await this.runFn();
    } catch (e: any) {
      this.lastResult = { status: 'failed', error: e?.message ?? String(e) };
      this.log(`Sync lỗi: ${e?.message ?? e}`);
    } finally {
      this.running = false;
      this.lastRunAt = Date.now();
      if (this.pending) {
        this.pending = false;
        this.log('Có thay đổi trong lúc Sync → mở chu kỳ debounce mới.');
        this.enqueue();
      }
    }
  }

  getState(): QueueState {
    return {
      running: this.running,
      scheduled: this.timer != null,
      pending: this.pending,
      firstRequestAt: this.firstRequestAt,
      nextFireAt: this.nextFireAt,
      lastEnqueueAt: this.lastEnqueueAt,
      triggerCount: this.triggerCount,
      lastResult: this.lastResult,
      lastRunAt: this.lastRunAt,
    };
  }
}
