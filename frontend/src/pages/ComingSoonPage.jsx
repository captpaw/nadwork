import { useEffect, useMemo, useState } from 'react';
import { theme as t } from '../styles/theme.js';
import { LogoLockup } from '../components/common/Logo.jsx';

const TARGET_DATE = new Date('2026-05-15T00:00:00+07:00').getTime();

function getCountdown() {
  const now = Date.now();
  const diff = Math.max(0, TARGET_DATE - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function CountBox({ label, value }) {
  return (
    <div
      style={{
        minWidth: 86,
        padding: '14px 12px',
        background: 'rgba(22,22,22,0.88)',
        border: `1px solid ${t.colors.border.default}`,
        borderRadius: t.radius.lg,
        textAlign: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          fontFamily: t.fonts.mono,
          fontSize: 24,
          fontWeight: 700,
          color: t.colors.primary,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {String(value).padStart(2, '0')}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: t.fonts.mono,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: t.colors.text.muted,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function ComingSoonPage() {
  const [countdown, setCountdown] = useState(getCountdown());
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  const milestones = useMemo(
    () => [
      { label: 'Core Flow Hardening', status: 'done' },
      { label: 'Smart Contract and UI Sync', status: 'done' },
      { label: 'Production Security Review', status: 'active' },
      { label: 'Mainnet Readiness', status: 'next' },
    ],
    []
  );

  const activeStep = 3;
  const progress = (activeStep / milestones.length) * 100;

  return (
    <section
      style={{
        position: 'relative',
        minHeight: 'calc(100vh - 106px)',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 28%, rgba(110,84,255,0.22) 0%, rgba(110,84,255,0.06) 25%, rgba(15,15,15,1) 58%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 170,
          width: 520,
          height: 520,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          border: '1px dashed rgba(133,230,255,0.24)',
          boxShadow: '0 0 80px rgba(110,84,255,0.20)',
          pointerEvents: 'none',
          animation: 'sealSpin 44s linear infinite',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 980,
          margin: '0 auto',
          padding: '54px 20px 84px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <LogoLockup sealSize={34} fontSize={24} />
        </div>

        <div
          style={{
            width: 'fit-content',
            margin: '0 auto 14px',
            padding: '7px 12px',
            borderRadius: 999,
            border: `1px solid ${t.colors.primaryBorder}`,
            background: t.colors.primaryDim,
            fontFamily: t.fonts.mono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: t.colors.primary,
          }}
        >
          Nadwork is upgrading
        </div>

        <h1
          style={{
            textAlign: 'center',
            fontSize: 'clamp(34px, 6vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}
        >
          Coming Soon
        </h1>
        <p
          style={{
            maxWidth: 760,
            margin: '0 auto',
            textAlign: 'center',
            color: t.colors.text.secondary,
            fontSize: 'clamp(16px, 2.2vw, 20px)',
            lineHeight: 1.7,
          }}
        >
          We are refining Nadwork for a cleaner, faster, and more reliable launch experience.
        </p>

        <div
          style={{
            marginTop: 30,
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <CountBox label="Days" value={countdown.days} />
          <CountBox label="Hours" value={countdown.hours} />
          <CountBox label="Minutes" value={countdown.minutes} />
          <CountBox label="Seconds" value={countdown.seconds} />
        </div>

        <div
          style={{
            marginTop: 34,
            border: `1px solid ${t.colors.border.default}`,
            background: 'rgba(20,20,20,0.88)',
            borderRadius: t.radius['2xl'],
            padding: '18px 18px 16px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span style={{ fontFamily: t.fonts.mono, fontSize: 11, color: t.colors.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Progress
            </span>
            <span style={{ fontFamily: t.fonts.mono, fontSize: 12, color: t.colors.cyan }}>{Math.round(progress)}%</span>
          </div>

          <div style={{ height: 8, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden', border: `1px solid ${t.colors.border.subtle}` }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6E54FF 0%, #85E6FF 100%)',
                boxShadow: '0 0 14px rgba(110,84,255,0.45)',
                transition: 'width 500ms ease',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: 10,
            }}
          >
            {milestones.map((m) => {
              const tone =
                m.status === 'done'
                  ? { bg: 'rgba(16,185,129,0.10)', c: '#34d399', b: 'rgba(16,185,129,0.25)' }
                  : m.status === 'active'
                    ? { bg: t.colors.primaryDim, c: t.colors.primary, b: t.colors.primaryBorder }
                    : { bg: 'rgba(133,230,255,0.06)', c: t.colors.cyan, b: 'rgba(133,230,255,0.20)' };

              return (
                <div
                  key={m.label}
                  style={{
                    border: `1px solid ${tone.b}`,
                    background: tone.bg,
                    borderRadius: t.radius.lg,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontFamily: t.fonts.mono, fontSize: 10, color: tone.c, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {m.status}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: t.colors.text.secondary }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            setSubmitted(true);
          }}
          style={{
            marginTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Enter email for launch update"
            style={{
              width: 'min(420px, 100%)',
              padding: '12px 14px',
              borderRadius: t.radius.md,
              border: `1px solid ${t.colors.border.default}`,
              background: '#131313',
              color: t.colors.text.primary,
              outline: 'none',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '12px 16px',
              borderRadius: t.radius.md,
              background: 'linear-gradient(135deg,#6E54FF,#7D65FF)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 8px 24px rgba(110,84,255,0.35)',
            }}
          >
            Notify Me
          </button>
        </form>

        {submitted && (
          <p
            style={{
              marginTop: 10,
              textAlign: 'center',
              color: t.colors.cyan,
              fontSize: 13,
              fontFamily: t.fonts.mono,
            }}
          >
            Draft mode: message captured locally. We will wire backend notification later.
          </p>
        )}
      </div>
    </section>
  );
}

