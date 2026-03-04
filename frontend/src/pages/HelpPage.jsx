import { useState } from 'react';
import { theme } from '../styles/theme';
import { IconChevronDown, IconBounties, IconTarget, IconChart, IconGlobe, IconExternalLink } from '../components/icons';
import { ADDRESSES } from '../config/contracts';

const FACTORY_ADDRESS = ADDRESSES.factory || '';

const FAQS = [
  {
    q: 'How does escrow work?',
    a: 'When you post a bounty, the reward + 3% platform fee is locked in the NadWork smart contract. The funds are held trustlessly — no human can access them. Only the smart contract can release them: to the approved winner, or back to you if the deadline expires with no approval.',
  },
  {
    q: 'What is the platform fee?',
    a: 'NadWork charges a 3% platform fee on the reward amount. This is taken at the time of posting and locked alongside the reward. It is non-refundable regardless of outcome.',
  },
  {
    q: 'Can I cancel a bounty?',
    a: 'You can cancel an active bounty only if there are no pending submissions. Once submissions exist, you cannot cancel — this protects builders who have invested time in the task.',
  },
  {
    q: 'What happens if the deadline passes?',
    a: 'If the deadline passes without an approved submission, the reward is automatically returned to your wallet. No action is required.',
  },
  {
    q: 'How do I submit work?',
    a: 'Browse active bounties, click into a bounty, and click "Submit Work". You will upload your deliverables and write a description. Submissions require a small stake (varies by tier) to prevent spam — this is returned when your submission is reviewed.',
  },
  {
    q: 'What is a builder tier?',
    a: 'Builders are ranked by their track record. Higher tiers require a larger submission stake but also give priority visibility in the submission list. Build your tier by completing bounties successfully.',
  },
  {
    q: 'Which network does NadWork run on?',
    a: 'NadWork is deployed on Monad Testnet. All transactions, rewards, and fees are in MON (testnet). Mainnet deployment will follow after thorough testing.',
  },
  {
    q: 'Is the contract verified?',
    a: 'Yes. The NadWork smart contract is open source and verified on MonadScan. You can inspect every function before interacting.',
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
        <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, maxWidth: 480, lineHeight: 1.75 }}>
          NadWork is a trustless bounty platform on Monad. Smart contracts handle escrow, payment, and dispute resolution — no middlemen.
        </p>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 48 }}>
        {[
          { Icon: IconBounties, label: 'Smart Contract', href: FACTORY_ADDRESS ? `https://testnet.monadexplorer.com/address/${FACTORY_ADDRESS}` : 'https://testnet.monadexplorer.com' },
          { Icon: IconTarget,   label: 'GitHub Repo',    href: 'https://github.com/captpaw/nadwork' },
          { Icon: IconChart,    label: 'Discord',        href: 'https://discord.gg/nadwork' },
          { Icon: IconGlobe,    label: 'MonadScan',      href: 'https://testnet.monadexplorer.com' },
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
