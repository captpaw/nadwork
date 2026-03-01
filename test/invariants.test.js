/**
 * NadWork Contract Invariants Test Suite
 *
 * Otomatis memverifikasi semua invariant dari INVARIANTS.md setelah setiap operasi.
 * Jalankan setelah setiap perubahan kontrak: npx hardhat test test/invariants.test.js
 *
 * Invariants dikelompokkan sesuai INVARIANTS.md:
 *   I.   ETH Balance Invariants
 *   II.  State Machine Invariants
 *   III. Access Control Invariants
 *   IV.  Reputation Invariants
 *   V.   Timeout/Stake Pull-Payment Invariants
 *   VI.  Username/Identity Invariants
 */

const { expect }  = require("chai");
const { ethers }  = require("hardhat");
const { time }    = require("@nomicfoundation/hardhat-network-helpers");

const ONE_DAY = 86400;
const ETH     = (n) => ethers.parseEther(String(n));

const POSTER_STAKE_BPS     = 500n;
const MIN_POSTER_STAKE     = ETH(0.005);
const SUBMISSION_STAKE_BPS = 100n;
const MIN_SUBMISSION_STAKE = ETH(0.001);
const MAX_SUBMISSION_STAKE = ETH(0.1);
const BPS_DENOM            = 10_000n;
const GRACE_PERIOD_REJECT  = BigInt(2 * 3600);

async function blockNow() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

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

function calcPosterStake(totalReward) {
  const pct = (totalReward * POSTER_STAKE_BPS) / BPS_DENOM;
  return pct < MIN_POSTER_STAKE ? MIN_POSTER_STAKE : pct;
}

function calcSubStake(totalReward, tierMultiplierBps = 10_000n) {
  let pct = (totalReward * SUBMISSION_STAKE_BPS) / BPS_DENOM;
  if (pct < MIN_SUBMISSION_STAKE) pct = MIN_SUBMISSION_STAKE;
  if (pct > MAX_SUBMISSION_STAKE) pct = MAX_SUBMISSION_STAKE;
  return (pct * tierMultiplierBps) / BPS_DENOM;
}

async function defaultParams(overrides = {}) {
  const now = await blockNow();
  return {
    ipfsHash:     "QmInvariantTest",
    title:        "Invariant test bounty",
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

async function createBounty(factory, signer, p) {
  const posterStake = calcPosterStake(p.totalReward);
  const value = p.rewardType === 0 ? p.totalReward + posterStake : posterStake;
  return factory.connect(signer).createBounty(
    p.ipfsHash, p.title, p.category,
    p.rewardType, p.rewardToken,
    p.totalReward, p.winnerCount, p.prizeWeights,
    p.deadline,
    { value }
  );
}

// ── Helper: check I-1 Factory Balance Coverage ──────────────────────────────
// factory.balance >= sum of all pending pull-payment pools
async function assertFactoryBalanceCoverage(factory) {
  const bal = await ethers.provider.getBalance(await factory.getAddress());
  // We can't directly read private _total* counters, but we can verify
  // that after each operation the contract still has enough ETH for known pending payouts.
  // We read the specific test accounts' pending amounts.
  return bal; // caller will do specific assertions
}

// ─────────────────────────────────────────────────────────────────────────────
// I. ETH Balance Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant I-1: Factory balance covers all pending pools", function () {
  it("cancelBounty: factory balance >= pendingCancelComps + pendingStakeRefunds", async function () {
    const { factory, poster, hunter1, hunter2, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("inv1h1");
    await identity.connect(hunter2).setUsername("inv1h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake1 = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake1 });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake1 });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);

    const comp = (ETH(0.5) * 200n) / 10_000n;
    const totalComp = comp * 2n;
    await factory.connect(poster).cancelBounty(1, { value: totalComp + ETH(0.01) });

    const factoryBal = await ethers.provider.getBalance(await factory.getAddress());
    const pendingComp1 = await factory.pendingCancelComps(hunter1.address);
    const pendingComp2 = await factory.pendingCancelComps(hunter2.address);
    const pendingStake1 = await factory.pendingStakeRefunds(hunter1.address);
    const pendingStake2 = await factory.pendingStakeRefunds(hunter2.address);
    const totalPending = pendingComp1 + pendingComp2 + pendingStake1 + pendingStake2;

    // I-1: factory must have enough to cover all pending
    expect(factoryBal).to.be.gte(totalPending);
  });

  it("triggerTimeout: factory balance >= pendingTimeoutPayouts + pendingStakeRefunds", async function () {
    const { factory, poster, hunter1, hunter2, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("inv2h1");
    await identity.connect(hunter2).setUsername("inv2h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);

    await factory.connect(hunter1).triggerTimeout(1);

    const factoryBal = await ethers.provider.getBalance(await factory.getAddress());
    const pending1  = await factory.pendingTimeoutPayouts(hunter1.address);
    const pending2  = await factory.pendingTimeoutPayouts(hunter2.address);
    const stake1    = await factory.pendingStakeRefunds(hunter1.address);
    const stake2    = await factory.pendingStakeRefunds(hunter2.address);
    const totalPending = pending1 + pending2 + stake1 + stake2;

    expect(factoryBal).to.be.gte(totalPending);
  });

  it("sweep() cannot steal pending cancel comp or stake refunds", async function () {
    const { factory, owner, poster, hunter1, anyone, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("inv3h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);
    const comp = (ETH(0.5) * 200n) / 10_000n;
    await factory.connect(poster).cancelBounty(1, { value: comp });

    // Can only sweep surplus, not pending amounts
    await expect(factory.connect(owner).sweep())
      .to.be.revertedWith("Factory: nothing to sweep");

    // Hunter can still claim
    const h1Before = await ethers.provider.getBalance(hunter1.address);
    await factory.connect(hunter1).claimCancelComp();
    await factory.connect(hunter1).claimStakeRefund();
    const h1After = await ethers.provider.getBalance(hunter1.address);
    expect(h1After).to.be.gt(h1Before);
  });
});

describe("Invariant I-2: Escrow balance covers unreleased records", function () {
  it("after createBounty, escrow holds reward + poster stake", async function () {
    const { factory, escrow, poster } = await deployAll();
    const p = await defaultParams();
    const posterStake = calcPosterStake(ETH(0.5));
    await createBounty(factory, poster, p);

    const escrowBal = await ethers.provider.getBalance(await escrow.getAddress());
    const record = await escrow.getRecord(1);
    const recordedStake = await escrow.posterStakes(1);

    // I-2: escrow must hold exactly reward + poster stake
    expect(escrowBal).to.be.gte(record.amount + recordedStake);
    expect(record.amount).to.equal(ETH(0.5));
    expect(recordedStake).to.equal(posterStake);
  });

  it("after submission, escrow holds reward + poster stake + submission stake", async function () {
    const { factory, escrow, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("inv4h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const subStake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: subStake });

    const escrowBal    = await ethers.provider.getBalance(await escrow.getAddress());
    const record       = await escrow.getRecord(1);
    const posterStake  = await escrow.posterStakes(1);
    const subStakeEsc  = await escrow.submissionStakes(1, hunter1.address);

    expect(escrowBal).to.be.gte(record.amount + posterStake + subStakeEsc);
  });

  it("escrow balance decreases by exactly reward after approveWinners", async function () {
    const { factory, escrow, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("inv5h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const subStake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: subStake });

    const escrowBefore = await ethers.provider.getBalance(await escrow.getAddress());
    await factory.connect(poster).approveWinners(1, [1], [1]);
    const escrowAfter  = await ethers.provider.getBalance(await escrow.getAddress());

    // After approve: reward + poster stake + sub stake all leave escrow
    // (reward distributed, poster stake refunded to poster, sub stake refunded to hunter)
    expect(escrowAfter).to.equal(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// II. State Machine Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant II-1: Terminal states imply escrow settled", function () {
  it("COMPLETED status: escrow.isSettled == true", async function () {
    const { factory, escrow, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("sm1h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).approveWinners(1, [1], [1]);

    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(2n); // COMPLETED
    expect(await escrow.isSettled(1)).to.be.true;
  });

  it("CANCELLED status (no subs): escrow.isSettled == true", async function () {
    const { factory, escrow, poster, registry } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    await factory.connect(poster).cancelBounty(1);

    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(4n); // CANCELLED
    expect(await escrow.isSettled(1)).to.be.true;
  });

  it("EXPIRED status: escrow.isSettled == true", async function () {
    const { factory, escrow, poster, registry } = await deployAll();
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    await time.increase(ONE_DAY * 4);
    await factory.connect(poster).expireBounty(1);

    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(3n); // EXPIRED
    expect(await escrow.isSettled(1)).to.be.true;
  });

  it("COMPLETED: winners array is non-empty", async function () {
    const { factory, escrow, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("sm2h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).approveWinners(1, [1], [1]);

    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(2n);
    expect(bounty.winners.length).to.be.gte(1);
  });
});

describe("Invariant II-2: Submission state consistency", function () {
  it("APPROVED submission: rejectedAt == 0, disputed == false", async function () {
    const { factory, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("ss1h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).approveWinners(1, [1], [1]);

    const sub = await registry.getSubmission(1);
    expect(sub.status).to.equal(1n); // APPROVED
    expect(sub.rejectedAt).to.equal(0n);
    expect(sub.disputed).to.be.false;
  });

  it("disputed submission: heldDisputeStakes > 0", async function () {
    const { factory, escrow, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("ss2h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });

    const sub = await registry.getSubmission(1);
    expect(sub.disputed).to.be.true;
    expect(sub.status).to.equal(2n); // REJECTED
    const held = await escrow.heldDisputeStakes(1, hunter1.address);
    expect(held).to.be.gt(0n); // II-2: disputed submission must have held stake
  });

  it("REJECTED+gracePeriodExpired: rejectedAt > 0", async function () {
    const { factory, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("ss3h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await time.increase(Number(GRACE_PERIOD_REJECT) + 60);
    await factory.connect(poster).rejectSubmission(1, 1);

    const sub = await registry.getSubmission(1);
    expect(sub.gracePeriodExpired).to.be.true;
    expect(sub.rejectedAt).to.be.gt(0n);
  });
});

describe("Invariant II-3: Dispute state consistency", function () {
  it("DISPUTED bounty: at least one submission has disputed == true", async function () {
    const { factory, poster, hunter1, registry, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("ds1h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });

    const bounty = await registry.getBounty(1);
    expect(bounty.status).to.equal(5n); // DISPUTED

    const subs = await registry.getBountySubmissions(1);
    const hasDisputed = subs.some(s => s.disputed);
    expect(hasDisputed).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// III. Access Control Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant III-1: Factory-only mutations", function () {
  it("registry rejects direct addSubmission call from non-factory", async function () {
    const { registry, hunter1 } = await deployAll();
    await expect(
      registry.connect(hunter1).addSubmission(1, hunter1.address, "Qm", 0n)
    ).to.be.revertedWith("Registry: not factory");
  });

  it("escrow rejects direct depositNative call from non-factory", async function () {
    const { escrow, poster } = await deployAll();
    const now = await blockNow();
    await expect(
      escrow.connect(poster).depositNative(1, poster.address, now + ONE_DAY, 0n, { value: ETH(0.1) })
    ).to.be.revertedWith("Escrow: not factory");
  });

  it("reputation rejects direct recordWin call from non-factory", async function () {
    const { reputation, hunter1 } = await deployAll();
    await expect(
      reputation.connect(hunter1).recordWin(hunter1.address, ETH(1), ethers.ZeroAddress)
    ).to.be.revertedWith("Reputation: not factory");
  });

  it("escrow rejects direct refundSubmissionStake from non-factory", async function () {
    const { escrow, hunter1 } = await deployAll();
    await expect(
      escrow.connect(hunter1).refundSubmissionStake(1, hunter1.address)
    ).to.be.revertedWith("Escrow: not factory");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IV. Reputation Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant IV-1: fraudCount only increases on fraud (BUG-RR-5 fix verified)", function () {
  it("fraudCount == 0 until a dispute is denied", async function () {
    const { factory, reputation, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("rep1h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });

    const stats = await reputation.getHunterStats(hunter1.address);
    expect(stats.fraudCount).to.equal(0n);
  });

  it("fraudCount == 1 after a dispute is denied", async function () {
    const { factory, reputation, owner, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("rep2h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);

    const stats = await reputation.getHunterStats(hunter1.address);
    expect(stats.fraudCount).to.equal(1n);
  });

  it("IV-2: getHunterScore always returns >= 0", async function () {
    const { factory, reputation, owner, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("rep3h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);
    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });
    await factory.connect(owner).resolveDispute(1, false, hunter1.address);

    const score = await reputation.getHunterScore(hunter1.address);
    expect(score).to.be.gte(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V. Timeout/Stake Pull-Payment Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant V-1: Timeout pool correctly funded", function () {
  it("after triggerTimeout, sum(pendingTimeoutPayouts) accounts for full hunter pool", async function () {
    const { factory, escrow, poster, hunter1, hunter2, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("v1h1");
    await identity.connect(hunter2).setUsername("v1h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);

    const record = await escrow.getRecord(1);
    const total = record.amount;
    const fee   = (total * 300n) / 10_000n;
    const expectedPool = total - fee;

    await factory.connect(anyone).triggerTimeout(1);

    const p1 = await factory.pendingTimeoutPayouts(hunter1.address);
    const p2 = await factory.pendingTimeoutPayouts(hunter2.address);
    // V-1: sum of queued payouts must equal the full hunter pool
    expect(p1 + p2).to.equal(expectedPool);
  }.bind(null)); // use anonymous function to access ctx

  async function timeoutPoolTest() {
    const ctx = await deployAll();
    const { factory, escrow, poster, hunter1, hunter2, anyone, identity } = ctx;
    await identity.connect(hunter1).setUsername("v1at1");
    await identity.connect(hunter2).setUsername("v1at2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmS1", { value: stake });
    await factory.connect(hunter2).submitWork(1, "QmS2", { value: stake });
    await time.increase(ONE_DAY * 3 + ONE_DAY + 60);
    return ctx;
  }

  it("pendingTimeoutPayouts sum equals full hunter pool (2 hunters)", async function () {
    const { factory, escrow, poster, hunter1, hunter2, anyone, identity } = await timeoutPoolTest();

    const record = await escrow.getRecord(1);
    const total = record.amount;
    const fee   = (total * 300n) / 10_000n;
    const expectedPool = total - fee;

    await factory.connect(anyone).triggerTimeout(1);

    const p1 = await factory.pendingTimeoutPayouts(hunter1.address);
    const p2 = await factory.pendingTimeoutPayouts(hunter2.address);
    expect(p1 + p2).to.equal(expectedPool);
  });

  it("pendingStakeRefunds sum equals sum of submission stakes", async function () {
    const { factory, escrow, hunter1, hunter2, anyone } = await timeoutPoolTest();
    const stake1 = await escrow.submissionStakes(1, hunter1.address);
    const stake2 = await escrow.submissionStakes(1, hunter2.address);

    await factory.connect(anyone).triggerTimeout(1);

    const sr1 = await factory.pendingStakeRefunds(hunter1.address);
    const sr2 = await factory.pendingStakeRefunds(hunter2.address);
    expect(sr1).to.equal(stake1);
    expect(sr2).to.equal(stake2);
  });
});

describe("Invariant V-2: Submission stake accounting", function () {
  it("submissionStakes cleared to 0 after approval", async function () {
    const { factory, escrow, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("v2h1");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });

    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(stake);
    await factory.connect(poster).approveWinners(1, [1], [1]);
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
  });

  it("submissionStakes cleared to 0 after dispute win (moved to heldDisputeStakes then released)", async function () {
    const { factory, escrow, owner, poster, hunter1, identity } = await deployAll();
    await identity.connect(hunter1).setUsername("v2h2");
    const p = await defaultParams();
    await createBounty(factory, poster, p);
    const stake = calcSubStake(ETH(0.5), 15_000n);
    await factory.connect(hunter1).submitWork(1, "QmSub", { value: stake });
    await factory.connect(poster).rejectSubmission(1, 1);

    // After inGrace reject: stake is still in submissionStakes
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(stake);

    await factory.connect(hunter1).raiseDispute(1, 1, { value: ETH(0.01) });

    // After raiseDispute: stake moved to heldDisputeStakes
    expect(await escrow.submissionStakes(1, hunter1.address)).to.equal(0n);
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(stake);

    await factory.connect(owner).resolveDispute(1, true, hunter1.address);

    // After dispute won: heldDisputeStakes cleared
    expect(await escrow.heldDisputeStakes(1, hunter1.address)).to.equal(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VI. Username/Identity Invariants
// ─────────────────────────────────────────────────────────────────────────────
describe("Invariant VI-1: Username uniqueness", function () {
  it("two wallets cannot hold the same username", async function () {
    const { identity, hunter1, hunter2 } = await deployAll();
    await identity.connect(hunter1).setUsername("unique1");
    await expect(identity.connect(hunter2).setUsername("unique1"))
      .to.be.revertedWith("Identity: username taken");
  });
});

describe("Invariant VI-2: Username cooldown consistency (BUG-IR-6 fix verified)", function () {
  it("isUsernameAvailable returns false during 90-day cooldown", async function () {
    const { identity, owner, hunter1 } = await deployAll();
    await identity.connect(hunter1).setUsername("cool1");
    await identity.connect(owner).adminClearUsername(hunter1.address);

    // Immediately: not available (cooldown active)
    expect(await identity.isUsernameAvailable("cool1", ethers.ZeroAddress)).to.be.false;
    // At cooldown end: available
    await time.increase(90 * ONE_DAY + 1);
    expect(await identity.isUsernameAvailable("cool1", ethers.ZeroAddress)).to.be.true;
  });

  it("setUsername and isUsernameAvailable agree about cooldown state", async function () {
    const { identity, owner, hunter1, anyone } = await deployAll();
    await identity.connect(hunter1).setUsername("cool2");
    await identity.connect(owner).adminClearUsername(hunter1.address);

    // Both must agree: not available during cooldown
    const available = await identity.isUsernameAvailable("cool2", ethers.ZeroAddress);
    expect(available).to.be.false;
    await expect(identity.connect(anyone).setUsername("cool2"))
      .to.be.revertedWith("Identity: username in cooldown (90 days after admin clear)");
  });
});

describe("Invariant VI-3: Primary wallet consistency (BUG-IR-1 fix verified)", function () {
  it("unlinkWallet clears claim state — no stale _claimInitiatedAt", async function () {
    const { identity, poster, hunter1 } = await deployAll();
    await identity.connect(poster).setUsername("pr1");
    await identity.connect(hunter1).setUsername("bk1");
    await identity.connect(poster).proposeLink(hunter1.address);
    await identity.connect(hunter1).confirmLink(poster.address);

    // hunter1 initiates claim
    await identity.connect(hunter1).initiateClaim(poster.address);
    const [before] = await identity.getPendingClaim(hunter1.address);
    expect(before).to.be.gt(0n);

    // Primary unlinks — must clear claim state
    await identity.connect(poster).unlinkWallet(hunter1.address);
    const [after] = await identity.getPendingClaim(hunter1.address);
    expect(after).to.equal(0n); // VI-3: claim state cleared on unlink
  });

  it("_primaryOf[linked] == 0 after unlinkWallet", async function () {
    const { identity, poster, hunter1 } = await deployAll();
    await identity.connect(poster).setUsername("pr2");
    await identity.connect(hunter1).setUsername("bk2");
    await identity.connect(poster).proposeLink(hunter1.address);
    await identity.connect(hunter1).confirmLink(poster.address);

    // Before unlink: primary of hunter1 == poster
    expect(await identity.getPrimary(hunter1.address)).to.equal(poster.address);

    await identity.connect(poster).unlinkWallet(hunter1.address);

    // After unlink: hunter1 is its own primary again
    expect(await identity.getPrimary(hunter1.address)).to.equal(hunter1.address);
  });
});

// Helper needed in V-1 test
let anyone;
before(async function() {
  const signers = await ethers.getSigners();
  anyone = signers[6]; // the 'anyone' signer from deployAll
});
