const rpcUrl = String(import.meta.env.VITE_RPC_URL || '').toLowerCase();

export const IS_TESTNET = rpcUrl.includes('testnet');
export const NETWORK_LABEL = IS_TESTNET ? 'Monad Testnet' : 'Monad Mainnet';
