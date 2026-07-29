/* CLI đồng bộ Zalo: `npm run zalo:sync`. ĐỘC LẬP với sync Facebook (npm run sync). */
import { runZaloSync } from './platform/zalo/ZaloSyncService';

runZaloSync({ source: 'manual-cli', logger: (m) => console.log(`[zalo-sync] ${m}`) })
  .then((r) => {
    console.log(`✅ Zalo sync ${r.status} · đọc ${r.rowsRead} · mới ${r.inserted} · đổi ${r.updated} · giữ ${r.unchanged} · prune ${r.pruned} · ${r.durationMs}ms`);
    process.exit(r.status === 'failed' ? 1 : 0);
  })
  .catch((e) => { console.error('❌ Zalo sync lỗi:', e?.message ?? e); process.exit(1); });
