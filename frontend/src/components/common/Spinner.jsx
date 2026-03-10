import { theme } from '../../styles/theme';

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 18, color = theme.colors.primary, style: extraStyle = {} }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0, ...extraStyle }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.15" strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── PageLoader ────────────────────────────────────────────────────────────────
export function PageLoader({ message = 'Loading…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '50vh', gap: 14,
    }}>
      <Spinner size={28} />
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 11,
        color: theme.colors.text.muted, letterSpacing: '0.05em',
      }}>
        {message}
      </span>
    </div>
  );
}

export default Spinner;
