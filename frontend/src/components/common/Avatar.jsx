import React, { useState, useRef } from 'react';
import { theme as t } from '@/styles/theme.js';
import { IconWarning } from '@/components/icons/index.jsx';
import { useAvatar, getAvatarSrc } from '@/hooks/useAvatar.js';

// ─── Initials fallback ────────────────────────────────────────────────────────

function InitialsFallback({ address, size }) {
  const initials = address ? address.slice(2, 4).toUpperCase() : '??';
  const hue = address ? parseInt(address.slice(2, 6), 16) % 360 : 200;
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `hsl(${hue},35%,15%)`,
      fontFamily: t.fonts.mono,
      fontSize: Math.floor(size * 0.28) + 'px',
      fontWeight: 700,
      color: `hsl(${hue},65%,68%)`,
      letterSpacing: '0.02em',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ─── Camera overlay icon ──────────────────────────────────────────────────────

function CameraIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

// ─── Shared image renderer ────────────────────────────────────────────────────

function AvatarImg({ src, address, size, onClearSrc }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt=""
        onError={() => { setErr(true); onClearSrc?.(); }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return <InitialsFallback address={address} size={size} />;
}

// ─── Read-only Avatar ────────────────────────────────────────────────────────
// Used anywhere you just want to display an address's avatar.

export function AvatarDisplay({ address, size = 40, style = {} }) {
  const src = getAvatarSrc(address);
  const hue = address ? parseInt(address.slice(2, 6), 16) % 360 : 200;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.22) + 'px',
      overflow: 'hidden',
      flexShrink: 0,
      border: `1.5px solid hsl(${hue},40%,28%)`,
      background: `hsl(${hue},35%,15%)`,
      ...style,
    }}>
      <AvatarImg src={src} address={address} size={size} />
    </div>
  );
}

// ─── Editable Avatar (self-profile) ──────────────────────────────────────────
// Shows a camera overlay on hover. Click → open file picker.
// onEdit prop overrides click to open parent modal instead.

export function AvatarEditable({ address, size = 60, onEdit, style = {} }) {
  const { avatar, uploading, setAvatar } = useAvatar(address);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);

  const src = avatar?.src || null;
  const hue = address ? parseInt(address.slice(2, 6), 16) % 360 : 200;

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return; }
    setAvatar(file);
  };

  const handleClick = () => {
    if (onEdit) { onEdit(); return; }
    inputRef.current?.click();
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0, ...style }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        title="Change profile picture"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22) + 'px',
          overflow: 'hidden',
          cursor: 'pointer',
          border: `1.5px solid hsl(${hue},40%,28%)`,
          background: `hsl(${hue},35%,15%)`,
          position: 'relative',
          transition: 'border-color 0.15s ease',
        }}
      >
        <AvatarImg src={src} address={address} size={size} />

        {/* Hover overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          opacity: hovered || uploading ? 1 : 0,
          transition: 'opacity 0.15s ease',
          color: '#fff',
        }}>
          {uploading ? (
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center', padding: '0 4px' }}>
              Saving…
            </div>
          ) : (
            <>
              <CameraIcon size={Math.max(12, size * 0.22)} />
              <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em' }}>
                {src ? 'Change' : 'Add Photo'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Avatar Section for IdentityModal ────────────────────────────────────────

export function AvatarSection({ address }) {
  const { avatar, uploading, uploadError, setAvatar, removeAvatar } = useAvatar(address);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const size = 80;
  const hue = address ? parseInt(address.slice(2, 6), 16) % 360 : 200;
  const src = avatar?.src || null;

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file (PNG, JPG, GIF, WebP).'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
    setAvatar(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Profile Picture
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

        {/* Live preview */}
        <div style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22) + 'px',
          overflow: 'hidden',
          flexShrink: 0,
          border: `1.5px solid hsl(${hue},40%,28%)`,
          background: `hsl(${hue},35%,15%)`,
          position: 'relative',
        }}>
          <AvatarImg src={src} address={address} size={size} />
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: '#fff', fontWeight: 600,
            }}>
              Saving…
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: '14px',
              border: `1.5px dashed ${dragOver ? 'rgba(124,58,237,0.6)' : t.colors.border.default}`,
              borderRadius: t.radius.md,
              background: dragOver ? 'rgba(124,58,237,0.07)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>📷</div>
            <div style={{ fontSize: '12px', color: t.colors.text.secondary, fontWeight: 500 }}>
              Click or drag & drop
            </div>
            <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '2px' }}>
              PNG, JPG, GIF, WebP — max 5 MB
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />

          {/* Status messages */}
          {uploadError && (
            <div style={{ fontSize: '11.5px', color: '#f87171', marginBottom: '6px', lineHeight: 1.5 }}>
              <IconWarning size={12} color="#f87171" style={{ marginRight: 4, verticalAlign: 'middle' }} /> {uploadError}
            </div>
          )}
          {src && !uploading && !uploadError && (
            <div style={{ fontSize: '11.5px', color: '#34d399', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Photo saved
            </div>
          )}

          {/* Remove button */}
          {src && (
            <button
              onClick={removeAvatar}
              style={{
                fontSize: '11.5px',
                color: '#f87171',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: t.radius.sm,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '10px', lineHeight: 1.6 }}>
        Stored locally on this device. No transaction required.
      </div>
    </div>
  );
}

export default AvatarEditable;
