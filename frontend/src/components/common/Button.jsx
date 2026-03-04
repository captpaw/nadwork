import { useState } from 'react';
import { theme } from '../../styles/theme';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: {
    bg:        theme.colors.primary,
    bgHover:   theme.colors.primaryHover,
    color:     '#ffffff',
    border:    'transparent',
    shadow:    `0 2px 16px ${theme.colors.primaryGlow}`,
  },
  secondary: {
    bg:        theme.colors.bg.elevated,
    bgHover:   '#222222',
    color:     theme.colors.text.primary,
    border:    theme.colors.border.default,
    shadow:    'none',
  },
  ghost: {
    bg:        'transparent',
    bgHover:   theme.colors.bg.elevated,
    color:     theme.colors.text.secondary,
    border:    'transparent',
    shadow:    'none',
  },
  danger: {
    bg:        theme.colors.red.dim,
    bgHover:   'rgba(239,68,68,0.14)',
    color:     theme.colors.red[400],
    border:    theme.colors.red.border,
    shadow:    'none',
  },
  success: {
    bg:        theme.colors.green.dim,
    bgHover:   'rgba(16,185,129,0.14)',
    color:     theme.colors.green[400],
    border:    theme.colors.green.border,
    shadow:    'none',
  },
  outline: {
    bg:        'transparent',
    bgHover:   theme.colors.primaryDim,
    color:     theme.colors.text.secondary,
    border:    theme.colors.border.default,
    shadow:    'none',
  },
};

const SIZES = {
  sm: { padding: '6px 14px', fontSize: 12, height: 30, gap: 5 },
  md: { padding: '9px 20px', fontSize: 13, height: 38, gap: 7 },
  lg: { padding: '12px 28px', fontSize: 14, height: 46, gap: 8 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  iconRight = null,
  fullWidth = false,
  onClick,
  type = 'button',
  style: extraStyle = {},
  ...props
}) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);

  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => !isDisabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !isDisabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        height: s.height,
        width: fullWidth ? '100%' : undefined,
        background: hov && !isDisabled ? v.bgHover : v.bg,
        color: isDisabled ? theme.colors.text.muted : v.color,
        border: `1px solid ${v.border}`,
        borderRadius: theme.radius.md,
        fontSize: s.fontSize,
        fontFamily: theme.fonts.body,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        boxShadow: hov && !isDisabled ? 'none' : v.shadow,
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
        transition: theme.transition,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...extraStyle,
      }}
      {...props}
    >
      {loading ? (
        <Spinner size={s.height - 20} color={v.color} />
      ) : (
        <>
          {icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
          {children}
          {iconRight && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{iconRight}</span>}
        </>
      )}
    </button>
  );
}
