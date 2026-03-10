// Shared Seal + LogoLockup — single source of truth for the NadWork logo.
// Import ini di mana saja; tidak ada duplikasi Seal logic di file lain.

// ── The Seal ─────────────────────────────────────────────────────────────────
// color  — stroke/fill color (gunakan '#ffffff' di dark bg, '#0f0f0f' di light bg)
// size   — bounding box px (default 28 untuk header)
// animated — idle slow-spin (12s linear infinite) untuk hero/splash
export function Seal({ size = 28, color = '#ffffff', animated = false }) {
  const cx = 24, cy = 24, R = 18;
  const circ = 2 * Math.PI * R;
  const gapLen = (8 / 360) * circ;
  const arcLen = circ - gapLen;
  const rs = 13;
  const toRad = d => (d - 90) * (Math.PI / 180);
  const f = n => parseFloat(n.toFixed(3));
  const sx = cx + rs * Math.cos(toRad(60));
  const sy = cy + rs * Math.sin(toRad(60));
  const ex = cx + rs * Math.cos(toRad(350));
  const ey = cy + rs * Math.sin(toRad(350));

  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none"
      style={animated ? { animation: 'sealSpin 12s linear infinite' } : {}}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle
        cx={cx} cy={cy} r={R}
        stroke={color} strokeWidth="2" fill="none"
        strokeDasharray={`${f(arcLen)} ${f(gapLen)}`}
        strokeDashoffset={f(gapLen / 2)}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Inner spiral — softer */}
      <path
        d={`M ${f(sx)} ${f(sy)} A ${rs} ${rs} 0 1 1 ${f(ex)} ${f(ey)}`}
        stroke={color} strokeWidth="1.4" fill="none"
        strokeLinecap="round" opacity="0.45"
      />
      {/* Center node */}
      <circle cx={cx} cy={cy} r="5.5" fill={color} />
      {/* Orbit node */}
      <circle cx={f(sx)} cy={f(sy)} r="2.8" fill={color} />
    </svg>
  );
}

// ── LogoLockup ────────────────────────────────────────────────────────────────
// sealSize  — Seal px size
// fontSize  — "nadwork" text px size
// color     — semua elemen mengikuti satu color
// tagline   — tampilkan "on-chain freelance" di bawah nama
// divider   — vertikal divider antara seal dan teks
export function LogoLockup({
  sealSize = 26,
  fontSize = 17,
  color = '#ffffff',
  tagline = false,
  divider = false,
  animated = false,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Seal size={sealSize} color={color} animated={animated} />
      {divider && (
        <div style={{
          width: 1, height: sealSize * 0.75,
          background: color, opacity: 0.15,
        }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{
            fontFamily: "'Outfit', -apple-system, sans-serif",
            fontWeight: 200, fontSize,
            color, letterSpacing: '-0.03em',
            opacity: 0.55,
            lineHeight: 1,
          }}>nad</span>
          <span style={{
            fontFamily: "'Outfit', -apple-system, sans-serif",
            fontWeight: 800, fontSize,
            color, letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>work</span>
        </div>
        {tagline && (
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: Math.max(8, Math.floor(fontSize * 0.52)),
            color, opacity: 0.3,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            lineHeight: 1,
          }}>on-chain freelance</span>
        )}
      </div>
    </div>
  );
}
