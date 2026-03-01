import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'nadwork_sub_status_';

// Persist last-seen submission status in localStorage so we can detect changes.
// Call this hook wherever you display submission status (ProfilePage, BountyDetailPage).
//
// IMPORTANT: `onNotify` must be memoized with useCallback in the parent, otherwise
// the effect will re-run on every render and may fire duplicate notifications.
export function useSubmissionNotifications(submissions, onNotify) {
  // Track by "id:status" pair — so the same submission changing status a second time
  // fires again, but remounting without a real change does not re-fire.
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!submissions?.length) return;

    const changed = [];
    for (const sub of submissions) {
      const key     = STORAGE_KEY + String(sub.id);
      const stored  = localStorage.getItem(key);
      const current = String(Number(sub.status));
      const pairKey = `${sub.id}:${current}`;

      if (stored !== null && stored !== current && !notifiedRef.current.has(pairKey)) {
        notifiedRef.current.add(pairKey);
        const statusLabel = ['Pending', 'Approved ✓', 'Rejected'][Number(sub.status)] || current;
        changed.push({ sub, newStatus: Number(sub.status), label: statusLabel });
      }

      // Only write to localStorage when the value actually changed
      if (stored !== current) {
        localStorage.setItem(key, current);
      }
    }

    if (changed.length > 0 && onNotify) {
      onNotify(changed);
    }
  }, [submissions, onNotify]);
}

export function clearNotification(submissionId) {
  localStorage.removeItem(STORAGE_KEY + String(submissionId));
}
