import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label = 'Memuat data...',
  className = '',
}) => {
  const sizes: Record<NonNullable<SpinnerProps['size']>, string> = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 text-sm text-slate-700 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`inline-block animate-spin rounded-full border-red-700 border-t-transparent ${sizes[size]}`}
      />
      <span>{label}</span>
    </div>
  );
};
