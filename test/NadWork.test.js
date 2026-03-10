const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────
// Constants (mirrors BountyFactory.sol)
// ─────────────────────────────────────────────
const ONE_DAY    = 86400;
const SEVEN_DAYS = 7 * ONE_DAY;
const ETH        = (n) => ethers.parseEther(String(n));

// V4 constants — match contract values (Creator/Builder terminology)
const CREATOR_STAKE_BPS     = 300n;    // 3%
const MIN_CREATOR_STAKE     = ETH(0.01);
const SUBMISSION_STAKE_BPS  = 200n;   // 2%
const MIN_SUBMISSION_STAKE = ETH(0.005);
const MAX_SUBMISSION_STAKE = ETH(5);
const MIN_REVIEW_WINDOW    = BigInt(ONE_DAY);     // 24h
const GRACE_PERIOD_REJECT  = BigInt(2 * 3600);   // 2h
const BPS_DENOM            = 10_000n;

async function blockNow() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

// ── Deploy helpers ──────────────────────────────────────────────────────────
async function deployAll() {
  const [owner, treasury, poster, hunter1, hunter2, hunter3, anyone] =
    await ethers.getSigners();

  const Registry   = await ethers.getContractFactory("BountyRegistry");
  const Escrow     = await ethers.getContractFactory("NadWorkEscrow");
  const Reputation = await ethers.getContractFactory("ReputationRegistry");
  const Identity   = await ethers.getContractFactory("IdentityRegistry");
  const Factory    = await ethers.getContractFactory("BountyFactory");

  const registry   = await Registry.deploy();
  const escrow     = await Escrow.deploy(treasury.address);
  const reputation = await Reputation.deploy();
  const identity   = await Identity.deploy();

  const factory = await Factory.deploy(
    await registry.getAddress(),
    await escrow.getAddress(),
    await reputation.getAddress(),
    await identity.getAddress()
  );

  await registry.setFactory(await factory.getAddress());
  await escrow.setFactory(await factory.getAddress());
  await reputation.setFactory(await factory.getAddress());
  await reputation.setIdentity(await identity.getAddress());

  return { owner, treasury, poster, hunter1, hunter2, hunter3, anyone, registry, escrow, reputation, identity, factory };
}

// ── Default bounty params helper ─────────────────────────────────────────────
// Default reward is 0.5 MON so Tier-1 hunters (no prior submissions) can submit.
// Tests needing >= 1 MON should pass { totalReward: ETH(1) } explicitly.
async function defaultParams(overrides = {}) {
  const now = await blockNow();
  return {
    ipfsHash:     "QmTestHash123",
    title:        "Build a landing page",
    category:     "dev",
    rewardType:   0,
    rewardToken:  ethers.ZeroAddress,
    totalReward:  ETH(0.5),
    winnerCount:  1,
    prizeWeights: [100],
    deadline:     now + ONE_DAY * 3,
    ...overrides,
  };
}

// ── V4: compute creator stake ──────────────────────────────────────────────────
function calcCreatorStake(totalReward) {
  const pct = (totalReward * CREATOR_STAKE_BPS) / BPS_DENOM;
  return pct < MIN_CREATOR_STAKE ? MIN_CREATOR_STAKE : pct;
}

// ── V4: compute submission stake (no tier multiplier) ─────────────────────────
function calcSubStake(totalReward) {
  let pct = (totalReward * SUBMISSION_STAKE_BPS) / BPS_DENOM;
  if (pct < MIN_SUBMISSION_STAKE) pct = MIN_SUBMISSION_STAKE;
  if (pct > MAX_SUBMISSION_STAKE) pct = MAX_SUBMISSION_STAKE;
  return pct;
}

// ── Helper: register username for a signer (Tier 1+) ─────────────────────────
async function registerUsername(identity, signer, username) {
  await identity.connect(signer).setUsername(username);
}

// ── Helper: createBounty with correct V4 msg.value ───────────────────────────
async function createBounty(factory, signer, p, extra = {}) {
  const creatorStake = calcCreatorStake(p.totalReward);
  const defaultValue = p.rewardType === 0 ? p.totalReward + creatorStake : creatorStake;
  return factory.connect(signer).createBounty(
    p.ipfsHash, p.title, p.category,
    p.rewardType, p.rewardToken,
    p.totalReward, p.winnerCount, p.prizeWeights,
    p.deadline,
    false, // requiresApplication
    { value: defaultValue, ...extra }
  );
}

// ── Helper: submitWork with correct V4 msg.value ─────────────────────────────
async function submitWork(factory, signer, bountyId, ipfsHash, totalReward) {
  const stake = calcSubStake(totalReward);
  return factory.connect(signer).submitWork(BigInt(bountyId), ipfsHash, { value: stake });
}

// ── Helper: valid usernames (min 3 chars, lowercase a-z/0-9/hyphen) ──────────
const USERNAMES = {
  hunter1: 'hnt',    hunter2: 'hnt2',   hunter3: 'hnt3',
  h1: 'usr',         h2: 'us2',
  h1r: 'usr-r',      h2r: 'us2-r',
  h1c: 'usr-c',      h1gp: 'usr-gp',
  h1e: 'usr-e',      h1t: 'usr-t',      h1ta: 'usr-ta',
  h1d: 'usr-d',
  h1fr: 'usr-fr',    h1pc: 'usr-pc',    h1sus: 'usr-sus',
  h1m: 'usr-m',      h2m: 'us2-m',
  h1small: 'sm1',    h1large: 'lg1',
  h1tier1: 'ti1',
  hunter1_tier1: 'tr1', // underscore not allowed — use separate key
};

// ─────────────────────────────────────────────
// Access Control
// ─────────────────────────────────────────────
describe("Access Control", function () {
  it("registry rejects direct calls from non-factory", async function () {
    const { registry, poster } = await deployAll();
    const now = await blockNow();
    await expect(
      registry.connect(poster).registerBounty(
        poster.address, "Qm", "t", "dev", 0, ethers.ZeroAddress,
        ETH(1), 1, [100], now + ONE_DAY * 2, now + ONE_DAY * 3, ETH(0.05),
        false // requiresApplication
      )
    ).to.be.revertedWith("Registry: not factory");
  });

  it("escrow rejects direct depositNative from non-factory", async function () {
    const { escrow, poster } = await deployAll();
    const now = await blockNow();
    await expect(
      escrow.connect(poster).depositNative(1, poster.address, now + ONE_DAY, 0, { value: ETH(1) })
    ).to.be.revertedWithCustomError(escrow, "EscrowNotFactory");
  });

  it("reputation rejects direct writes from non-factory", async function () {
    const { reputation, poster } = await deployAll();
    await expect(reputation.connect(poster).recordSubmission(poster.address))
      .to.be.revertedWithCustomError(reputation, "ReputationNotFactory");
  });

  it("only owner can setFactory on registry", async function () {
    const { registry, poster } = await deployAll();
    await expect(registry.connect(poster).setFactory(poster.address))
      .to.be.revertedWith("Registry: not owner");
  });

  it("escrow rejects ETH sent directly", async function () {
    const { escrow, anyone } = await deployAll();
    await expect(
      anyone.sendTransaction({ to: await escrow.getAddress(), value: ETH(1) })
    ).to.be.reverted;
  });

  it("owner cannot bypass factory to call escrow release directly", async function () {
    const { escrow, owner, treasury } = await deployAll();
    await expect(
      escrow.connect(owner).release(1, [treasury.address], [100])
    ).to.be.revertedWithCustomError(escrow, "EscrowNotFactory");
  });
});

// ─────────────────────────────────────────────
// Create Bounty — V3 (with poster stake)
// ─────────────────────────────────────────────
describe("createBounty — V3 (poster stake)", function () {
  it("creates bounty and locks reward+stake in escrow", async function () {
    const { factory, escrow, poster, identity } = await deployAll();
    const p = await defaultParams();
    const creatorStake = calcCreatorStake(p.totalReward);
    await createBounty(factory, poster, p);

    const record = await escrow.getRecord(1);
    // reward stored separately from stake
    expect(record.amount).to.equal(p.totalReward);
    expect(record.depositor).to.equal(poster.address);

    // poster stake stored separately
    expect(await escrow.creatorStakes(1)).to.equal(creatorStake);
  });

  it("reverts if msg.value != totalReward + creatorStake", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams(); // 0.5 MON
    await expect(
      factory.connect(poster).createBounty(
        p.ipfsHash, p.title, p.category, p.rewardType, p.rewardToken,
        p.totalReward, p.winnerCount, p.prizeWeights, p.deadline,
        false, // requiresApplication
        { value: p.totalReward } // only reward, missing creator stake
      )
    ).to.be.revertedWithCustomError(factory, "FactoryWrongNativeAmount");
  });

  it("sets reviewDeadline on the bounty", async function () {
    const { factory, registry, poster } = await deployAll();
    const p = await defaultParams();
    const txTime = BigInt(await blockNow());
    await createBounty(factory, poster, p);
    const bounty = await registry.getBounty(1);
    expect(bounty.reviewDeadline).to.be.gt(BigInt(p.deadline));
    expect(bounty.creatorStake).to.equal(calcCreatorStake(p.totalReward));
  });

  it("increments bountyCount", async function () {
    const { factory, registry, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    expect(await registry.bountyCount()).to.equal(1);
  });

  it("reverts if deadline too soon", async function () {
    const { factory, poster } = await deployAll();
    const now = await blockNow();
    const p = await defaultParams({ deadline: now + 100 });
    await expect(createBounty(factory, poster, p)).to.be.revertedWithCustomError(factory, "FactoryDeadlineTooSoon");
  });

  it("reverts if deadline too far", async function () {
    const { factory, poster } = await deployAll();
    const now = await blockNow();
    const p = await defaultParams({ deadline: now + 181 * ONE_DAY });
    await expect(createBounty(factory, poster, p)).to.be.revertedWithCustomError(factory, "FactoryDeadlineTooFar");
  });

  it("reverts if prize weights don't sum to 100", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams({ winnerCount: 2, prizeWeights: [60, 30] });
    await expect(createBounty(factory, poster, p)).to.be.revertedWithCustomError(factory, "FactoryWeightsMustSumTo100");
  });

  it("updates project reputation stats", async function () {
    const { factory, reputation, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stats = await reputation.creators(poster.address);
    expect(stats.bountiesPosted).to.equal(1);
  });
});

// ─────────────────────────────────────────────
// Submit Work — V3 (with identity tier + stake)
// ─────────────────────────────────────────────
describe("submitWork — V3 (identity + submission stake)", function () {
  // Default bounty: 0.5 MON so Tier 1 hunters can submit
  async function setup() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "hnt");
    await registerUsername(identity, hunter2, "hnt2");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    return ctx;
  }

  it("hunter with username (Tier 1) can submit and stake is locked", async function () {
    const { factory, escrow, hunter1 } = await setup();
    const stake = calcSubStake(ETH(0.5)); // Tier 1 = 1.5×
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(stake);
  });

  it("anonymous hunter (no username) cannot submit", async function () {
    const { factory, hunter3 } = await setup();
    const stake = calcSubStake(ETH(0.5));
    await expect(
      factory.connect(hunter3).submitWork(1, "QmSub", { value: stake })
    ).to.be.revertedWithCustomError(factory, "FactoryUsernameRequired");
  });

  it("reverts if insufficient submission stake", async function () {
    const { factory, hunter1 } = await setup();
    await expect(
      factory.connect(hunter1).submitWork(1, "QmSub", { value: 0n })
    ).to.be.revertedWithCustomError(factory, "FactoryInsufficientSubmissionStake");
  });

  it("poster cannot submit", async function () {
    const { factory, poster } = await setup();
    const stake = calcSubStake(ETH(0.5));
    await expect(factory.connect(poster).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWithCustomError(factory, "FactoryCreatorCannotSubmit");
  });

  it("hunter cannot submit twice", async function () {
    const { factory, hunter1 } = await setup();
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await expect(factory.connect(hunter1).submitWork(1, "QmSub2", { value: stake }))
      .to.be.revertedWithCustomError(factory, "FactoryAlreadySubmitted");
  });

  it("excess stake above required is refunded to hunter", async function () {
    const { factory, hunter1 } = await setup();
    const required = calcSubStake(ETH(0.5));
    const excess   = ETH(0.5);
    const balBefore = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).submitWork(1, "QmSub1", { value: required + excess });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;
    const balAfter = await ethers.provider.getBalance(hunter1.address);
    const spent = balBefore - balAfter - gasUsed;
    expect(spent).to.be.closeTo(required, ETH(0.0001));
  });

  it("reverts after deadline", async function () {
    const { factory, hunter1 } = await setup();
    await time.increase(ONE_DAY * 4);
    const stake = calcSubStake(ETH(0.5));
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWithCustomError(factory, "FactoryDeadlinePassed");
  });

  it("builder with username can submit to bounty >= 1 MON (V4: no tier restriction)", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "tr1");
    const p = await defaultParams({ totalReward: ETH(2) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(2));
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.not.be.reverted;
  });
});

// ─────────────────────────────────────────────
// Approve Winners — V3 (stake refunds)
// ─────────────────────────────────────────────
describe("approveWinners — V3 (stake refunds)", function () {
  // 0.5 MON bounty so Tier 1 can submit
  async function setup() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "usr");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    return ctx;
  }

  it("releases 97% reward to winner", async function () {
    const { factory, poster, hunter1, treasury } = await setup();
    const hunterBefore   = await ethers.provider.getBalance(hunter1.address);
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    const tx = await factory.connect(poster).approveWinners(1, [1], [1]);
    await tx.wait();

    const hunterAfter   = await ethers.provider.getBalance(hunter1.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    // Hunter receives reward 97% of 0.5 + submission stake back
    const subStake = calcSubStake(ETH(0.5));
    expect(hunterAfter - hunterBefore).to.be.closeTo(ETH(0.485) + subStake, ETH(0.001));
    expect(treasuryAfter - treasuryBefore).to.equal(ETH(0.015)); // 3% of 0.5
  });

  it("returns poster stake to poster on completion", async function () {
    const { factory, poster, escrow } = await setup();
    const creatorStake = calcCreatorStake(ETH(0.5));
    const posterBefore = await ethers.provider.getBalance(poster.address);
    const tx = await factory.connect(poster).approveWinners(1, [1], [1]);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;
    const posterAfter = await ethers.provider.getBalance(poster.address);
    expect(posterAfter - posterBefore + gasUsed).to.be.closeTo(creatorStake, ETH(0.001));
    expect(await escrow.creatorStakes(1)).to.equal(0n);
  });

  it("returns submission stake to winning hunter", async function () {
    const { factory, poster, hunter1, escrow } = await setup();
    await factory.connect(poster).approveWinners(1, [1], [1]);
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
  });

  it("updates reputation: winCount and totalEarned", async function () {
    const { factory, poster, hunter1, reputation } = await setup();
    await factory.connect(poster).approveWinners(1, [1], [1]);
    const stats = await reputation.builders(hunter1.address);
    expect(stats.winCount).to.equal(1);
    expect(stats.totalEarned).to.be.gt(0n);
  });

  it("non-poster cannot approve", async function () {
    const { factory, hunter2, identity } = await setup();
    await registerUsername(identity, hunter2, "us2");
    await expect(factory.connect(hunter2).approveWinners(1, [1], [1]))
      .to.be.revertedWithCustomError(factory, "FactoryNotCreator");
  });
});

// ─────────────────────────────────────────────
// Reject Submission — V3 (grace period)
// ─────────────────────────────────────────────
describe("rejectSubmission — V3 (grace period)", function () {
  async function setup() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "usr-r");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    return ctx;
  }

  it("within grace period: rejects and stake is HELD (not refunded), gracePeriodExpired = false", async function () {
    const { factory, poster, hunter1, registry, escrow } = await setup();
    const stakeAmt = await escrow.submissionStakes(1, hunter1.address);
    await factory.connect(poster).rejectSubmission(1, 1);
    const sub = await registry.getSubmission(1);
    expect(sub.gracePeriodExpired).to.be.false;
    // Stake is held in submissionStakes until hunter disputes or grace period elapses
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(stakeAmt);
  });

  it("after grace period: rejects and refunds stake, gracePeriodExpired = true", async function () {
    const { factory, poster, hunter1, registry, escrow } = await setup();
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);
    await factory.connect(poster).rejectSubmission(1, 1);
    const sub = await registry.getSubmission(1);
    expect(sub.gracePeriodExpired).to.be.true;
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
  });

  it("non-poster cannot reject", async function () {
    const { factory, hunter2, identity } = await setup();
    await registerUsername(identity, hunter2, "us2-r");
    await expect(factory.connect(hunter2).rejectSubmission(1, 1))
      .to.be.revertedWithCustomError(factory, "FactoryNotCreator");
  });
});

// ─────────────────────────────────────────────
// Cancel Bounty — V3 (poster stake slash)
// ─────────────────────────────────────────────
describe("cancelBounty — V3 (poster stake slash)", function () {
  it("cancel with no submissions: full refund + poster stake returned", async function () {
    const { factory, poster, escrow } = await deployAll();
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);

    const posterBal = await ethers.provider.getBalance(poster.address);
    const tx  = await factory.connect(poster).cancelBounty(1);
    const rec = await tx.wait();
    const gas = rec.gasUsed * tx.gasPrice;
    const posterBalAfter = await ethers.provider.getBalance(poster.address);

    const creatorStake = calcCreatorStake(ETH(0.5));
    expect(posterBalAfter - posterBal + gas).to.be.closeTo(ETH(0.5) + creatorStake, ETH(0.001));
    expect(await escrow.creatorStakes(1)).to.equal(0n);
  });

  it("cancel with valid submissions: comp paid + poster stake slashed 50/50", async function () {
    const { factory, poster, hunter1, escrow, treasury, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-c");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const subStake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: subStake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);

    const creatorStake  = calcCreatorStake(ETH(0.5));
    const compRequired = ETH(0.5) * BigInt(200) / 10_000n; // 2% of 0.5
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    const hunter1Before  = await ethers.provider.getBalance(hunter1.address);

    await factory.connect(poster).cancelBounty(1, { value: compRequired + ETH(0.01) });

    // FIX H-01: cancelBounty now uses pull-payment — hunter balance unchanged immediately.
    // Hunter must call claimCancelComp() + submission stake was already in escrow.
    const hunter1After  = await ethers.provider.getBalance(hunter1.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    const halfStake = creatorStake / 2n;
    // Comp is queued (pull-payment)
    expect(await factory.pendingCancelComps(hunter1.address)).to.equal(compRequired);
    // FIX XC-02: subStake now also queued as pull-payment (pendingStakeRefunds), not pushed.
    // Hunter immediately receives: only 50% poster stake slash from slashPosterStake (escrow push)
    expect(await factory.pendingStakeRefunds(hunter1.address)).to.equal(subStake);
    expect(hunter1After - hunter1Before).to.be.closeTo(halfStake, ETH(0.001));
    // Treasury gets the other 50% of poster stake
    expect(treasuryAfter - treasuryBefore).to.be.closeTo(halfStake, ETH(0.001));
    expect(await escrow.creatorStakes(1)).to.equal(0n);
  });

  it("cancel records cancelCount in reputation", async function () {
    const { factory, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-rep");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);
    const comp = ETH(0.5) * 200n / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });
    const stats = await reputation.creators(poster.address);
    expect(stats.cancelCount).to.equal(1n);
  });

  it("cancel with only grace-period submissions: treated as no submissions", async function () {
    const { factory, poster, hunter1, escrow, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-gp");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    const posterBefore = await ethers.provider.getBalance(poster.address);
    const tx = await factory.connect(poster).cancelBounty(1);
    const rec = await tx.wait();
    const gas = rec.gasUsed * tx.gasPrice;
    const posterAfter = await ethers.provider.getBalance(poster.address);
    const creatorStake = calcCreatorStake(ETH(0.5));
    expect(posterAfter - posterBefore + gas).to.be.closeTo(ETH(0.5) + creatorStake, ETH(0.001));
  });
});

// ─────────────────────────────────────────────
// Expire Bounty
// ─────────────────────────────────────────────
describe("expireBounty — V3", function () {
  it("refunds reward and poster stake when no submissions", async function () {
    const { factory, poster, escrow } = await deployAll();
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    await time.increase(ONE_DAY * 4);

    const posterBefore = await ethers.provider.getBalance(poster.address);
    // expireBounty can be called by anyone — use poster for gas tracking
    const tx  = await factory.connect(poster).expireBounty(1);
    const rec = await tx.wait();
    const gas = rec.gasUsed * tx.gasPrice;
    const posterAfter = await ethers.provider.getBalance(poster.address);

    const creatorStake = calcCreatorStake(ETH(0.5));
    expect(posterAfter - posterBefore + gas).to.be.closeTo(ETH(0.5) + creatorStake, ETH(0.001));
    expect(await escrow.creatorStakes(1)).to.equal(0n);
  });

  it("reverts if bounty has submissions", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-e");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await time.increase(ONE_DAY * 4);
    await expect(factory.expireBounty(1))
      .to.be.revertedWithCustomError(factory, "FactoryHasSubmissionsUseTriggerTimeout");
  });
});

// ─────────────────────────────────────────────
// Trigger Timeout — V3 (reviewDeadline + poster stake slash)
// ─────────────────────────────────────────────
describe("triggerTimeout — V3 (review deadline + poster stake slashed)", function () {
  it("splits reward among pending hunters and slashes poster stake to treasury", async function () {
    const { factory, poster, hunter1, escrow, treasury, registry, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-t");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });

    const bounty = await registry.getBounty(1);
    await time.increaseTo(Number(bounty.reviewDeadline) + 1);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    const hunter1Before  = await ethers.provider.getBalance(hunter1.address);
    const creatorStake    = calcCreatorStake(ETH(0.5));

    await factory.connect(poster).triggerTimeout(1);

    const treasuryAfter = await ethers.provider.getBalance(treasury.address);
    const hunter1After  = await ethers.provider.getBalance(hunter1.address);

    // FIX H-02: triggerTimeout uses pull-payment. Hunter payout is queued, not pushed.
    // FIX XC-02: Submission stake also queued as pull-payment (pendingStakeRefunds).
    const pending = await factory.pendingTimeoutPayouts(hunter1.address);
    expect(pending).to.be.closeTo(ETH(0.485), ETH(0.002));
    // Hunter stake now queued as pull-payment (pendingStakeRefunds), not pushed directly
    expect(await factory.pendingStakeRefunds(hunter1.address)).to.equal(stake);
    expect(hunter1After - hunter1Before).to.be.closeTo(0n, ETH(0.001));
    // Treasury gets 3% fee + 100% poster stake
    expect(treasuryAfter - treasuryBefore).to.be.closeTo(ETH(0.015) + creatorStake, ETH(0.002));
  });

  it("reverts if review window is still active", async function () {
    const { factory, poster, hunter1, identity, registry } = await deployAll();
    await registerUsername(identity, hunter1, "usr-ta");
    const p = await defaultParams(); // 0.5 MON, deadline = now + 3 days
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Advance past deadline but NOT past reviewDeadline (which is deadline + 24h)
    // deadline = now+3days, reviewDeadline = deadline+24h = now+4days
    // Advance to deadline + 12h (midway through review window)
    await time.increase(ONE_DAY * 3 + ONE_DAY / 2);
    await expect(factory.triggerTimeout(1))
      .to.be.revertedWithCustomError(factory, "FactoryReviewWindowActive");
  });
});

// ─────────────────────────────────────────────
// Dispute Mechanism — V3
// ─────────────────────────────────────────────
describe("Dispute — V3 (stake outcomes)", function () {
  async function setupDispute() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "usr-d");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject WITHIN grace period so stake is held (not refunded) and dispute window is open
    await factory.connect(poster).rejectSubmission(1, 1);
    return ctx;
  }

  it("hunter can raise dispute on rejected submission", async function () {
    const { factory, registry, hunter1 } = await setupDispute();
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(5); // DISPUTED
  });

  it("dispute in favor of hunters: poster stake slashed 100% to hunter, fraudCancel recorded", async function () {
    const { factory, owner, poster, hunter1, escrow, reputation } = await setupDispute();
    const creatorStake = calcCreatorStake(ETH(0.5));
    const subStake    = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // After raiseDispute: submissionStakes[1][hunter1] = 0, heldDisputeStakes[1][hunter1] = subStake
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(subStake);

    const hunter1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const hunter1After = await ethers.provider.getBalance(hunter1.address);

    // Hunter receives: poster stake (100% slash) + reward share from releaseToAll (97% of 0.5) + held stake returned
    const rewardShare = ETH(0.485); // 97% of 0.5 (1 hunter, gets all)
    expect(hunter1After - hunter1Before).to.be.closeTo(creatorStake + rewardShare + subStake, ETH(0.005));
    expect(await escrow.creatorStakes(1)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(0n);

    const projStats = await reputation.creators(poster.address);
    expect(projStats.fraudCancelCount).to.equal(1n);
    expect(projStats.disputeLost).to.equal(1n);
  });

  it("dispute denied: heldDisputeStake slashed to treasury", async function () {
    const { factory, owner, hunter1, escrow, reputation, treasury } = await setupDispute();
    const subStake = calcSubStake(ETH(0.5));
    // Before dispute: stake is still in submissionStakes (held inGrace)
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(subStake);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // After raiseDispute: stake moved to heldDisputeStakes
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(subStake);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    // Held stake slashed to treasury
    expect(treasuryAfter - treasuryBefore).to.equal(subStake);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(0n);
    // disputeLost recorded in reputation
    const hunterStats = await reputation.builders(hunter1.address);
    expect(hunterStats.disputeLost).to.equal(1n);
  });

  it("hunter can claim dispute deposit refund after winning", async function () {
    const { factory, owner, hunter1 } = await setupDispute();
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);

    const pending = await factory.pendingDisputeRefunds(hunter1.address);
    expect(pending).to.equal(ETH(0.01));

    const balBefore = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).claimDisputeRefund();
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const balAfter = await ethers.provider.getBalance(hunter1.address);
    expect(balAfter - balBefore + gas).to.be.closeTo(ETH(0.01), ETH(0.0001));
  });
});

// ─────────────────────────────────────────────
// Progressive Identity — Tier enforcement
// ─────────────────────────────────────────────
describe("Progressive Identity — Tier checks", function () {
  it("Tier 0 (anonymous) cannot submit to any bounty", async function () {
    const { factory, poster, hunter3 } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await expect(factory.connect(hunter3).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWithCustomError(factory, "FactoryUsernameRequired");
  });

  it("Tier 1 can submit to small bounty (<1 MON)", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "sm1");
    const p = await defaultParams({ totalReward: ETH(0.5) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5)); // Tier 1 = 1.5×
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.not.be.reverted;
  });

  it("V4: builder with username can submit to any bounty (no tier restriction)", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "lg1");
    const p = await defaultParams({ totalReward: ETH(2) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(2));
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.not.be.reverted;
  });
});

// ─────────────────────────────────────────────
// Reputation V3 — Score formula with penalties
// ─────────────────────────────────────────────
describe("Reputation V3 — fraud penalties in score", function () {
  it("hunter score decreases after disputeLost is recorded", async function () {
    const { factory, owner, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-fr");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject within grace period so dispute window is open
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);

    const stats = await reputation.builders(hunter1.address);
    const scoreAfter = await reputation.getBuilderScore(hunter1.address);
    expect(stats.disputeLost).to.equal(1n);
    // Score = (winCount×30) + (subCount×5) + (earned/1e15) - (fraudCount×50) - (disputeLost×15)
    // = 0 + 5 + 0 - 0 - 15 = 0 (capped at 0)
    expect(scoreAfter).to.equal(0n);
  });

  it("project score decreases after fraudCancelCount is recorded", async function () {
    const { factory, owner, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-pc");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject within grace period
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });

    const scoreBefore = await reputation.getCreatorScore(poster.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const scoreAfter = await reputation.getCreatorScore(poster.address);
    expect(scoreAfter).to.be.lte(scoreBefore);
  });

  it("isSuspicious returns true for a poster with fraudCancelCount > 0", async function () {
    const { factory, owner, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-sus");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject within grace period
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);

    expect(await reputation.isSuspicious(poster.address, false)).to.be.true;
  });
});

// ─────────────────────────────────────────────
// Multi-winner — V3
// ─────────────────────────────────────────────
describe("approveWinners — multi-winner V3", function () {
  it("2-winner bounty pays correct splits and refunds both stakes", async function () {
    const { factory, poster, hunter1, hunter2, escrow, treasury, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-m");
    await registerUsername(identity, hunter2, "us2-m");
    const p = await defaultParams({ totalReward: ETH(1), winnerCount: 2, prizeWeights: [60, 40] });
    await createBounty(factory, poster, p);
    // These hunters are Tier 1 (no prior subs) on a 1 MON bounty
    // The 1 MON bounty requires Tier 2 (>= 1 ether) — use 0.5 MON instead
    // Actually ETH(1) exactly triggers the >= 1 ether check → use smaller bounty
    const p2 = await defaultParams({ winnerCount: 2, prizeWeights: [60, 40] }); // 0.5 MON
    const { factory: f2, poster: po2, hunter1: h1, hunter2: h2, escrow: esc2, identity: id2 } = await deployAll();
    await registerUsername(id2, h1, "m1-usr");
    await registerUsername(id2, h2, "m2-usr");
    await createBounty(f2, po2, p2);
    const stake1 = calcSubStake(ETH(0.5));
    const stake2 = calcSubStake(ETH(0.5));
    await f2.connect(h1).submitWork(1, "QmSub1", { value: stake1 });
    await f2.connect(h2).submitWork(1, "QmSub2", { value: stake2 });

    const h1Before = await ethers.provider.getBalance(h1.address);
    const h2Before = await ethers.provider.getBalance(h2.address);

    await f2.connect(po2).approveWinners(1, [1, 2], [1, 2]);

    const h1After = await ethers.provider.getBalance(h1.address);
    const h2After = await ethers.provider.getBalance(h2.address);

    // 60% of 97% of 0.5 = 0.291 + stake1
    // 40% of 97% of 0.5 = 0.194 + stake2
    expect(h1After - h1Before).to.be.closeTo(ETH(0.291) + stake1, ETH(0.002));
    expect(h2After - h2Before).to.be.closeTo(ETH(0.194) + stake2, ETH(0.002));

    expect(await esc2.submissionStakes(1, h1.address)).to.equal(0n);
    expect(await esc2.submissionStakes(1, h2.address)).to.equal(0n);
  });
});

// ─────────────────────────────────────────────
// Featured Bounty
// ─────────────────────────────────────────────
describe("Featured Bounty", function () {
  it("poster can pay FEATURED_FEE to mark bounty featured", async function () {
    const { factory, poster, registry } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const fee = await factory.FEATURED_FEE();
    await factory.connect(poster).setFeatured(1, true, { value: fee });
    const bounty = await registry.getBounty(1);
    expect(bounty.featured).to.be.true;
  });

  it("reverts if insufficient featured fee", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    await expect(factory.connect(poster).setFeatured(1, true, { value: ETH(0.1) }))
      .to.be.revertedWithCustomError(factory, "FactoryInsufficientFeaturedFee");
  });
});

// ─────────────────────────────────────────────
// View helpers — V3
// ─────────────────────────────────────────────
describe("View helpers — V3", function () {
  it("getCreatorStake returns correct amount", async function () {
    const { factory } = await deployAll();
    const expected = calcCreatorStake(ETH(10));
    const onChain = await factory.getCreatorStake(ETH(10));
    expect(onChain).to.equal(expected);
  });

  it("minimum poster stake applied for very small bounties", async function () {
    const { factory } = await deployAll();
    const onChain = await factory.getCreatorStake(ETH(0.001));
    expect(onChain).to.equal(MIN_CREATOR_STAKE);
  });
});

// ─────────────────────────────────────────────
// FIX-1: sweep() guard — cannot steal dispute refunds
// ─────────────────────────────────────────────
describe("sweep() — cannot steal pending dispute refunds (FIX-1)", function () {
  async function setupDisputeWon() {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "sw1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Reject within grace period so stake is held (not refunded) and dispute window is open
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // Resolve in favor of hunter → queues 0.01 MON refund
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    return ctx;
  }

  it("owner cannot sweep pending dispute refund amount", async function () {
    const { factory, owner } = await setupDisputeWon();
    // Owner tries to sweep — factory balance = 0.01 MON (dispute deposit only)
    // sweepable = balance - _totalPendingRefunds = 0
    await expect(factory.connect(owner).sweep()).to.be.revertedWithCustomError(factory, "FactoryNothingToSweep");
  });

  it("hunter can still claim after sweep of unrelated fees", async function () {
    const { factory, owner, hunter1, anyone } = await setupDisputeWon();
    // Send extra ETH directly to factory (simulates denied-dispute deposits, etc.)
    // This ETH is above the reserved pendingDisputeRefunds amount and is sweepable.
    await anyone.sendTransaction({ to: await factory.getAddress(), value: ETH(0.05) });
    // Owner sweeps the 0.05 MON (only non-reserved amount)
    await factory.connect(owner).sweep();
    // Hunter can still claim their 0.01 MON dispute deposit refund
    const before = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).claimDisputeRefund();
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const after = await ethers.provider.getBalance(hunter1.address);
    expect(after - before + gas).to.equal(ETH(0.01));
  });
});

// ─────────────────────────────────────────────
// FIX-9: transitionToReviewing()
// ─────────────────────────────────────────────
describe("transitionToReviewing() (FIX-9)", function () {
  async function setupExpiredWithSub() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "rv1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Advance time past deadline
    await time.increase(ONE_DAY * 3 + 60);
    return ctx;
  }

  it("transitions bounty to REVIEWING after deadline with pending submissions", async function () {
    const { factory, registry, anyone } = await setupExpiredWithSub();
    await factory.connect(anyone).transitionToReviewing(1);
    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(1n); // REVIEWING = 1
  });

  it("emits BountyEnteredReview event", async function () {
    const { factory, anyone } = await setupExpiredWithSub();
    await expect(factory.connect(anyone).transitionToReviewing(1))
      .to.emit(factory, "BountyEnteredReview")
      .withArgs(1n, 1n);
  });

  it("reverts if deadline not yet reached", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "rv2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Do NOT advance time
    await expect(factory.transitionToReviewing(1)).to.be.revertedWithCustomError(factory, "FactoryDeadlineNotReached");
  });

  it("reverts if no pending submissions exist", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    await time.increase(ONE_DAY * 3 + 60);
    await expect(factory.transitionToReviewing(1)).to.be.revertedWithCustomError(factory, "FactoryNoSubmissions");
  });

  it("reverts if called again on REVIEWING bounty", async function () {
    const { factory, anyone } = await setupExpiredWithSub();
    await factory.connect(anyone).transitionToReviewing(1);
    await expect(factory.connect(anyone).transitionToReviewing(1))
      .to.be.revertedWithCustomError(factory, "FactoryNotActive");
  });

  it("poster can still approveWinners after REVIEWING transition", async function () {
    const { factory, registry, poster, anyone } = await setupExpiredWithSub();
    await factory.connect(anyone).transitionToReviewing(1);
    // approveWinners must work in REVIEWING state
    await factory.connect(poster).approveWinners(1, [1], [1]);
    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(2n); // COMPLETED = 2
  });

  it("transitionToReviewing reverts when paused (FIX M-05)", async function () {
    const { factory, owner, anyone } = await setupExpiredWithSub();
    await factory.connect(owner).pause();
    await expect(factory.connect(anyone).transitionToReviewing(1))
      .to.be.revertedWithCustomError(factory, "FactoryPaused");
    await factory.connect(owner).unpause();
  });
});

// ─────────────────────────────────────────────
// FIX C-01: Dispute window from rejectedAt
// ─────────────────────────────────────────────
describe("FIX C-01: dispute window measured from rejectedAt", function () {
  async function setupRejectedInGrace() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "c01h");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    return ctx;
  }

  it("hunter has full 2h window after rejectedAt even if poster waited", async function () {
    const { factory, hunter1, poster, registry } = await setupRejectedInGrace();
    // Poster waits 1h 50m then rejects — old code would leave hunter with only 10 min
    await time.increase(3600 + 3000); // 1h50m after submission
    await factory.connect(poster).rejectSubmission(1, 1);
    const sub = await registry.getSubmission(1);
    expect(sub.rejectedAt).to.be.gt(0n);

    // Hunter still has a full 2h window from rejectedAt
    await time.increase(3600); // 1h after rejection — still within window
    await expect(
      factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) })
    ).to.not.be.reverted;
  });

  it("dispute window expires 2h after rejectedAt", async function () {
    const { factory, hunter1, poster } = await setupRejectedInGrace();
    await factory.connect(poster).rejectSubmission(1, 1);
    // Advance past the 2h dispute window from rejectedAt
    await time.increase(2 * 3600 + 60);
    await expect(
      factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) })
    ).to.be.revertedWithCustomError(factory, "FactoryDisputeWindowExpired");
  });

  it("withdrawRejectedStake also uses rejectedAt (FIX C-01)", async function () {
    const { factory, hunter1, poster } = await setupRejectedInGrace();
    await factory.connect(poster).rejectSubmission(1, 1);
    // Cannot withdraw before 2h from rejectedAt
    await expect(
      factory.connect(hunter1).withdrawRejectedStake(1, 1)
    ).to.be.revertedWithCustomError(factory, "FactoryGracePeriodActiveDisputeInstead");
    // Can withdraw after 2h from rejectedAt
    await time.increase(2 * 3600 + 60);
    await expect(factory.connect(hunter1).withdrawRejectedStake(1, 1)).to.not.be.reverted;
  });
});

// ─────────────────────────────────────────────
// FIX C-02: resolveDispute only rewards disputed submissions
// ─────────────────────────────────────────────
describe("FIX C-02: resolveDispute only pays hunters with disputed==true", function () {
  it("pending submission hunter does NOT get reward when dispute resolved in favor", async function () {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "c02h1");
    await registerUsername(identity, hunter2, "c02h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake1 = calcSubStake(ETH(0.5));
    const stake2 = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake1 });
    await factory.connect(hunter2).submitWork(1, "QmSub2", { value: stake2 });
    // Reject hunter1 in grace period → hunter1 disputes
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // Hunter2's submission is still PENDING (not involved in dispute)
    const h2Before = await ethers.provider.getBalance(hunter2.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const h2After = await ethers.provider.getBalance(hunter2.address);
    // Hunter2 should NOT have received any reward from the dispute resolution
    expect(h2After - h2Before).to.equal(0n);
  });

  it("only the disputing hunter receives reward when dispute won", async function () {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "c02w1");
    await registerUsername(identity, hunter2, "c02w2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake1 = calcSubStake(ETH(0.5));
    const stake2 = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake1 });
    await factory.connect(hunter2).submitWork(1, "QmSub2", { value: stake2 });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const h1After = await ethers.provider.getBalance(hunter1.address);
    // Hunter1 should receive some funds (reward pool split)
    expect(h1After).to.be.gt(h1Before);
  });
});

// ─────────────────────────────────────────────
// FIX H-01: cancelBounty pull-payment (DoS resistance)
// ─────────────────────────────────────────────
describe("FIX H-01: cancelBounty pull-payment", function () {
  async function setupCancelWithSub() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "h01h");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    return ctx;
  }

  it("cancelBounty queues comp and does NOT push ETH immediately", async function () {
    const { factory, poster, hunter1, escrow } = await setupCancelWithSub();
    const comp = (ETH(0.5) * 200n) / 10_000n;
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(poster).cancelBounty(1, { value: comp });
    const h1After = await ethers.provider.getBalance(hunter1.address);
    // FIX XC-02: Comp is NOT pushed, AND submission stake is also now pull-payment (pendingStakeRefunds).
    // Hunter immediately receives: only 50% poster stake slash (pushed by slashPosterStake).
    const stake = calcSubStake(ETH(0.5));
    const creatorStake = calcCreatorStake(ETH(0.5));
    const halfPosterStake = creatorStake / 2n;
    expect(h1After - h1Before).to.be.closeTo(halfPosterStake, ETH(0.0005));
    // pendingCancelComps should be exactly comp
    expect(await factory.pendingCancelComps(hunter1.address)).to.equal(comp);
    // pendingStakeRefunds should be exactly the submission stake
    expect(await factory.pendingStakeRefunds(hunter1.address)).to.equal(stake);
  });

  it("hunter claims cancel compensation via claimCancelComp()", async function () {
    const { factory, poster, hunter1 } = await setupCancelWithSub();
    const comp = (ETH(0.5) * 200n) / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).claimCancelComp();
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const h1After = await ethers.provider.getBalance(hunter1.address);
    expect(h1After - h1Before + gas).to.equal(comp);
  });

  it("double claim reverts", async function () {
    const { factory, poster, hunter1 } = await setupCancelWithSub();
    const comp = (ETH(0.5) * 200n) / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });
    await factory.connect(hunter1).claimCancelComp();
    await expect(factory.connect(hunter1).claimCancelComp())
      .to.be.revertedWithCustomError(factory, "FactoryNoCancelCompPending");
  });

  it("sweep() cannot steal cancel comp reserves (FIX H-01)", async function () {
    const { factory, owner, poster, hunter1, anyone } = await setupCancelWithSub();
    const comp = (ETH(0.5) * 200n) / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });
    // Factory only holds comp amount — sweepable = 0
    await expect(factory.connect(owner).sweep())
      .to.be.revertedWithCustomError(factory, "FactoryNothingToSweep");
    // Send extra ETH, now sweep works without touching comp
    await anyone.sendTransaction({ to: await factory.getAddress(), value: ETH(0.05) });
    await factory.connect(owner).sweep();
    // Hunter can still claim their comp
    await expect(factory.connect(hunter1).claimCancelComp()).to.not.be.reverted;
  });
});

// ─────────────────────────────────────────────
// FIX H-02: triggerTimeout pull-payment (DoS resistance)
// ─────────────────────────────────────────────
describe("FIX H-02: triggerTimeout pull-payment", function () {
  async function setupTimeout() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "h02h");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Advance past review deadline
    await time.increase(ONE_DAY * 3 + ONE_DAY * 2 + 3600); // past deadline + review window
    return ctx;
  }

  it("triggerTimeout queues payout and does NOT push ETH immediately", async function () {
    const { factory, anyone, hunter1 } = await setupTimeout();
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(anyone).triggerTimeout(1);
    const h1After = await ethers.provider.getBalance(hunter1.address);
    // FIX XC-02: Submission stake is now also queued as pull-payment (pendingStakeRefunds).
    // Hunter balance does NOT change immediately.
    const stake = calcSubStake(ETH(0.5));
    expect(h1After - h1Before).to.be.closeTo(0n, ETH(0.0001));
    // pendingTimeoutPayouts should be non-zero (the reward portion)
    expect(await factory.pendingTimeoutPayouts(hunter1.address)).to.be.gt(0n);
    // pendingStakeRefunds should be non-zero (the submission stake)
    expect(await factory.pendingStakeRefunds(hunter1.address)).to.equal(stake);
  });

  it("hunter claims timeout payout via claimTimeoutPayout()", async function () {
    const { factory, anyone, hunter1 } = await setupTimeout();
    await factory.connect(anyone).triggerTimeout(1);
    const pending = await factory.pendingTimeoutPayouts(hunter1.address);
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).claimTimeoutPayout();
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const h1After = await ethers.provider.getBalance(hunter1.address);
    expect(h1After - h1Before + gas).to.equal(pending);
  });

  it("double claim reverts", async function () {
    const { factory, anyone, hunter1 } = await setupTimeout();
    await factory.connect(anyone).triggerTimeout(1);
    await factory.connect(hunter1).claimTimeoutPayout();
    await expect(factory.connect(hunter1).claimTimeoutPayout())
      .to.be.revertedWithCustomError(factory, "FactoryNoTimeoutPayoutPending");
  });

  it("FIX L-02: triggerTimeout records poster reputation penalty", async function () {
    const { factory, reputation, poster, anyone } = await setupTimeout();
    const statsBefore = await reputation.getCreatorStats(poster.address);
    await factory.connect(anyone).triggerTimeout(1);
    const statsAfter = await reputation.getCreatorStats(poster.address);
    expect(statsAfter.cancelCount).to.equal(statsBefore.cancelCount + 1n);
  });
});

// ─────────────────────────────────────────────
// FIX H-03: ranks[] validation in approveWinners
// ─────────────────────────────────────────────
describe("FIX H-03: ranks[] validation", function () {
  async function setupTwoSubmissions() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "h03h1");
    await registerUsername(identity, hunter2, "h03h2");
    const p = await defaultParams({ winnerCount: 2, prizeWeights: [60, 40] });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmSub2", { value: stake });
    return ctx;
  }

  it("reverts on duplicate ranks", async function () {
    const { factory, poster } = await setupTwoSubmissions();
    await expect(factory.connect(poster).approveWinners(1, [1, 2], [1, 1]))
      .to.be.revertedWithCustomError(factory, "FactoryDuplicateRank");
  });

  it("reverts on rank out of range", async function () {
    const { factory, poster } = await setupTwoSubmissions();
    await expect(factory.connect(poster).approveWinners(1, [1, 2], [1, 3]))
      .to.be.revertedWithCustomError(factory, "FactoryRankOutOfRange");
  });

  it("rank 1 maps to prizeWeights[0] (highest prize)", async function () {
    const { factory, poster, hunter1, hunter2, escrow } = await setupTwoSubmissions();
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    const h2Before = await ethers.provider.getBalance(hunter2.address);
    // Hunter1 gets rank 1 (60%), hunter2 gets rank 2 (40%)
    await factory.connect(poster).approveWinners(1, [1, 2], [1, 2]);
    const h1After = await ethers.provider.getBalance(hunter1.address);
    const h2After = await ethers.provider.getBalance(hunter2.address);
    // Hunter1 should receive more than hunter2
    expect(h1After - h1Before).to.be.gt(h2After - h2Before);
  });

  it("rank order can be reversed — rank 2 submitter gets higher prize", async function () {
    const { factory, poster, hunter1, hunter2 } = await setupTwoSubmissions();
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    const h2Before = await ethers.provider.getBalance(hunter2.address);
    // Hunter1 gets rank 2 (40%), hunter2 gets rank 1 (60%)
    await factory.connect(poster).approveWinners(1, [1, 2], [2, 1]);
    const h1After = await ethers.provider.getBalance(hunter1.address);
    const h2After = await ethers.provider.getBalance(hunter2.address);
    // Hunter2 should now receive more
    expect(h2After - h2Before).to.be.gt(h1After - h1Before);
  });
});

// ─────────────────────────────────────────────
// FIX H-04: claimPrimary timelock
// ─────────────────────────────────────────────
describe("FIX H-04: claimPrimary timelock (initiateClaim + finalizeClaim)", function () {
  async function setupLinkedWallets() {
    const ctx = await deployAll();
    const { identity, hunter1, hunter2 } = ctx;
    // hunter1 = primary, hunter2 = backup
    await registerUsername(identity, hunter1, "h04p");
    await identity.connect(hunter1).proposeLink(hunter2.address);
    await identity.connect(hunter2).confirmLink(hunter1.address);
    return ctx;
  }

  it("claimPrimary() reverts without prior initiateClaim()", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    await expect(identity.connect(hunter2).claimPrimary(hunter1.address))
      .to.be.revertedWith("Identity: must call initiateClaim() first");
  });

  it("finalizeClaim() reverts before timelock expires", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    await identity.connect(hunter2).initiateClaim(hunter1.address);
    await expect(identity.connect(hunter2).finalizeClaim())
      .to.be.revertedWith("Identity: timelock not expired");
  });

  it("finalizeClaim() succeeds after 3 days", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    await identity.connect(hunter2).initiateClaim(hunter1.address);
    await time.increase(3 * ONE_DAY + 60);
    await expect(identity.connect(hunter2).finalizeClaim()).to.not.be.reverted;
    expect(await identity.getPrimary(hunter2.address)).to.equal(hunter2.address);
  });

  it("emits PrimaryClaimInitiated with correct claimableAfter", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    const tx = await identity.connect(hunter2).initiateClaim(hunter1.address);
    const rcpt = await tx.wait();
    const block = await ethers.provider.getBlock(rcpt.blockNumber);
    await expect(tx)
      .to.emit(identity, "PrimaryClaimInitiated")
      .withArgs(hunter2.address, hunter1.address, BigInt(block.timestamp) + BigInt(3 * ONE_DAY));
  });

  it("original primary can cancel incoming claim via cancelClaim()", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    await identity.connect(hunter2).initiateClaim(hunter1.address);
    // Original primary detects the claim and cancels it
    await expect(identity.connect(hunter1).cancelClaim()).to.not.be.reverted;
    await time.increase(3 * ONE_DAY + 60);
    // finalizeClaim should now fail (no pending claim)
    await expect(identity.connect(hunter2).finalizeClaim())
      .to.be.revertedWith("Identity: no pending claim");
  });

  it("original primary can unlink the backup wallet to stop the claim", async function () {
    const { identity, hunter1, hunter2 } = await setupLinkedWallets();
    await identity.connect(hunter2).initiateClaim(hunter1.address);
    // Primary unlinks hunter2 before timelock expires
    await identity.connect(hunter1).unlinkWallet(hunter2.address);
    await time.increase(3 * ONE_DAY + 60);
    // FIX BUG-IR-1: unlinkWallet now clears _claimInitiatedAt[hunter2].
    // So finalizeClaim fails with "no pending claim" (not "link was removed during timelock").
    // This is even stronger protection — claim is fully cancelled by unlink, not just blocked.
    await expect(identity.connect(hunter2).finalizeClaim())
      .to.be.revertedWith("Identity: no pending claim");
  });
});

// ─────────────────────────────────────────────
// FIX M-03: username cooldown after adminClearUsername
// ─────────────────────────────────────────────
describe("FIX M-03: username 90-day cooldown after admin clear", function () {
  it("freed username cannot be immediately reclaimed", async function () {
    const { identity, owner, hunter1, hunter2 } = await deployAll();
    await identity.connect(hunter1).setUsername("coold");
    // Admin clears the username
    await identity.connect(owner).adminClearUsername(hunter1.address);
    // hunter2 tries to claim immediately — should fail
    await expect(identity.connect(hunter2).setUsername("coold"))
      .to.be.revertedWith("Identity: username in cooldown (90 days after admin clear)");
  });

  it("freed username can be reclaimed after 90 days", async function () {
    const { identity, owner, hunter1, hunter2 } = await deployAll();
    await identity.connect(hunter1).setUsername("coold2");
    await identity.connect(owner).adminClearUsername(hunter1.address);
    // Advance 90 days + 1 second
    await time.increase(90 * ONE_DAY + 1);
    await expect(identity.connect(hunter2).setUsername("coold2")).to.not.be.reverted;
  });

  it("getUsernameCooldownEnd returns correct timestamp", async function () {
    const { identity, owner, hunter1 } = await deployAll();
    await identity.connect(hunter1).setUsername("coold3");
    const clearTx = await identity.connect(owner).adminClearUsername(hunter1.address);
    const clearRcpt = await clearTx.wait();
    const block = await ethers.provider.getBlock(clearRcpt.blockNumber);
    const cooldownEnd = await identity.getUsernameCooldownEnd("coold3");
    expect(cooldownEnd).to.equal(BigInt(block.timestamp) + BigInt(90 * ONE_DAY));
  });
});

// ─────────────────────────────────────────────
// FIX L-01: cancel comp dust goes to last hunter
// ─────────────────────────────────────────────
describe("FIX L-01: cancel comp dust distribution", function () {
  it("all comp wei is distributed — no dust locked in contract", async function () {
    const ctx = await deployAll();
    const { factory, poster, hunter1, hunter2, hunter3, identity } = ctx;
    await registerUsername(identity, hunter1, "l01h1");
    await registerUsername(identity, hunter2, "l01h2");
    await registerUsername(identity, hunter3, "l01h3");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await factory.connect(hunter3).submitWork(1, "QmS3", { value: stake });

    // Total comp: 3 × (0.5 × 2%) = 0.03 MON
    const totalComp = (ETH(0.5) * 200n) / 10_000n * 3n;
    await factory.connect(poster).cancelBounty(1, { value: totalComp });

    const c1 = await factory.pendingCancelComps(hunter1.address);
    const c2 = await factory.pendingCancelComps(hunter2.address);
    const c3 = await factory.pendingCancelComps(hunter3.address);
    // All comp should be distributed (no orphan wei)
    expect(c1 + c2 + c3).to.equal(totalComp);
  });
});

// ─────────────────────────────────────────────
// ERC20 bounty full flow
// ─────────────────────────────────────────────
describe("ERC20 bounty full flow", function () {
  async function deployWithMockToken() {
    const ctx = await deployAll();
    // Deploy a minimal ERC20 mock
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USD", "MUSD", 18);
    await token.waitForDeployment();
    // Mint to poster
    await token.mint(ctx.poster.address, ETH(1000));
    // ERC20 bounty: poster must approve the ESCROW (not factory) for transferFrom
    // Factory calls escrow.depositERC20 which calls _transferFrom(token, depositor, escrow, amount)
    await token.connect(ctx.poster).approve(await ctx.escrow.getAddress(), ETH(100));
    return { ...ctx, token };
  }

  it("creates ERC20 bounty with MON poster stake", async function () {
    const ctx = await deployWithMockToken();
    const { factory, poster, registry, token } = ctx;
    const now = await blockNow();
    const totalReward = ETH(10);
    const creatorStake = calcCreatorStake(totalReward);
    await factory.connect(poster).createBounty(
      "QmHash", "ERC20 Bounty", "dev",
      1, // ERC20
      await token.getAddress(),
      totalReward, 1, [100],
      now + ONE_DAY * 3,
      false, // requiresApplication
      { value: creatorStake }
    );
    const bounty = await registry.getBounty(1);
    expect(bounty.rewardType).to.equal(1n); // ERC20
    expect(bounty.totalReward).to.equal(totalReward);
  });

  it("ERC20 bounty approveWinners pays winner in tokens", async function () {
    const ctx = await deployWithMockToken();
    const { factory, reputation, poster, hunter1, identity, token } = ctx;
    // For 10 MON reward, hunter needs Tier 2 (at least one prior submission).
    // Boost hunter1 to tier 2 by recording a prior win in reputation directly — or
    // use a small bounty first to get hunter1 a submission recorded.
    await registerUsername(identity, hunter1, "erc20w");

    // Step 1: small bounty so hunter1 gets a prior submission (becomes Tier 2)
    const now = await blockNow();
    const smallReward = ETH(0.5);
    const smallStake = calcCreatorStake(smallReward);
    await factory.connect(poster).createBounty(
      "QmSmall", "Small Bounty", "dev",
      0, ethers.ZeroAddress, smallReward, 1, [100],
      now + ONE_DAY * 3,
      false, // requiresApplication
      { value: smallReward + smallStake }
    );
    const subStakeSmall = calcSubStake(smallReward);
    await factory.connect(hunter1).submitWork(1, "QmSmallSub", { value: subStakeSmall });
    await factory.connect(poster).approveWinners(1, [1], [1]);
    // hunter1 now has 1 win → Tier 2

    // Step 2: ERC20 bounty
    const now2 = await blockNow();
    const totalReward = ETH(10);
    const creatorStake = calcCreatorStake(totalReward);
    await ctx.token.connect(poster).approve(await ctx.escrow.getAddress(), ETH(100));
    await factory.connect(poster).createBounty(
      "QmHash", "ERC20 Bounty", "dev",
      1, await token.getAddress(),
      totalReward, 1, [100],
      now2 + ONE_DAY * 3,
      false, // requiresApplication
      { value: creatorStake }
    );
    const subStake = calcSubStake(totalReward); // tier 2: 1× multiplier
    await factory.connect(hunter1).submitWork(2, "QmSub", { value: subStake });
    const h1TokenBefore = await token.balanceOf(hunter1.address);
    await factory.connect(poster).approveWinners(2, [2], [1]);
    const h1TokenAfter = await token.balanceOf(hunter1.address);
    // Hunter should have received 97% of 10 tokens
    const expected = (totalReward * 9700n) / 10_000n;
    expect(h1TokenAfter - h1TokenBefore).to.equal(expected);
  });
});

// ─────────────────────────────────────────────
// withdrawRejectedStake full flow
// ─────────────────────────────────────────────
describe("withdrawRejectedStake flow", function () {
  it("hunter can withdraw stake after grace period without disputing", async function () {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "wrs1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    // Advance past grace period
    await time.increase(2 * 3600 + 60);
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    const tx = await factory.connect(hunter1).withdrawRejectedStake(1, 1);
    const rec = await tx.wait();
    const gas = rec.gasUsed * rec.gasPrice;
    const h1After = await ethers.provider.getBalance(hunter1.address);
    expect(h1After - h1Before + gas).to.equal(stake);
  });

  it("cannot withdraw if not yet rejected", async function () {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "wrs2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // PENDING status triggers "Factory: not rejected" before rejectedAt check
    await expect(factory.connect(hunter1).withdrawRejectedStake(1, 1))
      .to.be.revertedWithCustomError(factory, "FactoryNotRejected");
    // Note: the rejectedAt check "Factory: not rejected yet" is a belt-and-suspenders guard
    // for cases where status=REJECTED but rejectedAt is unset (legacy data migration safety).
  });

  it("cannot withdraw if already disputed", async function () {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "wrs3");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await time.increase(2 * 3600 + 60);
    await expect(factory.connect(hunter1).withdrawRejectedStake(1, 1))
      .to.be.revertedWithCustomError(factory, "FactoryAlreadyDisputed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: NE-1+NE-2 — claimTimeoutPullable CEI order
// Bug: r.released = true BEFORE _safeTransferMON(factory, hunterPool)
// If escrow's receive() were to revert, ETH would be permanently locked.
// Fix: state change (released=true) must happen before external call, but
//      the call itself must complete atomically; verify pool arrives correctly.
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX NE-1+NE-2 — claimTimeoutPullable correctness", function () {
  it("factory receives hunterPool after triggerTimeout (native bounty)", async function () {
    const ctx = await deployAll();
    const { factory, escrow, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "ne1a");
    await registerUsername(identity, hunter2, "ne1b");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    // Advance past reviewDeadline
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    // Record escrow balance before
    const escrowBefore = await ethers.provider.getBalance(await escrow.getAddress());
    const factoryBefore = await ethers.provider.getBalance(await factory.getAddress());
    await factory.connect(hunter1).triggerTimeout(1);
    const escrowAfter = await ethers.provider.getBalance(await escrow.getAddress());
    const factoryAfter = await ethers.provider.getBalance(await factory.getAddress());
    // escrow.balance should decrease by reward amount (fee goes to treasury, pool to factory)
    expect(escrowAfter).to.be.lt(escrowBefore);
    // factory.balance should increase by hunterPool, minus what gets queued
    // (pending timeout payouts are on factory, not paid out yet)
    const pending1 = await factory.pendingTimeoutPayouts(hunter1.address);
    const pending2 = await factory.pendingTimeoutPayouts(hunter2.address);
    expect(pending1 + pending2).to.be.gt(0n);
    // Verify escrow record is settled
    const record = await escrow.getRecord(1);
    expect(record.released).to.be.true;
  });

  it("escrow record is settled AFTER transfer (CEI invariant)", async function () {
    const ctx = await deployAll();
    const { factory, escrow, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "ne2a");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    await factory.connect(hunter1).triggerTimeout(1);
    // After triggerTimeout, the record must be settled (released == true)
    const record = await escrow.getRecord(1);
    expect(record.released).to.equal(true);
    // Cannot trigger timeout again (already settled)
    await expect(factory.connect(hunter1).triggerTimeout(1))
      .to.be.revertedWithCustomError(factory, "FactoryNotActive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: BUG-IR-1 — unlinkWallet must clear stale claim state
// Bug: After unlinkWallet, _claimInitiatedAt and _claimTargetPrimary not cleared.
//      evicted wallet is permanently bricked — cannot initiate future claims.
// Fix: unlinkWallet must delete _claimInitiatedAt[linkedWallet] and
//      _claimTargetPrimary[linkedWallet]
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX BUG-IR-1 — unlinkWallet clears stale claim state", function () {
  it("linked wallet can initiate new claim after being unlinked and re-linked", async function () {
    const ctx = await deployAll();
    const { identity, poster, hunter1 } = ctx;
    // Setup: poster=primary, hunter1=linked
    await identity.connect(poster).setUsername("pri1");
    await identity.connect(hunter1).setUsername("bkp1");
    await identity.connect(poster).proposeLink(hunter1.address);
    await identity.connect(hunter1).confirmLink(poster.address);
    // hunter1 initiates claim
    await identity.connect(hunter1).initiateClaim(poster.address);
    // Verify claim is pending
    const [initiatedAt] = await identity.getPendingClaim(hunter1.address);
    expect(initiatedAt).to.be.gt(0n);
    // Primary cancels by unlinking
    await identity.connect(poster).unlinkWallet(hunter1.address);
    // BUG-IR-1: after unlink, claim state should be cleared
    const [initiatedAfter] = await identity.getPendingClaim(hunter1.address);
    expect(initiatedAfter).to.equal(0n);
  });

  it("evicted wallet can be re-linked and initiate a new claim (not permanently bricked)", async function () {
    const ctx = await deployAll();
    const { identity, poster, hunter1, hunter2 } = ctx;
    await identity.connect(poster).setUsername("pri2");
    await identity.connect(hunter1).setUsername("bkp2");
    await identity.connect(poster).proposeLink(hunter1.address);
    await identity.connect(hunter1).confirmLink(poster.address);
    // hunter1 initiates claim
    await identity.connect(hunter1).initiateClaim(poster.address);
    // Primary unlinks hunter1 (this should clear claim state)
    await identity.connect(poster).unlinkWallet(hunter1.address);
    // Without fix: hunter1 cannot call initiateClaim again (stale state blocks it)
    // With fix: hunter1 can be re-linked and initiate a fresh claim
    await identity.connect(poster).proposeLink(hunter1.address);
    await identity.connect(hunter1).confirmLink(poster.address);
    // This should NOT revert with "claim already pending" after the fix
    await expect(identity.connect(hunter1).initiateClaim(poster.address))
      .to.not.be.revertedWith("Identity: claim already pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: M-02 — resolveDispute deny path must not restore ACTIVE past deadline
// Bug: deny path sets status=ACTIVE even if past reviewDeadline.
//      A malicious actor can immediately call triggerTimeout to drain the escrow.
// Fix: check block.timestamp vs reviewDeadline, restore to REVIEWING if past deadline.
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX M-02 — resolveDispute deny restores correct state", function () {
  it("deny before reviewDeadline: bounty restores to ACTIVE", async function () {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "m02a");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // Resolve before reviewDeadline
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    const b = await factory.registry.then ? factory.registry() : null;
    // Check via registry
    const { registry } = ctx;
    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(0n); // 0 = ACTIVE
  });

  it("deny AFTER reviewDeadline: bounty restores to REVIEWING, not ACTIVE", async function () {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, hunter2, identity, registry } = ctx;
    await registerUsername(identity, hunter1, "m02b");
    await registerUsername(identity, hunter2, "m02bh2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    // hunter1 submits and gets rejected+disputed; hunter2 submits and stays PENDING
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // Advance past deadline and reviewDeadline
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    const bounty = await registry.getBounty(1);
    // With fix: status should be REVIEWING (1), not ACTIVE (0)
    expect(bounty.status).to.equal(1n); // 1 = REVIEWING
    // triggerTimeout should now be callable (hunter2 has a pending submission)
    await expect(factory.connect(hunter1).triggerTimeout(1))
      .to.not.be.reverted;
  });

  it("deny AFTER reviewDeadline: triggerTimeout works immediately (no free restart)", async function () {
    const ctx = await deployAll();
    const { factory, owner, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "m02c");
    await registerUsername(identity, hunter2, "m02ch2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    // hunter1 submits and gets rejected+disputed; hunter2 submits and stays PENDING
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    // Without fix: triggerTimeout would revert because status was ACTIVE (not past review)
    // With fix: triggerTimeout works because status is REVIEWING and reviewDeadline passed
    await expect(factory.connect(hunter1).triggerTimeout(1))
      .to.not.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: BUG-IR-6 — isUsernameAvailable must check cooldown
// Bug: isUsernameAvailable returns true for a name in cooldown period after admin clear.
//      Frontend would show the name as available when setUsername would revert.
// Fix: check _usernameFreedAt in isUsernameAvailable
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX BUG-IR-6 — isUsernameAvailable checks cooldown", function () {
  it("returns false for a username in 90-day cooldown after admin clear", async function () {
    const ctx = await deployAll();
    const { identity, owner, hunter1 } = ctx;
    await identity.connect(hunter1).setUsername("ir6test");
    // Admin clears the username
    await identity.connect(owner).adminClearUsername(hunter1.address);
    // Immediately after clear: name is in cooldown → isUsernameAvailable must return false
    const available = await identity.isUsernameAvailable("ir6test", ethers.ZeroAddress);
    expect(available).to.be.false;
  });

  it("returns true for a username after 90-day cooldown expires", async function () {
    const ctx = await deployAll();
    const { identity, owner, hunter1 } = ctx;
    await identity.connect(hunter1).setUsername("ir6x");
    await identity.connect(owner).adminClearUsername(hunter1.address);
    // Advance 90 days + 1 second
    await time.increase(90 * ONE_DAY + 1);
    const available = await identity.isUsernameAvailable("ir6x", ethers.ZeroAddress);
    expect(available).to.be.true;
  });

  it("setUsername reverts during cooldown even if isUsernameAvailable was broken", async function () {
    const ctx = await deployAll();
    const { identity, owner, hunter1, anyone } = ctx;
    await identity.connect(hunter1).setUsername("ir6y");
    await identity.connect(owner).adminClearUsername(hunter1.address);
    // 'anyone' has no username yet — tries to claim "ir6y" which is in cooldown
    await expect(identity.connect(anyone).setUsername("ir6y"))
      .to.be.revertedWith("Identity: username in cooldown (90 days after admin clear)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: BUG-RR-5 — recordFraudSubmission must be called on dispute deny
// Bug: fraudCount is never incremented because recordFraudSubmission is never called.
//      This makes the fraud penalty in getBuilderScore() dead code.
// Fix: call recordFraudSubmission(disputingHunter) in resolveDispute deny path.
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX BUG-RR-5 — fraudCount incremented on dispute deny", function () {
  it("hunter fraudCount increases when dispute is denied", async function () {
    const ctx = await deployAll();
    const { factory, reputation, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "rr5a");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // Get stats before
    const statsBefore = await reputation.getBuilderStats(hunter1.address);
    expect(statsBefore.fraudCount).to.equal(0n);
    // Deny the dispute
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    // fraudCount must now be 1
    const statsAfter = await reputation.getBuilderStats(hunter1.address);
    expect(statsAfter.fraudCount).to.equal(1n);
  });

  it("fraud penalty reduces hunter score after dispute deny", async function () {
    const ctx = await deployAll();
    const { factory, reputation, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "rr5b");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    const scoreBefore = await reputation.getBuilderScore(hunter1.address);
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    const scoreAfter = await reputation.getBuilderScore(hunter1.address);
    // After fraud: fraudCount*50 + disputeLost*15 penalty applied → score should drop
    expect(scoreAfter).to.be.lt(scoreBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: Low — whenNotPaused guards missing
// Bugs: rejectSubmission, expireBounty, triggerTimeout missing whenNotPaused
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX Low — whenNotPaused guards", function () {
  async function setup() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "pause-h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    return ctx;
  }

  async function setupTwoSubmissions() {
    const ctx = await deployAll();
    const { factory, poster, hunter1, hunter2, identity } = ctx;
    await registerUsername(identity, hunter1, "pause-h1");
    await registerUsername(identity, hunter2, "pause-h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    return ctx;
  }

  it("rejectSubmission blocked when paused", async function () {
    const { factory, poster, hunter1, owner } = await setupTwoSubmissions();
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(owner).pause();
    await expect(factory.connect(poster).rejectSubmission(1, 1))
      .to.be.revertedWithCustomError(factory, "FactoryPaused");
  });

  it("expireBounty blocked when paused", async function () {
    const { factory, owner } = await setup();
    await time.increase(ONE_DAY * 3 + 60);
    await factory.connect(owner).pause();
    await expect(factory.connect(owner).expireBounty(1))
      .to.be.revertedWithCustomError(factory, "FactoryPaused");
  });

  it("triggerTimeout blocked when paused", async function () {
    const { factory, hunter1, owner } = await setup();
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    await factory.connect(owner).pause();
    await expect(factory.connect(hunter1).triggerTimeout(1))
      .to.be.revertedWithCustomError(factory, "FactoryPaused");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUND 2 FIX: RR-1 — recordDisputeLost must update lastActivity
// Bug: recordDisputeLost does not set lastActivity, leaving stale timestamp
// ─────────────────────────────────────────────────────────────────────────────
describe("FIX RR-1 — recordDisputeLost updates lastActivity", function () {
  it("hunter lastActivity updated after losing dispute", async function () {
    const ctx = await deployAll();
    const { factory, reputation, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "rr1a");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    const statsBefore = await reputation.getBuilderStats(hunter1.address);
    const lastBefore = statsBefore.lastActivity;
    // Advance time so lastActivity must change
    await time.increase(3600);
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);
    const statsAfter = await reputation.getBuilderStats(hunter1.address);
    expect(statsAfter.lastActivity).to.be.gt(lastBefore);
  });

  it("poster lastActivity updated after losing dispute", async function () {
    const ctx = await deployAll();
    const { factory, reputation, owner, poster, hunter1, identity } = ctx;
    await registerUsername(identity, hunter1, "rr1b");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    const statsBefore = await reputation.getCreatorStats(poster.address);
    const lastBefore = statsBefore.lastActivity;
    await time.increase(3600);
    // inFavorOfHunters = true → poster loses
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const statsAfter = await reputation.getCreatorStats(poster.address);
    expect(statsAfter.lastActivity).to.be.gt(lastBefore);
  });
});
