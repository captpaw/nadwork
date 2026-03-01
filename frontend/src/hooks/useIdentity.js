import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContractWithFallback, getContract } from '@/utils/ethers.js';
import { ADDRESSES, IDENTITY_ABI } from '@/config/contracts.js';
import { shortAddr } from '@/utils/format.js';

// Module-level cache: address → { username, primary, linked, ts }
// Shared across all hook instances so multiple components don't re-fetch the same address.
const _cache = new Map();
const CACHE_TTL = 30_000; // 30 seconds

function getCached(addr) {
  const entry = _cache.get(addr?.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(addr?.toLowerCase()); return null; }
  return entry;
}

function setCached(addr, data) {
  _cache.set(addr?.toLowerCase(), { ...data, ts: Date.now() });
}

/**
 * Clears the identity cache for an address (call after writes to force a refresh).
 */
export function invalidateIdentityCache(addr) {
  if (addr) _cache.delete(addr.toLowerCase());
}

/**
 * @hook useIdentity
 * Fetches the on-chain identity (username, primaryWallet, linkedWallets) for a given address.
 * Returns null/loading state gracefully when IdentityRegistry is not configured.
 *
 * @param {string|null} address  Wallet address to look up
 * @returns {{ username, primaryWallet, linkedWallets, loading, error, reload }}
 */
export function useIdentity(address) {
  const [data, setData]       = useState(null);
  // FIX I-FE-3: Initialize loading as true when address is provided to prevent flash
  const [loading, setLoading] = useState(!!address);
  const [error, setError]     = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!address || !ADDRESSES.identity) {
      if (mountedRef.current) { setLoading(false); setData(null); }
      return;
    }

    // Return cached if still fresh
    const cached = getCached(address);
    if (cached) {
      if (mountedRef.current) { setData(cached); setLoading(false); }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const contract = await getReadContractWithFallback(ADDRESSES.identity, IDENTITY_ABI);
      const result   = await contract.getIdentity(address);
      // getIdentity returns: (string username, address primaryWallet, address[] linkedWallets, uint256 createdAt, uint256 updatedAt)
      const parsed = {
        username:      result[0] || '',
        primaryWallet: result[1] || address,
        linkedWallets: [...(result[2] || [])],
        createdAt:     Number(result[3] || 0),
        updatedAt:     Number(result[4] || 0),
      };
      setCached(address, parsed);
      if (mountedRef.current) { setData(parsed); setLoading(false); }
    } catch (err) {
      console.warn('[useIdentity] fetch failed for', address, err?.message);
      if (mountedRef.current) { setError(err?.message); setLoading(false); setData(null); }
    }
  }, [address]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // Provide safe defaults when data is null (not yet loaded / no identity configured)
  return {
    username:      data?.username      ?? '',
    primaryWallet: data?.primaryWallet ?? null,
    linkedWallets: data?.linkedWallets ?? [],
    createdAt:     data?.createdAt     ?? 0,
    updatedAt:     data?.updatedAt     ?? 0,
    loading,
    error,
    reload: load,
  };
}

/**
 * @hook useDisplayName
 * Returns a human-readable display name for an address:
 * - Username if set on-chain (e.g. "alice")
 * - Shortened address fallback (e.g. "0x1234...5678")
 *
 * This is the primary hook to use anywhere an address is displayed to users.
 *
 * @param {string|null} address
 * @returns {{ displayName: string, username: string|null, isUsername: boolean, loading: boolean }}
 */
export function useDisplayName(address) {
  const { username, loading } = useIdentity(address);

  const displayName = username || shortAddr(address);
  const isUsername  = !!username;

  return { displayName, username: username || null, isUsername, loading };
}

/**
 * @hook useIdentityWrite
 * Returns write functions (setUsername, proposeLink, confirmLink, unlinkWallet, claimPrimary)
 * bound to the connected wallet's signer. Requires walletClient from useWalletClient().
 *
 * Note: setUsername is a ONE-TIME operation. The contract enforces that a username,
 * once set, is permanent and cannot be changed or cleared by the user.
 *
 * @param {object|null} walletClient  From wagmi's useWalletClient()
 * @returns {{ setUsername, proposeLink, confirmLink, unlinkWallet, claimPrimary, busy, txError }}
 */
export function useIdentityWrite(walletClient) {
  const [busy, setBusy]       = useState(false);
  const [txError, setTxError] = useState(null);

  const getWriteContract = useCallback(async () => {
    if (!walletClient || !ADDRESSES.identity) throw new Error('Wallet not connected or identity contract not configured');
    return getContract(ADDRESSES.identity, IDENTITY_ABI, walletClient);
  }, [walletClient]);

  const exec = useCallback(async (fn, invalidateAddr) => {
    setBusy(true);
    setTxError(null);
    try {
      const contract = await getWriteContract();
      const tx = await fn(contract);
      await tx.wait();
      if (invalidateAddr) invalidateIdentityCache(invalidateAddr);
      return true;
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || 'Transaction failed';
      setTxError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [getWriteContract]);

  const setUsername = useCallback((username, callerAddr) =>
    exec(c => c.setUsername(username), callerAddr),
  [exec]);

  const proposeLink = useCallback((newWallet, callerAddr) =>
    exec(c => c.proposeLink(newWallet), callerAddr),
  [exec]);

  const cancelProposal = useCallback((callerAddr) =>
    exec(c => c.cancelProposal(), callerAddr),
  [exec]);

  const confirmLink = useCallback((primaryWallet, callerAddr) =>
    exec(c => c.confirmLink(primaryWallet), callerAddr),
  [exec]);

  const unlinkWallet = useCallback((linkedWallet, callerAddr) =>
    exec(c => c.unlinkWallet(linkedWallet), callerAddr),
  [exec]);

  const claimPrimary = useCallback((lostPrimary, callerAddr) =>
    exec(c => c.claimPrimary(lostPrimary), callerAddr),
  [exec]);

  return { setUsername, proposeLink, cancelProposal, confirmLink, unlinkWallet, claimPrimary, busy, txError };
}
