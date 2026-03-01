const { run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found for network: ${network.name}. Run deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const { contracts, treasury } = deployment;

  if (!process.env.MONAD_EXPLORER_API_KEY) {
    throw new Error("MONAD_EXPLORER_API_KEY not set — cannot verify contracts");
  }

  console.log("=".repeat(60));
  console.log("NadWork Contract Verification");
  console.log("Network:", network.name);
  console.log("=".repeat(60));

  // BountyRegistry — no constructor args
  console.log("\nVerifying BountyRegistry...");
  await verify(contracts.BountyRegistry.address, []);

  // NadWorkEscrow — constructor: treasury address
  console.log("\nVerifying NadWorkEscrow...");
  await verify(contracts.NadWorkEscrow.address, [treasury]);

  // ReputationRegistry — no constructor args
  console.log("\nVerifying ReputationRegistry...");
  await verify(contracts.ReputationRegistry.address, []);

  // FIX H-DEPLOY-1: IdentityRegistry — no constructor args
  console.log("\nVerifying IdentityRegistry...");
  await verify(contracts.IdentityRegistry.address, []);

  // FIX H-DEPLOY-1: BountyFactory — constructor: registry, escrow, reputation, identity (4 args)
  console.log("\nVerifying BountyFactory...");
  await verify(contracts.BountyFactory.address, [
    contracts.BountyRegistry.address,
    contracts.NadWorkEscrow.address,
    contracts.ReputationRegistry.address,
    contracts.IdentityRegistry.address,
  ]);

  console.log("\nAll contracts verified!");
}

async function verify(address, constructorArgs) {
  try {
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✓ Verified: ${address}`);
  } catch (err) {
    if (err.message.includes("Already Verified")) {
      console.log(`  ✓ Already verified: ${address}`);
    } else {
      console.error(`  ✗ Failed: ${address}`, err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
