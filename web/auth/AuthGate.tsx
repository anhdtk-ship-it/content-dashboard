import { useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from './supabaseClient';
import { LoginPage } from './LoginPage';

/* Cổng xác thực — bọc toàn app. KHÔNG sửa Dashboard; chỉ quyết định CÓ cho vào hay không.
 *   loading    → đang kiểm tra phiên
 *   login      → chưa đăng nhập → LoginPage
 *   denied     → đã đăng nhập nhưng KHÔNG được cấp quyền (403) → thông báo
 *   authorized → render Dashboard (children) */

const DENY_DEFAULT = 'Bạn không có quyền truy cập hệ thống.';
type State =
  | { k: 'loading' }
  | { k: 'login' }
  | { k: 'denied'; msg: string }
  | { k: 'authorized' };

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ k: 'loading' });

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;

    (async () => {
      const s = await getSupabase();

      const check = async () => {
        const { data } = await s.auth.getSession();
        if (!alive) return;
        if (!data.session) { setState({ k: 'login' }); return; }
        try {
          const res = await fetch('/api/auth/me');
          if (!alive) return;
          if (res.status === 200) setState({ k: 'authorized' });
          else if (res.status === 403) {
            const j = await res.json().catch(() => ({}));
            setState({ k: 'denied', msg: j?.error || DENY_DEFAULT });
          } else {
            setState({ k: 'login' }); // 401/khác → coi như chưa đăng nhập
          }
        } catch {
          if (alive) setState({ k: 'login' });
        }
      };

      await check();
      const { data: sub } = s.auth.onAuthStateChange(() => { check(); });
      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => { alive = false; unsub?.(); };
  }, []);

  const signOut = async () => {
    const s = await getSupabase();
    await s.auth.signOut();
    setState({ k: 'login' });
  };

  if (state.k === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-[14px] text-muted">Đang kiểm tra đăng nhập…</div>;
  }
  if (state.k === 'login') return <LoginPage />;
  if (state.k === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
        <div className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 text-center">
          <div className="mb-2 text-[30px]">⛔</div>
          <div className="mb-1 text-[16px] font-bold text-danger">{state.msg}</div>
          <div className="mb-5 text-[13px] text-muted">Tài khoản của bạn chưa được cấp quyền vào hệ thống. Liên hệ quản trị để được thêm.</div>
          <button
            onClick={signOut}
            className="w-full rounded-control border border-line bg-surface2 px-4 py-2 text-[14px] font-semibold text-fg outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent"
          >
            Đăng xuất / Thử tài khoản khác
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
