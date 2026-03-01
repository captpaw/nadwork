import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  type = 'text',
  style,
  containerStyle,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...containerStyle }}>
      {label && (
        <label style={{
          fontSize: '12px',
          fontWeight: 500,
          color: focused ? t.colors.text.secondary : t.colors.text.muted,
          letterSpacing: '-0.01em',
          transition: 'color 0.12s ease',
        }}>{label}</label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute',
            left: '10px',
            display: 'flex',
            alignItems: 'center',
            color: focused ? t.colors.text.secondary : t.colors.text.muted,
            pointerEvents: 'none',
            transition: 'color 0.12s ease',
          }}>{icon}</span>
        )}
        <input
          type={type}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: '36px',
            padding: icon ? '0 10px 0 34px' : '0 10px',
            paddingRight: iconRight ? '34px' : '10px',
            background: t.colors.bg.input,
            border: '1px solid ' + (error ? t.colors.red[500] : focused ? t.colors.violet[600] : t.colors.border.default),
            borderRadius: t.radius.md,
            color: t.colors.text.primary,
            fontSize: '13px',
            letterSpacing: '-0.01em',
            outline: 'none',
            transition: 'border-color 0.14s ease, box-shadow 0.14s ease',
            boxShadow: focused ? (error ? '0 0 0 2px rgba(239,68,68,0.15)' : '0 0 0 2px rgba(124,58,237,0.12)') : 'none',
            ...style,
          }}
          {...props}
        />
        {iconRight && (
          <span style={{
            position: 'absolute',
            right: '10px',
            display: 'flex',
            alignItems: 'center',
            color: t.colors.text.muted,
            pointerEvents: 'none',
          }}>{iconRight}</span>
        )}
      </div>
      {(error || hint) && (
        <span style={{
          fontSize: '11.5px',
          color: error ? t.colors.red[400] : t.colors.text.muted,
          lineHeight: 1.4,
        }}>{error || hint}</span>
      )}
    </div>
  );
}
