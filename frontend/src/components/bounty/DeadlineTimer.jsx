import { useState, useEffect } from 'react';
import { theme } from '../../styles/theme';

function toMs(deadline) {
  if (deadline == null) return null;
  if (typeof deadline === 'bigint') return Number(deadline) * 1000;       // ethers v6 BigInt (Unix seconds)
  if (typeof deadline === 'number') return deadline < 1e12 ? deadline * 1000 : deadline; // seconds vs ms
  return new Date(deadline).getTime(); // ISO string or Date
}

function getRemaining(deadline) {
  const ms   = toMs(deadline);
  if (!ms) return null;
  const diff = ms - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total:   diff,
  };
}

export default function DeadlineTimer({ deadline, compact = false }) {
  const [rem, setRem] = useState(() => getRemaining(deadline));

  useEffect(() => {
    const id = setInterval(() => setRem(getRemaining(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!rem) {
    return (
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: compact ? 9.5 : 11,
        color: theme.colors.red[400],
      }}>
        Expired
      </span>
    );
  }

  const isUrgent = rem.total < 86400000 * 2; // < 2 days
  const color = isUrgent ? theme.colors.red[400] : theme.colors.text.muted;

  let display;
  if (compact) {
    if (rem.days > 0)       display = `${rem.days}d ${rem.hours}h`;
    else if (rem.hours > 0) display = `${rem.hours}h ${rem.minutes}m`;
    else                    display = `${rem.minutes}m ${rem.seconds}s`;
  } else {
    if (rem.days > 0) {
      display = `${rem.days}d ${rem.hours}h ${rem.minutes}m`;
    } else if (rem.hours > 0) {
      display = `${rem.hours}h ${rem.minutes}m ${rem.seconds}s`;
    } else {
      display = `${rem.minutes}m ${rem.seconds}s`;
    }
  }

  return (
    <span style={{
      fontFamily: theme.fonts.mono,
      fontSize: compact ? 9.5 : 12,
      color,
      display: 'flex', alignItems: 'center', gap: 4,
      letterSpacing: '0.02em',
    }}>
      {isUrgent && !compact && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0, display: 'inline-block' }} />
      )}
      {display}
    </span>
  );
}
