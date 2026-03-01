/* eslint-disable */
const fs = require("fs");
const path = require("path");

const frontendDir = path.join(__dirname, "..", "frontend");
const srcDir = path.join(frontendDir, "src");

// Create directories
const dirs = [
  srcDir,
  path.join(srcDir, "config"),
  path.join(srcDir, "styles"),
  path.join(srcDir, "components", "common"),
  path.join(srcDir, "components", "layout"),
  path.join(srcDir, "components", "bounty"),
  path.join(srcDir, "components", "stats"),
  path.join(srcDir, "contexts"),
  path.join(srcDir, "hooks"),
  path.join(srcDir, "pages"),
  path.join(srcDir, "utils"),
];

dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));
console.log("Directories created.");

// ─── vite.config.js ───────────────────────────────────────
fs.writeFileSync(
  path.join(frontendDir, "vite.config.js"),
  `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: { global: 'globalThis' },
  server: { port: 3000 },
});
`,
  "utf8"
);
console.log("vite.config.js written");

// ─── index.html ───────────────────────────────────────────
const fontsUrl =
  "https://fonts.googleapis.com/css2?family=Press+Start+2P" +
  "&family=JetBrains+Mono:wght@300;400;500;600;700" +
  "&family=Russo+One&display=swap";

fs.writeFileSync(
  path.join(frontendDir, "index.html"),
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="NadWork — The on-chain bounty platform for Monad builders. Hunt. Submit. Earn." />
    <meta property="og:title" content="NadWork — Hunt. Submit. Earn." />
    <meta property="og:description" content="Post tasks, submit work, earn MON on Monad." />
    <meta property="og:url" content="https://NadWork.xyz" />
    <title>NadWork — Hunt. Submit. Earn.</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${fontsUrl}" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "utf8"
);
console.log("index.html written");

// ─── .env.example for frontend ────────────────────────────
fs.writeFileSync(
  path.join(frontendDir, ".env.example"),
  `VITE_WALLETCONNECT_PROJECT_ID=
VITE_PINATA_API_KEY=
VITE_PINATA_SECRET_API_KEY=
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
VITE_BOUNTY_FACTORY_ADDRESS=
VITE_BOUNTY_REGISTRY_ADDRESS=
VITE_ESCROW_ADDRESS=
VITE_REPUTATION_REGISTRY_ADDRESS=
VITE_USDC_ADDRESS=0x754704Bc059F8C67012fEd69BC8A327a5aafb603
`,
  "utf8"
);
console.log(".env.example written");

// ─── addresses.json (empty placeholder) ──────────────────
fs.writeFileSync(
  path.join(srcDir, "config", "addresses.json"),
  JSON.stringify(
    {
      BountyFactory: "",
      BountyRegistry: "",
      NadWorkEscrow: "",
      ReputationRegistry: "",
    },
    null,
    2
  ),
  "utf8"
);
console.log("addresses.json written");

console.log("\nAll base frontend files written successfully.");
