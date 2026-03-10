import { theme } from '../../styles/theme';
import Button from './Button';

export default function EmptyState({ icon, title, message, action, actionLabel }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '64px 24px', gap: 14,
    }}>
      {icon && (
        <div style={{
          color: theme.colors.text.faint,
          marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {typeof icon === 'string' ? <span style={{ fontSize: 32 }}>{icon}</span> : icon}
        </div>
      )}
      <h3 style={{
        fontFamily: theme.fonts.body, fontWeight: 600,
        fontSize: 15, color: theme.colors.text.secondary,
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h3>
      {message && (
        <p style={{
          fontFamily: theme.fonts.body, fontWeight: 300,
          fontSize: 13, color: theme.colors.text.muted,
          maxWidth: 320, lineHeight: 1.7,
        }}>
          {message}
        </p>
      )}
      {action && actionLabel && (
        <div style={{ marginTop: 8 }}>
          <Button variant="secondary" size="sm" onClick={action}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
