const fs = require('fs');
const path = require('path');

const ADDRESS_VARS = [
  'VITE_BOUNTY_FACTORY_ADDRESS',
  'VITE_BOUNTY_REGISTRY_ADDRESS',
  'VITE_ESCROW_ADDRESS',
  'VITE_REPUTATION_REGISTRY_ADDRESS',
  'VITE_IDENTITY_REGISTRY_ADDRESS',
];

const REQUIRED_VARS = [
  ...ADDRESS_VARS,
  'VITE_WALLETCONNECT_PROJECT_ID',
  'VITE_PIN_PROXY_URL',
];

const SENSITIVE_FRONTEND_VARS = [
  'VITE_PINATA_API_KEY',
  'VITE_PINATA_SECRET_API_KEY',
];

function parseEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return { env: {}, source: null };
  }
  const content = fs.readFileSync(envPath, 'utf8');
  return { env: parseEnv(content), source: envPath };
}

function isValidAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isZeroAddress(value) {
  return /^0x0{40}$/i.test(value);
}

function isTruthy(value) {
  if (typeof value !== 'string') return false;
  return value.trim() !== '';
}

function printSection(title, lines) {
  if (!lines.length) return;
  console.log(`\n${title}`);
  for (const line of lines) console.log(`- ${line}`);
}

function main() {
  const root = path.join(__dirname, '..');
  const argFileIdx = process.argv.indexOf('--file');
  const customFile = argFileIdx > -1 ? process.argv[argFileIdx + 1] : '';
  const envFilePath = customFile
    ? path.resolve(process.cwd(), customFile)
    : path.join(root, 'frontend', '.env.production');

  const { env: fileEnv, source } = readEnvFile(envFilePath);
  const merged = { ...fileEnv, ...process.env };
  const errors = [];
  const warnings = [];
  const infos = [];

  infos.push(`Config source: ${source || 'process.env (no env file found)'}`);

  for (const key of REQUIRED_VARS) {
    if (!isTruthy(merged[key])) {
      errors.push(`${key} is required for production`);
    }
  }

  for (const key of ADDRESS_VARS) {
    const value = String(merged[key] || '');
    if (!value) continue;
    if (!isValidAddress(value)) {
      errors.push(`${key} must be a valid EVM address (0x + 40 hex chars)`);
      continue;
    }
    if (isZeroAddress(value)) {
      errors.push(`${key} cannot be zero address`);
    }
  }

  const wc = String(merged.VITE_WALLETCONNECT_PROJECT_ID || '');
  if (wc && wc.length < 16) {
    warnings.push('VITE_WALLETCONNECT_PROJECT_ID looks too short, double-check value');
  }

  const pinProxy = String(merged.VITE_PIN_PROXY_URL || '');
  if (pinProxy) {
    try {
      const parsed = new URL(pinProxy);
      if (parsed.protocol !== 'https:') {
        errors.push('VITE_PIN_PROXY_URL must use https in production');
      }
    } catch (_err) {
      errors.push('VITE_PIN_PROXY_URL must be a valid URL');
    }
  }

  for (const key of SENSITIVE_FRONTEND_VARS) {
    if (isTruthy(merged[key])) {
      errors.push(`${key} must not be set in production frontend environment`);
    }
  }

  if (String(merged.VITE_USE_TESTNET || '').trim()) {
    warnings.push('VITE_USE_TESTNET is set; verify this is intended for production');
  }
  if (String(merged.VITE_RPC_URL || '').toLowerCase().includes('testnet')) {
    warnings.push('VITE_RPC_URL points to testnet; verify production network');
  }
  if (String(merged.VITE_COMING_SOON || '').toLowerCase() === 'true') {
    warnings.push('VITE_COMING_SOON=true will hide the app behind Coming Soon page');
  }

  console.log('NadWork frontend production config check');
  printSection('Info', infos);
  printSection('Warnings', warnings);
  printSection('Errors', errors);

  if (errors.length) {
    console.log(`\nResult: FAILED (${errors.length} error${errors.length > 1 ? 's' : ''})`);
    process.exit(1);
  }

  console.log('\nResult: OK');
}

main();