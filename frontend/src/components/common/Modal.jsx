import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../../styles/theme';
import { IconX } from '../icons';

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 520,
  hideClose = false,
}) {
  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: theme.colors.bg.overlay,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: theme.z.modal,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px 16px',
            }}
          >
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth,
                maxHeight: 'calc(100vh - 40px)',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.default}`,
                borderRadius: theme.radius['2xl'],
                boxShadow: theme.shadow.xl,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header — sticky, never scrolls away */}
              {(title || !hideClose) && (
                <div style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '18px 22px 16px',
                  borderBottom: `1px solid ${theme.colors.border.subtle}`,
                }}>
                  {title && (
                    <h2 style={{
                      fontFamily: theme.fonts.body, fontWeight: 700,
                      fontSize: 16, color: theme.colors.text.primary,
                      letterSpacing: '-0.025em',
                    }}>{title}</h2>
                  )}
                  {!hideClose && (
                    <button
                      onClick={onClose}
                      style={{
                        width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: theme.colors.text.muted,
                        borderRadius: theme.radius.sm,
                        fontSize: 16, transition: theme.transition,
                        marginLeft: 'auto',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = theme.colors.bg.elevated; e.currentTarget.style.color = theme.colors.text.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = theme.colors.text.muted; }}
                    >
                      <IconX size={16} color="currentColor" />
                    </button>
                  )}
                </div>
              )}

              {/* Body — scrollable */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 22px 24px',
                /* Custom scrollbar to match dark theme */
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.colors.border.default} transparent`,
              }}>
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
