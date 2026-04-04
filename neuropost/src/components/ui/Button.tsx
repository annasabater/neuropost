import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children:  ReactNode;
  loading?:  boolean;
  variant?:  'primary' | 'orange' | 'outline' | 'ghost' | 'danger';
  size?:     'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-primary',
  orange:  'btn-primary btn-orange',
  outline: 'btn-outline',
  ghost:   'btn-outline',
  danger:  'btn-outline',
};

export function Button({
  children,
  loading = false,
  variant = 'primary',
  size,
  fullWidth = false,
  disabled,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const sizeStyle = size === 'sm'
    ? { padding: '8px 18px', fontSize: '0.82rem' }
    : size === 'lg'
    ? { padding: '16px 36px', fontSize: '1rem' }
    : {};

  return (
    <button
      disabled={loading || disabled}
      className={`${VARIANT_STYLES[variant]} ${fullWidth ? 'btn-full' : ''} ${className}`.trim()}
      style={{ ...sizeStyle, ...style }}
      {...rest}
    >
      {loading && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
