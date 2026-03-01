const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────
// Constants (mirrors BountyFactory.sol)
// ─────────────────────────────────────────────
const ONE_DAY    = 86400;
const SEVEN_DAYS = 7 * ONE_DAY;
const ETH        = (n) => ethers.parseEther(String(n));

// V3 constants — match contract values
const POSTER_STAKE_BPS     = 500n;    // 5%
const MIN_POSTER_STAKE     = ETH(0.005);
const SUBMISSION_STAKE_BPS = 100n;    // 1%
const MIN_SUBMISSION_STAKE = ETH(0.001);
const MAX_SUBMISSION_STAKE = ETH(0.1);
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

// ── V3: compute poster stake ──────────────────────────────────────────────────
function calcPosterStake(totalReward) {
  const pct = (totalReward * POSTER_STAKE_BPS) / BPS_DENOM;
  return pct < MIN_POSTER_STAKE ? MIN_POSTER_STAKE : pct;
}

// ── V3: compute submission stake (tier = 2 default = 1× multiplier) ──────────
function calcSubStake(totalReward, tierMultiplierBps = 10_000n) {
  let pct = (totalReward * SUBMISSION_STAKE_BPS) / BPS_DENOM;
  if (pct < MIN_SUBMISSION_STAKE) pct = MIN_SUBMISSION_STAKE;
  if (pct > MAX_SUBMISSION_STAKE) pct = MAX_SUBMISSION_STAKE;
  return (pct * tierMultiplierBps) / BPS_DENOM;
}

// ── Helper: register username for a signer (Tier 1+) ─────────────────────────
async function registerUsername(identity, signer, username) {
  await identity.connect(signer).setUsername(username);
}

// ── Helper: createBounty with correct V3 msg.value ───────────────────────────
async function createBounty(factory, signer, p, extra = {}) {
  const posterStake = calcPosterStake(p.totalReward);
  const defaultValue = p.rewardType === 0 ? p.totalReward + posterStake : posterStake;
  return factory.connect(signer).createBounty(
    p.ipfsHash, p.title, p.category,
    p.rewardType, p.rewardToken,
    p.totalReward, p.winnerCount, p.prizeWeights,
    p.deadline,
    { value: defaultValue, ...extra }
  );
}

// ── Helper: submitWork with correct V3 msg.value ─────────────────────────────
// Tier 1 hunters use 1.5× multiplier; Tier 2+ use 1×
async function submitWork(factory, signer, bountyId, ipfsHash, totalReward, tierMultiplierBps = 15_000n) {
  const stake = calcSubStake(totalReward, tierMultiplierBps);
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
        ETH(1), 1, [100], now + ONE_DAY * 2, now + ONE_DAY * 3, ETH(0.05)
      )
    ).to.be.revertedWith("Registry: not factory");
  });

  it("escrow rejects direct depositNative from non-factory", async function () {
    const { escrow, poster } = await deployAll();
    const now = await blockNow();
    await expect(
      escrow.connect(poster).depositNative(1, poster.address, now + ONE_DAY, 0, { value: ETH(1) })
    ).to.be.revertedWith("Escrow: not factory");
  });

  it("reputation rejects direct writes from non-factory", async function () {
    const { reputation, poster } = await deployAll();
    await expect(reputation.connect(poster).recordSubmission(poster.address))
      .to.be.revertedWith("Reputation: not factory");
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
    ).to.be.revertedWith("Escrow: not factory");
  });
});

// ─────────────────────────────────────────────
// Create Bounty — V3 (with poster stake)
// ─────────────────────────────────────────────
describe("createBounty — V3 (poster stake)", function () {
  it("creates bounty and locks reward+stake in escrow", async function () {
    const { factory, escrow, poster, identity } = await deployAll();
    const p = await defaultParams();
    const posterStake = calcPosterStake(p.totalReward);
    await createBounty(factory, poster, p);

    const record = await escrow.getRecord(1);
    // reward stored separately from stake
    expect(record.amount).to.equal(p.totalReward);
    expect(record.depositor).to.equal(poster.address);

    // poster stake stored separately
    expect(await escrow.posterStakes(1)).to.equal(posterStake);
  });

  it("reverts if msg.value != totalReward + posterStake", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams(); // 0.5 MON
    await expect(
      factory.connect(poster).createBounty(
        p.ipfsHash, p.title, p.category, p.rewardType, p.rewardToken,
        p.totalReward, p.winnerCount, p.prizeWeights, p.deadline,
        { value: p.totalReward } // only reward, missing poster stake
      )
    ).to.be.revertedWith("Factory: wrong MON amount (reward + stake)");
  });

  it("sets reviewDeadline on the bounty", async function () {
    const { factory, registry, poster } = await deployAll();
    const p = await defaultParams();
    const txTime = BigInt(await blockNow());
    await createBounty(factory, poster, p);
    const bounty = await registry.getBounty(1);
    expect(bounty.reviewDeadline).to.be.gt(BigInt(p.deadline));
    expect(bounty.posterStake).to.equal(calcPosterStake(p.totalReward));
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
    await expect(createBounty(factory, poster, p)).to.be.revertedWith("Factory: deadline too soon");
  });

  it("reverts if deadline too far", async function () {
    const { factory, poster } = await deployAll();
    const now = await blockNow();
    const p = await defaultParams({ deadline: now + 181 * ONE_DAY });
    await expect(createBounty(factory, poster, p)).to.be.revertedWith("Factory: deadline too far");
  });

  it("reverts if prize weights don't sum to 100", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams({ winnerCount: 2, prizeWeights: [60, 30] });
    await expect(createBounty(factory, poster, p)).to.be.revertedWith("Factory: weights must sum to 100");
  });

  it("updates project reputation stats", async function () {
    const { factory, reputation, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stats = await reputation.projects(poster.address);
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
    const stake = calcSubStake(ETH(0.5), 15_000n); // Tier 1 = 1.5×
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(stake);
  });

  it("anonymous hunter (no username) cannot submit", async function () {
    const { factory, hunter3 } = await setup();
    const stake = calcSubStake(ETH(0.5));
    await expect(
      factory.connect(hunter3).submitWork(1, "QmSub", { value: stake })
    ).to.be.revertedWith("Factory: identity required to submit");
  });

  it("reverts if insufficient submission stake", async function () {
    const { factory, hunter1 } = await setup();
    await expect(
      factory.connect(hunter1).submitWork(1, "QmSub", { value: 0n })
    ).to.be.revertedWith("Factory: insufficient submission stake");
  });

  it("poster cannot submit", async function () {
    const { factory, poster } = await setup();
    const stake = calcSubStake(ETH(0.5));
    await expect(factory.connect(poster).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWith("Factory: poster cannot submit");
  });

  it("hunter cannot submit twice", async function () {
    const { factory, hunter1 } = await setup();
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await expect(factory.connect(hunter1).submitWork(1, "QmSub2", { value: stake }))
      .to.be.revertedWith("Factory: already submitted");
  });

  it("excess stake above required is refunded to hunter", async function () {
    const { factory, hunter1 } = await setup();
    const required = calcSubStake(ETH(0.5), 15_000n);
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWith("Factory: deadline passed");
  });

  it("bounty >= 1 MON requires Tier 2+ (at least one prior submission)", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "tr1"); // Tier 1: registered, no prior subs
    const p = await defaultParams({ totalReward: ETH(2) }); // >= 1 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(2), 15_000n);
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWith("Factory: active status required for bounties >= 1 MON");
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
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
    const subStake = calcSubStake(ETH(0.5), 15_000n);
    expect(hunterAfter - hunterBefore).to.be.closeTo(ETH(0.485) + subStake, ETH(0.001));
    expect(treasuryAfter - treasuryBefore).to.equal(ETH(0.015)); // 3% of 0.5
  });

  it("returns poster stake to poster on completion", async function () {
    const { factory, poster, escrow } = await setup();
    const posterStake = calcPosterStake(ETH(0.5));
    const posterBefore = await ethers.provider.getBalance(poster.address);
    const tx = await factory.connect(poster).approveWinners(1, [1], [1]);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;
    const posterAfter = await ethers.provider.getBalance(poster.address);
    expect(posterAfter - posterBefore + gasUsed).to.be.closeTo(posterStake, ETH(0.001));
    expect(await escrow.posterStakes(1)).to.equal(0n);
  });

  it("returns submission stake to winning hunter", async function () {
    const { factory, poster, hunter1, escrow } = await setup();
    await factory.connect(poster).approveWinners(1, [1], [1]);
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
  });

  it("updates reputation: winCount and totalEarned", async function () {
    const { factory, poster, hunter1, reputation } = await setup();
    await factory.connect(poster).approveWinners(1, [1], [1]);
    const stats = await reputation.hunters(hunter1.address);
    expect(stats.winCount).to.equal(1);
    expect(stats.totalEarned).to.be.gt(0n);
  });

  it("non-poster cannot approve", async function () {
    const { factory, hunter2, identity } = await setup();
    await registerUsername(identity, hunter2, "us2");
    await expect(factory.connect(hunter2).approveWinners(1, [1], [1]))
      .to.be.revertedWith("Factory: not poster");
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
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
      .to.be.revertedWith("Factory: not poster");
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

    const posterStake = calcPosterStake(ETH(0.5));
    expect(posterBalAfter - posterBal + gas).to.be.closeTo(ETH(0.5) + posterStake, ETH(0.001));
    expect(await escrow.posterStakes(1)).to.equal(0n);
  });

  it("cancel with valid submissions: comp paid + poster stake slashed 50/50", async function () {
    const { factory, poster, hunter1, escrow, treasury, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-c");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const subStake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: subStake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);

    const posterStake  = calcPosterStake(ETH(0.5));
    const compRequired = ETH(0.5) * BigInt(200) / 10_000n; // 2% of 0.5
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    const hunter1Before  = await ethers.provider.getBalance(hunter1.address);

    await factory.connect(poster).cancelBounty(1, { value: compRequired + ETH(0.01) });

    const hunter1After  = await ethers.provider.getBalance(hunter1.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    const halfStake = posterStake / 2n;
    expect(hunter1After - hunter1Before).to.be.closeTo(compRequired + subStake + halfStake, ETH(0.001));
    expect(treasuryAfter - treasuryBefore).to.be.closeTo(halfStake, ETH(0.001));
    expect(await escrow.posterStakes(1)).to.equal(0n);
  });

  it("cancel records cancelCount in reputation", async function () {
    const { factory, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-rep");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);
    const comp = ETH(0.5) * 200n / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });
    const stats = await reputation.projects(poster.address);
    expect(stats.cancelCount).to.equal(1n);
  });

  it("cancel with only grace-period submissions: treated as no submissions", async function () {
    const { factory, poster, hunter1, escrow, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-gp");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    const posterBefore = await ethers.provider.getBalance(poster.address);
    const tx = await factory.connect(poster).cancelBounty(1);
    const rec = await tx.wait();
    const gas = rec.gasUsed * tx.gasPrice;
    const posterAfter = await ethers.provider.getBalance(poster.address);
    const posterStake = calcPosterStake(ETH(0.5));
    expect(posterAfter - posterBefore + gas).to.be.closeTo(ETH(0.5) + posterStake, ETH(0.001));
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

    const posterStake = calcPosterStake(ETH(0.5));
    expect(posterAfter - posterBefore + gas).to.be.closeTo(ETH(0.5) + posterStake, ETH(0.001));
    expect(await escrow.posterStakes(1)).to.equal(0n);
  });

  it("reverts if bounty has submissions", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-e");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    await time.increase(ONE_DAY * 4);
    await expect(factory.expireBounty(1))
      .to.be.revertedWith("Factory: has submissions, use triggerTimeout");
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });

    const bounty = await registry.getBounty(1);
    await time.increaseTo(Number(bounty.reviewDeadline) + 1);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    const hunter1Before  = await ethers.provider.getBalance(hunter1.address);
    const posterStake    = calcPosterStake(ETH(0.5));

    await factory.connect(poster).triggerTimeout(1);

    const treasuryAfter = await ethers.provider.getBalance(treasury.address);
    const hunter1After  = await ethers.provider.getBalance(hunter1.address);

    // Hunter gets 97% of 0.5 = 0.485 + submission stake
    expect(hunter1After - hunter1Before).to.be.closeTo(ETH(0.485) + stake, ETH(0.002));
    // Treasury gets 3% of 0.5 = 0.015 + 100% of poster stake
    expect(treasuryAfter - treasuryBefore).to.be.closeTo(ETH(0.015) + posterStake, ETH(0.002));
  });

  it("reverts if review window is still active", async function () {
    const { factory, poster, hunter1, identity, registry } = await deployAll();
    await registerUsername(identity, hunter1, "usr-ta");
    const p = await defaultParams(); // 0.5 MON, deadline = now + 3 days
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Advance past deadline but NOT past reviewDeadline (which is deadline + 24h)
    // deadline = now+3days, reviewDeadline = deadline+24h = now+4days
    // Advance to deadline + 12h (midway through review window)
    await time.increase(ONE_DAY * 3 + ONE_DAY / 2);
    await expect(factory.triggerTimeout(1))
      .to.be.revertedWith("Factory: review window active");
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
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
    const posterStake = calcPosterStake(ETH(0.5));
    const subStake    = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    // After raiseDispute: submissionStakes[1][hunter1] = 0, heldDisputeStakes[1][hunter1] = subStake
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(subStake);

    const hunter1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const hunter1After = await ethers.provider.getBalance(hunter1.address);

    // Hunter receives: poster stake (100% slash) + reward share from releaseToAll (97% of 0.5) + held stake returned
    const rewardShare = ETH(0.485); // 97% of 0.5 (1 hunter, gets all)
    expect(hunter1After - hunter1Before).to.be.closeTo(posterStake + rewardShare + subStake, ETH(0.005));
    expect(await escrow.posterStakes(1)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(0n);

    const projStats = await reputation.projects(poster.address);
    expect(projStats.fraudCancelCount).to.equal(1n);
    expect(projStats.disputeLost).to.equal(1n);
  });

  it("dispute denied: heldDisputeStake slashed to treasury", async function () {
    const { factory, owner, hunter1, escrow, reputation, treasury } = await setupDispute();
    const subStake = calcSubStake(ETH(0.5), 15_000n);
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
    const hunterStats = await reputation.hunters(hunter1.address);
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
    const gas = rec.gasUsed * tx.gasPrice;
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
    const p = await defaultParams({ totalReward: ETH(0.5) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5));
    await expect(factory.connect(hunter3).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWith("Factory: identity required to submit");
  });

  it("Tier 1 can submit to small bounty (<1 MON)", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "sm1");
    const p = await defaultParams({ totalReward: ETH(0.5) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n); // Tier 1 = 1.5×
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.not.be.reverted;
  });

  it("Tier 1 cannot submit to bounty >= 1 MON", async function () {
    const { factory, poster, hunter1, identity } = await deployAll();
    await registerUsername(identity, hunter1, "lg1");
    const p = await defaultParams({ totalReward: ETH(2) });
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(2), 15_000n);
    await expect(factory.connect(hunter1).submitWork(1, "QmSub", { value: stake }))
      .to.be.revertedWith("Factory: active status required for bounties >= 1 MON");
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject within grace period so dispute window is open
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);

    const stats      = await reputation.hunters(hunter1.address);
    const scoreAfter = await reputation.getHunterScore(hunter1.address);
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub1", { value: stake });
    // Reject within grace period
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });

    const scoreBefore = await reputation.getProjectScore(poster.address);
    await factory.connect(owner).resolveDispute(1, true, hunter1.address);
    const scoreAfter = await reputation.getProjectScore(poster.address);
    expect(scoreAfter).to.be.lte(scoreBefore);
  });

  it("isSuspicious returns true for a poster with fraudCancelCount > 0", async function () {
    const { factory, owner, poster, hunter1, reputation, identity } = await deployAll();
    await registerUsername(identity, hunter1, "usr-sus");
    const p = await defaultParams(); // 0.5 MON
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
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
    const stake1 = calcSubStake(ETH(0.5), 15_000n);
    const stake2 = calcSubStake(ETH(0.5), 15_000n);
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
      .to.be.revertedWith("Factory: insufficient featured fee");
  });
});

// ─────────────────────────────────────────────
// View helpers — V3
// ─────────────────────────────────────────────
describe("View helpers — V3", function () {
  it("getPosterStake returns correct amount", async function () {
    const { factory } = await deployAll();
    const expected = calcPosterStake(ETH(10));
    const onChain  = await factory.getPosterStake(ETH(10));
    expect(onChain).to.equal(expected);
  });

  it("minimum poster stake applied for very small bounties", async function () {
    const { factory } = await deployAll();
    const onChain = await factory.getPosterStake(ETH(0.001));
    expect(onChain).to.equal(MIN_POSTER_STAKE);
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Reject within grace period so dispute window is open
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
    await expect(factory.connect(owner).sweep()).to.be.revertedWith("Factory: nothing to sweep");
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
    const tx   = await factory.connect(hunter1).claimDisputeRefund();
    const rcpt = await tx.wait();
    const gasUsed = rcpt.gasUsed * rcpt.gasPrice;
    const after = await ethers.provider.getBalance(hunter1.address);
    expect(after - before + gasUsed).to.equal(ETH(0.01));
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
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
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    // Do NOT advance time
    await expect(factory.transitionToReviewing(1)).to.be.revertedWith("Factory: deadline not reached");
  });

  it("reverts if no pending submissions exist", async function () {
    const { factory, poster } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    await time.increase(ONE_DAY * 3 + 60);
    await expect(factory.transitionToReviewing(1)).to.be.revertedWith("Factory: no submissions");
  });

  it("reverts if called again on REVIEWING bounty", async function () {
    const { factory, anyone } = await setupExpiredWithSub();
    await factory.connect(anyone).transitionToReviewing(1);
    await expect(factory.connect(anyone).transitionToReviewing(1))
      .to.be.revertedWith("Factory: not active");
  });

  it("poster can still approveWinners after REVIEWING transition", async function () {
    const { factory, registry, poster, anyone } = await setupExpiredWithSub();
    await factory.connect(anyone).transitionToReviewing(1);
    // approveWinners must work in REVIEWING state
    await factory.connect(poster).approveWinners(1, [1], [1]);
    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(2n); // COMPLETED = 2
  });
});
