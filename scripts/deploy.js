const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(60));
  console.log("NadWork Deployment");
  console.log("=".repeat(60));
  console.log("Network:  ", network.name);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(balance), "MON");
  console.log("=".repeat(60));

  // Validate private key format
  const pk = process.env.PRIVATE_KEY || '';
  if (!pk || !/^(0x)?[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("PRIVATE_KEY is missing or malformed (must be 64 hex chars)");
  }

  if (!process.env.MONAD_EXPLORER_API_KEY) {
    console.warn("WARNING: MONAD_EXPLORER_API_KEY not set — contract verification will fail");
  }

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  console.log("Treasury: ", treasury);
  console.log("");

  // ─── 1. Deploy BountyRegistry ────────────────────────────
  console.log("Deploying BountyRegistry...");
  const Registry = await ethers.getContractFactory("BountyRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("  BountyRegistry:", registryAddr);

  // ─── 2. Deploy NadWorkEscrow ─────────────────────────────
  console.log("Deploying NadWorkEscrow...");
  const Escrow = await ethers.getContractFactory("NadWorkEscrow");
  const escrow = await Escrow.deploy(treasury);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("  NadWorkEscrow:", escrowAddr);

  // ─── 3. Deploy ReputationRegistry ────────────────────────
  console.log("Deploying ReputationRegistry...");
  const Reputation = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("  ReputationRegistry:", reputationAddr);

  // ─── 4. Deploy IdentityRegistry ──────────────────────────
  console.log("Deploying IdentityRegistry...");
  const Identity = await ethers.getContractFactory("IdentityRegistry");
  const identityReg = await Identity.deploy();
  await identityReg.waitForDeployment();
  const identityAddr = await identityReg.getAddress();
  console.log("  IdentityRegistry:", identityAddr);

  // ─── 5. Deploy BountyFactory ─────────────────────────────
  console.log("Deploying BountyFactory...");
  const Factory = await ethers.getContractFactory("BountyFactory");
  const factory = await Factory.deploy(registryAddr, escrowAddr, reputationAddr, identityAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("  BountyFactory:", factoryAddr);

  // ─── 6. Wire factory into all contracts ──────────────────
  console.log("\nWiring factory...");
  await (await registry.setFactory(factoryAddr)).wait();
  console.log("  registry.setFactory ✓");
  await (await escrow.setFactory(factoryAddr)).wait();
  console.log("  escrow.setFactory ✓");
  await (await reputation.setFactory(factoryAddr)).wait();
  console.log("  reputation.setFactory ✓");
  await (await reputation.setIdentity(identityAddr)).wait();
  console.log("  reputation.setIdentity ✓");

  // ─── 7. Post-deployment sanity checks ────────────────────
  console.log("\nRunning sanity checks...");
  const factoryIdentity = await factory.identity();
  if (factoryIdentity.toLowerCase() !== identityAddr.toLowerCase()) {
    throw new Error("SANITY FAIL: factory.identity() does not match identityAddr");
  }
  console.log("  factory.identity() ✓");
  const escrowFactory = await escrow.factory();
  if (escrowFactory.toLowerCase() !== factoryAddr.toLowerCase()) {
    throw new Error("SANITY FAIL: escrow.factory() does not match factoryAddr");
  }
  console.log("  escrow.factory() ✓");

  // ─── 8. Save deployment JSON ─────────────────────────────
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    treasury,
    contracts: {
      BountyRegistry:     { address: registryAddr },
      NadWorkEscrow:      { address: escrowAddr },
      ReputationRegistry: { address: reputationAddr },
      IdentityRegistry:   { address: identityAddr },
      BountyFactory:      { address: factoryAddr },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment saved → deployments/${network.name}.json`);

  // ─── 9. Auto-write frontend addresses ────────────────────
  const frontendAddressFile = path.join(__dirname, "..", "frontend", "src", "config", "addresses.json");
  fs.mkdirSync(path.dirname(frontendAddressFile), { recursive: true });
  const addresses = {
    BountyFactory:      factoryAddr,
    BountyRegistry:     registryAddr,
    NadWorkEscrow:      escrowAddr,
    ReputationRegistry: reputationAddr,
    IdentityRegistry:   identityAddr,
  };
  fs.writeFileSync(frontendAddressFile, JSON.stringify(addresses, null, 2));
  console.log("Frontend addresses updated → frontend/src/config/addresses.json");

  // ─── 10. Auto-update frontend/.env (Vite reads this, not root .env) ──
  const frontendEnvFile = path.join(__dirname, "..", "frontend", ".env");
  let envContent = fs.existsSync(frontendEnvFile) ? fs.readFileSync(frontendEnvFile, "utf8") : "";
  const envUpdates = {
    VITE_BOUNTY_FACTORY_ADDRESS:      factoryAddr,
    VITE_BOUNTY_REGISTRY_ADDRESS:     registryAddr,
    VITE_ESCROW_ADDRESS:              escrowAddr,
    VITE_REPUTATION_REGISTRY_ADDRESS: reputationAddr,
    VITE_IDENTITY_REGISTRY_ADDRESS:   identityAddr,
  };
  for (const [key, val] of Object.entries(envUpdates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${val}`);
    } else {
      envContent += `\n${key}=${val}`;
    }
  }
  fs.writeFileSync(frontendEnvFile, envContent);
  console.log("Frontend .env updated → frontend/.env");

  console.log("\n" + "=".repeat(60));
  console.log("Deployment complete!");
  console.log("=".repeat(60));
  console.log("BountyFactory:     ", factoryAddr);
  console.log("BountyRegistry:    ", registryAddr);
  console.log("NadWorkEscrow:     ", escrowAddr);
  console.log("ReputationRegistry:", reputationAddr);
  console.log("IdentityRegistry:  ", identityAddr);
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("  1. Verify: npm run verify:monad");
  console.log("  2. Update .env with contract addresses");
  console.log("  3. Start frontend: cd frontend && npm run dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
