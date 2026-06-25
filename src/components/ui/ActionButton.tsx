import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'ghost' | 'primary';

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  default: 'bg-surface border-line hover:bg-surface2 text-fg',
  ghost: 'bg-transparent border-line hover:bg-surface2 text-fg',
  primary: 'bg-[#1d4ed8] border-[#1d4ed8] text-white hover:brightness-110',
};

/** Nút hành động (DESIGN_SYSTEM §4). */
export function ActionButton({ variant = 'default', icon, children, className = '', ...rest }: ActionButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-control border px-[10px] py-[6px] text-[13px] transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function ActionButtonDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton variant="primary" icon={<span>⟳</span>}>Chạy Sync</ActionButton>
      <ActionButton>Mặc định</ActionButton>
      <ActionButton variant="ghost" icon={<span>⬇</span>}>Export</ActionButton>
      <ActionButton disabled>Disabled</ActionButton>
    </div>
  );
}
