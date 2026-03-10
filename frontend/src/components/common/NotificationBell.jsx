import { useState, useRef, useEffect } from 'react';
import { theme } from '../../styles/theme';
import { useNotifications } from '../../hooks/useNotifications';
import { IconTrophy, IconCheck, IconWarning, IconWallet, IconMail, IconClipboard, IconClock, IconInfo, IconBell, IconRefresh } from '../icons';

// ── Type → color / icon mapping ───────────────────────────────────────────────
const TYPE_META = {
  win:      { Icon: IconTrophy,   color: theme.colors.green[400] },
  approved: { Icon: IconCheck,    color: theme.colors.green[400] },
  rejected: { Icon: IconWarning,  color: theme.colors.amber       },
  payment:  { Icon: IconWallet,   color: theme.colors.cyan         },
  new_sub:  { Icon: IconMail,     color: theme.colors.primary      },
  new_app:  { Icon: IconClipboard, color: theme.colors.primary     },
  warning:  { Icon: IconClock,    color: theme.colors.amber        },
  info:     { Icon: IconInfo,     color: theme.colors.text.muted  },
};

function timeAgo(ms) {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function NotifRow({ notif, onNavigate }) {
  const meta = TYPE_META[notif.type] || TYPE_META.info;
  return (
    <div
      onClick={() => notif.bountyId && onNavigate(notif.bountyId)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '11px 16px',
        background: notif.read ? 'transparent' : 'rgba(110,84,255,0.04)',
        borderBottom: `1px solid ${theme.colors.border.faint}`,
        cursor: notif.bountyId ? 'pointer' : 'default',
        transition: theme.transition,
      }}
      onMouseEnter={e => { if (notif.bountyId) e.currentTarget.style.background = theme.colors.bg.elevated; }}
      onMouseLeave={e => { e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(110,84,255,0.04)'; }}
    >
      <span style={{ lineHeight: 1, marginTop: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }}><meta.Icon size={14} color={meta.color} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 12.5,
          color: notif.read ? theme.colors.text.secondary : theme.colors.text.primary,
          marginBottom: 2, lineHeight: 1.3,
        }}>{notif.title}</div>
        <div style={{
          fontFamily: theme.fonts.body, fontSize: 11.5,
          color: theme.colors.text.muted, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{notif.body}</div>
        <div style={{
          fontFamily: theme.fonts.mono, fontSize: 10,
          color: theme.colors.text.faint, marginTop: 3,
        }}>{timeAgo(notif.ts)}</div>
      </div>
      {!notif.read && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: meta.color, flexShrink: 0, marginTop: 4,
        }} />
      )}
    </div>
  );
}

export default function NotificationBell() {
  const { notifs, unread, markAllRead, clearAll, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNavigate = (bountyId) => {
    setOpen(false);
    window.location.hash = `#/bounty/${bountyId}`;
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unread > 0) {
      // Mark all read when dropdown opens
      markAllRead();
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        style={{
          position: 'relative',
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? theme.colors.bg.elevated : 'transparent',
          border: `1px solid ${open ? theme.colors.border.default : 'transparent'}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text.secondary,
          cursor: 'pointer',
          transition: theme.transition,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = theme.colors.bg.elevated;
          e.currentTarget.style.borderColor = theme.colors.border.default;
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <IconBell size={18} color="currentColor" />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 16, height: 16,
            background: theme.colors.primary,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.mono, fontSize: 9, fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            boxShadow: `0 0 0 2px ${theme.colors.bg.base}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340,
          background: theme.colors.bg.card,
          border: `1px solid ${theme.colors.border.default}`,
          borderRadius: theme.radius['2xl'],
          boxShadow: theme.shadow.xl,
          zIndex: theme.z.dropdown,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: `1px solid ${theme.colors.border.subtle}`,
          }}>
            <div style={{
              fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 13.5,
              color: theme.colors.text.primary, letterSpacing: '-0.02em',
            }}>Notifications</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={refresh}
                title="Refresh notifications"
                style={{
                  fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: theme.radius.sm, transition: theme.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = theme.colors.primary; }}
                onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.faint; }}
              >
                <IconRefresh size={14} color="currentColor" />
              </button>
              {notifs.length > 0 && (
                <button onClick={clearAll} style={{
                  fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: theme.radius.sm, transition: theme.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = theme.colors.red[400]; }}
                onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.faint; }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{
            maxHeight: 380, overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${theme.colors.border.default} transparent`,
          }}>
            {notifs.length === 0 ? (
              <div style={{
                padding: '32px 16px', textAlign: 'center',
                fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.faint,
              }}>
                <div style={{ marginBottom: 8, opacity: 0.5, display: 'flex', justifyContent: 'center' }}><IconBell size={24} color={theme.colors.text.faint} /></div>
                No notifications yet
              </div>
            ) : (
              notifs.map(n => (
                <NotifRow key={n.id} notif={n} onNavigate={handleNavigate} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
