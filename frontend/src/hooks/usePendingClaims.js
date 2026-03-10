import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ADDRESSES, FACTORY_ABI } from '../config/contracts';
import { getReadContractFast, getContract } from '../utils/ethers';
import { requestNotificationRefresh } from './useNotifications';

function formatMon(wei) {
  try {
    if (wei == null || wei === 0n) return '0';
    return (Number(BigInt(wei)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0';
  } catch {
    return '0';
  }
}

export function usePendingClaims() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [claims, setClaims] = useState({
    cancelComp: 0n,
    timeoutPayout: 0n,
    stakeRefund: 0n,
    disputeRefund: 0n,
  });
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(null);

  const fetchClaims = useCallback(async () => {
    if (!address || !ADDRESSES.factory) return;
    try {
      const factory = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
      const [cc, tp, sr, dr] = await Promise.all([
        factory.pendingCancelComps(address).catch(() => 0n),
        factory.pendingTimeoutPayouts(address).catch(() => 0n),
        factory.pendingStakeRefunds(address).catch(() => 0n),
        factory.pendingDisputeRefunds(address).catch(() => 0n),
      ]);
      setClaims({ cancelComp: cc, timeoutPayout: tp, stakeRefund: sr, disputeRefund: dr });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[usePendingClaims]', err);
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setClaims({ cancelComp: 0n, timeoutPayout: 0n, stakeRefund: 0n, disputeRefund: 0n });
      return;
    }
    setLoading(true);
    fetchClaims().finally(() => setLoading(false));
  }, [address, fetchClaims]);

  const totalPending = claims.cancelComp + claims.timeoutPayout + claims.stakeRefund + claims.disputeRefund;
  const hasPending = totalPending > 0n;

  const claim = useCallback(async (type) => {
    if (!address || !walletClient) return;
    const methods = {
      cancelComp: 'claimCancelComp',
      timeoutPayout: 'claimTimeoutPayout',
      stakeRefund: 'claimStakeRefund',
      disputeRefund: 'claimDisputeRefund',
    };
    const method = methods[type];
    if (!method || claims[type] <= 0n) return;
    setClaiming(type);
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory[method]();
      await tx.wait();
      await fetchClaims();
      requestNotificationRefresh();
      return { success: true };
    } catch (err) {
      let msg = err?.reason || err?.shortMessage || err?.message || 'Transaction failed';
      if (typeof msg === 'string' && (msg.includes('rejected') || msg.includes('denied') || msg.includes('user rejected'))) {
        msg = 'Transaction cancelled';
      }
      return { success: false, error: msg };
    } finally {
      setClaiming(null);
    }
  }, [address, walletClient, claims, fetchClaims]);

  return {
    claims: {
      cancelComp: claims.cancelComp,
      timeoutPayout: claims.timeoutPayout,
      stakeRefund: claims.stakeRefund,
      disputeRefund: claims.disputeRefund,
    },
    hasPending,
    totalPending,
    formatMon,
    fetchClaims,
    claim,
    claiming,
    loading,
  };
}
