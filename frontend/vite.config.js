import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '');
  const rpcTarget = env.VITE_RPC_URL?.trim() || 'https://testnet-rpc.monad.xyz';
  const subgraphUrl = env.VITE_GOLDSKY_SUBGRAPH_URL?.trim() || '';
  const ipfsGateway = env.VITE_PINATA_GATEWAY?.trim() || 'https://gateway.pinata.cloud/ipfs/';

  const proxy = {
    '/rpc-proxy': {
      target: rpcTarget,
      changeOrigin: true,
      secure: true,
      rewrite: (p) => p.replace(/^\/rpc-proxy/, ''),
      ws: false,
    },
  };

  if (subgraphUrl) {
    try {
      const u = new URL(subgraphUrl);
      proxy['/subgraph-proxy'] = {
        target: u.origin,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/subgraph-proxy/, u.pathname),
      };
    } catch (_) {}
  }

  try {
    const gw = new URL(ipfsGateway);
    const gwPath = gw.pathname.endsWith('/') ? gw.pathname.slice(0, -1) : gw.pathname;
    proxy['/ipfs-proxy'] = {
      target: gw.origin,
      changeOrigin: true,
      secure: true,
      rewrite: (p) => p.replace(/^\/ipfs-proxy/, gwPath),
    };
  } catch (_) {}

  return {
    root: __dirname,
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    define: { global: 'globalThis' },
    server: {
      port: 3000,
      proxy,
    },
  };
});


