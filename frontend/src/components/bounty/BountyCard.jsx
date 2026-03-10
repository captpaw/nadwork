import { useState, useEffect } from 'react';
import { theme } from '../../styles/theme';
import Badge from '../common/Badge';
import DeadlineTimer from './DeadlineTimer';
import { fetchJSON } from '../../config/pinata';
import { getProfileMeta } from '../../hooks/useProfileMeta';
import { useDisplayName } from '../../hooks/useIdentity';
import { AvatarDisplay } from '../common/Avatar';

function toBoolSafe(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'bigint') return value !== 0n;
  const s = String(value).trim().toLowerCase();
  if (!s) return fallback;
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

export default function BountyCard({ bounty, onClick, view = 'grid' }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let alive = true;

    const hasPresentation =
      Boolean(String(bounty?.title || '').trim()) &&
      Boolean(String(bounty?.category || '').trim()) &&
      Boolean(String(bounty?.description || '').trim());

    if (hasPresentation) {
      setMeta(null);
      return () => { alive = false; };
    }

    const cid = bounty?.ipfsHash || bounty?.metaCid || bounty?.metadataCID;
    if (!cid) {
      setMeta(null);
      return () => { alive = false; };
    }

    fetchJSON(cid).then((data) => {
      if (alive) setMeta(data);
    });

    return () => {
      alive = false;
    };
  }, [bounty?.ipfsHash, bounty?.metaCid, bounty?.metadataCID, bounty?.title, bounty?.category, bounty?.description]);

  const [hov, setHov] = useState(false);

  if (!bounty) return null;

  const title       = meta?.title || bounty?.title || (bounty?.id != null ? `Bounty #${bounty.id}` : 'Untitled Bounty');
  const description = meta?.fullDescription || meta?.description || bounty?.description || '';
  const category    = meta?.category    || bounty?.category    || 'other';
  // totalReward is a BigInt (Wei) from ethers v6; reward/rewardAmount are legacy string fields
  const rawReward   = bounty?.totalReward;
  const reward      = bounty?.reward || bounty?.rewardAmount
    || (rawReward != null ? (Number(rawReward) / 1e18).toFixed(4).replace(/\.?0+$/, '') : '0');
  // Normalize uint8 BigInt status from contract to string for Badge
  const _STATUS = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
  const status      = bounty?.status != null
    ? (_STATUS[Number(bounty.status)] || 'active')
    : 'active';
  const deadline    = bounty?.deadline  || bounty?.expiresAt;
  const submCount   = Number(bounty?.submissionCount ?? 0);
  const isFeatured = toBoolSafe(bounty?.featured, false);
  const isCurated = toBoolSafe(bounty?.requiresApplication, false);
  const creator      = bounty?.creator || bounty?.poster;
  const creatorMeta  = creator ? getProfileMeta(creator) : null;
  const { displayName: creatorUsername } = useDisplayName(creator);
  const creatorLabel = creatorMeta?.displayName || creatorUsername
    || (creator ? `${creator.slice(0, 6)}…${creator.slice(-4)}` : null);

  const CAT_ACCENT = {
    dev:      theme.colors.cyan,
    design:   theme.colors.pink,
    content:  theme.colors.amber,
    research: '#c4b5fd',
    other:    theme.colors.text.muted,
  };
  const catColor = CAT_ACCENT[(category || 'other').toLowerCase()] || theme.colors.text.muted;

  // Grid view
  if (view === 'grid') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: 'relative',
          background: hov ? theme.colors.bg.elevated : theme.colors.bg.card,
          border: `1px solid ${hov ? theme.colors.border.default : theme.colors.border.subtle}`,
          borderRadius: theme.radius.xl,
          padding: '20px',
          cursor: 'pointer',
          transition: theme.transition,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.4)` : 'none',
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
          background: catColor,
          opacity: hov ? 1 : 0.3,
          transition: theme.transition,
          borderRadius: '12px 0 0 12px',
        }} />

        {/* Top row — badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 6 }}>
          <Badge type={status} />
          <Badge type={category} />
          {isFeatured && <Badge type="featured" label="Featured" />}
          {isCurated && (
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 9.5, fontWeight: 500,
              color: theme.colors.amber, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 6px',
              background: theme.colors.amberDim,
              border: `1px solid ${theme.colors.amberBorder}`,
              borderRadius: theme.radius.full,
            }}>◈ Curated</span>
          )}
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: theme.fonts.body, fontWeight: 600,
          fontSize: 15, color: hov ? theme.colors.text.white : theme.colors.text.primary,
          letterSpacing: '-0.02em', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          flex: 1, paddingLeft: 6, transition: theme.transition,
        }}>
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p style={{
            fontFamily: theme.fonts.body, fontWeight: 300,
            fontSize: 13, color: theme.colors.text.muted,
            lineHeight: 1.6,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            paddingLeft: 6,
          }}>
            {description}
          </p>
        )}

        {/* Bottom row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, paddingLeft: 6,
          borderTop: `1px solid ${theme.colors.border.subtle}`,
          gap: 8,
        }}>
          {/* Reward */}
          <span style={{
            fontFamily: theme.fonts.mono, fontSize: 17,
            fontWeight: 600, color: hov ? catColor : theme.colors.primary,
            letterSpacing: '-0.03em', transition: theme.transition,
          }}>
            {reward}
            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: theme.colors.text.muted }}>MON</span>
          </span>

          {/* Deadline + submissions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {deadline && <DeadlineTimer deadline={deadline} compact />}
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 11,
              color: submCount > 0 ? theme.colors.text.secondary : theme.colors.text.faint,
            }}>
              {submCount} sub{submCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Creator */}
        {creator && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 6,
          }}>
            <AvatarDisplay address={creator} size={16} />
            <span style={{
              fontFamily: creatorMeta?.displayName ? theme.fonts.body : theme.fonts.mono,
              fontSize: 10.5,
              color: theme.colors.text.faint,
              letterSpacing: creatorMeta?.displayName ? '-0.01em' : '0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110,
            }}>
              {creatorLabel}
            </span>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${theme.colors.border.faint}`,
        cursor: 'pointer',
        transition: theme.transition,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <Badge type={status} />
          <Badge type={category} />
          {isCurated && (
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 9.5, fontWeight: 500,
              color: theme.colors.amber, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '2px 6px',
              background: theme.colors.amberDim,
              border: `1px solid ${theme.colors.amberBorder}`,
              borderRadius: theme.radius.full,
            }}>◈ Curated</span>
          )}
          <span style={{
            fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 15,
            color: theme.colors.text.primary,
            letterSpacing: '-0.015em',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {deadline && <DeadlineTimer deadline={deadline} compact />}
          <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.muted }}>
            {submCount} subs
          </span>
        </div>
      </div>

      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 15,
        fontWeight: 500, color: theme.colors.primary,
        flexShrink: 0, letterSpacing: '-0.02em',
      }}>
        {reward} MON
      </span>
    </div>
  );
}



