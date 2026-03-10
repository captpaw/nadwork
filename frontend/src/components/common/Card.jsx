import { useState } from 'react';
import { theme } from '../../styles/theme';

const VARIANTS = {
  default:  { bg: theme.colors.bg.card,    border: theme.colors.border.subtle  },
  elevated: { bg: theme.colors.bg.elevated, border: theme.colors.border.default },
  surface:  { bg: theme.colors.bg.surface,  border: theme.colors.primaryBorder  },
  outline:  { bg: 'transparent',            border: theme.colors.border.default },
};

const PADDING = { sm: '12px', md: '20px', lg: '28px' };

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  onClick,
  style: extraStyle = {},
  className = '',
  ...props
}) {
  const [hov, setHov] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.default;
  const isClickable = hoverable || !!onClick;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => isClickable && setHov(true)}
      onMouseLeave={() => isClickable && setHov(false)}
      className={className}
      style={{
        background: v.bg,
        border: `1px solid ${hov && isClickable ? theme.colors.border.strong : v.border}`,
        borderRadius: theme.radius.lg,
        padding: typeof padding === 'string' && PADDING[padding] ? PADDING[padding] : padding,
        cursor: isClickable ? 'pointer' : 'default',
        transition: theme.transition,
        boxShadow: hov && isClickable ? theme.shadow.md : 'none',
        ...extraStyle,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
