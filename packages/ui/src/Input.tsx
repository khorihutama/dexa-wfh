import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        aria-invalid={hasError || undefined}
        className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
          hasError
            ? 'border-red-600 bg-red-50/30 focus-visible:border-red-600 focus-visible:ring-red-600/25'
            : 'border-slate-300 bg-white focus-visible:border-red-700 focus-visible:ring-red-700/20'
        } ${className}`.trim()}
        {...props}
      />
      {error ? (
        <span role="alert" className="text-xs font-medium text-red-700">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-xs text-slate-600">{helperText}</span>
      ) : null}
    </div>
  );
};
