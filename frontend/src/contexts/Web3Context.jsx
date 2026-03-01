import React, { createContext, useContext } from 'react';
import { useWalletClient } from 'wagmi';
import { walletClientToSigner } from '@/utils/ethers.js';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  return <Web3Context.Provider value={{}}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  return useContext(Web3Context);
}

// Returns an async getSigner function bound to the current walletClient.
// Usage: const { getSigner } = useEthersSigner(); const signer = await getSigner();
export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();
  if (!walletClient) return null;
  return { getSigner: () => walletClientToSigner(walletClient) };
}
