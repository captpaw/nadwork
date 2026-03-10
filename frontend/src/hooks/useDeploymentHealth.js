import { useEffect, useState } from 'react';
import { ADDRESSES } from '@/config/contracts.js';
import { getFactoryCapabilities } from '@/utils/factoryCapabilities.js';

function shortAddr(addr) {
  if (!addr || typeof addr !== 'string') return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function useDeploymentHealth() {
  const [state, setState] = useState({
    loading: true,
    ok: true,
    message: '',
    details: '',
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const factory = ADDRESSES.factory;
        const registry = ADDRESSES.registry;

        if (!factory || !registry) {
          if (!cancelled) {
            setState({
              loading: false,
              ok: false,
              message: 'Deployment address configuration is incomplete.',
              details: 'Set VITE_BOUNTY_FACTORY_ADDRESS and VITE_BOUNTY_REGISTRY_ADDRESS to the V4 deployment.',
            });
          }
          return;
        }

        const caps = await getFactoryCapabilities(true);
        const isV4Ready = caps?.supportsCreateV4 === true && caps?.openOnlyLegacy !== true;

        if (!isV4Ready) {
          if (!cancelled) {
            setState({
              loading: false,
              ok: false,
              message: `Active factory ${shortAddr(factory)} is not V4-ready.`,
              details: 'App is configured to run V4-only flow (open + curated). Please switch to the V4 deployment manifest.',
            });
          }
          return;
        }

        if (!cancelled) {
          setState({ loading: false, ok: true, message: '', details: '' });
        }
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            ok: false,
            message: 'Failed to verify deployment capabilities from RPC.',
            details: 'Check RPC connectivity and ensure the app points to the intended V4 deployment.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
