import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../../styles/theme';
import { registerToastHandler } from '../../utils/toast';
import { IconCheck, IconX, IconWarning, IconInfo } from '../icons';

const TYPES = {
  success: { color: theme.colors.green[400],    bg: theme.colors.green.dim,    border: theme.colors.green.border,    Icon: IconCheck },
  error:   { color: theme.colors.red[400],      bg: theme.colors.red.dim,      border: theme.colors.red.border,      Icon: IconX },
  warning: { color: theme.colors.amber,         bg: theme.colors.amberDim,     border: theme.colors.amberBorder,     Icon: IconWarning },
  info:    { color: theme.colors.primary,       bg: theme.colors.primaryDim,   border: theme.colors.primaryBorder,   Icon: IconInfo },
};

function Toast({ id, type = 'info', message, onDismiss, duration = 4000 }) {
  const t = TYPES[type] || TYPES.info;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.94 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: theme.colors.bg.elevated,
        border: `1px solid ${t.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.lg,
        maxWidth: 360, minWidth: 260,
        cursor: 'pointer',
      }}
      onClick={() => onDismiss(id)}
    >
      {/* Icon */}
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        background: t.bg, border: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <t.Icon size={11} color={t.color} />
      </span>

      {/* Message */}
      <span style={{
        fontFamily: theme.fonts.body, fontSize: 13,
        color: theme.colors.text.primary, lineHeight: 1.5,
        flex: 1,
      }}>
        {message}
      </span>

      {/* Dismiss */}
      <span style={{ flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center' }}>
        <IconX size={12} color={theme.colors.text.muted} />
      </span>
    </motion.div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    registerToastHandler((toast) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...toast, id }]);
    });
  }, []);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: theme.z.toast,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast {...t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
