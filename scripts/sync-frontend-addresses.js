const fs = require('fs');
const path = require('path');

function upsertEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) return content.replace(regex, line);
  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}${line}\n`;
}

function syncEnvFile(filePath, values) {
  const exists = fs.existsSync(filePath);
  let content = exists ? fs.readFileSync(filePath, 'utf8') : '';
  for (const [k, v] of Object.entries(values)) {
    content = upsertEnvValue(content, k, v);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const root = path.join(__dirname, '..');
  const deployPath = path.join(root, 'deployments', 'monad_mainnet.json');
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Deployment manifest not found: ${deployPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
  const contracts = manifest?.contracts || {};

  const values = {
    VITE_BOUNTY_FACTORY_ADDRESS: contracts?.BountyFactory?.address || '',
    VITE_BOUNTY_REGISTRY_ADDRESS: contracts?.BountyRegistry?.address || '',
    VITE_ESCROW_ADDRESS: contracts?.NadWorkEscrow?.address || '',
    VITE_REPUTATION_REGISTRY_ADDRESS: contracts?.ReputationRegistry?.address || '',
    VITE_IDENTITY_REGISTRY_ADDRESS: contracts?.IdentityRegistry?.address || '',
  };

  for (const [k, v] of Object.entries(values)) {
    if (!v) throw new Error(`Missing contract address in manifest for ${k}`);
  }

  const addressesJson = {
    BountyFactory: values.VITE_BOUNTY_FACTORY_ADDRESS,
    BountyRegistry: values.VITE_BOUNTY_REGISTRY_ADDRESS,
    NadWorkEscrow: values.VITE_ESCROW_ADDRESS,
    ReputationRegistry: values.VITE_REPUTATION_REGISTRY_ADDRESS,
    IdentityRegistry: values.VITE_IDENTITY_REGISTRY_ADDRESS,
  };

  const addressesPath = path.join(root, 'frontend', 'src', 'config', 'addresses.json');
  fs.writeFileSync(addressesPath, `${JSON.stringify(addressesJson, null, 2)}\n`, 'utf8');

  syncEnvFile(path.join(root, 'frontend', '.env'), values);

  const rootEnvPath = path.join(root, '.env');
  if (fs.existsSync(rootEnvPath)) {
    syncEnvFile(rootEnvPath, values);
  }

  console.log('Synced V4 deployment addresses from deployments/monad_mainnet.json');
  console.log(`- frontend/src/config/addresses.json`);
  console.log(`- frontend/.env`);
  if (fs.existsSync(rootEnvPath)) console.log(`- .env`);
}

main();
