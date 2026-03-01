import { ethers } from 'ethers';

export function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = { chainId: chain.id, name: chain.name, ensAddress: chain.contracts?.ensRegistry?.address };
  const provider = new ethers.BrowserProvider(transport, network);
  return provider.getSigner(account.address);
}

export async function getContract(address, abi, walletClient) {
  const signer = await walletClientToSigner(walletClient);
  return new ethers.Contract(address, abi, signer);
}

const RPC_URLS = [
  import.meta.env.VITE_RPC_URL || 'https://rpc.monad.xyz',
  'https://rpc.monad.xyz',
  'https://rpc2.monad.xyz',
  'https://rpc3.monad.xyz',
  'https://rpc-mainnet.monadinfra.com',
].filter((url, idx, arr) => arr.indexOf(url) === idx); // deduplicate if env matches default

// Simple in-memory rate limit tracker: skip URLs that returned 429 recently
const _rateLimitedUntil = new Map();
function isRateLimited(url) {
  const until = _rateLimitedUntil.get(url);
  return until && Date.now() < until;
}
function markRateLimited(url) {
  _rateLimitedUntil.set(url, Date.now() + 10_000); // backoff 10s
}

export function getReadContract(address, abi, rpcUrl) {
  const url = rpcUrl || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(url);
  return new ethers.Contract(address, abi, provider);
}

export async function getReadContractWithFallback(address, abi) {
  const candidates = RPC_URLS.filter(u => !isRateLimited(u));
  const ordered = candidates.length > 0 ? candidates : RPC_URLS;
  for (const url of ordered) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // test connection
      return new ethers.Contract(address, abi, provider);
    } catch (e) {
      if (e?.message?.includes('429') || e?.status === 429) markRateLimited(url);
    }
  }
  // last resort, return with first non-rate-limited URL
  const fallbackUrl = RPC_URLS.find(u => !isRateLimited(u)) || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(fallbackUrl);
  return new ethers.Contract(address, abi, provider);
}

// getReadContract with rate limit awareness — use for one-off reads without connectivity test
export function getReadContractFast(address, abi) {
  const url = RPC_URLS.find(u => !isRateLimited(u)) || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(url);
  return new ethers.Contract(address, abi, provider);
}
