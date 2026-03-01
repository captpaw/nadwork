import { defineChain } from 'viem';

export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz', 'https://rpc2.monad.xyz', 'https://rpc3.monad.xyz'] },
    public:  { http: ['https://rpc.monad.xyz', 'https://rpc2.monad.xyz', 'https://rpc3.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://monadexplorer.com' },
  },
});
