import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme as t } from '@/styles/theme.js';
// FIX L-FE-8: Use GATEWAY from config so hardcoded fallback URLs use configured gateway
import { fetchJSON, GATEWAY } from '@/config/pinata.js';
import { shortAddr } from '@/utils/format.js';

// FIX M-FE-1: Sanitize links to prevent XSS via javascript: URIs
function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}
const MD_COMPONENTS = { a: SafeLink };

const LINK_META = {
  github:  { icon: '⌥', label: 'GitHub',  color: '#e2e8f0' },
  figma:   { icon: '✦', label: 'Figma',   color: '#a78bfa' },
  demo:    { icon: '⚡', label: 'Demo',    color: '#34d399' },
  url:     { icon: '↗', label: 'Link',    color: '#818cf8' },
};

function detectType(url) {
  if (!url) return 'url';
  if (url.includes('github.com')) return 'github';
  if (url.includes('figma.com'))  return 'figma';
  if (url.includes('vercel.app') || url.includes('netlify.app')) return 'demo';
  return 'url';
}

function DeliverableLink({ item }) {
  const type = item.type || detectType(item.value || item.url || '');
  const m    = LINK_META[type] || LINK_META.url;
  const href = item.value || item.url || '';
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: t.radius.md,
        background: t.colors.bg.elevated,
        border: '1px solid ' + t.colors.border.default,
        textDecoration: 'none', transition: t.transition,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.hover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; }}>
      <span style={{ fontSize: '16px', color: m.color, flexShrink: 0 }}>{m.icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: m.color }}>{item.label || m.label}</div>
        <div style={{ fontSize: '11px', color: t.colors.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{href}</div>
      </div>
      <span style={{ fontSize: '11px', color: t.colors.text.muted, flexShrink: 0 }}>↗</span>
    </a>
  );
}

function SLabel({ children }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
      {children}
    </div>
  );
}

export default function SubmissionViewer({ ipfsHash, hunter, compact }) {
  const [open,    setOpen]  = useState(false);
  const [meta,    setMeta]  = useState(null);
  const [loading, setLoad]  = useState(false);

  useEffect(() => {
    if (!open || !ipfsHash || meta) return;
    setLoad(true);
    fetchJSON(ipfsHash)
      .then(d => setMeta(d))
      .catch(() => setMeta(null))
      .finally(() => setLoad(false));
  }, [open, ipfsHash, meta]);

  if (!ipfsHash) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          fontSize: compact ? '11px' : '12px',
          color: t.colors.primary,
          background: 'transparent',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: t.radius.sm,
          padding: compact ? '3px 8px' : '4px 10px',
          cursor: 'pointer',
          transition: t.transition,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        {open ? '▲ Hide Work' : '▼ View Work'}
      </button>

      {open && (
        <div style={{
          marginTop: '12px', padding: '18px',
          background: 'rgba(10,10,14,0.85)',
          border: '1px solid ' + t.colors.border.default,
          borderRadius: t.radius.md,
        }}>
          {loading && (
            <div style={{ fontSize: '13px', color: t.colors.text.muted, padding: '8px 0' }}>Loading submission…</div>
          )}

          {!loading && !meta && (
            <div style={{ fontSize: '13px', color: t.colors.text.muted }}>
              Could not load submission.{' '}
              <a href={GATEWAY + ipfsHash} target="_blank" rel="noopener noreferrer"
                style={{ color: t.colors.primary }}>Open raw JSON ↗</a>
            </div>
          )}

          {!loading && meta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  {meta.title && (
                    <div style={{ fontSize: '14px', fontWeight: 600, color: t.colors.text.primary, marginBottom: '3px' }}>
                      {meta.title}
                    </div>
                  )}
                  {(hunter || meta.hunterAddress) && (
                    <div style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
                      by {shortAddr(hunter || meta.hunterAddress)}
                    </div>
                  )}
                </div>
                <a href={GATEWAY + ipfsHash} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: t.colors.text.muted, textDecoration: 'none' }}>
                  Raw ↗
                </a>
              </div>

              {/* Description */}
              {meta.description && (
                <div>
                  <SLabel>Description</SLabel>
                  <div className="md-body" style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.75 }}>
                    <ReactMarkdown components={MD_COMPONENTS}>{meta.description}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Deliverables */}
              {meta.deliverables && meta.deliverables.length > 0 && (
                <div>
                  <SLabel>Deliverables</SLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {meta.deliverables.map((d, i) => (
                      <DeliverableLink key={i} item={d} />
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {meta.notes && (
                <div>
                  <SLabel>Notes</SLabel>
                  <p style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.7, margin: 0 }}>
                    {meta.notes}
                  </p>
                </div>
              )}

              {/* Legacy v1 fallback */}
              {!meta.description && !meta.deliverables && meta.submissionText && (
                <p style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.7, margin: 0 }}>
                  {meta.submissionText}
                </p>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
