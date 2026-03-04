import { useState, useEffect, useRef } from 'react';
import { theme } from '../styles/theme';
import { useGlobalStats } from '../hooks/useGlobalStats';
import { Seal } from '../components/common/Logo';
import { IconChevronRight, IconBounties, IconTarget, IconChart } from '../components/icons';

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, duration = 1400, suffix = '' }) {
  const [v, setV] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !to) return;
    done.current = true;
    const t0 = performance.now();
    const frame = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setV(Math.round(e * to));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [to, duration]);
  return <>{v.toLocaleString()}{suffix}</>;
}

// ── Orbital bounty board ──────────────────────────────────────────────────────
const CAT_COLORS = {
  dev:      { c: theme.colors.primary,       border: theme.colors.primaryBorder },
  design:   { c: theme.colors.pink,          border: theme.colors.pinkBorder    },
  content:  { c: theme.colors.amber,         border: theme.colors.amberBorder   },
  research: { c: theme.colors.cyan,          border: theme.colors.cyanBorder    },
  other:    { c: theme.colors.text.secondary, border: theme.colors.border.default },
};

// BountyNode: wrapRef is at position:absolute left:0 top:0
// RAF moves it with transform: translate(px,py) translate(-50%,-50%)
// so the card center lands exactly on the orbit position
function BountyNode({ bounty, size, wrapRef, onClick }) {
  const [hov, setHov] = useState(false);
  const cat      = CAT_COLORS[(bounty.category || 'other').toLowerCase()] || CAT_COLORS.other;
  const w        = size === 'sm' ? 148 : 164;
  const title    = bounty?.title    || 'Untitled';
  const reward   = bounty?.reward   || bounty?.rewardAmount || '—';
  const category = bounty?.category || 'Other';

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', left: 0, top: 0, willChange: 'transform' }}
    >
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onClick}
        style={{
          width: w,
          background: hov ? theme.colors.bg.elevated : 'rgba(20,20,20,0.93)',
          border: `1px solid ${hov ? cat.border : theme.colors.border.default}`,
          borderRadius: theme.radius.xl,
          padding: '12px 14px',
          cursor: 'pointer',
          zIndex: hov ? 30 : 5,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.2s',
          boxShadow: hov
            ? `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${cat.border}, 0 0 18px ${cat.c}20`
            : '0 2px 12px rgba(0,0,0,0.5)',
          transform: hov ? 'scale(1.05)' : 'scale(1)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.c, flexShrink: 0, boxShadow: `0 0 6px ${cat.c}88` }} />
          <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: cat.c, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 500 }}>{category}</span>
        </div>
        <div style={{
          fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500,
          color: hov ? theme.colors.text.primary : theme.colors.text.secondary,
          letterSpacing: '-0.01em', lineHeight: 1.38, marginBottom: 9,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          transition: 'color 0.2s',
        }}>{title}</div>
        <span style={{
          fontFamily: theme.fonts.mono, fontSize: 13.5, fontWeight: 600,
          color: hov ? cat.c : theme.colors.primary,
          letterSpacing: '-0.01em', transition: 'color 0.2s',
        }}>{reward} MON</span>
      </div>
    </div>
  );
}

function OrbitalBoard({ bounties }) {
  const rafRef   = useRef(null);
  const lastRef  = useRef(null);
  const angleRef = useRef(0);

  // One ref per node — RAF writes transform directly to DOM, zero React re-renders
  const innerRefs = [useRef(null), useRef(null), useRef(null)];
  const outerRefs = [useRef(null), useRef(null), useRef(null)];
  const lineRefs  = [useRef(null), useRef(null), useRef(null)];
  const iDotRefs  = [useRef(null), useRef(null), useRef(null)];
  const oDotRefs  = [useRef(null), useRef(null), useRef(null)];

  const W = 560, H = 560, cx = W / 2, cy = H / 2;
  const R1 = 142, R2 = 228;

  const inner = bounties.slice(0, 3);
  const outer = bounties.slice(3, 6);

  useEffect(() => {
    const toRad = d => d * Math.PI / 180;

    const getXY = (r, baseAngle, i, total) => {
      const deg = baseAngle + i * (360 / total);
      return {
        x: cx + r * Math.cos(toRad(deg)),
        y: cy + r * Math.sin(toRad(deg)),
      };
    };

    const animate = (now) => {
      const dt = lastRef.current !== null ? now - lastRef.current : 0;
      // clamp dt to avoid huge jump after tab switch
      angleRef.current += Math.min(dt, 100) * 0.0042;
      lastRef.current = now;

      const a = angleRef.current;

      inner.forEach((_, i) => {
        const p = getXY(R1, a, i, inner.length);
        // Node wrapper: position relative to container top-left
        // translate so card CENTER lands on (p.x, p.y)
        if (innerRefs[i].current) {
          innerRefs[i].current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        }
        if (lineRefs[i].current) {
          lineRefs[i].current.setAttribute('x2', p.x);
          lineRefs[i].current.setAttribute('y2', p.y);
        }
        if (iDotRefs[i].current) {
          iDotRefs[i].current.setAttribute('cx', p.x);
          iDotRefs[i].current.setAttribute('cy', p.y);
        }
      });

      outer.forEach((_, i) => {
        const p = getXY(R2, -a * 0.58, i, outer.length);
        if (outerRefs[i].current) {
          outerRefs[i].current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        }
        if (oDotRefs[i].current) {
          oDotRefs[i].current.setAttribute('cx', p.x);
          oDotRefs[i].current.setAttribute('cy', p.y);
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="orbital-wrap"
      style={{ position: 'relative', width: W, height: H }}
    >
      {/* ── Static SVG: rings + glow (never re-renders) ── */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <defs>
          <radialGradient id="orb-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#6E54FF" stopOpacity="0.4" />
            <stop offset="55%"  stopColor="#6E54FF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#6E54FF" stopOpacity="0"   />
          </radialGradient>
          <linearGradient id="ring1-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6E54FF" stopOpacity="0.6" />
            <stop offset="50%"  stopColor="#85E6FF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6E54FF" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="ring2-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6E54FF" stopOpacity="0.28" />
            <stop offset="50%"  stopColor="#85E6FF" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6E54FF" stopOpacity="0.28" />
          </linearGradient>
          <filter id="f-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="f-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ambient glow */}
        <circle cx={cx} cy={cy} r={120} fill="url(#orb-glow)" filter="url(#f-blur)" />

        {/* Rings — static, always visible */}
        <circle cx={cx} cy={cy} r={R2} stroke="url(#ring2-g)" strokeWidth="1.5" fill="none" strokeDasharray="6 11" filter="url(#f-glow)" />
        <circle cx={cx} cy={cy} r={R1} stroke="url(#ring1-g)" strokeWidth="1.5" fill="none" strokeDasharray="5 8"  filter="url(#f-glow)" />

        {/* Connector lines — x2/y2 updated by RAF */}
        {inner.map((_, i) => (
          <line key={i} ref={lineRefs[i]}
            x1={cx} y1={cy} x2={cx} y2={cy}
            stroke="rgba(110,84,255,0.14)" strokeWidth="1" strokeDasharray="3 6"
          />
        ))}

        {/* Inner orbit dots */}
        {inner.map((_, i) => (
          <circle key={i} ref={iDotRefs[i]} cx={cx} cy={cy} r="3.5"
            fill="#6E54FF" opacity="0.7" filter="url(#f-glow)" />
        ))}
        {/* Outer orbit dots */}
        {outer.map((_, i) => (
          <circle key={i} ref={oDotRefs[i]} cx={cx} cy={cy} r="2.5"
            fill="#85E6FF" opacity="0.55" filter="url(#f-glow)" />
        ))}
      </svg>

      {/* ── Center hub — always at center, never moves ── */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 32%, #1e1a3c, #0f0f0f)',
          border: '1.5px solid rgba(110,84,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(110,84,255,0.04), 0 0 0 18px rgba(110,84,255,0.015), 0 0 44px rgba(110,84,255,0.38)',
        }}>
          <Seal size={40} color={theme.colors.primary} animated />
        </div>
        <span style={{
          fontFamily: theme.fonts.mono, fontSize: 11,
          color: theme.colors.primary, letterSpacing: '0.1em', textTransform: 'uppercase',
          textShadow: '0 0 14px rgba(110,84,255,0.6)', opacity: 0.9,
        }}>Contract</span>
      </div>

      {/* ── Bounty nodes — positioned at center, moved by RAF via ref ── */}
      {inner.map((b, i) => (
        <BountyNode
          key={b.id || i} bounty={b} size="sm"
          wrapRef={innerRefs[i]}
          onClick={() => { if (b.id) window.location.hash = `#/bounty/${b.id}`; }}
        />
      ))}
      {outer.map((b, i) => (
        <BountyNode
          key={b.id || i} bounty={b} size="md"
          wrapRef={outerRefs[i]}
          onClick={() => { if (b.id) window.location.hash = `#/bounty/${b.id}`; }}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { bountyCount, submissionCount } = useGlobalStats();

  useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

  const orbitalBounties = [
    { id: '1', title: 'Build Monad DEX router UI', reward: '4.0', category: 'dev' },
    { id: '2', title: 'Smart contract audit report', reward: '2.5', category: 'research' },
    { id: '3', title: 'Design NadWork marketing kit', reward: '1.8', category: 'design' },
    { id: '4', title: 'Integrate Monad RPC dashboard', reward: '3.2', category: 'dev' },
    { id: '5', title: 'Translate docs to Bahasa', reward: '0.6', category: 'content' },
    { id: '6', title: 'Create onboarding video', reward: '1.2', category: 'content' },
  ];

  return (
    <div style={{ background: theme.colors.bg.base, minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <section style={{
        padding: 'clamp(52px,8vh,100px) clamp(20px,5vw,64px) 64px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${theme.colors.primaryGlow} 0%, transparent 70%)`,
          opacity: 0.18,
        }} />

        {/* Live pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: theme.colors.primaryDim,
          border: `1px solid ${theme.colors.primaryBorder}`,
          borderRadius: theme.radius.full,
          padding: '6px 16px 6px 12px', marginBottom: 36,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.6s ease 0.1s',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: theme.colors.primary,
            animation: 'livePulse 2s ease infinite',
          }} />
          <span style={{
            fontFamily: theme.fonts.mono, fontSize: 12,
            color: theme.colors.primary, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>Live on Monad Testnet</span>
        </div>

        {/* Headline */}
        <div style={{
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(18px)',
          transition: 'all 0.7s ease 0.2s',
        }}>
          <div style={{
            fontFamily: theme.fonts.body, fontWeight: 800,
            fontSize: 'clamp(56px,9vw,104px)',
            letterSpacing: '-0.05em', lineHeight: 0.92,
            color: theme.colors.text.primary,
          }}>Post work.</div>
          <div style={{
            fontFamily: theme.fonts.body, fontWeight: 800,
            fontSize: 'clamp(56px,9vw,104px)',
            letterSpacing: '-0.05em', lineHeight: 0.92,
            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.cyan} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Get paid.</div>
          {/* Line 3 — strikethrough treatment, visible on dark bg */}
          <div style={{
            fontFamily: theme.fonts.body, fontWeight: 800,
            fontSize: 'clamp(56px,9vw,104px)',
            letterSpacing: '-0.05em', lineHeight: 0.92,
            display: 'flex', alignItems: 'baseline', gap: '0.2em',
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <span style={{ color: theme.colors.text.muted }}>No</span>
            <span style={{
              color: theme.colors.text.muted,
              textDecoration: 'line-through',
              textDecorationColor: theme.colors.primary,
              textDecorationThickness: 4,
            }}>trust</span>
            <span style={{ color: theme.colors.text.muted }}>required.</span>
          </div>
        </div>

        {/* Subtext */}
        <p style={{
          fontFamily: theme.fonts.body, fontWeight: 300,
          fontSize: 16, color: theme.colors.text.secondary, lineHeight: 1.8,
          maxWidth: 480, marginBottom: 36,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.7s ease 0.32s',
        }}>
          Smart contracts hold the funds. You deliver the work.<br />
          The contract releases payment — automatically, on Monad.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: 48,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.7s ease 0.4s',
        }}>
          <a href="#/bounties" style={{
            padding: '13px 32px',
            background: theme.colors.primary, color: '#fff',
            border: 'none', borderRadius: theme.radius.lg, fontSize: 15,
            fontFamily: theme.fonts.body, fontWeight: 700,
            letterSpacing: '-0.01em', cursor: 'pointer',
            boxShadow: `0 4px 28px ${theme.colors.primaryGlow}`,
            textDecoration: 'none', display: 'inline-block',
          }}>Browse Bounties <IconChevronRight size={16} color="#fff" style={{ marginLeft: 6, verticalAlign: 'middle' }} /></a>
          <a href="#/post" style={{
            padding: '13px 28px',
            background: 'transparent', color: theme.colors.text.secondary,
            border: `1px solid ${theme.colors.border.strong}`, borderRadius: theme.radius.lg,
            fontSize: 15, fontFamily: theme.fonts.body, fontWeight: 500,
            letterSpacing: '-0.01em', cursor: 'pointer', textDecoration: 'none',
            display: 'inline-block',
          }}>+ Post a Bounty</a>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 0,
          border: `1px solid ${theme.colors.border.default}`,
          borderRadius: theme.radius.xl, overflow: 'hidden',
          background: theme.colors.bg.card,
          opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.5s',
        }}>
          {[
            { to: bountyCount    || 0, suffix: '',  label: 'Total Bounties'  },
            { to: submissionCount|| 0, suffix: '',  label: 'Submissions'     },
            { to: 3,                   suffix: '%', label: 'Platform Fee'    },
          ].map(({ to, suffix, label }, i, arr) => (
            <div key={label} style={{
              padding: '18px clamp(20px,3vw,36px)',
              borderRight: i < arr.length - 1 ? `1px solid ${theme.colors.border.default}` : 'none',
              textAlign: 'center', minWidth: 90,
            }}>
              <div style={{
                fontFamily: theme.fonts.mono, fontSize: 22,
                fontWeight: 500, color: theme.colors.text.primary,
                letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6,
              }}>
                {mounted ? <Counter to={to} suffix={suffix} /> : '0'}
              </div>
              <div style={{
                fontFamily: theme.fonts.body, fontSize: 12,
                color: theme.colors.text.muted, letterSpacing: '0.01em',
              }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ORBITAL BOARD ── */}
      <section style={{
        padding: '0 clamp(20px,5vw,64px) 56px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36,
          opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.6s',
        }}>
          <div style={{ height: 1, width: 60, background: theme.colors.border.default }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: theme.colors.primary,
              animation: 'livePulse 2s ease infinite',
            }} />
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 12,
              color: theme.colors.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Live bounties · orbiting the contract</span>
          </div>
          <div style={{ height: 1, width: 60, background: theme.colors.border.default }} />
        </div>

        <OrbitalBoard bounties={orbitalBounties} />

        {/* Browse CTA below orbital */}
        <div style={{
          marginTop: 36,
          opacity: mounted ? 1 : 0, transition: 'opacity 0.9s ease 0.8s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <a href="#/bounties" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 32px',
            background: 'transparent',
            border: `1px solid ${theme.colors.border.strong}`,
            borderRadius: theme.radius.lg, fontSize: 14,
            fontFamily: theme.fonts.body, fontWeight: 600,
            color: theme.colors.text.primary,
            letterSpacing: '-0.01em', cursor: 'pointer', textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = theme.colors.primaryDim;
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.primary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border.strong;
              e.currentTarget.style.color = theme.colors.text.primary;
            }}
          >
            <span>Browse All Bounties</span>
            <IconChevronRight size={16} color="currentColor" />
          </a>
          <span style={{
            fontFamily: theme.fonts.mono, fontSize: 11,
            color: theme.colors.text.faint, letterSpacing: '0.05em',
          }}>filter · search · sort</span>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{
        borderTop: `1px solid ${theme.colors.border.subtle}`,
        padding: '72px clamp(20px,5vw,64px) 96px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
            <div style={{ height: 1, flex: 1, background: theme.colors.border.default }} />
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 12,
              color: theme.colors.text.muted, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>How it works</span>
            <div style={{ height: 1, flex: 1, background: theme.colors.border.default }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 2 }}>
            {[
              { n: '01', Icon: IconBounties, color: theme.colors.primary, title: 'Post a Bounty',   desc: 'Describe the task and set a MON reward. Funds lock instantly into the smart contract.' },
              { n: '02', Icon: IconTarget,   color: theme.colors.cyan,    title: 'Builders Deliver', desc: 'Anyone can find your bounty and submit work. Review and pick the best submission.' },
              { n: '03', Icon: IconChart,    color: theme.colors.primary, title: 'Contract Pays',   desc: 'Approve a winner and the contract releases funds directly to their wallet. Automatic.' },
            ].map((item, i, arr) => (
              <div key={item.n} style={{
                padding: '32px 28px',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: i === 0 ? '14px 0 0 14px' : i === arr.length - 1 ? '0 14px 14px 0' : '0',
                position: 'relative',
                transition: theme.transition,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; e.currentTarget.style.background = theme.colors.bg.elevated; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
              >
                <div style={{
                  fontFamily: theme.fonts.mono, fontSize: 12,
                  color: theme.colors.text.muted, marginBottom: 20, letterSpacing: '0.04em',
                }}>{item.n}</div>
                <div style={{
                  color: item.color, marginBottom: 16,
                  textShadow: `0 0 20px ${item.color}55`, display: 'flex', alignItems: 'center',
                }}><item.Icon size={28} color={item.color} /></div>
                <h3 style={{
                  fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 17,
                  color: theme.colors.text.primary, letterSpacing: '-0.02em', marginBottom: 10,
                }}>{item.title}</h3>
                <p style={{
                  fontFamily: theme.fonts.body, fontWeight: 300, fontSize: 14,
                  color: theme.colors.text.secondary, lineHeight: 1.75,
                }}>{item.desc}</p>
                {i < arr.length - 1 && (
                  <div style={{
                    position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)',
                    zIndex: 2, width: 28, height: 28, borderRadius: '50%',
                    background: theme.colors.bg.base, border: `1px solid ${theme.colors.border.default}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><IconChevronRight size={12} color={theme.colors.text.muted} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
