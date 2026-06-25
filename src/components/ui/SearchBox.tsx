import { useState } from 'react';

export interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/** Ô tìm kiếm có icon (DESIGN_SYSTEM §8). */
export function SearchBox({ value, onChange, placeholder = 'Tìm…', className = '' }: SearchBoxProps) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted">🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-control border border-line bg-surface py-[6px] pl-7 pr-2 text-[13px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
    </div>
  );
}

export function SearchBoxDemo() {
  const [q, setQ] = useState('');
  return (
    <div className="max-w-xs">
      <SearchBox value={q} onChange={setQ} placeholder="Tìm content_code / title…" />
      <p className="mt-2 text-xs text-muted">Giá trị: "{q}"</p>
    </div>
  );
}
