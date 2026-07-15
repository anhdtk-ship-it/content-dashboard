import { useState } from 'react';
import { getSupabase } from './supabaseClient';

/* Màn hình đăng nhập — chỉ Google Workspace @seryn.vn. Hiển thị NGOÀI chrome Dashboard. */
export function LoginPage({ notice }: { notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true); setErr(null);
    try {
      const s = await getSupabase();
      const { error } = await s.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { hd: 'seryn.vn', prompt: 'select_account' }, // gợi ý giới hạn domain (server vẫn kiểm tra)
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? String(e)); setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
      <div className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 text-center">
        <div className="mb-1 text-[20px] font-bold">⚡ Ops Dashboard</div>
        <div className="mb-5 text-[13px] text-muted">Đăng nhập bằng Google Workspace <b className="text-fg">@seryn.vn</b></div>

        {notice && (
          <div className="mb-4 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">{notice}</div>
        )}

        <button
          onClick={signIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-control border border-line bg-surface2 px-4 py-2.5 text-[14px] font-semibold text-fg outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          <span aria-hidden className="text-[16px]">🔐</span>
          {busy ? 'Đang chuyển tới Google…' : 'Đăng nhập với Google'}
        </button>

        {err && <div className="mt-3 text-[12px] text-danger">{err}</div>}
        <div className="mt-4 text-[11px] text-muted">Chỉ tài khoản được cấp quyền mới truy cập được hệ thống.</div>
      </div>
    </div>
  );
}
