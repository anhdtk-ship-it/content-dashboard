/**
 * Tailwind config cho Component Library (src/components/ui).
 * Màu trỏ vào CSS variable trong tokens.css → đổi theme bằng <html data-theme="…">.
 * (Không áp dụng cho dashboard vanilla public/index.html — dashboard giữ nguyên CSS riêng.)
 */
module.exports = {
  content: ['./src/components/ui/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        violet: 'var(--violet)',
        slate: 'var(--slate)',
      },
      borderRadius: { card: '12px', control: '8px', tag: '6px', pill: '999px' },
      fontSize: { kpi: ['25px', { lineHeight: '1.1', fontWeight: '700' }] },
      maxWidth: { content: '1180px' },
    },
  },
  plugins: [],
};
