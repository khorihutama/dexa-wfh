import React from 'react';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => {
  const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
    success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    warning: 'bg-amber-100 text-amber-900 border-amber-200',
    danger: 'bg-red-100 text-red-900 border-red-200',
    info: 'bg-sky-100 text-sky-900 border-sky-200',
    neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
};
