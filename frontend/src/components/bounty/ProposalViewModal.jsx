import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { theme } from '../../styles/theme';
import { fetchJSON, GATEWAY } from '../../config/pinata';

/**
 * Modal to view an application proposal. Fetches proposal from IPFS and
 * renders the proposal text in a readable format (not raw JSON).
 */
export default function ProposalViewModal({ open, onClose, proposalIpfsHash, builderAddress }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !proposalIpfsHash) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchJSON(proposalIpfsHash)
      .then((json) => {
        setData(json);
      })
      .catch(() => setError('Failed to load proposal'))
      .finally(() => setLoading(false));
  }, [open, proposalIpfsHash]);

  const proposalText = data?.proposal || '';
  const isUrl = (s) => /^https?:\/\//.test(s);
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  const renderProposal = (text) => {
    if (!text) return null;
    return text.split(/\n/).map((line, i) => {
      const parts = line.split(linkRegex);
      return (
        <div key={i} style={{ marginBottom: 8, lineHeight: 1.6 }}>
          {parts.map((part, j) =>
            isUrl(part) ? (
              <a
                key={j}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.colors.primary, textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {part}
              </a>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </div>
      );
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Application Proposal" maxWidth={560}>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: theme.colors.text.muted }}>
          Loading proposal…
        </div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: theme.colors.red[400] }}>
          {error}
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <a
              href={GATEWAY + proposalIpfsHash}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.colors.primary }}
            >
              Open raw on IPFS ↗
            </a>
          </div>
        </div>
      ) : data ? (
        <div style={{ padding: '0 4px' }}>
          {builderAddress && (
            <div
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 11,
                color: theme.colors.text.faint,
                marginBottom: 14,
                paddingBottom: 12,
                borderBottom: `1px solid ${theme.colors.border.faint}`,
              }}
            >
              From: {builderAddress}
            </div>
          )}
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 14,
              color: theme.colors.text.secondary,
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflowY: 'auto',
              paddingBottom: 16,
            }}
          >
            {renderProposal(proposalText)}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
