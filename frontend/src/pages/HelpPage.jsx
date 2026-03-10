import { useState } from 'react';
import { theme } from '../styles/theme';
import { IconChevronDown, IconBounties, IconTarget, IconChart, IconGlobe, IconExternalLink } from '../components/icons';
import { ADDRESSES } from '../config/contracts';

const FACTORY_ADDRESS = ADDRESSES.factory || '';
const EXPLORER_BASE = 'https://testnet.monadexplorer.com';

const FAQS = [
  {
    q: 'How does escrow work?',
    a: 'When you create a bounty as a Creator, the reward + 3% platform fee is locked in the NadWork smart contract. Funds are held trustlessly — no human can access them. Only the contract can release: to the approved Builder, or back to the Creator if the deadline expires with no approval.',
  },
  {
    q: 'What is the platform fee?',
    a: 'NadWork charges a 3% platform fee on the reward amount, taken at bounty creation and locked alongside the reward. It is non-refundable regardless of outcome.',
  },
  {
    q: 'Who are Creators and Builders?',
    a: 'Creators post bounties and fund the rewards. Builders deliver work and claim rewards when approved. All payments flow through the smart contract — no middlemen.',
  },
  {
    q: 'Do I need a username to submit?',
    a: 'Yes. Builders must set a username (via Profile) before submitting work. This ties your on-chain identity to your reputation and protects the platform from spam.',
  },
  {
    q: 'What are curated bounties (Apply flow)?',
    a: 'Some bounties require application first. For these, Builders submit a proposal; the Creator reviews and approves who can then deliver. Once approved, you submit work as usual. Look for the "Curated" badge on a bounty.',
  },
  {
    q: 'How do I submit work?',
    a: 'Browse active bounties, open one, and click "Submit Work". Upload deliverables and a description. A submission stake is required to prevent spam; it is returned when your work is reviewed (or refunded after rejection if the grace period has passed).',
  },
  {
    q: 'What is the revision flow?',
    a: 'Revision is an off-chain option: Creators can request changes via a revision request (IPFS link shared with the Builder). Builders upload a revision response. This keeps iteration flexible without on-chain transactions. Links are shared via the bounty page.',
  },
  {
    q: 'Can I cancel a bounty?',
    a: 'Yes, but only if there are no pending submissions. Once Builders have submitted, you cannot cancel — this protects them. With submissions, you can still reject and proceed to review or timeout.',
  },
  {
    q: 'What happens if the deadline passes?',
    a: 'If the deadline passes without an approved submission, the reward is automatically refundable to the Creator. No action required.',
  },
  {
    q: 'What is a dispute?',
    a: 'If a Builder is rejected, they can raise a dispute (within 2 hours of rejection) by locking a dispute deposit. The BountyFactory owner resolves: in favor of Builder (reward + refund) or Creator (Builder stake may be slashed). This is a safety valve for unfair rejections.',
  },
  {
    q: 'Which network does NadWork run on?',
    a: 'NadWork is deployed on Monad Testnet. All transactions, rewards, and fees use MON. Mainnet deployment will follow after thorough testing.',
  },
  {
    q: 'Is the contract verified?',
    a: 'Yes. The NadWork smart contracts are open source and verified on Monad Explorer. You can inspect every function before interacting.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: `1px solid ${theme.colors.border.faint}`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 14,
          color: open ? theme.colors.text.primary : theme.colors.text.secondary,
          letterSpacing: '-0.015em', transition: theme.transition,
        }}>{q}</span>
        <span style={{
          fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.muted,
          flexShrink: 0, transition: theme.transition,
          transform: open ? 'rotate(180deg)' : 'none',
        }}><IconChevronDown size={12} color={theme.colors.text.muted} style={{ display: 'block', transition: 'transform 0.2s' }} /></span>
      </button>
      {open && (
        <div style={{
          padding: '0 0 18px',
          fontFamily: theme.fonts.body, fontWeight: 300, fontSize: 13.5,
          color: theme.colors.text.muted, lineHeight: 1.75,
          animation: 'fadeUp 0.2s ease both',
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Help & Docs
        </div>
        <h1 style={{ fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 'clamp(28px,5vw,48px)', letterSpacing: '-0.04em', color: theme.colors.text.primary, marginBottom: 12 }}>
          How NadWork works
        </h1>
        <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, maxWidth: 520, lineHeight: 1.75 }}>
          NadWork is a trustless bounty platform on Monad. Creators post tasks and lock rewards; Builders deliver work and get paid. Smart contracts handle escrow, payments, applications, and dispute resolution — no middlemen.
        </p>
      </div>

      {/* How it works */}
      <div style={{
        marginBottom: 48,
        padding: '24px 28px',
        background: theme.colors.bg.card,
        border: `1px solid ${theme.colors.border.subtle}`,
        borderRadius: theme.radius.xl,
      }}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Flow
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { n: '01', title: 'Creator posts a bounty', desc: 'Set reward, deadline, and optionally require applications. Funds lock in the contract.' },
            { n: '02', title: 'Builder delivers', desc: 'Submit work (or apply first for curated bounties). Creator reviews. Revisions possible off-chain.' },
            { n: '03', title: 'Contract pays', desc: 'Creator approves winner; contract releases payment. Or: timeout/cancel triggers refunds and comps.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.primary, fontWeight: 600, flexShrink: 0 }}>{n}</span>
              <div>
                <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 14, color: theme.colors.text.primary, marginBottom: 4 }}>{title}</div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links — app navigation */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          App
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'Browse Bounties', href: '#/bounties', internal: true },
            { label: 'Post a Bounty', href: '#/post', internal: true },
            { label: 'Dashboard', href: '#/dashboard', internal: true },
            { label: 'Leaderboard', href: '#/leaderboard', internal: true },
            { label: 'Profile', href: '#/profile', internal: true },
          ].map(({ label, href, internal }) => (
            <a key={label} href={href}
              onClick={internal ? (e) => { e.preventDefault(); window.location.hash = href; } : undefined}
              target={internal ? undefined : '_blank'}
              rel={internal ? undefined : 'noopener noreferrer'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.md,
                textDecoration: 'none', transition: theme.transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; e.currentTarget.style.background = theme.colors.bg.elevated; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
            >
              <span style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500, color: theme.colors.text.secondary }}>{label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Quick links — external */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          External
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { Icon: IconBounties, label: 'BountyFactory (Explorer)', href: FACTORY_ADDRESS ? `${EXPLORER_BASE}/address/${FACTORY_ADDRESS}` : EXPLORER_BASE },
            { Icon: IconTarget,   label: 'GitHub',                 href: 'https://github.com/captpaw/nadwork' },
            { Icon: IconChart,   label: 'Discord',                 href: 'https://discord.gg/nadwork' },
            { Icon: IconGlobe,   label: 'Monad Explorer',          href: EXPLORER_BASE },
          ].map(({ Icon, label, href }) => (
            <a key={label} href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 16px',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.md,
                textDecoration: 'none', transition: theme.transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; e.currentTarget.style.background = theme.colors.bg.elevated; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
            >
              <Icon size={18} color={theme.colors.primary} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500, color: theme.colors.text.secondary, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>{label} <IconExternalLink size={12} color={theme.colors.text.muted} /></span>
            </a>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 17, letterSpacing: '-0.025em', color: theme.colors.text.primary, marginBottom: 8 }}>
        Frequently Asked Questions
      </h2>
      <div>
        {FAQS.map(item => <FaqItem key={item.q} {...item} />)}
      </div>
    </div>
  );
}
