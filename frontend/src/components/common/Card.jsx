import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Card({
  children,
  variant = 'default',
  hoverable = false,
  onClick,
  padding,
  style,
  className,
}) {
  const [hov, setHov] = useState(false);

  const variants = {
    default: {
      background: t.colors.bg.card,
      border: '1px solid ' + (hov && hoverable ? t.colors.border.strong : t.colors.border.subtle),
      boxShadow: hov && hoverable ? t.shadow.md : 'none',
    },
    elevated: {
      background: t.colors.bg.elevated,
      border: '1px solid ' + (hov && hoverable ? t.colors.border.strong : t.colors.border.default),
      boxShadow: hov && hoverable ? t.shadow.md : 'none',
    },
    surface: {
      background: t.colors.bg.surface,
      border: '1px solid rgba(124,58,237,0.14)',
      boxShadow: 'none',
    },
    outline: {
      background: 'transparent',
      border: '1px solid ' + (hov && hoverable ? t.colors.border.strong : t.colors.border.default),
    },
  };

  const v = variants[variant] || variants.default;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHov(true)}
      onMouseLeave={() => hoverable && setHov(false)}
      className={className}
      style={{
        ...v,
        borderRadius: t.radius.lg,
        padding: padding ?? '20px',
        transition: 'border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
