import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ADDRESSES, FACTORY_ABI, REGISTRY_ABI } from '../config/contracts';
import { getReadContractFast, invalidateContractCache } from '../utils/ethers';
import { listCreatorBountyIds } from '../utils/registry';
import { getFactoryCapabilities } from '../utils/factoryCapabilities';

const NOTIF_KEY = (addr) => `nw_notifs_v1_${addr.toLowerCase()}`;
const SNAP_KEY = (addr) => `nw_snap_v1_${addr.toLowerCase()}`;
const MAX_NOTIFS = 50;

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

let nid = 0;
function mkNotif(type, title, body, bountyId) {
  return { id: `${++nid}_${Date.now()}`, type, title, body, bountyId, ts: Date.now(), read: false };
}

const POLL_INTERVAL_VISIBLE_MS = 90_000;
const POLL_INTERVAL_HIDDEN_MS = 180_000;

export const NOTIF_REFRESH_EVENT = 'nadwork:refresh-notifications';

export function requestNotificationRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIF_REFRESH_EVENT));
  }
}

export function useNotifications() {
  const { address } = useAccount();
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const pollInProgressRef = useRef(false);

  const reload = useCallback(() => {
    if (!address) {
      setNotifs([]);
      setUnread(0);
      return;
    }
    const stored = readStore(NOTIF_KEY(address), []);
    setNotifs(stored);
    setUnread(stored.filter((n) => !n.read).length);
  }, [address]);

  const poll = useCallback(async () => {
    if (!address || !ADDRESSES.factory || !ADDRESSES.registry) return;
    if (pollInProgressRef.current) return;
    pollInProgressRef.current = true;

    try {
      const factoryCaps = await getFactoryCapabilities().catch(() => null);
      const supportsApplications = !(factoryCaps?.openOnlyLegacy || factoryCaps?.supportsApplications === false);

      const factory = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
      const registry = getReadContractFast(ADDRESSES.registry, REGISTRY_ABI);

      const snap = readStore(SNAP_KEY(address), {});
      const newSnap = { ...snap };
      const newNotifs = [];

      // 1) Builder submission status changes
      try {
        const builderSubs = await registry.getBuilderSubmissions(address);
        for (const sub of builderSubs || []) {
          const key = `sub_${sub.id}`;
          const prev = snap[key];
          const cur = Number(sub.status);
          newSnap[key] = cur;

          if (prev === undefined) continue;
          if (prev === 0 && cur === 1) {
            newNotifs.push(mkNotif(
              'win',
              'Submission approved',
              `Your submission for bounty #${sub.bountyId} was approved. Payment released.`,
              String(sub.bountyId),
            ));
          } else if (prev === 0 && cur === 2) {
            newNotifs.push(mkNotif(
              'rejected',
              'Submission rejected',
              `Your submission for bounty #${sub.bountyId} was rejected. You have 2 hours to dispute.`,
              String(sub.bountyId),
            ));
          }
        }
      } catch {
        // non-fatal
      }

      // 2) Builder pending pull payments
      try {
        const [cc, tp, sr] = await Promise.all([
          factory.pendingCancelComps(address).catch(() => 0n),
          factory.pendingTimeoutPayouts(address).catch(() => 0n),
          factory.pendingStakeRefunds(address).catch(() => 0n),
        ]);

        const prevCc = BigInt(snap.cancelComp ?? 0);
        const prevTp = BigInt(snap.timeoutPayout ?? 0);
        const prevSr = BigInt(snap.stakeRefund ?? 0);

        newSnap.cancelComp = cc.toString();
        newSnap.timeoutPayout = tp.toString();
        newSnap.stakeRefund = sr.toString();

        if (cc > 0n && cc !== prevCc) {
          newNotifs.push(mkNotif('payment', 'Cancel compensation ready', `You have ${formatMon(cc)} MON to claim from a cancelled bounty.`, null));
        }
        if (tp > 0n && tp !== prevTp) {
          newNotifs.push(mkNotif('payment', 'Timeout payout ready', `You have ${formatMon(tp)} MON to claim from a timed-out bounty.`, null));
        }
        if (sr > 0n && sr !== prevSr) {
          newNotifs.push(mkNotif('payment', 'Stake refund ready', `You have ${formatMon(sr)} MON stake refund to claim.`, null));
        }
      } catch {
        // non-fatal
      }

      // 3) Builder application status changes (only when contract supports it)
      if (supportsApplications && typeof factory.getBuilderApplications === 'function') {
        try {
          const apps = await factory.getBuilderApplications(address).catch(() => []);
          for (const app of apps || []) {
            const key = `app_${app.id}`;
            const prev = snap[key];
            const cur = Number(app.status);
            newSnap[key] = cur;

            if (prev === undefined) continue;
            if (prev === 0 && cur === 1) {
              newNotifs.push(mkNotif(
                'approved',
                'Application approved',
                `You can now submit your work for bounty #${app.bountyId}.`,
                String(app.bountyId),
              ));
            } else if (prev === 0 && cur === 2) {
              newNotifs.push(mkNotif(
                'rejected',
                'Application rejected',
                `Your application for bounty #${app.bountyId} was not approved.`,
                String(app.bountyId),
              ));
            }
          }
        } catch {
          // non-fatal
        }
      }

      // 4-6) Creator-side checks
      try {
        const creatorBountyIds = await listCreatorBountyIds(registry, address).catch(() => []);
        const bountyMap = {};
        for (const bid of creatorBountyIds) {
          bountyMap[bid] = await registry.getBounty(bid).catch(() => null);
        }

        const nowSec = Math.floor(Date.now() / 1000);

        for (const bid of creatorBountyIds) {
          const bounty = bountyMap[bid];
          if (!bounty) continue;

          const subKey = `creator_sub_count_${bid}`;
          const curSub = Number(bounty.submissionCount);
          const prevSub = snap[subKey];
          newSnap[subKey] = curSub;
          if (prevSub !== undefined && curSub > prevSub) {
            newNotifs.push(mkNotif(
              'new_sub',
              'New submission received',
              `Bounty #${bid} has ${curSub - prevSub} new submission${curSub - prevSub > 1 ? 's' : ''}.`,
              String(bid),
            ));
          }

          if (supportsApplications && bounty.requiresApplication && typeof registry.getBountyApplications === 'function') {
            const apps = await registry.getBountyApplications(bid).catch(() => []);
            const appKey = `creator_app_count_${bid}`;
            const curApp = apps.length;
            const prevApp = snap[appKey];
            newSnap[appKey] = curApp;
            if (prevApp !== undefined && curApp > prevApp) {
              newNotifs.push(mkNotif(
                'new_app',
                'New application received',
                `Bounty #${bid} has ${curApp - prevApp} new application${curApp - prevApp > 1 ? 's' : ''}.`,
                String(bid),
              ));
            }
          }

          const reviewKey = `creator_review_warned_${bid}`;
          if (!snap[reviewKey] && Number(bounty.status) === 1) {
            const reviewDl = Number(bounty.reviewDeadline);
            if (reviewDl > 0 && reviewDl - nowSec < 6 * 3600 && reviewDl > nowSec) {
              newSnap[reviewKey] = true;
              newNotifs.push(mkNotif(
                'warning',
                'Review window closing soon',
                `Bounty #${bid} review window closes in less than 6 hours. Approve winners now.`,
                String(bid),
              ));
            }
          }
        }
      } catch {
        // non-fatal
      }

      writeStore(SNAP_KEY(address), newSnap);

      if (newNotifs.length > 0) {
        const existing = readStore(NOTIF_KEY(address), []);
        const merged = [...newNotifs, ...existing].slice(0, MAX_NOTIFS);
        writeStore(NOTIF_KEY(address), merged);

        if (typeof window !== 'undefined' && document.hidden && Notification?.permission === 'granted') {
          newNotifs.forEach((n) => {
            try {
              new Notification('NadWork', { body: n.body, icon: '/favicon.ico', tag: n.id });
            } catch {
              // ignore notification errors
            }
          });
        }
      }

      reload();
    } catch (err) {
      if (err?.message?.includes('429')) {
        invalidateContractCache(ADDRESSES.factory);
        invalidateContractCache(ADDRESSES.registry);
      }
      if (import.meta.env.DEV) {
        console.warn('[useNotifications] poll error:', err);
      }
      reload();
    } finally {
      pollInProgressRef.current = false;
    }
  }, [address, reload]);

  useEffect(() => {
    reload();
    if (!address) return;

    const runPoll = () => poll();

    let tid;
    const scheduleNext = () => {
      const ms = document.visibilityState === 'visible'
        ? POLL_INTERVAL_VISIBLE_MS
        : POLL_INTERVAL_HIDDEN_MS;
      tid = setTimeout(() => {
        runPoll();
        scheduleNext();
      }, ms);
    };

    const initialTid = setTimeout(() => {
      runPoll();
      scheduleNext();
    }, 2000);

    const onVisibilityChange = () => {
      clearTimeout(tid);
      if (document.visibilityState === 'visible') runPoll();
      scheduleNext();
    };

    const onRefreshEvent = () => runPoll();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener(NOTIF_REFRESH_EVENT, onRefreshEvent);

    return () => {
      clearTimeout(initialTid);
      clearTimeout(tid);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener(NOTIF_REFRESH_EVENT, onRefreshEvent);
    };
  }, [address, poll, reload]);

  const markAllRead = useCallback(() => {
    if (!address) return;
    const stored = readStore(NOTIF_KEY(address), []);
    const updated = stored.map((n) => ({ ...n, read: true }));
    writeStore(NOTIF_KEY(address), updated);
    setNotifs(updated);
    setUnread(0);
  }, [address]);

  const clearAll = useCallback(() => {
    if (!address) return;
    writeStore(NOTIF_KEY(address), []);
    setNotifs([]);
    setUnread(0);
  }, [address]);

  const refresh = useCallback(() => {
    requestNotificationRefresh();
  }, []);

  return { notifs, unread, markAllRead, clearAll, refresh };
}

function formatMon(wei) {
  try {
    const val = Number(BigInt(wei)) / 1e18;
    return val.toFixed(4).replace(/\.?0+$/, '') || '0';
  } catch {
    return '0';
  }
}
