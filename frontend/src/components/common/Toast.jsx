import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { IconCheck, IconX, IconWarning, IconInfo } from '@/components/icons/index.jsx';
import { registerToastHandler } from '@/utils/toast.js';

const TYPES = {
  success: { icon: IconCheck,   color: t.colors.green[400],   bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.18)' },
  error:   { icon: IconX,       color: t.colors.red[400],     bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.18)' },
  warning: { icon: IconWarning, color: t.colors.amber[400],   bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.18)' },
  info:    { icon: IconInfo,    color: t.colors.violet[300],  bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)' },
};

function ToastItem({ id, type = 'info', message, onDismiss, duration = 4000 }) {
  const cfg = TYPES[type] || TYPES.info;
  const Icon = cfg.icon;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.94 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        background: t.colors.bg.card,
        border: '1px solid ' + cfg.border,
        borderRadius: t.radius.lg,
        boxShadow: t.shadow.lg,
        maxWidth: '340px',
        width: '100%',
        pointerEvents: 'all',
        cursor: 'default',
      }}
    >
      <span style={{
        width: '28px', height: '28px',
        borderRadius: '8px',
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} color={cfg.color} />
      </span>
      <p style={{
        flex: 1,
        fontSize: '12.5px',
        color: t.colors.text.secondary,
        lineHeight: 1.5,
        letterSpacing: '-0.01em',
        margin: 0,
      }}>{message}</p>
      <button
        onClick={() => onDismiss(id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '20px', height: '20px', flexShrink: 0,
          borderRadius: '5px',
          color: t.colors.text.muted,
          transition: 'background 0.12s ease',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = t.colors.bg.elevated}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <IconX size={12} />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return registerToastHandler((item) => setToasts(prev => [...prev, item]));
  }, []);

  const onDismiss = (id) => setToasts(prev => prev.filter(item => item.id !== id));

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: t.z.toast,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map(item => (
          <ToastItem key={item.id} {...item} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
