import { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import { theme } from '../../styles/theme.js';
import { useProfileMeta } from '../../hooks/useProfileMeta.js';
import { AvatarSection } from '../common/Avatar.jsx';
import { IconTwitter, IconGithub } from '../icons/index.jsx';

// ── Shared atoms ──────────────────────────────────────────────────────────────
function Label({ children, hint }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600,
        color: theme.colors.text.faint,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>{children}</span>
      {hint && (
        <span style={{
          fontFamily: theme.fonts.body, fontSize: 11,
          color: theme.colors.text.faint, marginLeft: 8,
        }}>{hint}</span>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px',
  background: theme.colors.bg.input,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.primary,
  fontFamily: theme.fonts.body, fontSize: 13,
  outline: 'none', transition: 'border-color 0.15s',
};

function TextInput({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      style={inputStyle}
      onFocus={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
      onBlur={e => { e.currentTarget.style.borderColor = theme.colors.border.default; }}
    />
  );
}

function TextareaInput({ value, onChange, placeholder, maxLength, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      style={{
        ...inputStyle,
        resize: 'vertical',
        lineHeight: 1.6,
        minHeight: 72,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
      onBlur={e => { e.currentTarget.style.borderColor = theme.colors.border.default; }}
    />
  );
}

// ── Skill tag editor ──────────────────────────────────────────────────────────
function SkillEditor({ skills, onChange }) {
  const [input, setInput] = useState('');

  const addSkill = (val) => {
    const trimmed = val.trim();
    if (!trimmed || skills.includes(trimmed) || skills.length >= 12) return;
    onChange([...skills, trimmed]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(input);
      setInput('');
    } else if (e.key === 'Backspace' && !input && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  };

  const removeSkill = (i) => onChange(skills.filter((_, idx) => idx !== i));

  return (
    <div>
      {/* Tags row */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: skills.length ? 8 : 0,
      }}>
        {skills.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px 3px 10px',
            background: theme.colors.primaryDim,
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 500,
            color: theme.colors.primaryLight,
          }}>
            {s}
            <button
              onClick={() => removeSkill(i)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: theme.colors.text.faint, padding: '0 2px',
                fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.colors.red[400]; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.faint; }}
            >×</button>
          </div>
        ))}
      </div>

      {/* Input */}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) { addSkill(input); setInput(''); } }}
        placeholder={skills.length >= 12 ? 'Max 12 skills' : 'Type a skill and press Enter…'}
        disabled={skills.length >= 12}
        style={{
          ...inputStyle,
          opacity: skills.length >= 12 ? 0.5 : 1,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
        onBlur2={e => { e.currentTarget.style.borderColor = theme.colors.border.default; }}
      />
      <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 4 }}>
        Press Enter or comma to add · {skills.length}/12
      </div>
    </div>
  );
}

// ── Social row ────────────────────────────────────────────────────────────────
function SocialInput({ icon: IconComp, prefix, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
      <div style={{
        padding: '9px 10px',
        background: theme.colors.bg.elevated,
        border: `1px solid ${theme.colors.border.default}`,
        borderRight: 'none',
        borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
        fontFamily: theme.fonts.body, fontSize: 13,
        color: theme.colors.text.faint,
        whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>{typeof IconComp === 'string' ? IconComp : <IconComp size={14} color="currentColor" />}</span>
        {prefix && <span style={{ fontFamily: theme.fonts.mono, fontSize: 11 }}>{prefix}</span>}
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
          flex: 1,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
        onBlur={e => { e.currentTarget.style.borderColor = theme.colors.border.default; }}
      />
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function EditProfileModal({ open, onClose, address, onSaved }) {
  const { meta, save } = useProfileMeta(address);

  const [form, setForm] = useState({
    displayName: '',
    bio:         '',
    skills:      [],
    twitter:     '',
    github:      '',
  });
  const [saved, setSaved] = useState(false);

  // Sync form with loaded meta
  useEffect(() => {
    if (meta) {
      setForm({
        displayName: meta.displayName || '',
        bio:         meta.bio         || '',
        skills:      meta.skills      || [],
        twitter:     meta.twitter     || '',
        github:      meta.github      || '',
      });
    }
  }, [meta, open]);

  const set = (key, val) => {
    setSaved(false);
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    save({
      displayName: form.displayName.trim(),
      bio:         form.bio.trim(),
      skills:      form.skills.filter(Boolean),
      twitter:     form.twitter.trim().replace(/^@/, ''),
      github:      form.github.trim().replace(/^@/, ''),
    });
    setSaved(true);
    onSaved?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile" maxWidth={480}>
      <div>

        {/* Profile picture */}
        <AvatarSection address={address} />

        <div style={{ height: 1, background: theme.colors.border.subtle, margin: '20px 0' }} />

        {/* Display name */}
        <Field label="Display Name" hint="optional · shown on bounties you post">
          <TextInput
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            placeholder="e.g. Alice Dev"
            maxLength={40}
          />
          <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 4 }}>
            {form.displayName.length}/40
          </div>
        </Field>

        {/* Bio */}
        <Field label="Bio" hint="optional · max 200 chars">
          <TextareaInput
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Tell builders who you are, what you work on…"
            maxLength={200}
            rows={3}
          />
          <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 4 }}>
            {form.bio.length}/200
          </div>
        </Field>

        {/* Skills */}
        <Field label="Skills / Tags" hint="optional · helps builders know your domain">
          <SkillEditor
            skills={form.skills}
            onChange={val => set('skills', val)}
          />
        </Field>

        {/* Social links */}
        <Field label="Social Links" hint="optional">
          <SocialInput
            icon={IconTwitter}
            prefix="@"
            value={form.twitter}
            onChange={e => set('twitter', e.target.value.replace(/^@/, ''))}
            placeholder="twitter username"
          />
          <SocialInput
            icon={IconGithub}
            prefix="github.com/"
            value={form.github}
            onChange={e => set('github', e.target.value.replace(/^@/, ''))}
            placeholder="github username"
          />
        </Field>

        <div style={{ height: 1, background: theme.colors.border.subtle, marginBottom: 20 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {saved && (
            <span style={{
              fontFamily: theme.fonts.body, fontSize: 12,
              color: theme.colors.green[400],
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: theme.radius.md,
              background: 'none', border: `1px solid ${theme.colors.border.default}`,
              color: theme.colors.text.muted,
              fontFamily: theme.fonts.body, fontSize: 13, cursor: 'pointer',
              transition: theme.transition,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.hover; e.currentTarget.style.color = theme.colors.text.secondary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.color = theme.colors.text.muted; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 20px', borderRadius: theme.radius.md,
              background: theme.colors.primaryDim,
              border: `1px solid ${theme.colors.primaryBorder}`,
              color: theme.colors.primaryLight,
              fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: theme.transition,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(110,84,255,0.15)'; e.currentTarget.style.borderColor = theme.colors.primary; }}
            onMouseLeave={e => { e.currentTarget.style.background = theme.colors.primaryDim; e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
          >
            Save Changes
          </button>
        </div>

        <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 12, lineHeight: 1.6, textAlign: 'center' }}>
          Stored locally on this device · no transaction required
        </div>
      </div>
    </Modal>
  );
}
