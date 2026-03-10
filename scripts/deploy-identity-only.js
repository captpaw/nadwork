const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(50));
  console.log("Deploy: IdentityRegistry only");
  console.log("Network: ", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "MON");
  console.log("=".repeat(50));

  const Identity = await ethers.getContractFactory("IdentityRegistry");
  const identityReg = await Identity.deploy();
  await identityReg.waitForDeployment();
  const identityAddr = await identityReg.getAddress();
  console.log("\nIdentityRegistry deployed:", identityAddr);

  // Update frontend/src/config/addresses.json
  const addrFile = path.join(__dirname, "..", "frontend", "src", "config", "addresses.json");
  // FIX: Ensure directory exists before writing
  fs.mkdirSync(path.dirname(addrFile), { recursive: true });
  let addresses = {};
  if (fs.existsSync(addrFile)) {
    addresses = JSON.parse(fs.readFileSync(addrFile, "utf8"));
  }
  addresses.IdentityRegistry = identityAddr;
  fs.writeFileSync(addrFile, JSON.stringify(addresses, null, 2));
  console.log("addresses.json updated ✓");

  console.log("\n>>> Update .env and frontend/.env:");
  console.log(`VITE_IDENTITY_REGISTRY_ADDRESS=${identityAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
