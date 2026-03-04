import { theme } from '../../styles/theme';
import { LogoLockup } from '../common/Logo';

export default function AppFooter() {
  const links = [
    { label: 'Docs',    href: '#/help' },
    { label: 'GitHub',  href: 'https://github.com/captpaw/nadwork', external: true },
    { label: 'Discord', href: 'https://discord.gg/nadwork', external: true },
  ];

  return (
    <footer style={{
      borderTop: `1px solid ${theme.colors.border.faint}`,
      padding: '24px clamp(16px,4vw,48px)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Left — logo + tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LogoLockup sealSize={18} fontSize={13} color={theme.colors.text.faint} tagline={false} />
          <span style={{
            fontFamily: theme.fonts.mono, fontSize: 10,
            color: theme.colors.text.faint, opacity: 0.5,
            letterSpacing: '0.02em',
          }}>
            · Powered by Monad · 3% fee
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {links.map(l => (
            <a
              key={l.label}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
              style={{
                fontFamily: theme.fonts.mono, fontSize: 10,
                color: theme.colors.text.faint,
                padding: '4px 10px',
                border: `1px solid ${theme.colors.border.faint}`,
                borderRadius: theme.radius.sm,
                transition: theme.transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.colors.text.muted; e.currentTarget.style.borderColor = theme.colors.border.subtle; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.faint; e.currentTarget.style.borderColor = theme.colors.border.faint; }}
            >
              {l.label}{l.external ? ' ↗' : ''}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
