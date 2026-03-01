import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import {
  IconBook, IconQuestion, IconLink, IconShield, IconLock, IconWallet,
  IconTelegram, IconTwitter, IconChevron, IconMessage, IconWarning, IconCheck,
} from '@/components/icons/index.jsx';

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ Icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: t.radius.md,
            background: 'rgba(124,58,237,0.07)',
            border: '1px solid rgba(124,58,237,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.colors.violet[400],
            flexShrink: 0,
          }}>
            <Icon size={15} color={t.colors.violet[400]} />
          </div>
        )}
        <h2 style={{ margin: 0, fontSize: 'clamp(16px, 3vw, 20px)', fontWeight: 700, color: t.colors.text.primary, letterSpacing: '-0.025em' }}>
          {title}
        </h2>
      </div>
      {subtitle && (
        <p style={{ margin: 0, fontSize: '13.5px', color: t.colors.text.muted, lineHeight: 1.6, paddingLeft: '42px' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Accordion({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid ' + t.colors.border.subtle }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '14px',
        }}
      >
        <span style={{
          fontSize: '13.5px',
          fontWeight: 600,
          color: open ? t.colors.text.primary : t.colors.text.secondary,
          lineHeight: 1.5,
          flex: 1,
          letterSpacing: '-0.01em',
        }}>
          {q}
        </span>
        <span style={{
          color: t.colors.violet[400],
          flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.18s ease',
          display: 'flex',
        }}>
          <IconChevron size={15} color={t.colors.violet[400]} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: '16px', fontSize: '13px', color: t.colors.text.muted, lineHeight: 1.8 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepCard({ n, title, children, color }) {
  const c = color || t.colors.violet[300];
  return (
    <div style={{
      display: 'flex',
      gap: '14px',
      padding: '16px',
      background: 'rgba(124,58,237,0.03)',
      border: '1px solid rgba(124,58,237,0.1)',
      borderRadius: t.radius.lg,
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: t.radius.sm,
        flexShrink: 0,
        background: 'rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.28)',
        color: c,
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: t.fonts.mono,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {n}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: t.colors.text.primary, marginBottom: '5px' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ Icon: IcoComponent, color, border, textColor, children }) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      padding: '11px 13px',
      background: color || 'rgba(124,58,237,0.06)',
      border: `1px solid ${border || 'rgba(124,58,237,0.18)'}`,
      borderRadius: t.radius.md,
      fontSize: '12.5px',
      color: textColor || t.colors.violet[400],
      lineHeight: 1.7,
      marginTop: '12px',
    }}>
      {IcoComponent && (
        <span style={{ flexShrink: 0, display: 'flex', marginTop: '1px' }}>
          <IcoComponent size={13} color={textColor || t.colors.violet[400]} />
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}

function Tag({ children, color, textColor }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      background: color || 'rgba(124,58,237,0.12)',
      borderRadius: t.radius.xs,
      fontSize: '10.5px',
      fontWeight: 600,
      color: textColor || t.colors.violet[300],
      marginRight: '6px',
      letterSpacing: '0.02em',
    }}>
      {children}
    </span>
  );
}

function Mono({ children }) {
  return (
    <code style={{
      fontFamily: t.fonts.mono,
      fontSize: '11.5px',
      background: 'rgba(255,255,255,0.06)',
      padding: '1px 6px',
      borderRadius: '4px',
      color: t.colors.text.secondary,
    }}>
      {children}
    </code>
  );
}

// ─── Guide: Linking a Backup Wallet ──────────────────────────────────────────

function BackupWalletGuide() {
  return (
    <div>
      <p style={{ fontSize: '13.5px', color: t.colors.text.muted, lineHeight: 1.8, marginBottom: '18px' }}>
        A backup wallet is a security feature that lets you recover your NadWork identity if your primary wallet is ever lost or inaccessible. This process only needs to be done <strong style={{ color: t.colors.text.secondary }}>once</strong>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <StepCard n="1" title="Open Identity Settings">
          Go to your <strong>Profile</strong> page and click <strong>"Identity Settings"</strong>. Make sure your primary wallet is connected.
        </StepCard>
        <StepCard n="2" title="Enter your backup wallet address">
          In the <strong>Backup Wallet</strong> section, type the address of your backup wallet, then click <strong>"Propose"</strong>. Approve the transaction from your primary wallet.
        </StepCard>
        <StepCard n="3" title="Close the dialog and switch wallets">
          After the proposal is sent, click <strong>"Close &amp; Switch Wallet"</strong>. Then in your wallet app, switch to the backup wallet.
        </StepCard>
        <StepCard n="4" title="Re-open Identity Settings">
          With the backup wallet active, go back to <strong>Profile → Identity Settings</strong>. You will see the confirmation screen: <strong>"You've been invited as a backup wallet!"</strong>
        </StepCard>
        <StepCard n="5" title="Confirm with one click" color={t.colors.green[400]}>
          Click <strong>"Confirm — Link as Backup Wallet"</strong> and approve the transaction. Done!
        </StepCard>
      </div>
      <InfoBox Icon={IconWarning} color="rgba(251,191,36,0.05)" border="rgba(251,191,36,0.18)" textColor={t.colors.amber[400]}>
        <strong>Note:</strong> Each identity supports a maximum of <strong>1 backup wallet</strong>. To change it, remove the existing one first, then add the new one.
      </InfoBox>
      <InfoBox Icon={IconLock} color="rgba(52,211,153,0.04)" border="rgba(52,211,153,0.18)" textColor={t.colors.green[400]}>
        <strong>Security:</strong> The two-step process (propose + confirm) ensures both wallets have signed a transaction — no third party can link a wallet to your identity without your approval.
      </InfoBox>
    </div>
  );
}

// ─── Guide: Recovering with a Backup Wallet ──────────────────────────────────

function RecoveryGuide() {
  return (
    <div>
      <p style={{ fontSize: '13.5px', color: t.colors.text.muted, lineHeight: 1.8, marginBottom: '18px' }}>
        If your primary wallet is lost, stolen, or permanently inaccessible, you can use your backup wallet to take over the identity. Your username and full reputation history will transfer.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <StepCard n="1" title="Connect with your backup wallet">
          In your wallet app, connect using the backup wallet you registered previously.
        </StepCard>
        <StepCard n="2" title="Open Identity Settings">
          Go to <strong>Profile → Identity Settings</strong>. You will see the status <strong>"This wallet is a backup for: 0x..."</strong>
        </StepCard>
        <StepCard n="3" title="Use Emergency Recovery">
          Scroll to the <strong>Emergency Recovery</strong> section, check the confirmation box, and click <strong>"Take Over as Primary"</strong>. Approve the transaction.
        </StepCard>
      </div>
      <InfoBox Icon={IconWarning} color="rgba(239,68,68,0.04)" border="rgba(239,68,68,0.18)" textColor={t.colors.red[300]}>
        <strong>Warning:</strong> This action is <strong>irreversible</strong>. Only use Emergency Recovery if you have truly and permanently lost access to your primary wallet.
      </InfoBox>
    </div>
  );
}

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_GENERAL = [
  { q: 'What is NadWork?', a: 'NadWork is an on-chain micro-task bounty platform built on the Monad blockchain. Posters create tasks with MON or ERC20 token rewards, and hunters complete them to earn payouts directly from a smart contract — no middlemen, no KYC.' },
  { q: 'How is NadWork different from traditional freelance platforms?', a: 'Everything is transparent and on-chain. Funds are held in an escrow smart contract and released automatically once the poster approves a winner. No third party holds the funds, all submission history is permanently recorded on-chain, and disputes are resolved transparently.' },
  { q: 'What tokens can be used as rewards?', a: 'NadWork supports two reward types: MON (Monad\'s native token) and ERC20 tokens such as USDC. Posters choose the reward type when creating a bounty.' },
  { q: 'What is the platform fee?', a: 'NadWork charges a 3% platform fee on the total reward when a bounty is completed. There are no fees for hunters submitting work.' },
  { q: 'Is submitted work stored permanently?', a: 'Yes. All submissions are stored on IPFS (InterPlanetary File System) — a decentralised, tamper-proof storage network. The IPFS link is also recorded on-chain, so it cannot be deleted or manipulated.' },
];

const FAQ_BOUNTY = [
  { q: 'How do I create a bounty?', a: (<>Click <strong>"Post"</strong> in the navigation bar, fill in the form (title, description, category, deadline, reward amount, number of winners), review everything, then click <strong>"Create &amp; Fund Bounty"</strong>. Funds are sent directly into the escrow smart contract.</>) },
  { q: 'Can I approve fewer winners than I originally set?', a: 'Yes. If you create a bounty for 3 winners but only 1 submission is worth rewarding, you can approve just that 1 winner. The remaining prize slots are refunded to the poster proportionally.' },
  { q: 'What happens when a bounty passes its deadline?', a: 'After the deadline, the bounty enters a Review Window (20% of its duration, min 24h, max 7d). The poster must approve or reject submissions within this window. If the poster does nothing, anyone can trigger a Timeout — pending hunters receive the reward and the poster\'s stake is slashed 100% to treasury.' },
  { q: 'Can I cancel a bounty after it is created?', a: 'Yes. If there are no submissions, you get a full refund including your poster stake. If submissions exist, a cancellation fee applies (approx. 2% of reward per submission for MON bounties, or 0.005 MON flat per submission for ERC20 bounties). Any unused MON is refunded.' },
  { q: 'What is a "Featured" bounty?', a: 'Featured bounties appear at the top of the homepage, giving them maximum visibility. Posters can pay 0.5 MON to feature their bounty.' },
  { q: 'How does the dispute system work?', a: 'A hunter who believes their submission was unfairly rejected can raise a dispute within the 2-hour grace period following rejection. A 0.01 MON deposit is required. If upheld by an admin: the hunter\'s stake and deposit are returned, and the poster\'s stake is slashed to the hunter. If denied: both the submission stake and the dispute deposit are forfeited to treasury. Only file a dispute if you genuinely believe the rejection was unfair.' },
];

const FAQ_IDENTITY = [
  { q: 'What is a NadWork Username?', a: 'A username is an on-chain identity permanently linked to your wallet. Once claimed, it cannot be changed or removed — this ensures your reputation cannot be "reset" by switching names, and no one can inherit your history by taking your old username.' },
  { q: 'Can I change my username after claiming it?', a: 'No. Usernames are permanent and cannot be changed by anyone — including the NadWork team. Choose carefully. Usernames must be 3–32 characters: lowercase letters, numbers, and hyphens only.' },
  { q: 'What is a backup wallet and why do I need one?', a: 'A backup wallet is a second wallet linked to your primary identity. It acts as a "spare key" — if your primary wallet is ever lost or inaccessible, you can use the backup to take over your username and full reputation history.' },
  { q: 'Can my backup wallet submit work or create bounties?', a: 'Not directly. The backup wallet is only used for Emergency Recovery. For regular activity — submitting work, creating bounties — use your primary wallet.' },
  { q: 'How many backup wallets can I add?', a: 'A maximum of 1 backup wallet per identity. This is sufficient for recovery purposes while keeping the system simple and secure.' },
  { q: 'How do I change my backup wallet?', a: 'Open Identity Settings, click "Remove" on the current backup wallet, wait for the transaction to confirm, then add a new backup wallet using the Propose → Confirm flow.' },
];

const FAQ_WALLET = [
  { q: 'Which wallets does NadWork support?', a: 'NadWork supports any wallet compatible with WalletConnect and the Monad network, including MetaMask, Haha Wallet, Rabby, and others. Make sure your wallet is configured for Monad Mainnet (Chain ID: 143).' },
  { q: 'How do I add Monad to MetaMask?', a: (<>In MetaMask, click <strong>Add Network</strong> and enter the following details:<ul style={{ marginTop: '8px', paddingLeft: '20px', lineHeight: 2 }}><li>Network Name: <Mono>Monad Mainnet</Mono></li><li>RPC URL: <Mono>https://rpc.monad.xyz</Mono></li><li>Chain ID: <Mono>143</Mono></li><li>Currency Symbol: <Mono>MON</Mono></li><li>Explorer: <Mono>https://monadexplorer.com</Mono></li></ul></>) },
  { q: 'My transaction is stuck / pending for a long time — what should I do?', a: 'Check the transaction status on Monad Explorer. If it is genuinely stuck, you can speed it up or cancel it directly from your wallet app. Make sure you are setting a sufficient gas fee for current network conditions.' },
];

const TABS = [
  { id: 'general',  label: 'General',   Icon: IconQuestion, faqs: FAQ_GENERAL  },
  { id: 'bounty',   label: 'Bounties',  Icon: IconCheck,    faqs: FAQ_BOUNTY   },
  { id: 'identity', label: 'Identity',  Icon: IconLock,     faqs: FAQ_IDENTITY },
  { id: 'wallet',   label: 'Wallet',    Icon: IconWallet,   faqs: FAQ_WALLET   },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [activeTab, setActiveTab]     = useState('general');
  const [activeGuide, setActiveGuide] = useState(null);
  const currentTab = TABS.find(tb => tb.id === activeTab);

  return (
    <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)', maxWidth: '760px', margin: '0 auto' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginBottom: '36px' }}
      >
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: t.colors.text.primary, margin: '0 0 6px', letterSpacing: '-0.035em' }}>
          Help &amp; FAQ
        </h1>
        <p style={{ fontSize: '14px', color: t.colors.text.muted, margin: 0, lineHeight: 1.7 }}>
          Guides and answers for everything on NadWork — from posting bounties to securing your identity.
        </p>
      </motion.div>

      {/* Step-by-Step Guides */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.22 }}
        style={{ marginBottom: '36px' }}
      >
        <SectionHeader Icon={IconBook} title="Step-by-Step Guides" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {[
            {
              id: 'backup',
              Icon: IconLink,
              title: 'Link a Backup Wallet',
              desc: 'Secure your identity with a recovery wallet. A complete walkthrough of the propose & confirm process.',
              tag: 'Identity',
              tagColor: 'rgba(124,58,237,0.12)',
              tagText: t.colors.violet[300],
              iconColor: t.colors.violet[400],
            },
            {
              id: 'recovery',
              Icon: IconShield,
              title: 'Recover Using a Backup Wallet',
              desc: 'Lost access to your primary wallet? Use your backup to reclaim your username and reputation history.',
              tag: 'Emergency',
              tagColor: 'rgba(239,68,68,0.1)',
              tagText: t.colors.red[300],
              iconColor: t.colors.red[400],
            },
          ].map(guide => {
            const GuideIcon = guide.Icon;
            const isActive  = activeGuide === guide.id;
            return (
              <button
                key={guide.id}
                onClick={() => setActiveGuide(isActive ? null : guide.id)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '16px',
                  background: isActive ? 'rgba(124,58,237,0.07)' : t.colors.bg.card,
                  border: `1px solid ${isActive ? 'rgba(124,58,237,0.28)' : t.colors.border.default}`,
                  borderRadius: t.radius.lg,
                  transition: 'border-color 0.12s ease, background 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: t.radius.md,
                    background: isActive ? 'rgba(124,58,237,0.12)' : t.colors.bg.elevated,
                    border: '1px solid ' + t.colors.border.default,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: guide.iconColor,
                  }}>
                    <GuideIcon size={15} color={guide.iconColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Tag color={guide.tagColor} textColor={guide.tagText}>{guide.tag}</Tag>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: t.colors.text.primary, margin: '5px 0 3px', letterSpacing: '-0.01em' }}>{guide.title}</div>
                    <div style={{ fontSize: '12px', color: t.colors.text.muted, lineHeight: 1.6 }}>{guide.desc}</div>
                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: t.colors.violet[400], fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'flex', transform: isActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
                        <IconChevron size={12} color={t.colors.violet[400]} />
                      </span>
                      {isActive ? 'Close guide' : 'Read guide'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Guide content */}
        <AnimatePresence>
          {activeGuide && (
            <motion.div
              key={activeGuide}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: '14px',
                padding: '22px',
                background: t.colors.bg.card,
                border: '1px solid ' + t.colors.border.default,
                borderRadius: t.radius.lg,
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: t.colors.text.primary, letterSpacing: '-0.02em' }}>
                  {activeGuide === 'backup' ? 'How to Link a Backup Wallet' : 'How to Recover Using a Backup Wallet'}
                </h3>
                {activeGuide === 'backup' ? <BackupWalletGuide /> : <RecoveryGuide />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Fair System Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.22 }}
        style={{ marginBottom: '36px' }}
      >
        <SectionHeader
          Icon={IconShield}
          title="NadWork Fair System"
          subtitle="Three on-chain pillars protect both posters and hunters from bad-faith actors."
        />

        {/* Pillars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>

          {/* Pillar 1: Stakes */}
          <div style={{ padding: '18px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: t.radius.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: t.radius.sm, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: t.fonts.mono, fontWeight: 700, fontSize: '11px', color: '#34d399' }}>P1</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: t.colors.text.primary, letterSpacing: '-0.01em' }}>Skin-in-the-Game Stakes</div>
            </div>
            <div style={{ fontSize: '12.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>
              Both parties lock real MON before participating:
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li><strong style={{ color: t.colors.text.secondary }}>Poster stake</strong> — 5% of reward (min 0.005 MON). Fully refunded on successful completion. Slashed to hunters if the poster commits fraud-cancel.</li>
                <li><strong style={{ color: t.colors.text.secondary }}>Hunter submission stake</strong> — 1% of reward (min 0.001 MON). Refunded on rejection or approval. Slashed to treasury only if a dispute is raised and denied.</li>
              </ul>
            </div>
          </div>

          {/* Pillar 2: Time-gated review */}
          <div style={{ padding: '18px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: t.radius.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: t.radius.sm, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: t.fonts.mono, fontWeight: 700, fontSize: '11px', color: '#818cf8' }}>P2</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: t.colors.text.primary, letterSpacing: '-0.01em' }}>Time-Gated Review Windows</div>
            </div>
            <div style={{ fontSize: '12.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li><strong style={{ color: t.colors.text.secondary }}>Review window</strong> — 20% of bounty duration (min 24h, max 7d) after deadline. Poster must approve or reject within this window.</li>
                <li><strong style={{ color: t.colors.text.secondary }}>Grace period</strong> — 2 hours after a rejection. Hunter can raise a dispute. Submission stake is held (not refunded) during this window, then released if no dispute is filed.</li>
                <li><strong style={{ color: t.colors.text.secondary }}>Timeout</strong> — if the poster ignores submissions past the review deadline, anyone can trigger a timeout. Funds go to pending hunters, poster stake is slashed 100% to treasury.</li>
              </ul>
            </div>
          </div>

          {/* Pillar 3: Identity & Reputation */}
          <div style={{ padding: '18px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.14)', borderRadius: t.radius.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: t.radius.sm, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: t.fonts.mono, fontWeight: 700, fontSize: '11px', color: '#fbbf24' }}>P3</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: t.colors.text.primary, letterSpacing: '-0.01em' }}>Identity Tiers & Reputation</div>
            </div>
            <div style={{ fontSize: '12.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>
              Hunters progress through trust tiers based on their on-chain history:
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { tier: 'Anonymous',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)', desc: 'No username. Cannot submit.' },
                  { tier: 'Registered', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', desc: 'Claimed username. Stake ×1.5. Bounties under 1 MON only.' },
                  { tier: 'Active',     color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  desc: '≥1 submission. Stake ×1.0. All bounties accessible.' },
                  { tier: 'Trusted',    color: '#34d399', bg: 'rgba(52,211,153,0.08)',  desc: '5+ wins. Stake ×0.75 (discount). Highest trust.' },
                ].map(({ tier, color, bg, desc }) => (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: bg, borderRadius: t.radius.sm }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase', width: '68px', flexShrink: 0 }}>{tier}</span>
                    <span style={{ fontSize: '11.5px', color: t.colors.text.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '11.5px', lineHeight: 1.6 }}>
                Bad-faith actions (fraud-cancel, losing disputes) are <strong style={{ color: t.colors.text.secondary }}>permanently recorded on-chain</strong> and reduce your reputation score. Fraud posters face stake slashing and reputation penalties.
              </div>
            </div>
          </div>
        </div>

        {/* Dispute Flow Summary */}
        <InfoBox Icon={IconWarning} color="rgba(239,68,68,0.05)" border="rgba(239,68,68,0.15)" textColor="#f87171">
          <strong>Dispute outcome reminder:</strong> If a dispute is <strong>upheld</strong>, the hunter receives their stake back, the dispute deposit is refunded, and the poster's stake is slashed. If <strong>denied</strong>, both the submission stake and the dispute deposit are forfeited to treasury.
        </InfoBox>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.22 }}
      >
        <SectionHeader Icon={IconQuestion} title="Frequently Asked Questions" />

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '3px',
          marginBottom: '22px',
          flexWrap: 'wrap',
          padding: '3px',
          background: t.colors.bg.card,
          borderRadius: t.radius.md,
          border: '1px solid ' + t.colors.border.default,
        }}>
          {TABS.map(tab => {
            const TabIcon = tab.Icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                  color: isActive ? t.colors.violet[300] : t.colors.text.muted,
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <TabIcon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div>
          {currentTab?.faqs.map((item, i) => (
            <Accordion key={i} q={item.q}>{item.a}</Accordion>
          ))}
        </div>
      </motion.div>

      {/* Contact / Community */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        style={{
          marginTop: '60px',
          padding: '22px',
          background: 'rgba(124,58,237,0.04)',
          border: '1px solid rgba(124,58,237,0.14)',
          borderRadius: t.radius.xl,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: t.colors.violet[400] }}>
          <IconMessage size={26} color={t.colors.violet[400]} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: t.colors.text.primary, letterSpacing: '-0.02em' }}>
          Still have questions?
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.colors.text.muted, lineHeight: 1.7 }}>
          Join the NadWork community on Telegram or Twitter for direct support from the team and community members.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="https://t.me/nadwork"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 18px',
              borderRadius: t.radius.md,
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.22)',
              color: t.colors.violet[300],
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconTelegram size={14} />
            Telegram
          </a>
          <a
            href="https://twitter.com/nadwork"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 18px',
              borderRadius: t.radius.md,
              background: 'transparent',
              border: '1px solid ' + t.colors.border.default,
              color: t.colors.text.secondary,
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <IconTwitter size={14} />
            Twitter / X
          </a>
        </div>
      </motion.div>

    </div>
  );
}
