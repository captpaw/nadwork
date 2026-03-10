import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { monadMainnet } from './chains.js';

// VITE_WALLETCONNECT_PROJECT_ID is required for WalletConnect.
// In dev we warn (non-blocking) because injected wallet still works.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  const log = import.meta.env.PROD ? console.error : console.warn;
  log(
    '[NadWork] VITE_WALLETCONNECT_PROJECT_ID is not set. ' +
    'WalletConnect connections will fail. Get a project ID from cloud.walletconnect.com'
  );
}

// In dev: use Vite proxy to bypass CORS. Set VITE_USE_RPC_PROXY=0 to disable.
const useRpcProxy = import.meta.env.DEV && (import.meta.env.VITE_USE_RPC_PROXY !== '0');
const devRpcUrl = typeof window !== 'undefined' && useRpcProxy
  ? `${window.location.origin}/rpc-proxy`
  : undefined;

export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: 'NadWork',
      projectId,
      chains: [monadMainnet],
      ssr: false,
    })
  : createConfig({
      chains: [monadMainnet],
      connectors: [injected()],
      transports: {
        [monadMainnet.id]: http(devRpcUrl),
      },
      ssr: false,
    });
