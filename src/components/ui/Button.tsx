import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-bg hover:bg-accent/90 disabled:bg-accent/30',
  secondary: 'bg-surface-2 text-text hover:bg-surface-2/70 border border-border',
  ghost: 'bg-transparent text-text-dim hover:text-text',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`rounded-xl px-5 py-3 font-bold uppercase tracking-wide text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
