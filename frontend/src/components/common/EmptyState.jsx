import React from 'react';
import { theme as t } from '@/styles/theme.js';
import Button from './Button.jsx';

export default function EmptyState({ icon: Icon, title, message, action, onAction }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 'clamp(40px, 8vw, 80px) 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    }}>
      {Icon && (
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: t.radius.lg,
          background: t.colors.bg.elevated,
          border: '1px solid ' + t.colors.border.default,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '4px',
        }}>
          <Icon size={20} color={t.colors.text.muted} />
        </div>
      )}
      <h3 style={{
        fontSize: '14px',
        fontWeight: 600,
        color: t.colors.text.secondary,
        letterSpacing: '-0.02em',
      }}>{title}</h3>
      {message && (
        <p style={{
          fontSize: '12.5px',
          color: t.colors.text.muted,
          maxWidth: '320px',
          lineHeight: 1.65,
        }}>{message}</p>
      )}
      {action && onAction && (
        <div style={{ marginTop: '8px' }}>
          <Button size='sm' onClick={onAction}>{action}</Button>
        </div>
      )}
    </div>
  );
}
