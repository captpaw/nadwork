import { useState } from 'react';
import { theme } from '../../styles/theme';

export default function Input({
  label,
  hint,
  error,
  iconLeft,
  iconRight,
  style: extraStyle = {},
  containerStyle = {},
  id,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.red[500]
    : focused
    ? theme.colors.primary
    : theme.colors.border.default;

  const boxShadow = error
    ? `0 0 0 3px ${theme.colors.red.dim}`
    : focused
    ? `0 0 0 3px ${theme.colors.primaryDim}`
    : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...containerStyle }}>
      {label && (
        <label htmlFor={id} style={{
          fontFamily: theme.fonts.body, fontSize: 12.5,
          fontWeight: 500, color: theme.colors.text.secondary,
          letterSpacing: '-0.01em',
        }}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {iconLeft && (
          <span style={{
            position: 'absolute', left: 12,
            display: 'flex', alignItems: 'center',
            color: focused ? theme.colors.text.secondary : theme.colors.text.muted,
            pointerEvents: 'none', transition: theme.transition,
          }}>
            {iconLeft}
          </span>
        )}

        <input
          id={id}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `9px ${iconRight ? '36px' : '14px'} 9px ${iconLeft ? '36px' : '14px'}`,
            background: theme.colors.bg.input,
            color: theme.colors.text.primary,
            border: `1px solid ${borderColor}`,
            borderRadius: theme.radius.md,
            fontSize: 13.5,
            fontFamily: theme.fonts.body,
            outline: 'none',
            boxShadow,
            transition: theme.transition,
            ...extraStyle,
          }}
          {...props}
        />

        {iconRight && (
          <span style={{
            position: 'absolute', right: 12,
            display: 'flex', alignItems: 'center',
            color: theme.colors.text.muted,
          }}>
            {iconRight}
          </span>
        )}
      </div>

      {(error || hint) && (
        <span style={{
          fontFamily: theme.fonts.body, fontSize: 12,
          color: error ? theme.colors.red[400] : theme.colors.text.muted,
          letterSpacing: '-0.01em',
        }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

// Textarea variant
export function Textarea({ label, hint, error, style: extraStyle = {}, containerStyle = {}, id, ...props }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...containerStyle }}>
      {label && (
        <label htmlFor={id} style={{
          fontFamily: theme.fonts.body, fontSize: 12.5,
          fontWeight: 500, color: theme.colors.text.secondary,
          letterSpacing: '-0.01em',
        }}>
          {label}
        </label>
      )}

      <textarea
        id={id}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', resize: 'vertical', minHeight: 100,
          padding: '10px 14px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md,
          fontSize: 13.5, fontFamily: theme.fonts.body,
          outline: 'none', lineHeight: 1.6,
          boxShadow: error
            ? `0 0 0 3px ${theme.colors.red.dim}`
            : focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
          transition: theme.transition,
          ...extraStyle,
        }}
        {...props}
      />

      {(error || hint) && (
        <span style={{
          fontFamily: theme.fonts.body, fontSize: 12,
          color: error ? theme.colors.red[400] : theme.colors.text.muted,
        }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
