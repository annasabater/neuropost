import React from 'react';
import { Link } from '@react-email/components';

interface ButtonProps {
  href:     string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const style = variant === 'primary' ? primaryStyle : secondaryStyle;
  return (
    <Link href={href} style={style}>
      {children}
    </Link>
  );
}

const base: React.CSSProperties = {
  display:        'inline-block',
  padding:        '12px 24px',
  fontSize:       '14px',
  fontWeight:     700,
  textDecoration: 'none',
  textAlign:      'center',
  border:         '2px solid #111827',
  lineHeight:     '1',
};

const primaryStyle: React.CSSProperties = {
  ...base,
  backgroundColor: '#0F766E',
  color:           '#ffffff',
  borderColor:     '#0F766E',
};

const secondaryStyle: React.CSSProperties = {
  ...base,
  backgroundColor: 'transparent',
  color:           '#111827',
};
