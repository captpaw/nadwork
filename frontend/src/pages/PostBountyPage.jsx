import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { theme } from '../styles/theme';
import Button from '../components/common/Button';
import { uploadJSON, buildBountyMeta } from '../config/pinata';
import { getContract } from '../utils/ethers';
import { clearRegistryResolutionCache, getResolvedRegistryContract, listCreatorBountyIds } from '../utils/registry.js';
import { getFactoryCapabilities, seedFactoryCapabilities } from '../utils/factoryCapabilities.js';
import { ADDRESSES, FACTORY_ABI } from '../config/contracts';
import { toast } from '../utils/toast';
import { invalidateBountiesCache } from '../hooks/useBounties';
import { requestNotificationRefresh } from '../hooks/useNotifications';
import { IconCheck, IconX, IconCode, IconTarget, IconNote, IconChart, IconBounties, IconChevronLeft, IconChevronRight } from '../components/icons';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { GATEWAY } from '../config/pinata';

const turndownService = new TurndownService({ headingStyle: 'atx', emDelimiter: '*', strongDelimiter: '**' });
function mdToHtml(md) {
  if (md == null || String(md).trim() === '') return '';
  try {
    return marked.parse(String(md), { async: false }) || '';
  } catch {
    return String(md);
  }
}
function htmlToMd(html) {
  if (html == null) return '';
  const s = String(html).trim();
  if (!s || s === '<br>' || s === '<p></p>' || s === '<p><br></p>' || s === '<div><br></div>') return '';
  try {
    const md = turndownService.turndown(s);
    return (md && md.trim()) ? md : '';
  } catch {
    return '';
  }
}

function SafeLinkMarkdown({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#') || href.startsWith('ipfs://'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  const resolved = href.startsWith('ipfs://')
    ? (GATEWAY || 'https://gateway.pinata.cloud/ipfs/') + href.replace('ipfs://', '')
    : href;
  return <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}
const MD_COMPONENTS = { a: SafeLinkMarkdown };

// ?????????????? Constants ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
const CATEGORIES = [
  { key: 'Dev',      Icon: IconCode,  desc: 'Smart contracts, dApps, tooling' },
  { key: 'Design',   Icon: IconTarget, desc: 'UI/UX, branding, graphics'       },
  { key: 'Content',  Icon: IconNote,   desc: 'Docs, writing, translation'       },
  { key: 'Research', Icon: IconChart,  desc: 'Analysis, audits, reports'        },
  { key: 'Other',    Icon: IconTarget, desc: 'Anything else'                    },
];

const STEPS = [
  { id: 'task',   label: 'Task',   desc: 'What needs to be done'    },
  { id: 'reward', label: 'Reward', desc: 'Payment and deadline'      },
  { id: 'review', label: 'Review', desc: 'Confirm and post'          },
];

const DRAFT_KEY      = addr => `nw_draft_v1_${addr?.toLowerCase() || 'anon'}`;
const DRAFT_STEP_KEY = addr => `nw_draft_step_v1_${addr?.toLowerCase() || 'anon'}`;
const JUST_POSTED_KEY = 'nw_bounty_just_posted';

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

const PRESET_SKILLS = [
  'Solidity', 'React', 'TypeScript', 'JavaScript', 'Rust', 'Python',
  'Smart Contract', 'DeFi', 'NFT', 'Node.js', 'GraphQL', 'Move',
  'UI/UX', 'Figma', 'Branding', 'Illustration', 'Motion Design',
  'Technical Writing', 'Documentation', 'Translation', 'Copywriting',
  'Market Research', 'Tokenomics', 'Security Audit', 'Data Analysis',
];

function normalizeSkill(raw) {
  return String(raw || '')
    .replace(/^[-*•·\s,]+/, '')
    .replace(/[\s,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSkillList(list = []) {
  const seen = new Set();
  const next = [];
  for (const raw of list) {
    const skill = normalizeSkill(raw);
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(skill);
  }
  return next;
}
function extractBountyIdFromReceipt(receipt) {
  try {
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log of receipt?.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name !== 'BountyCreated') continue;
        const raw = parsed?.args?.bountyId ?? parsed?.args?.[0];
        if (raw == null) continue;
        return String(raw);
      } catch {
        // ignore non-factory logs
      }
    }
  } catch {
    // ignore parsing errors
  }
  return '';
}


async function resolveBountyIdAfterPost(receipt, creator) {
  const fromReceipt = extractBountyIdFromReceipt(receipt);
  if (fromReceipt) return fromReceipt;
  if (!creator) return '';

  try {
    const { contract: reg } = await getResolvedRegistryContract();
    if (!reg) return '';

    const ids = await listCreatorBountyIds(reg, creator);
    if (!Array.isArray(ids) || ids.length === 0) return '';

    let maxId = 0n;
    for (const raw of ids) {
      try {
        const n = BigInt(raw);
        if (n > maxId) maxId = n;
      } catch {
        // ignore malformed id entries
      }
    }

    return maxId > 0n ? String(maxId) : '';
  } catch {
    return '';
  }
}
function saveJustPostedHint(payload = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(JUST_POSTED_KEY, JSON.stringify({
      ts: Date.now(),
      bountyId: payload?.bountyId ? String(payload.bountyId) : '',
      title: payload?.title ? String(payload.title) : '',
      category: payload?.category ? String(payload.category).toLowerCase() : '',
      totalReward: payload?.totalReward ? String(payload.totalReward) : '',
      deadline: payload?.deadline ? String(payload.deadline) : '',
      creator: payload?.creator ? String(payload.creator) : '',
      metaCid: payload?.metaCid ? String(payload.metaCid) : '',
      requiresApplication: toBoolSafe(payload?.requiresApplication, false),
    }));
  } catch {
    // ignore sessionStorage errors
  }
}

const INITIAL_FORM = {
  title: '',
  description: '',
  category: 'Dev',
  requirements: [''],     // list: what builder must do
  deliverables: [''],     // list: what builder must submit
  evaluationCriteria: [''], // list: how creator evaluates submissions
  skills: [],           // array of strings
  reward: '',
  winnerCount: '1',
  deadline: '',
  contactInfo: '',
  requiresApplication: false, // V4: curated project flag
};

// ?????????????? Sub-components ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function StepIndicator({ current }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginBottom: 16 }}>
        Step {current + 1} of {STEPS.length}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
      {STEPS.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done
                  ? theme.colors.primary
                  : active ? theme.colors.primaryDim : 'transparent',
                border: `1.5px solid ${done || active ? theme.colors.primary : theme.colors.border.default}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: theme.fonts.mono, fontSize: 11, fontWeight: 600,
                color: done ? '#fff' : active ? theme.colors.primary : theme.colors.text.faint,
                transition: theme.transition,
                flexShrink: 0,
              }}>
                {done ? <IconCheck size={14} color="#fff" strokeWidth={2.5} /> : i + 1}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: theme.fonts.body, fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? theme.colors.text.primary : done ? theme.colors.text.secondary : theme.colors.text.faint,
                  transition: theme.transition, whiteSpace: 'nowrap',
                }}>{s.label}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: done ? theme.colors.primary : theme.colors.border.subtle,
                margin: '0 10px', marginBottom: 22,
                transition: theme.transition,
              }} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function FieldLabel({ children, hint, required }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <label style={{
        fontFamily: theme.fonts.body, fontSize: 13,
        fontWeight: 500, color: theme.colors.text.secondary,
        letterSpacing: '-0.01em',
      }}>
        {children}
        {required && <span style={{ color: theme.colors.primary, marginLeft: 3 }}>*</span>}
      </label>
      {hint && (
        <div style={{
          fontFamily: theme.fonts.body, fontSize: 11.5,
          color: theme.colors.text.faint, marginTop: 2,
        }}>{hint}</div>
      )}
    </div>
  );
}

function SectionCard({ eyebrow, title, hint, children, tone = 'default' }) {
  const isPrimary = tone === 'primary';
  return (
    <div style={{
      padding: 18,
      background: isPrimary ? 'linear-gradient(180deg, rgba(110,84,255,0.08) 0%, rgba(10,10,12,0.96) 100%)' : theme.colors.bg.card,
      border: `1px solid ${isPrimary ? theme.colors.primaryBorder : theme.colors.border.subtle}`,
      borderRadius: theme.radius.xl,
      boxShadow: isPrimary ? `0 20px 60px ${theme.colors.primaryGlow}` : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {(eyebrow || title || hint) && (
        <div>
          {eyebrow && (
            <div style={{
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              color: isPrimary ? theme.colors.primary : theme.colors.text.faint,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              {eyebrow}
            </div>
          )}
          {title && (
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: 17,
              fontWeight: 700,
              color: theme.colors.text.primary,
              letterSpacing: '-0.03em',
              marginBottom: hint ? 4 : 0,
            }}>
              {title}
            </div>
          )}
          {hint && (
            <div style={{
              fontFamily: theme.fonts.body,
              fontSize: 12.5,
              color: theme.colors.text.muted,
              lineHeight: 1.65,
            }}>
              {hint}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function MetaPill({ label, value, accent = false }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: accent ? theme.colors.primaryDim : theme.colors.bg.panel,
      border: `1px solid ${accent ? theme.colors.primaryBorder : theme.colors.border.subtle}`,
      borderRadius: theme.radius.lg,
      minWidth: 110,
    }}>
      <div style={{
        fontFamily: theme.fonts.mono,
        fontSize: 10,
        color: theme.colors.text.faint,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: theme.fonts.body,
        fontSize: 13,
        fontWeight: accent ? 700 : 600,
        color: accent ? theme.colors.primaryLight : theme.colors.text.primary,
        lineHeight: 1.4,
      }}>
        {value}
      </div>
    </div>
  );
}

function FormInput({ label, hint, required, error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <FieldLabel hint={hint} required={required}>{label}</FieldLabel>}
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 14px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md, fontSize: 14,
          fontFamily: theme.fonts.body, outline: 'none',
          boxShadow: focused ? (error ? `0 0 0 3px ${theme.colors.red.dim}` : `0 0 0 3px ${theme.colors.primaryDim}`) : 'none',
          transition: theme.transition, boxSizing: 'border-box',
        }}
        {...props}
      />
      {error && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

function FormTextarea({ label, hint, required, error, minHeight = 120, maxHeight = 420, ...props }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      {label && <FieldLabel hint={hint} required={required}>{label}</FieldLabel>}
      <textarea
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md,
          fontSize: 14,
          fontFamily: theme.fonts.body,
          outline: 'none',
          lineHeight: 1.7,
          resize: 'vertical',
          boxShadow: focused ? (error ? `0 0 0 3px ${theme.colors.red.dim}` : `0 0 0 3px ${theme.colors.primaryDim}`) : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minHeight,
          maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
        }}
        {...props}
      />
      {error && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

// ── WYSIWYG toolbar: execCommand on contentEditable, then sync to Markdown ─────
function WysiwygToolbar({ editorRef, onSync, compact = false }) {
  const exec = (cmd, value = null) => {
    if (editorRef?.current) {
      editorRef.current.focus();
      document.execCommand(cmd, false, value);
      onSync();
    }
  };
  const clearFormat = () => {
    if (editorRef?.current) {
      editorRef.current.focus();
      document.execCommand('removeFormat', false, null);
      document.execCommand('formatBlock', false, 'p');
      onSync();
    }
  };
  const btn = (label, title, onClick) => (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: compact ? '4px 8px' : '6px 10px',
        minWidth: compact ? 28 : 32,
        background: theme.colors.bg.elevated,
        border: `1px solid ${theme.colors.border.subtle}`,
        borderRadius: theme.radius.sm,
        color: theme.colors.text.secondary,
        fontFamily: theme.fonts.body,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: theme.transition,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = theme.colors.primary;
        e.currentTarget.style.color = theme.colors.primary;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = theme.colors.border.subtle;
        e.currentTarget.style.color = theme.colors.text.secondary;
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
      {btn('B', 'Bold', () => exec('bold'))}
      {btn('I', 'Italic', () => exec('italic'))}
      {btn('•', 'Bullet list', () => exec('insertUnorderedList'))}
      {btn('1.', 'Numbered list', () => exec('insertOrderedList'))}
      {btn('H2', 'Heading 2', () => exec('formatBlock', 'h2'))}
      {btn('H3', 'Heading 3', () => exec('formatBlock', 'h3'))}
      {btn('Normal', 'Clear formatting / back to normal text', clearFormat)}
    </div>
  );
}

// Overview: WYSIWYG contentEditable, simpan sebagai Markdown, tanpa kolom Preview
function FormTextareaWithToolbar({ label, hint, required, error, minHeight = 120, maxHeight = 420, value, onChange, placeholder, ...rest }) {
  const [focused, setFocused] = useState(false);
  const editorRef = useRef(null);
  const lastValueRef = useRef(undefined);
  const changeFromEditorRef = useRef(false);

  const syncHtmlToMarkdown = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = htmlToMd(el.innerHTML);
    changeFromEditorRef.current = true;
    onChange({ target: { value: md } });
  }, [onChange]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    syncHtmlToMarkdown();
  }, [syncHtmlToMarkdown]);

  useEffect(() => {
    const v = value == null ? '' : String(value);
    if (changeFromEditorRef.current) {
      lastValueRef.current = v;
      changeFromEditorRef.current = false;
      return;
    }
    if (lastValueRef.current === v) return;
    const el = editorRef.current;
    if (el) {
      el.innerHTML = mdToHtml(v) || '';
      lastValueRef.current = v;
    } else {
      lastValueRef.current = v;
    }
  }, [value]);

  const baseStyle = {
    width: '100%',
    padding: '10px 14px',
    background: theme.colors.bg.input,
    color: theme.colors.text.primary,
    border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
    borderRadius: theme.radius.md,
    fontSize: 14,
    fontFamily: theme.fonts.body,
    outline: 'none',
    lineHeight: 1.7,
    minHeight,
    maxHeight,
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
    boxShadow: focused ? (error ? `0 0 0 3px ${theme.colors.red.dim}` : `0 0 0 3px ${theme.colors.primaryDim}`) : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div>
      {label && <FieldLabel hint={hint} required={required}>{label}</FieldLabel>}
      <WysiwygToolbar editorRef={editorRef} onSync={syncHtmlToMarkdown} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncHtmlToMarkdown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...baseStyle,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />
      <style>{`
        [data-placeholder]:empty::before { content: attr(data-placeholder); color: ${theme.colors.text.faint}; }
        [contenteditable="true"] h2 { font-size: 1.25em; font-weight: 700; margin: 0.6em 0 0.3em; }
        [contenteditable="true"] h3 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.25em; }
        [contenteditable="true"] ul, [contenteditable="true"] ol { margin: 0.5em 0; padding-left: 1.75em; }
        [contenteditable="true"] li { margin: 0.25em 0; padding-left: 0.35em; }
      `}</style>
      {error && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

// Dynamic list editor (requirements / deliverables)
function ListEditor({ label, hint, required, items, onChange, placeholder, maxItems = 8 }) {
  const normalizedItems = items.map((item) => String(item || ''));
  const filledCount = normalizedItems.filter((item) => item.trim()).length;

  const addItem = () => {
    if (normalizedItems.length < maxItems) onChange([...normalizedItems, '']);
  };
  const removeItem = (i) => onChange(normalizedItems.filter((_, idx) => idx !== i));
  const editItem = (i, v) => onChange(normalizedItems.map((x, idx) => idx === i ? v : x));

  const labelWithCounter = label ? `${label} (${filledCount}/${maxItems})` : null;
  return (
    <div>
      {label ? <FieldLabel hint={hint} required={required}>{labelWithCounter}</FieldLabel> : hint ? <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, marginBottom: 8 }}>{hint}</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {normalizedItems.map((item, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              background: theme.colors.bg.panel,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                color: theme.colors.text.faint,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                Item {i + 1}
              </div>
              {normalizedItems.length > 1 && (
                <button
                  onClick={() => removeItem(i)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'transparent',
                    border: `1px solid ${theme.colors.border.subtle}`,
                    borderRadius: theme.radius.md,
                    cursor: 'pointer',
                    color: theme.colors.text.faint,
                    fontFamily: theme.fonts.body,
                    fontSize: 11.5,
                    transition: theme.transition,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = theme.colors.red[500];
                    e.currentTarget.style.color = theme.colors.red[400];
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = theme.colors.border.subtle;
                    e.currentTarget.style.color = theme.colors.text.faint;
                  }}
                  title="Remove item"
                >
                  <IconX size={12} color="currentColor" /> Remove
                </button>
              )}
            </div>
            <ItemTextareaWithToolbar
              value={item}
              placeholder={placeholder}
              onChange={(v) => editItem(i, v)}
            />
          </div>
        ))}
        {normalizedItems.length < maxItems && (
          <button
            onClick={addItem}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'none', border: `1px dashed ${theme.colors.border.default}`,
              borderRadius: theme.radius.lg, padding: '12px 14px',
              color: theme.colors.text.faint, fontSize: 12.5,
              fontFamily: theme.fonts.body, cursor: 'pointer',
              transition: theme.transition, marginTop: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.color = theme.colors.text.faint; }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add another item
          </button>
        )}
      </div>
    </div>
  );
}

function ItemTextarea({ value, placeholder, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        minHeight: 88,
        padding: '10px 12px',
        background: theme.colors.bg.input,
        color: theme.colors.text.primary,
        border: `1px solid ${focused ? theme.colors.primary : theme.colors.border.default}`,
        borderRadius: theme.radius.md, fontSize: 13.5,
        fontFamily: theme.fonts.body, outline: 'none',
        resize: 'vertical',
        lineHeight: 1.65,
        boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
        transition: theme.transition, boxSizing: 'border-box',
      }}
    />
  );
}

// List item: WYSIWYG contentEditable (requirements / deliverables / evaluation criteria), tanpa Preview
function ItemTextareaWithToolbar({ value, placeholder, onChange }) {
  const [focused, setFocused] = useState(false);
  const editorRef = useRef(null);
  const lastValueRef = useRef(undefined);
  const changeFromEditorRef = useRef(false);

  const syncHtmlToMarkdown = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = htmlToMd(el.innerHTML);
    changeFromEditorRef.current = true;
    onChange(md);
  }, [onChange]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    syncHtmlToMarkdown();
  }, [syncHtmlToMarkdown]);

  useEffect(() => {
    const v = value == null ? '' : String(value);
    if (changeFromEditorRef.current) {
      lastValueRef.current = v;
      changeFromEditorRef.current = false;
      return;
    }
    if (lastValueRef.current === v) return;
    const el = editorRef.current;
    if (el) {
      el.innerHTML = mdToHtml(v) || '';
      lastValueRef.current = v;
    } else {
      lastValueRef.current = v;
    }
  }, [value]);

  return (
    <div>
      <WysiwygToolbar editorRef={editorRef} onSync={syncHtmlToMarkdown} compact />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncHtmlToMarkdown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          minHeight: 88,
          padding: '10px 12px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md,
          fontSize: 13.5,
          fontFamily: theme.fonts.body,
          outline: 'none',
          lineHeight: 1.65,
          boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
          transition: theme.transition,
          boxSizing: 'border-box',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />
    </div>
  );
}

function TagInput({ label, hint, value = [], onChange, max = 10 }) {
  const [inputVal, setInputVal] = useState('');
  const [focused,  setFocused]  = useState(false);
  const normalizedValue = normalizeSkillList(value);
  const suggestions = PRESET_SKILLS
    .filter((preset) => !normalizedValue.some((item) => item.toLowerCase() === preset.toLowerCase()))
    .slice(0, 12);

  const addTag = (raw) => {
    const incoming = normalizeSkillList(String(raw || '').split(/[\n,;]+/));
    if (incoming.length === 0) { setInputVal(''); return; }
    const next = normalizeSkillList([...normalizedValue, ...incoming]).slice(0, max);
    onChange(next);
    setInputVal('');
  };
  const removeTag = (i) => onChange(normalizedValue.filter((_, idx) => idx !== i));
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); }
    if (e.key === 'Backspace' && !inputVal && normalizedValue.length > 0) removeTag(normalizedValue.length - 1);
  };

  return (
    <div>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>
          {normalizedValue.length} / {max} skills selected
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint }}>
          Custom skills supported. Separate with Enter, comma, or semicolon.
        </div>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: '10px 12px', minHeight: 52,
        background: theme.colors.bg.input,
        border: `1px solid ${focused ? theme.colors.primary : theme.colors.border.default}`,
        borderRadius: theme.radius.md,
        boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
        transition: theme.transition, cursor: 'text',
      }}
        onClick={() => document.getElementById('tag-input-field')?.focus()}
      >
        {normalizedValue.map((tag, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px 4px 10px',
            background: theme.colors.primaryDim,
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 500,
            color: theme.colors.primaryLight,
          }}>
            {tag}
            <button onClick={() => removeTag(i)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: theme.colors.primaryLight, opacity: 0.6,
              fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            ><IconX size={12} color="currentColor" /></button>
          </span>
        ))}
        {normalizedValue.length < max && (
          <input
            id="tag-input-field"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { addTag(inputVal); setFocused(false); }}
            onFocus={() => setFocused(true)}
            placeholder={normalizedValue.length === 0 ? 'Type a skill and press Enter...' : ''}
            style={{
              flex: 1, minWidth: 120, border: 'none', outline: 'none',
              background: 'transparent', color: theme.colors.text.primary,
              fontFamily: theme.fonts.body, fontSize: 13.5,
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {suggestions.map(p => (
          <button key={p} onClick={() => addTag(p)} style={{
            padding: '5px 10px',
            background: theme.colors.bg.elevated,
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.body, fontSize: 11.5,
            color: theme.colors.text.muted, cursor: 'pointer',
            transition: theme.transition,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.color = theme.colors.text.muted; }}
          >+ {p}</button>
        ))}
      </div>
      <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 6, lineHeight: 1.6 }}>
        Preset tags are only suggestions. You can paste or type any role, tool, framework, or domain skill needed for this bounty.
      </div>
    </div>
  );
}

function CollapsibleTip({ label, content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      padding: '12px 14px',
      background: theme.colors.bg.panel,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.lg,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: 0, textAlign: 'left',
        }}
      >
        {label}
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: theme.transition }}>
          <IconChevronRight size={14} color={theme.colors.text.faint} style={{ verticalAlign: 'middle' }} />
        </span>
      </button>
      {open && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.muted, lineHeight: 1.7, marginTop: 10 }}>
          {content}
        </div>
      )}
    </div>
  );
}

function CollapsibleListEditor({ label, hint, items, onChange, placeholder, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const trimmed = items.map((x) => String(x || '').trim()).filter(Boolean);
  const count = trimmed.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          marginBottom: open ? 10 : 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500, color: theme.colors.text.secondary, textAlign: 'left',
        }}
      >
        <span>{label} {count > 0 && `(${count})`}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: theme.transition }}>
          <IconChevronRight size={14} color={theme.colors.text.muted} />
        </span>
      </button>
      {hint && !open && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, marginTop: 2 }}>{hint}</div>
      )}
      {open && (
        <ListEditor
          label=""
          hint={hint}
          required={false}
          items={items}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function ReviewAccordionCard({ eyebrow, title, hint, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      padding: 18,
      background: theme.colors.bg.card,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.xl,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          {eyebrow && (
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{eyebrow}</div>
          )}
          <div style={{ fontFamily: theme.fonts.body, fontSize: 15, fontWeight: 600, color: theme.colors.text.primary }}>{title}</div>
          {hint && (
            <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 2 }}>{hint}</div>
          )}
        </div>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: theme.transition, flexShrink: 0 }}>
          <IconChevronRight size={18} color={theme.colors.text.muted} />
        </span>
      </button>
      {open && <div style={{ paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

function ReviewRow({ label, value, mono, accent, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '11px 18px', gap: 20,
      borderBottom: last ? 'none' : `1px solid ${theme.colors.border.faint}`,
    }}>
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 10,
        color: theme.colors.text.faint, textTransform: 'uppercase',
        letterSpacing: '0.06em', flexShrink: 0, paddingTop: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: mono ? theme.fonts.mono : theme.fonts.body,
        fontSize: mono ? 12 : 13,
        color: accent ? theme.colors.primary : theme.colors.text.primary,
        fontWeight: accent ? 600 : 400,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

// ?????????????? Main page ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
export default function PostBountyPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [creatorStake, setCreatorStake] = useState(null); // fetched from contract
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [factoryCaps, setFactoryCaps] = useState(null);
  const formRef    = useRef(null);
  const saveTimerRef = useRef(null);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (address) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try { localStorage.setItem(DRAFT_KEY(address), JSON.stringify(next)); } catch {}
        }, 500);
      }
      return next;
    });
  };

  const isLegacyOpenOnly = !!factoryCaps?.openOnlyLegacy;
  const applicationFlowUnsupported = isLegacyOpenOnly || factoryCaps?.supportsApplications === false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const caps = await getFactoryCapabilities();
        if (!cancelled) setFactoryCaps(caps);
      } catch {
        if (!cancelled) setFactoryCaps(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!applicationFlowUnsupported) return;
    setForm((prev) => (
      prev.requiresApplication
        ? { ...prev, requiresApplication: false }
        : prev
    ));
  }, [applicationFlowUnsupported]);

  // Fetch creator stake estimate when reward changes
  useEffect(() => {
    if (!form.reward || isNaN(parseFloat(form.reward))) { setCreatorStake(null); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!ADDRESSES.factory) return;
        // Use a read-only call - no wallet needed
        const { ethers: e } = await import('ethers');
        const { getReadContract } = await import('../utils/ethers');
        const factory = getReadContract(ADDRESSES.factory, FACTORY_ABI);
        const rewardWei = e.parseEther(form.reward);

        const stakeFromGetter = await factory.getCreatorStake(rewardWei).catch(() => null);
        if (stakeFromGetter != null) {
          if (!cancelled) setCreatorStake(stakeFromGetter);
          return;
        }

        const [bps, min] = await Promise.all([
          factory.CREATOR_STAKE_BPS().catch(() => 300n),
          factory.MIN_CREATOR_STAKE().catch(() => e.parseEther('0.01')),
        ]);
        if (cancelled) return;
        const calc = rewardWei * BigInt(bps) / 10000n;
        const stake = calc > min ? calc : min;
        setCreatorStake(stake);
      } catch {
        setCreatorStake(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.reward]);

  const totalLocked = (() => {
    if (!form.reward || isNaN(parseFloat(form.reward))) return null;
    try {
      const rewardWei = ethers.parseEther(form.reward);
      const stake = creatorStake || (rewardWei * 300n / 10000n);
      return rewardWei + stake;
    } catch { return null; }
  })();
  const trimmedRequirements = form.requirements.map((item) => String(item || '').trim()).filter(Boolean);
  const trimmedDeliverables = form.deliverables.map((item) => String(item || '').trim()).filter(Boolean);
  const trimmedEvaluationCriteria = form.evaluationCriteria.map((item) => String(item || '').trim()).filter(Boolean);
  const normalizedSkills = normalizeSkillList(form.skills);
  const overviewLength = form.description.trim().length;
  const deadlineLabel = form.deadline
    ? new Date(form.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '-';
  const modeLabel = applicationFlowUnsupported
    ? 'Open (direct submit)'
    : (form.requiresApplication ? 'Curated (apply-first)' : 'Open (direct submit)');
  const totalLockedDisplay = totalLocked
    ? (Number(totalLocked) / 1e18).toFixed(4)
    : (form.reward && !isNaN(parseFloat(form.reward)) ? (parseFloat(form.reward) * 1.05).toFixed(4) : '-');
  const creatorStakeDisplay = creatorStake
    ? (Number(creatorStake) / 1e18).toFixed(4)
    : (form.reward && !isNaN(parseFloat(form.reward)) ? (parseFloat(form.reward) * 0.05).toFixed(4) : '-');

  // Validation
  const validateStep0 = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.length > 100) e.title = 'Title max 100 characters (contract limit)';
    if (!form.description.trim()) e.description = 'Description is required';
    else if (form.description.length < 30) e.description = 'At least 30 characters - describe the task clearly';
    const reqs = form.requirements.filter(r => r.trim());
    if (reqs.length === 0) e.requirements = 'Add at least one requirement';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    const r = parseFloat(form.reward);
    if (!form.reward || isNaN(r) || r <= 0) e.reward = 'Enter a valid reward amount (e.g. 1.5)';
    if (r > 0 && r < 0.001) e.reward = 'Minimum reward is 0.001 MON';
    if (!form.deadline) e.deadline = 'Deadline is required';
    else {
      const dl = new Date(form.deadline).getTime();
      if (dl <= Date.now() + 3600_000) e.deadline = 'Deadline must be at least 1 hour from now';
    }
    const wc = parseInt(form.winnerCount);
    if (isNaN(wc) || wc < 1 || wc > 3) e.winnerCount = 'Winners must be 1, 2, or 3';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (step === 1 && !validateStep1()) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    if (address) try { localStorage.setItem(DRAFT_STEP_KEY(address), String(nextStep)); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    const prevStep = step - 1;
    setStep(prevStep);
    if (address) try { localStorage.setItem(DRAFT_STEP_KEY(address), String(prevStep)); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!walletClient || !address) { toast('Connect your wallet first.', 'error'); return; }
    if (!ADDRESSES.factory) { toast('Contract address not configured.', 'error'); return; }

    setLoading(true);
    try {
      toast('Uploading metadata to IPFS...', 'info');

      const skills = Array.isArray(form.skills)
        ? form.skills
        : (form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : []);
      const requirements = form.requirements.filter(r => r.trim());
      const deliverables = form.deliverables.filter(d => d.trim());
      const evaluationCriteria = form.evaluationCriteria.filter(c => c.trim());

      const meta = buildBountyMeta({
        title:           form.title.trim(),
        fullDescription: form.description.trim(),
        requirements,
        evaluationCriteria,
        skills,
        contactInfo: form.contactInfo.trim(),
        category:    form.category,
      });
      const ipfsHash = await uploadJSON(meta, `bounty-${Date.now()}`);

      const rewardWei    = ethers.parseEther(form.reward);
      const deadlineTs   = BigInt(Math.floor(new Date(form.deadline).getTime() / 1000));
      const winnerCount  = parseInt(form.winnerCount) || 1;

      // Equal split for multi-winner
      const baseWeight   = Math.floor(100 / winnerCount);
      const prizeWeights = Array(winnerCount).fill(baseWeight);
      prizeWeights[0]   += 100 - baseWeight * winnerCount; // remainder to first

      toast('Confirm transaction in your wallet...', 'info');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);

      const CREATE_BOUNTY_V4_SIG = 'createBounty(string,string,string,uint8,address,uint256,uint8,uint8[],uint256,bool)';

      const runtimeCaps = await getFactoryCapabilities(true);
      if (runtimeCaps?.supportsCreateV4 === false) {
        throw new Error('Active deployment is not V4-compatible (createBounty v4 missing).');
      }
      if (toBoolSafe(form.requiresApplication, false) && runtimeCaps?.supportsApplications === false) {
        throw new Error('Active deployment does not support curated/apply flow.');
      }

      const effectiveRequiresApplication = toBoolSafe(form.requiresApplication, false);

      const stakeValueMap = new Map();
      const addStakeValue = (label, stakeRaw) => {
        try {
          const stake = BigInt(stakeRaw);
          if (stake <= 0n) return;
          if (stake > ethers.parseEther('200')) return;
          const total = rewardWei + stake;
          stakeValueMap.set(total.toString(), { label, value: total });
        } catch {
          // ignore invalid candidate
        }
      };

      if (creatorStake != null) addStakeValue('ui-preview', creatorStake);

      try {
        const stakeFromGetter = await factory.getCreatorStake(rewardWei);
        addStakeValue('getter', stakeFromGetter);
      } catch {
        // getter not available on some deployments
      }

      try {
        const [creatorStakeBps, minCreatorStake, maxCreatorStake] = await Promise.all([
          factory.CREATOR_STAKE_BPS(),
          factory.MIN_CREATOR_STAKE(),
          factory.MAX_CREATOR_STAKE(),
        ]);
        const calcStake = rewardWei * BigInt(creatorStakeBps) / 10000n;
        let stake = calcStake < minCreatorStake ? minCreatorStake : calcStake;
        if (stake > maxCreatorStake) stake = maxCreatorStake;
        addStakeValue('constants', stake);
      } catch {
        // constants not available on some deployments
      }

      const heuristicMinStake = ethers.parseEther('0.01');
      for (const bps of [100n, 200n, 250n, 300n, 400n, 500n, 1000n]) {
        let stake = (rewardWei * bps) / 10000n;
        if (stake < heuristicMinStake) stake = heuristicMinStake;
        addStakeValue(`heuristic-${bps.toString()}bps`, stake);
      }
      addStakeValue('min-only', heuristicMinStake);
      addStakeValue('min-0.005', ethers.parseEther('0.005'));
      addStakeValue('min-0.05', ethers.parseEther('0.05'));
      addStakeValue('min-0.1', ethers.parseEther('0.1'));

      const titleForContract = form.title.trim().slice(0, 100);
      const commonArgs = [
        ipfsHash,
        titleForContract,
        form.category.toLowerCase(),
        0,
        ethers.ZeroAddress,
        rewardWei,
        winnerCount,
        prizeWeights,
        deadlineTs,
      ];

      const valueCandidates = new Map();
      const addValueCandidate = (label, valueRaw) => {
        try {
          const value = BigInt(valueRaw);
          if (value < 0n) return;
          const key = value.toString();
          if (!valueCandidates.has(key)) valueCandidates.set(key, { label, value });
        } catch {
          // ignore malformed value
        }
      };

      for (const stakeCandidate of stakeValueMap.values()) {
        addValueCandidate(`stake-${stakeCandidate.label}`, stakeCandidate.value);
      }
      addValueCandidate('reward-only', rewardWei);

      const candidates = [];
      for (const entry of valueCandidates.values()) {
        candidates.push({
          sig: CREATE_BOUNTY_V4_SIG,
          args: [...commonArgs, effectiveRequiresApplication],
          value: entry.value,
          mode: `v4-${entry.label}`,
        });
      }

      if (candidates.length === 0) {
        throw new Error('No V4 createBounty candidate generated.');
      }

      let selected = null;
      let lastEstimateError = null;
      for (const c of candidates) {
        const fn = factory[c.sig];
        if (typeof fn !== 'function') continue;
        try {
          await fn.estimateGas(...c.args, { value: c.value });
          selected = c;
          break;
        } catch (e) {
          lastEstimateError = e;
        }
      }

      if (!selected) {
        throw lastEstimateError || new Error('No V4 createBounty path accepted by active deployment.');
      }

      if (import.meta.env.DEV) {
        console.debug('[PostBounty] selected create candidate', {
          mode: selected.mode,
          valueWei: selected.value.toString(),
        });
      }

      seedFactoryCapabilities({
        supportsCreateV4: true,
        supportsCreateV3: false,
        supportsApplications: runtimeCaps?.supportsApplications !== false,
        openOnlyLegacy: false,
        source: 'post-submit',
      });

      const tx = await factory[selected.sig](...selected.args, { value: selected.value });
      toast('Transaction submitted, waiting for confirmation...', 'info');
      const receipt = await tx.wait();
      const bountyId = await resolveBountyIdAfterPost(receipt, address);
      saveJustPostedHint({
        bountyId,
        title: titleForContract,
        category: form.category,
        totalReward: rewardWei.toString(),
        deadline: deadlineTs.toString(),
        creator: address,
        metaCid: ipfsHash,
        requiresApplication: effectiveRequiresApplication,
      });
      clearRegistryResolutionCache();
      invalidateBountiesCache();
      requestNotificationRefresh();
      toast('Bounty posted! Funds are now locked on-chain.', 'success');
      setDone(true);
    } catch (err) {
      console.error('[PostBounty]', err);
      const rawMsg = err?.reason || err?.shortMessage || err?.message || 'Unknown error';
      const msg = /no data present|require\\(false\\)|missing revert data|No V4 createBounty path/i.test(String(rawMsg))
        ? 'Contract reverted with no message. Check: (1) Title max 100 characters, (2) reward and stake match contract limits, (3) V4 deployment address is correct.'
        : rawMsg;
      toast('Failed: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDraft = () => {
    try {
      const saved     = localStorage.getItem(DRAFT_KEY(address));
      const savedStep = localStorage.getItem(DRAFT_STEP_KEY(address));
      if (saved) { const parsed = JSON.parse(saved); setForm({ ...INITIAL_FORM, ...parsed, requiresApplication: toBoolSafe(parsed?.requiresApplication, false) }); }
      if (savedStep) setStep(parseInt(savedStep) || 0);
    } catch {}
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY(address));
      localStorage.removeItem(DRAFT_STEP_KEY(address));
    } catch {}
    setShowDraftBanner(false);
  };

  // Check for saved draft on mount
  useEffect(() => {
    if (!address) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY(address));
      if (saved && JSON.parse(saved)) setShowDraftBanner(true);
    } catch {}
  }, [address]);

  // Clear draft on successful submit
  useEffect(() => {
    if (done && address) {
      try {
        localStorage.removeItem(DRAFT_KEY(address));
        localStorage.removeItem(DRAFT_STEP_KEY(address));
      } catch {}
    }
  }, [done, address]);

  const resetForm = () => {
    setDone(false); setStep(0);
    setForm(INITIAL_FORM); setErrors({});
    setCreatorStake(null);
    if (address) {
      try {
        localStorage.removeItem(DRAFT_KEY(address));
        localStorage.removeItem(DRAFT_STEP_KEY(address));
      } catch {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ?????????????? Not connected ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 24,
        }}>O</div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 22, letterSpacing: '-0.03em', color: theme.colors.text.primary, marginBottom: 10 }}>Connect your wallet</h2>
        <p style={{ fontSize: 13.5, color: theme.colors.text.muted, fontWeight: 300, lineHeight: 1.7 }}>
          You need a connected wallet to post a bounty and lock reward funds on-chain.
        </p>
      </div>
    );
  }

  // ?????????????? Done ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`,
          boxShadow: `0 0 48px ${theme.colors.primaryGlow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 28px', fontSize: 28, color: theme.colors.primary,
        }}>O</div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', color: theme.colors.text.primary, marginBottom: 10 }}>Bounty Posted!</h2>
        <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, marginBottom: 32, lineHeight: 1.7 }}>
          Your bounty is live on Monad. Funds are locked in the smart contract - builders can start submitting work.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => { window.location.hash = '#/bounties'; }}>
            Browse Bounties
          </Button>
          <Button variant="secondary" onClick={resetForm}>Post Another</Button>
        </div>
      </div>
    );
  }

  // ?????????????? Form ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  return (
    <div
      ref={formRef}
      style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(32px,5vw,56px) clamp(16px,4vw,40px)' }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div className="page-eyebrow">Post a Bounty</div>
        <h1 style={{
          fontFamily: theme.fonts.body, fontWeight: 800,
          fontSize: 'clamp(26px,4vw,38px)', letterSpacing: '-0.04em',
          color: theme.colors.text.primary, marginBottom: 6,
        }}>
          {step === 0 ? 'Describe the task' : step === 1 ? 'Set reward & deadline' : 'Review & confirm'}
        </h1>
        <p style={{ fontSize: 13.5, color: theme.colors.text.muted, fontWeight: 300 }}>
          {step === 0 && 'Help builders understand exactly what you need.'}
          {step === 1 && 'Define the reward, number of winners, and deadline.'}
          {step === 2 && 'Review everything before locking funds on-chain.'}
        </p>
      </div>

      {/* Draft banner */}
      {showDraftBanner && (
        <div style={{
          padding: '14px 18px', marginBottom: 24,
          background: theme.colors.primaryDim,
          border: `1px solid ${theme.colors.primaryBorder}`,
          borderRadius: theme.radius.lg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13.5, color: theme.colors.primaryLight, marginBottom: 2 }}>Draft saved</div>
            <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>Continue from where you left off?</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleRestoreDraft} style={{
              padding: '7px 16px', borderRadius: theme.radius.md,
              background: theme.colors.primary, color: '#fff',
              border: 'none', fontFamily: theme.fonts.body,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Continue Draft</button>
            <button onClick={handleDiscardDraft} style={{
              padding: '7px 16px', borderRadius: theme.radius.md,
              background: 'transparent', color: theme.colors.text.muted,
              border: `1px solid ${theme.colors.border.default}`,
              fontFamily: theme.fonts.body, fontSize: 12, cursor: 'pointer',
            }}>Start Fresh</button>
          </div>
        </div>
      )}

      <StepIndicator current={step} />

      <style>{`
        @keyframes postBountyStepFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .post-bounty-step-content { animation: postBountyStepFadeIn 0.25s ease-out forwards; }
      `}</style>
      <div key={step} className="post-bounty-step-content">
      {/* ?????????????? Step 0: Task — Single column, Category first, progressive disclosure ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SectionCard
            eyebrow="Step 1 of 3"
            title="Define the bounty clearly"
            hint="A sharp brief attracts stronger builders, reduces review friction, and makes your outcome easier to judge."
            tone="primary"
          >
            {/* MetaPill summary — tampil setelah ada input (progress feedback) */}
            {(form.title.trim() || form.description.trim() || trimmedRequirements.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <MetaPill label="Category" value={form.category || 'General'} accent />
                <MetaPill label="Overview" value={`${overviewLength} chars`} />
                <MetaPill label="Requirements" value={`${trimmedRequirements.length} items`} />
                <MetaPill label="Skills" value={normalizedSkills.length > 0 ? `${normalizedSkills.length} tagged` : 'Optional'} />
              </div>
            )}

            {/* 1. Category first (familiarity) */}
            <div>
              <FieldLabel hint="Choose the lane that best matches the core work.">Category</FieldLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                {CATEGORIES.map(c => {
                  const active = form.category === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => set('category', c.key)}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                        color: active ? theme.colors.primaryLight : theme.colors.text.secondary,
                        border: `1px solid ${active ? theme.colors.primary : theme.colors.border.subtle}`,
                        borderRadius: theme.radius.lg,
                        cursor: 'pointer',
                        transition: theme.transition,
                        boxShadow: active ? `0 0 0 1px ${theme.colors.primary}` : 'none',
                        minHeight: 44,
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.borderColor = theme.colors.border.default;
                          e.currentTarget.style.background = theme.colors.bg.hover;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.borderColor = theme.colors.border.subtle;
                          e.currentTarget.style.background = theme.colors.bg.elevated;
                        }
                      }}
                    >
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <c.Icon size={18} color={active ? theme.colors.primary : theme.colors.text.muted} />
                        {active && (
                          <span style={{
                            fontFamily: theme.fonts.mono,
                            fontSize: 10,
                            color: theme.colors.primary,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}>
                            Selected
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{c.key}</div>
                      <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: active ? theme.colors.text.muted : theme.colors.text.faint, lineHeight: 1.5 }}>{c.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Title */}
            <FormInput
              label="Title" required
              hint="Keep it clear and outcome-focused. Max 100 characters because this also lands on-chain."
              placeholder="e.g. Build a Monad DEX aggregator UI"
              maxLength={100}
              value={form.title}
              onChange={e => {
                set('title', e.target.value);
                if (errors.title) {
                  const v = e.target.value.trim();
                  if (v && v.length <= 100) setErrors(prev => { const n = { ...prev }; delete n.title; return n; });
                }
              }}
              error={errors.title}
            />

            {/* 3. Briefing note — collapsible */}
            <CollapsibleTip
              label="Tips for a strong brief"
              content={'Explain the outcome, technical context, constraints, dependencies, and what "done" looks like. Builders should understand the scope before they message you.'}
              defaultOpen={false}
            />

            {/* 4. Overview — supports Markdown (bold, italic, bullets, headings, code) */}
            <FormTextareaWithToolbar
              label="Overview" required
              hint="Use this like a mini-spec. Toolbar: bold, italic, bullets, headings, code — hasil format langsung tampil di kolom ini."
              placeholder="Describe the problem, the product context, the target outcome, technical constraints, dependencies, and anything builders must understand before they start."
              value={form.description}
              onChange={e => {
                set('description', e.target.value);
                if (errors.description && e.target.value.trim().length >= 30) {
                  setErrors(prev => { const n = { ...prev }; delete n.description; return n; });
                }
              }}
              error={errors.description}
              minHeight={200}
              maxHeight={560}
            />
          </SectionCard>

          {/* 5. Requirements — single column */}
          <SectionCard
            eyebrow="Execution"
            title="Builder checklist"
            hint="Break the work into concrete, reviewable items. Each line should help a builder scope effort quickly."
          >
            <div>
<ListEditor
                  label="Requirements" required
                  hint="Core tasks the builder must complete."
                  items={form.requirements}
                  onChange={v => {
                    set('requirements', v);
                    if (errors.requirements && v.some(r => String(r || '').trim())) {
                      setErrors(prev => { const n = { ...prev }; delete n.requirements; return n; });
                    }
                  }}
                placeholder="e.g. Implement ERC-20 token swap using Uniswap V3"
              />
              {errors.requirements && (
                <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{errors.requirements}</div>
              )}
            </div>
          </SectionCard>

          {/* 6. Deliverables + Evaluation Criteria — single column */}
          <SectionCard
            eyebrow="Review quality"
            title="Submission expectations"
            hint="Tell builders what to deliver and how their work will be judged."
          >
            <ListEditor
              label="Deliverables"
              hint="Artifacts the builder must submit as proof of work."
              items={form.deliverables}
              onChange={v => set('deliverables', v)}
              placeholder="e.g. GitHub repo with tests, Loom walkthrough video"
            />

            {/* Evaluation Criteria — collapsible, default collapsed */}
            <CollapsibleListEditor
              label="Evaluation Criteria"
              hint="Optional scoring rubric to help builders optimize quality before they submit."
              items={form.evaluationCriteria}
              onChange={v => set('evaluationCriteria', v)}
              placeholder="e.g. Functionality and correctness (40%)"
              defaultOpen={false}
            />
          </SectionCard>

          {/* 7. Skills — last */}
          <SectionCard
            eyebrow="Talent fit"
            title="Required skills"
            hint="Presets are suggestions only. Add custom skills freely when the work is specialized."
          >
            <TagInput
              label="Required Skills"
              hint="Helps builders self-select before applying or submitting."
              value={form.skills}
              onChange={v => set('skills', v)}
            />
          </SectionCard>
        </div>
      )}

      {/* ?????????????? Step 1: Reward ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Reward */}
          <div className="reward-amount-field">
            <FieldLabel required hint="Reward paid to the winner(s). Denominated in MON.">Reward Amount</FieldLabel>
            <div style={{ position: 'relative' }}>
              <FormInput
                placeholder="e.g. 2.5"
                type="number" min="0.001" step="0.1" inputMode="decimal"
                value={form.reward}
                onChange={e => {
                  set('reward', e.target.value);
                  const r = parseFloat(e.target.value);
                  if (errors.reward && r > 0 && !isNaN(r) && r >= 0.001) {
                    setErrors(prev => { const n = { ...prev }; delete n.reward; return n; });
                  }
                }}
                error={errors.reward}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%',
                transform: `translateY(${errors.reward ? '-60%' : '-50%'})`,
                fontFamily: theme.fonts.mono, fontSize: 12,
                color: theme.colors.text.muted, pointerEvents: 'none',
              }}>MON</span>
            </div>

            {/* Cost breakdown */}
            {form.reward && !isNaN(parseFloat(form.reward)) && parseFloat(form.reward) > 0 && (
              <div style={{
                marginTop: 10, padding: '12px 14px',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.md,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reward</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11.5, color: theme.colors.text.secondary }}>{parseFloat(form.reward).toFixed(4)} MON</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${theme.colors.border.faint}` }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Stake (~3%, max 50 MON)</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11.5, color: theme.colors.text.muted }}>
                    {creatorStake
                      ? (Number(creatorStake) / 1e18).toFixed(4)
                      : Math.min(parseFloat(form.reward) * 0.03, 50).toFixed(4)
                    } MON
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Required</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.primary, fontWeight: 600 }}>
                    {totalLocked
                      ? (Number(totalLocked) / 1e18).toFixed(4)
                      : (parseFloat(form.reward) + Math.min(parseFloat(form.reward) * 0.03, 50)).toFixed(4)
                    } MON
                  </span>
                </div>
                <div style={{ marginTop: 8, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, lineHeight: 1.5 }}>
                  Creator stake is returned when the bounty completes. If abandoned, it goes to the protocol.
                </div>
              </div>
            )}
          </div>

          {/* Number of Winners */}
          <div>
            <FieldLabel hint="Up to 3 winners can be rewarded. Reward splits equally.">Number of Winners</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1', '2', '3'].map(n => {
                const active = form.winnerCount === n;
                return (
                  <button
                    key={n}
                    onClick={() => set('winnerCount', n)}
                    style={{
                      width: 56, height: 48,
                      background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                      color: active ? theme.colors.primary : theme.colors.text.secondary,
                      border: `1.5px solid ${active ? theme.colors.primary : theme.colors.border.subtle}`,
                      borderRadius: theme.radius.md,
                      fontFamily: theme.fonts.mono, fontSize: 18, fontWeight: 600,
                      cursor: 'pointer', transition: theme.transition,
                    }}
                  >{n}</button>
                );
              })}
            </div>
            {form.winnerCount !== '1' && form.reward && !isNaN(parseFloat(form.reward)) && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, marginTop: 6 }}>
                Each winner receives ~{(parseFloat(form.reward) / parseInt(form.winnerCount)).toFixed(4)} MON
              </div>
            )}
          </div>

          {/* Deadline - split date + time, with quick presets */}
          <div>
            <FieldLabel required hint="Builders have until this date to submit work.">Submission Deadline</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(() => {
                const base = new Date(Date.now() + 3600_000);
                const presets = [
                  { label: '1 week', days: 7 },
                  { label: '2 weeks', days: 14 },
                  { label: '1 month', days: 30 },
                ];
                return presets.map(({ label, days }) => {
                  const d = new Date(base);
                  d.setDate(d.getDate() + days);
                  d.setHours(12, 0, 0, 0);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const dateStr = `${y}-${m}-${day}`;
                  const active = form.deadline && form.deadline.startsWith(dateStr);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        set('deadline', `${dateStr}T12:00:00`);
                        if (errors.deadline) setErrors(prev => { const n = { ...prev }; delete n.deadline; return n; });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: theme.radius.md,
                        border: `1px solid ${active ? theme.colors.primary : theme.colors.border.subtle}`,
                        background: active ? theme.colors.primaryDim : 'transparent',
                        color: active ? theme.colors.primary : theme.colors.text.muted,
                        fontSize: 12,
                        fontFamily: theme.fonts.body,
                        cursor: 'pointer',
                        transition: theme.transition,
                      }}
                    >
                      {label}
                    </button>
                  );
                });
              })()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  type="date"
                  value={form.deadline ? form.deadline.slice(0, 10) : ''}
                  min={new Date(Date.now() + 3600_000).toISOString().slice(0, 10)}
                  onChange={e => {
                    const d = e.target.value;
                    const t = form.deadline ? form.deadline.slice(11, 16) : '12:00';
                    set('deadline', d && t ? `${d}T${t}:00` : d || '');
                    if (errors.deadline && d) setErrors(prev => { const n = { ...prev }; delete n.deadline; return n; });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: theme.colors.bg.input, color: theme.colors.text.primary,
                    border: `1px solid ${errors.deadline ? theme.colors.red[500] : theme.colors.border.default}`,
                    borderRadius: theme.radius.md, fontSize: 14,
                    fontFamily: theme.fonts.body, outline: 'none',
                    boxSizing: 'border-box', colorScheme: 'dark',
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Time</label>
                <input
                  type="time"
                  value={form.deadline ? form.deadline.slice(11, 16) : ''}
                  onChange={e => {
                    const t = e.target.value;
                    const d = form.deadline ? form.deadline.slice(0, 10) : new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
                    set('deadline', d && t ? `${d}T${t}:00` : (form.deadline?.slice(0, 10) || ''));
                    if (errors.deadline && t) setErrors(prev => { const n = { ...prev }; delete n.deadline; return n; });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: theme.colors.bg.input, color: theme.colors.text.primary,
                    border: `1px solid ${errors.deadline ? theme.colors.red[500] : theme.colors.border.default}`,
                    borderRadius: theme.radius.md, fontSize: 14,
                    fontFamily: theme.fonts.body, outline: 'none',
                    boxSizing: 'border-box', colorScheme: 'dark',
                  }}
                />
              </div>
            </div>
            {form.deadline && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconChevronRight size={12} color={theme.colors.text.muted} /> {new Date(form.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
            {errors.deadline && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{errors.deadline}</div>
            )}
          </div>

          {/* Contact */}
          <FormInput
            label="Contact (optional)"
            hint="Where builders can reach you for questions."
            placeholder="@telegram_handle or discord username"
            value={form.contactInfo}
            onChange={e => set('contactInfo', e.target.value)}
          />

          {/* V4: Bounty type - Open or Curated */}
          <div>
            <FieldLabel hint="Open bounty: anyone with a username can submit. Curated project: builders apply first, you approve who can submit.">
              Submission Mode
            </FieldLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { val: false, Icon: IconBounties, label: 'Open Bounty', desc: 'Any registered builder can submit directly.' },
                ...(!applicationFlowUnsupported
                  ? [{ val: true, Icon: IconTarget, label: 'Curated Project', desc: 'Builders apply first; you choose who proceeds.' }]
                  : []),
              ].map(opt => {
                const active = form.requiresApplication === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    onClick={() => set('requiresApplication', opt.val)}
                    style={{
                      flex: 1, minWidth: 160,
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '12px 14px', textAlign: 'left',
                      background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                      border: `1.5px solid ${active ? theme.colors.primary : theme.colors.border.subtle}` ,
                      borderRadius: theme.radius.lg, cursor: 'pointer',
                      transition: theme.transition,
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.default; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.subtle; } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <opt.Icon size={16} color={active ? theme.colors.primary : theme.colors.text.muted} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13,
                        color: active ? theme.colors.primaryLight : theme.colors.text.primary,
                      }}>{opt.label}</span>
                    </div>
                    <span style={{
                      fontFamily: theme.fonts.body, fontSize: 11.5,
                      color: theme.colors.text.muted, lineHeight: 1.5,
                    }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            {applicationFlowUnsupported && (
              <div style={{
                marginTop: 8,
                padding: '10px 12px',
                background: 'rgba(110,84,255,0.04)',
                border: `1px solid ${theme.colors.primaryBorder}` ,
                borderRadius: theme.radius.md,
                fontFamily: theme.fonts.body,
                fontSize: 11.5,
                color: theme.colors.text.muted,
              }}>
                This deployment does not support application flow. All bounties are posted as Open.
              </div>
            )}
          </div>
          {/* Escrow notice */}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(110,84,255,0.04)',
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.md,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <IconBounties size={18} color={theme.colors.primary} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.primaryLight, fontWeight: 500, marginBottom: 3 }}>
                Funds are locked trustlessly
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, lineHeight: 1.6 }}>
                When you post, the reward + creator stake will be locked into the smart contract. The contract automatically releases funds to the approved winner. If no winner is approved before the deadline, you can reclaim your reward.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ?????????????? Step 2: Review ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionCard
            eyebrow="Ready to post"
            title="Final review"
            hint="This is the public brief builders will see first. Verify clarity now so the on-chain record matches your intent."
            tone="primary"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 10 }}>
              <MetaPill label="Reward" value={`${form.reward || '-'} MON`} accent />
              <MetaPill label="Winners" value={form.winnerCount || '1'} />
              <MetaPill label="Mode" value={modeLabel} />
              <MetaPill label="Deadline" value={deadlineLabel} />
            </div>

            <div style={{
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
            }}>
              <ReviewRow label="Title" value={form.title || '-'} />
              <ReviewRow label="Category" value={form.category || '-'} />
              <ReviewRow label="Reward" value={`${form.reward || '-'} MON`} accent mono />
              {String(form.winnerCount || '1') !== '1' && (
                <ReviewRow label="Winners" value={`${form.winnerCount} (equal split)`} mono />
              )}
              <ReviewRow label="Deadline" value={deadlineLabel} />
              <ReviewRow label="Mode" value={modeLabel} />
              {form.contactInfo && <ReviewRow label="Contact" value={form.contactInfo} />}
            </div>
          </SectionCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 0.9fr)', gap: 18 }}>
            <SectionCard
              eyebrow="Brief preview"
              title={form.title || 'Untitled bounty'}
              hint="Read this like a builder landing on the page for the first time."
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{
                  padding: '6px 10px',
                  borderRadius: theme.radius.full,
                  border: `1px solid ${theme.colors.primaryBorder}`,
                  background: theme.colors.primaryDim,
                  fontFamily: theme.fonts.mono,
                  fontSize: 10.5,
                  color: theme.colors.primary,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {form.category}
                </span>
                <span style={{
                  padding: '6px 10px',
                  borderRadius: theme.radius.full,
                  border: `1px solid ${theme.colors.border.subtle}`,
                  background: theme.colors.bg.panel,
                  fontFamily: theme.fonts.mono,
                  fontSize: 10.5,
                  color: theme.colors.text.faint,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {modeLabel}
                </span>
                {normalizedSkills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      padding: '6px 10px',
                      borderRadius: theme.radius.full,
                      border: `1px solid ${theme.colors.border.subtle}`,
                      background: theme.colors.bg.elevated,
                      fontFamily: theme.fonts.body,
                      fontSize: 11.5,
                      color: theme.colors.text.muted,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div style={{
                padding: '16px 18px',
                background: theme.colors.bg.panel,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.lg,
                fontFamily: theme.fonts.body,
                fontSize: 13.5,
                color: theme.colors.text.secondary,
                lineHeight: 1.75,
                maxHeight: 320,
                overflowY: 'auto',
              }}>
                {form.description.trim() ? (
                  <ReactMarkdown components={MD_COMPONENTS}>{form.description.trim()}</ReactMarkdown>
                ) : (
                  'No overview provided.'
                )}
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Escrow"
              title="Funds to be locked"
              hint="Reward and creator stake are locked in the contract until the bounty settles."
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <MetaPill label="Reward" value={`${form.reward || '-'} MON`} accent />
                <MetaPill label="Creator stake" value={`${creatorStakeDisplay} MON`} />
                <MetaPill label="Total locked" value={`${totalLockedDisplay} MON`} accent />
                <MetaPill label="Contact" value={form.contactInfo || 'Not provided'} />
              </div>
              <div style={{
                padding: '12px 14px',
                background: theme.colors.bg.panel,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.lg,
                fontFamily: theme.fonts.body,
                fontSize: 12.5,
                color: theme.colors.text.muted,
                lineHeight: 1.7,
              }}>
                By posting, you authorize the smart contract to custody these funds. No centralized party can move them while the bounty is active.
              </div>
            </SectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            <ReviewAccordionCard
              eyebrow="Checklist"
              title="Requirements"
              hint={trimmedRequirements.length > 0 ? `${trimmedRequirements.length} task item(s)` : 'No explicit requirements yet.'}
              defaultOpen={true}
            >
              {trimmedRequirements.length > 0 ? trimmedRequirements.map((item, index) => (
                <div key={`${item}-${index}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: theme.radius.full,
                    border: `1px solid ${theme.colors.primaryBorder}`,
                    background: theme.colors.primaryDim,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    color: theme.colors.primary,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {index + 1}
                  </span>
                  <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.65 }}>
                    <ReactMarkdown components={MD_COMPONENTS}>{item}</ReactMarkdown>
                  </div>
                </div>
              )) : (
                <div style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.faint }}>No requirements provided.</div>
              )}
            </ReviewAccordionCard>

            <ReviewAccordionCard
              eyebrow="Submission"
              title="Deliverables"
              hint={trimmedDeliverables.length > 0 ? `${trimmedDeliverables.length} proof item(s)` : 'Optional deliverables were left empty.'}
              defaultOpen={false}
            >
              {trimmedDeliverables.length > 0 ? trimmedDeliverables.map((item, index) => (
                <div key={`${item}-${index}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <IconChevronRight size={12} color={theme.colors.cyan} style={{ flexShrink: 0, marginTop: 4 }} />
                  <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.65 }}>
                    <ReactMarkdown components={MD_COMPONENTS}>{item}</ReactMarkdown>
                  </div>
                </div>
              )) : (
                <div style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.faint }}>No deliverables provided.</div>
              )}
            </ReviewAccordionCard>

            <ReviewAccordionCard
              eyebrow="Selection"
              title="Evaluation criteria"
              hint={trimmedEvaluationCriteria.length > 0 ? `${trimmedEvaluationCriteria.length} scoring cue(s)` : 'Optional rubric was left empty.'}
              defaultOpen={false}
            >
              {trimmedEvaluationCriteria.length > 0 ? trimmedEvaluationCriteria.map((item, index) => (
                <div key={`${item}-${index}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    color: theme.colors.cyan,
                    marginTop: 3,
                    flexShrink: 0,
                  }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.65 }}>
                    <ReactMarkdown components={MD_COMPONENTS}>{item}</ReactMarkdown>
                  </div>
                </div>
              )) : (
                <div style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.faint }}>No evaluation criteria provided.</div>
              )}
            </ReviewAccordionCard>
          </div>
        </div>
      )}
      </div>

      {/* ?????????????? Navigation ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
      {step === STEPS.length - 1 && (
        <div style={{
          marginTop: 28,
          padding: '12px 16px',
          background: theme.colors.bg.panel,
          border: `1px solid ${theme.colors.border.subtle}`,
          borderRadius: theme.radius.lg,
          fontFamily: theme.fonts.body,
          fontSize: 12,
          color: theme.colors.text.muted,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0 16px',
          alignItems: 'center',
        }}>
          <span><IconCheck size={12} color={theme.colors.green[400]} style={{ verticalAlign: 'middle', marginRight: 4 }} />Title, Overview, Requirements</span>
          <span><IconCheck size={12} color={theme.colors.green[400]} style={{ verticalAlign: 'middle', marginRight: 4 }} />Reward & Deadline</span>
          <span><IconCheck size={12} color={theme.colors.green[400]} style={{ verticalAlign: 'middle', marginRight: 4 }} />Review</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 10 }}>
        {step > 0 ? (
          <Button variant="ghost" icon={<IconChevronLeft size={14} color="currentColor" />} onClick={handleBack}>Back</Button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <Button variant="primary" iconRight={<IconChevronRight size={14} color="currentColor" />} onClick={handleNext}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" loading={loading} onClick={handleSubmit}>
            Post & Lock Funds
          </Button>
        )}
      </div>
    </div>
  );
}







































