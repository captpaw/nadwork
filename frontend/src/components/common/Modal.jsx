import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { IconClose } from '@/components/icons/index.jsx';

export default function Modal({ open, onClose, title, children, maxWidth = '560px' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleBackdropClick = onClose || undefined;
  const handleCloseBtn      = onClose || undefined;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            background: t.colors.bg.overlay,
            backdropFilter: 'blur(4px)',
            zIndex: t.z.modal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: t.colors.bg.dark,
              border: '1px solid ' + t.colors.border.default,
              borderRadius: t.radius.xl,
              padding: 'clamp(1.25rem, 4vw, 1.75rem)',
              width: '100%',
              maxWidth,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: t.shadow.xl,
            }}
          >
            {title && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                paddingBottom: '0.875rem',
                borderBottom: '1px solid ' + t.colors.border.subtle,
              }}>
                <h2 style={{
                  fontWeight: 600,
                  fontSize: '15px',
                  letterSpacing: '-0.02em',
                  color: t.colors.text.primary,
                  margin: 0,
                }}>
                  {title}
                </h2>
                {handleCloseBtn && (
                  <button
                    onClick={handleCloseBtn}
                    style={{
                      background: 'none',
                      border: '1px solid ' + t.colors.border.default,
                      color: t.colors.text.muted,
                      cursor: 'pointer',
                      borderRadius: t.radius.sm,
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.12s ease, border-color 0.12s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = t.colors.text.secondary; e.currentTarget.style.borderColor = t.colors.border.hover; }}
                    onMouseLeave={e => { e.currentTarget.style.color = t.colors.text.muted; e.currentTarget.style.borderColor = t.colors.border.default; }}
                  >
                    <IconClose size={14} />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
