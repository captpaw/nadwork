import { useState, useEffect, useCallback } from 'react';

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORE_KEY = (addr) => `nadwork_avatar_${addr?.toLowerCase()}`;

// Avatar stored shape: { src: string (base64 data URL), ts: number }
function readStored(addr) {
  if (!addr) return null;
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY(addr)) || 'null');
    if (!data) return null;
    // Migrate / reject old IPFS entries — src must be a data URL
    if (data.src && !data.src.startsWith('data:')) {
      localStorage.removeItem(STORE_KEY(addr));
      return null;
    }
    return data;
  } catch { return null; }
}

function writeStored(addr, data) {
  if (!addr) return;
  try { localStorage.setItem(STORE_KEY(addr), JSON.stringify(data)); } catch {}
}

// ─── Image → base64 ──────────────────────────────────────────────────────────

/**
 * Read a File as a base64 data URL.
 * Optionally downscale to maxPx (longest edge) and compress to JPEG
 * to keep localStorage usage small (typical: ~30-80 KB).
 */
function fileToBase64(file, maxPx = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        // Resize to maxPx on the longest side
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else                  { width  = Math.round(width  * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Use WebP if supported (smaller), fall back to JPEG
        const dataUrl = canvas.toDataURL('image/webp', quality) ||
                        canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @hook useAvatar
 *
 * Manages a user's profile picture stored as a resized base64 image in localStorage.
 * No IPFS, no transactions — instant and free.
 *
 * Stored shape: { src: 'data:image/...;base64,...', ts: number }
 *
 * @param {string|null} address  Wallet address
 * @returns {{ avatar, uploading, uploadError, setAvatar, removeAvatar }}
 */
export function useAvatar(address) {
  const [avatar,      setAvatarState] = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Load from localStorage on mount / address change
  useEffect(() => {
    if (!address) { setAvatarState(null); return; }
    const stored = readStored(address);
    setAvatarState(stored || null);
  }, [address]);

  /**
   * Process and store a new avatar image.
   * Resizes to 256×256 max, compresses, then saves as base64 in localStorage.
   */
  const setAvatar = useCallback(async (file) => {
    if (!address || !file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const src = await fileToBase64(file);
      const entry = { src, ts: Date.now() };
      setAvatarState(entry);
      writeStored(address, entry);
    } catch (err) {
      setUploadError(err.message || 'Failed to process image');
    } finally {
      setUploading(false);
    }
  }, [address]);

  /** Remove avatar (back to initials fallback) */
  const removeAvatar = useCallback(() => {
    if (!address) return;
    localStorage.removeItem(STORE_KEY(address));
    setAvatarState(null);
  }, [address]);

  return { avatar, uploading, uploadError, setAvatar, removeAvatar };
}

/**
 * Read-only: get the stored avatar data URL for any address (no hook overhead).
 * Returns null if not set.
 */
export function getAvatarSrc(address) {
  const stored = readStored(address);
  return stored?.src || null;
}
