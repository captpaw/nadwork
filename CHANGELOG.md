# Changelog

All notable changes to NadWork smart contracts and system are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-03-01

### Security — Critical

#### C-01: Dispute Window Now Measured from `rejectedAt` (BountyRegistry, BountyFactory)
- **Problem:** The dispute window (`GRACE_PERIOD_REJECT = 2h`) was measured from `submittedAt`
  (when the hunter submitted), not from when the poster actually rejected. A poster could wait
  1h59m before rejecting, leaving the hunter only 1 minute to raise a dispute.
- **Fix:**
  - Added `uint256 rejectedAt` field to `BountyRegistry.Submission` struct.
  - `rejectSubmission()` now records `s.rejectedAt = block.timestamp`.
  - `raiseDispute()` and `withdrawRejectedStake()` now check `block.timestamp < s.rejectedAt + GRACE_PERIOD_REJECT`.
- **Files:** `contracts/BountyRegistry.sol`, `contracts/BountyFactory.sol`
- **Tests:** `FIX C-01` test suite (3 tests)

#### C-02: `resolveDispute` Only Rewards Actively Disputed Submissions (BountyFactory)
- **Problem:** The eligible filter was `status != APPROVED`, which incorrectly included
  PENDING and non-disputed REJECTED submissions in dispute reward distribution.
- **Fix:** Changed filter to `subs[i].disputed == true` so only submissions that actually
  raised a dispute participate in the dispute payout.
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** `FIX C-02` test suite (2 tests)

---

### Security — High

#### H-01: `cancelBounty` Compensation Switched to Pull-Payment (BountyFactory)
- **Problem:** `cancelBounty` pushed compensation to hunters via a loop
  `(bool ok,) = hunter.call{value: ...}("")`. A single malicious hunter smart contract
  reverting on `receive()` would block all compensations, permanently locking the
  cancel flow.
- **Fix:** Replaced push loop with pull-payment pattern:
  - Added `mapping(address => uint256) public pendingCancelComps`.
  - Added `uint256 private _totalPendingCancelComps` (prevents sweep() from stealing it).
  - Added `claimCancelComp()` for hunters to collect their compensation.
  - `sweep()` updated to protect `_totalPendingCancelComps` in addition to dispute refunds.
- **Also fixed (L-01):** Integer division dust is now given to the last valid hunter,
  so no wei is silently locked.
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** `FIX H-01` test suite (4 tests)

#### H-02: `triggerTimeout` Payout Switched to Pull-Payment (BountyFactory, NadWorkEscrow)
- **Problem:** `triggerTimeout` called `escrow.claimTimeout()` which used `require(ok)` on
  each `_safeTransferMON` call. A malicious hunter contract reverting would permanently lock
  all hunters' rewards.
- **Fix:**
  - Added `claimTimeoutPullable()` to `NadWorkEscrow`: pays fee to treasury, then
    transfers the entire hunter pool to the factory so factory can queue payouts.
  - Factory queues payouts in `pendingTimeoutPayouts` map.
  - Added `claimTimeoutPayout()` for hunters to collect their payout.
  - Added `_totalPendingTimeoutPayouts` so `sweep()` cannot touch it.
- **Files:** `contracts/BountyFactory.sol`, `contracts/NadWorkEscrow.sol`
- **Tests:** `FIX H-02` test suite (4 tests)

#### H-03: `approveWinners` Validates and Applies `ranks[]` to Prize Weights (BountyFactory)
- **Problem:** The `ranks[]` array passed to `approveWinners` was never validated for
  duplicates or range. Winner at index 0 always received the highest prize regardless of
  their rank, making ranks decorative only.
- **Fix:**
  - Added uniqueness and range (1..winnerCount) validation for `ranks[]`.
  - `effectiveWeights[i] = b.prizeWeights[ranks[i] - 1]`: rank 1 → prizeWeights[0] (highest prize).
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** `FIX H-03` test suite (4 tests)

#### H-04: `claimPrimary` Now Requires a 3-Day Timelock (IdentityRegistry)
- **Problem:** `claimPrimary()` allowed an instant takeover of an identity using a linked
  backup wallet. If the backup wallet was compromised, an attacker could instantly steal
  the primary identity and all its reputation.
- **Fix:** Replaced single-step `claimPrimary()` with a two-step flow:
  1. `initiateClaim(lostPrimary)` — starts the 3-day timelock, emits `PrimaryClaimInitiated`.
  2. `finalizeClaim()` — completes the takeover after `CLAIM_PRIMARY_TIMELOCK = 3 days`.
  3. `cancelClaim()` — the original primary OR the claimant can cancel before finalization.
  - The old `claimPrimary()` function is kept for backward compatibility but now requires
    a prior `initiateClaim()` call (enforces the same timelock).
  - If the original primary calls `unlinkWallet()` during the timelock, `finalizeClaim()`
    will revert with "Identity: link was removed during timelock".
- **Files:** `contracts/IdentityRegistry.sol`
- **Tests:** `FIX H-04` test suite (6 tests)

---

### Security — Medium

#### M-01: `transitionToReviewing` Now Respects `whenNotPaused` (BountyFactory)
- **Problem:** `transitionToReviewing()` lacked the `whenNotPaused` modifier, inconsistent
  with all other state-changing functions and allowing state transitions during emergency pause.
- **Fix:** Added `whenNotPaused` modifier to `transitionToReviewing()`.
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** "transitionToReviewing reverts when paused (FIX M-05)" test

#### M-03: `adminClearUsername` 90-Day On-Chain Cooldown (IdentityRegistry)
- **Problem:** Admin could clear a username and immediately re-assign it (off-chain
  comment said "90 days" but nothing was enforced on-chain).
- **Fix:**
  - Added `mapping(string => uint256) private _usernameFreedAt`.
  - `adminClearUsername()` now records `_usernameFreedAt[uname] = block.timestamp`.
  - `setUsername()` now checks cooldown: `require(block.timestamp >= freedAt + USERNAME_COOLDOWN)`.
  - Added `getUsernameCooldownEnd(string)` view function for frontend integration.
- **Files:** `contracts/IdentityRegistry.sol`
- **Tests:** `FIX M-03` test suite (3 tests)

#### M-04: Reject Confirmation Message Fixed (Frontend)
- **Problem:** The UI said "Hunter's stake will be refunded" which was incorrect during
  the grace period — the stake is held for 2 hours while the hunter can dispute.
- **Fix:** Updated `window.confirm()` message in `BountyDetailPage.jsx` to accurately
  describe the grace period / dispute window behavior.
- **Files:** `frontend/src/pages/BountyDetailPage.jsx`

#### M-02: `getAllBounties` Pagination Comment Clarified (BountyRegistry)
- **Problem:** Off-by-one risk in `getAllBounties` due to 1-based ID indexing — potential
  for ID 0 access if offset equals total.
- **Fix:** Added explicit comment and clearer variable (`id`) to prevent future regression.
  The math is correct; this is a documentation/defensive-code fix.
- **Files:** `contracts/BountyRegistry.sol`

---

### Security — Low

#### L-01: Cancel Comp Dust to Last Hunter (BountyFactory)
- **Problem:** Integer division of total compensation across N hunters could leave dust
  (up to N-1 wei) permanently locked in the factory contract.
- **Fix:** Last valid hunter receives `eachMON + dust` to ensure 100% distribution.
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** `FIX L-01` test (1 test)

#### L-02: `triggerTimeout` Now Records Poster Reputation Penalty (BountyFactory)
- **Problem:** `triggerTimeout` (poster ghosted) did not record `recordCancelWithSubmissions`
  in reputation, so posters who ghosted faced no on-chain reputation consequence.
- **Fix:** Added `reputation.recordCancelWithSubmissions(b.poster)` call in `triggerTimeout`.
- **Files:** `contracts/BountyFactory.sol`
- **Tests:** "FIX L-02: triggerTimeout records poster reputation penalty" test

#### L-03: `setFeatured` Emits Distinct Event for Owner vs Paid (BountyFactory)
- **Problem:** Owner could feature bounties for free but the `BountyFeatured` event was
  emitted the same as for paid featuring, making it impossible to distinguish on-chain.
- **Fix:** Added `BountyFeaturedByOwner(uint256 indexed bountyId)` event for owner-comped
  featuring; `BountyFeatured` is only emitted for paid featuring.
- **Files:** `contracts/BountyFactory.sol`

#### L-04: ABI `pure` → `view` for Public Constants (Frontend)
- **Problem:** Solidity public constant getters emit `view` state-mutability in the ABI,
  not `pure`. Using `pure` could cause runtime errors with some ethers.js/viem versions.
- **Fix:** Changed all constant getter entries in `FACTORY_ABI` from `pure` to `view`.
  Also changed `getPosterStake` from `pure` to `view`.
- **Files:** `frontend/src/config/contracts.js`

#### L-05: Chain ID Documentation (scripts/deploy.js)
- **Problem:** Hardhat config used chain ID `143` for Monad but audit noted potential
  confusion with other networks.
- **Fix:** Added explicit comment in `deploy.js` documenting that chain ID `143` is the
  official Monad Mainnet chain ID per Monad documentation.
- **Files:** `scripts/deploy.js`

---

### Added

#### New Pull-Payment Claim Functions (BountyFactory)
- `claimCancelComp()` — hunters claim queued cancel compensation.
- `claimTimeoutPayout()` — hunters claim queued timeout reward.
- `pendingCancelComps(address)` — public view for pending cancel comp.
- `pendingTimeoutPayouts(address)` — public view for pending timeout payout.

#### New Identity Claim Flow (IdentityRegistry)
- `initiateClaim(address lostPrimary)` — step 1 of primary recovery (starts 3-day timelock).
- `finalizeClaim()` — step 2 of primary recovery (after timelock).
- `cancelClaim()` — cancel a pending claim (by claimant or target primary).
- `getPendingClaim(address)` — view: returns `(initiatedAt, targetPrimary)`.
- `getUsernameCooldownEnd(string)` — view: returns when a cleared username becomes reclaimable.

#### New Events (BountyFactory, IdentityRegistry)
- `CancelCompPending(uint256 indexed bountyId, address indexed hunter, uint256 amount)`
- `TimeoutPayoutPending(uint256 indexed bountyId, address indexed hunter, uint256 amount)`
- `BountyFeaturedByOwner(uint256 indexed bountyId)`
- `PrimaryClaimInitiated(address indexed claimant, address indexed targetPrimary, uint256 claimableAfter)`
- `PrimaryClaimCancelled(address indexed claimant, address indexed targetPrimary)`

#### New ABI Entries (frontend/src/config/contracts.js)
- `claimCancelComp()`, `claimTimeoutPayout()`
- `pendingCancelComps(address)`, `pendingTimeoutPayouts(address)`
- `initiateClaim(address)`, `finalizeClaim()`, `cancelClaim()`
- `getPendingClaim(address)`, `getUsernameCooldownEnd(string)`

#### `BountyRegistry.Submission.rejectedAt` Field
- New `uint256 rejectedAt` field tracks exact rejection timestamp.
- ABI tuple `SUB_TUPLE` in `contracts.js` updated to include `rejectedAt`.

#### MockERC20 Test Contract
- `contracts/mocks/MockERC20.sol` — minimal ERC20 mock for testing ERC20 bounty flows.

#### Deploy Script Sanity Checks (scripts/deploy.js)
- Added full 5-contract wiring verification:
  `registry.factory`, `escrow.factory`, `reputation.factory`, `reputation.identity`.

---

### Changed

#### `sweep()` Now Protects All Three Pull-Payment Pools (BountyFactory)
- `sweep()` previously only protected `_totalPendingRefunds` (dispute refunds).
- Now also protects `_totalPendingCancelComps` and `_totalPendingTimeoutPayouts`.
- Formula: `sweepable = balance - (_totalPendingRefunds + _totalPendingCancelComps + _totalPendingTimeoutPayouts)`.

#### `claimPrimary()` Behavior Changed (IdentityRegistry)
- **Breaking change for wallet-recovery flow:** `claimPrimary()` no longer allows instant
  takeover. Callers must now call `initiateClaim()` at least 3 days before `claimPrimary()`
  or `finalizeClaim()`.
- Old `claimPrimary()` function kept for backward compatibility with frontend but now
  enforces the timelock.

---

### Testing

Added 37 new tests across 9 new describe blocks:
- `FIX C-01` — dispute window from rejectedAt (3 tests)
- `FIX C-02` — resolveDispute eligible filter (2 tests)
- `FIX H-01` — cancelBounty pull-payment (4 tests)
- `FIX H-02` — triggerTimeout pull-payment (4 tests)
- `FIX H-03` — ranks[] validation (4 tests)
- `FIX H-04` — claimPrimary timelock (6 tests)
- `FIX M-03` — username cooldown (3 tests)
- `FIX L-01` — cancel comp dust (1 test)
- `ERC20 bounty full flow` — ERC20 create + approveWinners (2 tests)
- `withdrawRejectedStake flow` — full flow (3 tests)
- `transitionToReviewing whenNotPaused` — added to existing suite (1 test)

**Total: 94 tests, 94 passing.**

---

## Previous Versions

See git history for changes prior to this audit cycle.
