import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import Badge from '@/components/common/Badge.jsx';
import DeadlineTimer from './DeadlineTimer.jsx';
import { formatReward, categoryLabel } from '@/utils/format.js';
import { useDisplayName } from '@/hooks/useIdentity.js';
import { fetchJSON } from '@/config/pinata.js';
import { BOUNTY_STATUS, CATEGORY_LABELS } from '@/config/contracts.js';
import { IconStar, IconArrowRight } from '@/components/icons/index.jsx';

export default function BountyCard({ bounty, onClick }) {
  const [meta, setMeta] = useState(null);
  const [hov,  setHov]  = useState(false);
  const { displayName: posterName } = useDisplayName(bounty.poster);

  useEffect(() => {
    if (bounty.ipfsHash) fetchJSON(bounty.ipfsHash).then(setMeta).catch(() => {});
  }, [bounty.ipfsHash]);

  const title      = meta?.title    || bounty.title    || 'Untitled Bounty';
  const category   = meta?.category || bounty.category || '';
  const statusNum  = Number(bounty.status);
  const statusKey  = BOUNTY_STATUS[statusNum]?.toLowerCase() || 'active';
  const isActive   = statusNum === 0;
  const isFeatured = bounty.featured;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: hov ? t.colors.bg.elevated : t.colors.bg.card,
        border: '1px solid ' + (hov ? t.colors.border.strong : (isFeatured ? 'rgba(251,191,36,0.2)' : t.colors.border.subtle)),
        borderRadius: t.radius.lg,
        cursor: 'pointer',
        transition: 'background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease',
        boxShadow: hov ? (isFeatured ? '0 0 0 1px rgba(251,191,36,0.12), ' + t.shadow.md : '0 0 0 1px rgba(124,58,237,0.1), ' + t.shadow.md) : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
        gap: 0,
        minHeight: '200px',
      }}
    >
      {/* Top violet accent line on hover */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '1.5px',
        background: isFeatured
          ? (hov ? 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.7) 50%, transparent 100%)' : 'transparent')
          : (hov ? 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.6) 50%, transparent 100%)' : 'transparent'),
        transition: 'background 0.2s ease',
      }}/>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden', marginBottom: '12px', flexShrink: 0 }}>
        <Badge type={statusKey} label={statusKey.charAt(0).toUpperCase() + statusKey.slice(1)} />
        {isFeatured && <Badge type='featured' label='★ Featured' />}
        {category && <Badge type={category} label={CATEGORY_LABELS[category] || categoryLabel(category)} />}
      </div>

      {/* Title */}
      <h3 style={{
        fontWeight: 600,
        fontSize: '13.5px',
        color: t.colors.text.primary,
        lineHeight: 1.4,
        letterSpacing: '-0.02em',
        marginBottom: '8px',
        flexShrink: 0,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        minHeight: '38px',
      }}>
        {title}
      </h3>

      {/* Description or skills */}
      <div style={{ flex: 1, overflow: 'hidden', marginBottom: '12px' }}>
        {(meta?.shortDescription || meta?.fullDescription) ? (
          <p style={{
            fontSize: '12px',
            color: t.colors.text.muted,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {(meta.shortDescription || (meta.fullDescription || '').replace(/#+\s/g, '').replace(/\*\*/g, '').replace(/\n/g, ' ')).slice(0, 130)}
          </p>
        ) : meta?.skills?.length > 0 && (
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            {meta.skills.slice(0, 4).map(sk => (
              <span key={sk} style={{
                fontSize: '10px',
                color: t.colors.violet[400],
                background: 'rgba(124,58,237,0.07)',
                border: '1px solid rgba(124,58,237,0.12)',
                padding: '1px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}>{sk}</span>
            ))}
          </div>
        )}
      </div>

      {/* Reward */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexShrink: 0 }}>
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '14px',
          fontWeight: 700,
          color: t.colors.violet[300],
          letterSpacing: '-0.01em',
        }}>
          {formatReward(bounty.totalReward, bounty.rewardType)}
        </span>
        {Number(bounty.winnerCount) > 1 && (
          <span style={{
            fontSize: '10px',
            color: t.colors.text.muted,
            background: t.colors.bg.elevated,
            padding: '1px 7px',
            borderRadius: '3px',
            border: '1px solid ' + t.colors.border.subtle,
          }}>{String(bounty.winnerCount)} winners</span>
        )}
        {meta?.skills?.length > 0 && (meta?.shortDescription || meta?.fullDescription) && (
          <div style={{ display: 'flex', gap: '3px', flex: 1, overflow: 'hidden' }}>
            {meta.skills.slice(0, 2).map(sk => (
              <span key={sk} style={{
                fontSize: '10px',
                color: t.colors.violet[400],
                background: 'rgba(124,58,237,0.07)',
                border: '1px solid rgba(124,58,237,0.12)',
                padding: '1px 5px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}>{sk}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '10px',
        borderTop: '1px solid ' + t.colors.border.faint,
        flexShrink: 0,
        gap: '8px',
      }}>
        <span style={{
          fontSize: '11px',
          color: t.colors.text.muted,
          fontFamily: t.fonts.mono,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '48%',
        }}>{posterName}</span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
            {String(bounty.submissionCount)} sub{Number(bounty.submissionCount) !== 1 ? 's' : ''}
          </span>
          {isActive && <DeadlineTimer deadline={bounty.deadline} />}
        </div>
      </div>
    </div>
  );
}
