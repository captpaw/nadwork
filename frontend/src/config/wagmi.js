import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadMainnet } from './chains.js';

// FIX H-DEPLOY-2: VITE_WALLETCONNECT_PROJECT_ID is required — no fallback to invalid string
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  console.error(
    '[NadWork] VITE_WALLETCONNECT_PROJECT_ID is not set. ' +
    'WalletConnect connections will fail. Get a project ID from cloud.walletconnect.com'
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: 'NadWork',
  projectId: projectId || '',
  chains: [monadMainnet],
  ssr: false,
});
