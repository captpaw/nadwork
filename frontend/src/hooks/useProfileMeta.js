/**
 * useProfileMeta — local profile metadata (bio, display name, skills, social links).
 *
 * Storage: localStorage per wallet address. No transaction required.
 * Key: nadwork_profile_meta_<address_lowercase>
 *
 * Shape:
 *   { displayName: string, bio: string, skills: string[], twitter: string, github: string, ts: number }
 */
import { useState, useEffect, useCallback } from 'react';

const STORE_KEY = (addr) => `nadwork_profile_meta_${addr?.toLowerCase()}`;

export const EMPTY_META = {
  displayName: '',
  bio:         '',
  skills:      [],
  twitter:     '',
  github:      '',
};

function readMeta(addr) {
  if (!addr) return null;
  try {
    const raw = localStorage.getItem(STORE_KEY(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      displayName: parsed.displayName || '',
      bio:         parsed.bio         || '',
      skills:      Array.isArray(parsed.skills) ? parsed.skills : [],
      twitter:     parsed.twitter     || '',
      github:      parsed.github      || '',
      ts:          parsed.ts          || 0,
    };
  } catch { return null; }
}

function writeMeta(addr, data) {
  if (!addr) return;
  try {
    localStorage.setItem(STORE_KEY(addr), JSON.stringify({ ...data, ts: Date.now() }));
  } catch {}
}

/**
 * Hook to read + write profile metadata for any address.
 * `save` only works when address === connected wallet (controlled by caller).
 */
export function useProfileMeta(address) {
  const [meta, setMetaState] = useState(null);

  useEffect(() => {
    if (!address) { setMetaState(null); return; }
    setMetaState(readMeta(address) || { ...EMPTY_META });
  }, [address]);

  const save = useCallback((updates) => {
    if (!address) return;
    const next = { ...(readMeta(address) || EMPTY_META), ...updates };
    writeMeta(address, next);
    setMetaState({ ...next });
  }, [address]);

  return { meta: meta || { ...EMPTY_META }, save };
}

/**
 * Read-only helper — no hook overhead.
 * Use in non-reactive contexts (e.g. BountyCard, BountyDetailPage).
 */
export function getProfileMeta(address) {
  return readMeta(address) || { ...EMPTY_META };
}
