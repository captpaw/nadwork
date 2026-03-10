import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme } from '../../styles/theme';
import { IconX } from '../icons';

function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(selector)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return el.offsetParent !== null;
  });
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 520,
  hideClose = false,
}) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2, 10)}`);

  // Lock body scroll when modal is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus management: move focus into dialog and restore when closed.
  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      const target = focusables[0] || panel;
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Keyboard support: ESC close + TAB focus trap.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: theme.colors.bg.overlay,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: theme.z.modal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px',
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleIdRef.current : undefined}
            aria-label={title ? undefined : 'Dialog'}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth,
              maxHeight: 'calc(100vh - 40px)',
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.radius['2xl'],
              boxShadow: theme.shadow.xl,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              outline: 'none',
            }}
          >
            {(title || !hideClose) && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 22px 16px',
                  borderBottom: `1px solid ${theme.colors.border.subtle}`,
                }}
              >
                {title && (
                  <h2
                    id={titleIdRef.current}
                    style={{
                      fontFamily: theme.fonts.body,
                      fontWeight: 700,
                      fontSize: 16,
                      color: theme.colors.text.primary,
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {title}
                  </h2>
                )}
                {!hideClose && (
                  <button
                    onClick={onClose}
                    aria-label="Close dialog"
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: theme.colors.text.muted,
                      borderRadius: theme.radius.sm,
                      fontSize: 16,
                      transition: theme.transition,
                      marginLeft: 'auto',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = theme.colors.bg.elevated;
                      event.currentTarget.style.color = theme.colors.text.primary;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'none';
                      event.currentTarget.style.color = theme.colors.text.muted;
                    }}
                  >
                    <IconX size={16} color="currentColor" />
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 22px 24px',
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.colors.border.default} transparent`,
              }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
