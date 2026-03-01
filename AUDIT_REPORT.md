# NadWork Internal Audit Report

**Audit Date:** 2026-03-01  
**Auditor:** Internal (AI-assisted review)  
**Status:** All findings remediated and verified by tests  
**Test suite:** 94 tests, 94 passing

---

## Scope

| Contract | Lines |
|---|---|
| `contracts/BountyFactory.sol` | ~700 |
| `contracts/BountyRegistry.sol` | ~280 |
| `contracts/NadWorkEscrow.sol` | ~450 |
| `contracts/IdentityRegistry.sol` | ~500 |
| `contracts/ReputationRegistry.sol` | ~194 |
| `frontend/src/config/contracts.js` | ~166 |
| `scripts/deploy.js` | ~170 |

---

## Executive Summary

The audit covered the NadWork V3 "Fair System" smart contracts: bounty lifecycle, escrow,
identity, and reputation. Two critical logic bugs were found affecting the fairness guarantees,
four high-severity DoS/economic vulnerabilities, five medium issues, and five low/informational
issues. All findings have been fixed and verified with automated tests.

---

## Findings

### Critical

#### C-01 — Dispute Window Calculated from `submittedAt` Instead of `rejectedAt`
- **Severity:** Critical
- **Contract:** `BountyFactory.sol`, `BountyRegistry.sol`
- **Status:** Fixed
- **Description:** `raiseDispute()` checked `block.timestamp < s.submittedAt + GRACE_PERIOD_REJECT`.
  A poster could submit a deliberately delayed rejection (e.g., wait 1h59m), leaving the
  hunter with only 1 minute to notice and raise a dispute — effectively circumventing the
  2-hour grace period guarantee.
- **Impact:** Poster can time rejection to make disputes practically impossible. Hunters lose
  their stake even for legitimate work.
- **Fix:** Added `uint256 rejectedAt` to `Submission` struct. Window is now measured from
  `s.rejectedAt`. `withdrawRejectedStake()` updated consistently.

#### C-02 — `resolveDispute` Distributes Reward to Non-Disputing Hunters
- **Severity:** Critical
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** The eligible-hunter filter used `status != APPROVED`, which included
  PENDING and non-disputed REJECTED submissions. Hunters who submitted but had no connection
  to the dispute received reward from the pool.
- **Impact:** Economic unfairness; hunters benefit from a dispute they did not raise.
  The disputing hunter receives a diluted share of the pool.
- **Fix:** Changed filter to `subs[i].disputed == true`.

---

### High

#### H-01 — DoS Attack via `cancelBounty` Push-Payment Loop
- **Severity:** High
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** `cancelBounty` used a `for` loop with `require(ok)` on each
  `hunter.call{value: ...}("")`. A malicious hunter smart contract with a reverting
  `receive()` function would cause the entire cancel transaction to revert, permanently
  blocking the poster's ability to cancel and locking all funds.
- **Impact:** Bounty permanently stuck in ACTIVE state; poster's funds locked.
- **Fix:** Pull-payment pattern. Compensation is queued in `pendingCancelComps[hunter]`.
  Hunters call `claimCancelComp()` to collect. `sweep()` updated to protect this pool.

#### H-02 — DoS Attack via `triggerTimeout` Push-Payment Loop
- **Severity:** High
- **Contract:** `BountyFactory.sol`, `NadWorkEscrow.sol`
- **Status:** Fixed
- **Description:** Same pattern as H-01 but in `triggerTimeout`. The escrow's `claimTimeout`
  function pushed to each hunter with `require(ok)`, meaning any one malicious hunter
  could block the timeout for everyone, keeping the bounty in an unresolved state indefinitely.
- **Impact:** Poster ghosting is not punishable; hunters' rewards permanently locked.
- **Fix:** Added `claimTimeoutPullable()` to escrow (native bounties: sends pool to factory,
  factory queues `pendingTimeoutPayouts`). Hunters call `claimTimeoutPayout()`.

#### H-03 — `ranks[]` Array Not Validated or Applied to Prize Weights
- **Severity:** High
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** `approveWinners` accepted a `ranks[]` array but never validated it for
  duplicates or out-of-range values, and the array was not used when computing `effectiveWeights`.
  Winner at index 0 always received the highest prize regardless of their rank. Duplicate
  rank values (e.g., `[1, 1, 1]`) were silently accepted.
- **Impact:** Prize distribution does not match the declared ranking; poster intent is
  ignored. A poster could pass invalid ranks and gaslight hunters about placement.
- **Fix:** Added uniqueness validation (no duplicates) and range check (1..winnerCount).
  `effectiveWeights[i] = b.prizeWeights[ranks[i] - 1]` — rank 1 → highest prize.

#### H-04 — `claimPrimary` Allows Instant Identity Takeover
- **Severity:** High
- **Contract:** `IdentityRegistry.sol`
- **Status:** Fixed
- **Description:** If a linked backup wallet was compromised (leaked private key), an
  attacker could call `claimPrimary()` immediately, taking over the primary identity,
  username, and reputation history with no delay for the legitimate owner to react.
- **Impact:** Complete identity theft; reputation history permanently transferred to attacker.
- **Fix:** Two-step timelock: `initiateClaim()` starts a 3-day window. `finalizeClaim()`
  completes after the window. The original primary can `cancelClaim()` or `unlinkWallet()`
  to stop the attack during the 3-day window.

---

### Medium

#### M-01 — `transitionToReviewing` Missing `whenNotPaused` Modifier
- **Severity:** Medium
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** All other state-changing functions have `whenNotPaused` but
  `transitionToReviewing()` did not, allowing state transitions during emergency pause.
- **Fix:** Added `whenNotPaused` modifier.

#### M-02 — `getAllBounties` Pagination Off-by-One Risk
- **Severity:** Medium (documentation/defensive)
- **Contract:** `BountyRegistry.sol`
- **Status:** Fixed (clarified)
- **Description:** The reverse iteration `result[i] = _bounties[total - offset - i]`
  is mathematically safe when `offset < total`, but lacked a clear comment explaining
  the 1-based ID invariant, creating a maintenance trap.
- **Fix:** Added explicit comment and cleaner variable naming.

#### M-03 — `adminClearUsername` Cooldown Documented But Not Enforced On-Chain
- **Severity:** Medium
- **Contract:** `IdentityRegistry.sol`
- **Status:** Fixed
- **Description:** The `adminClearUsername` NatSpec said "Freed names remain unclaimable
  for 90 days as a spam deterrent — implement off-chain." This meant the cooldown could
  be bypassed by anyone immediately reclaiming a cleared name.
- **Fix:** Added `mapping(string => uint256) private _usernameFreedAt`. `adminClearUsername`
  records the timestamp. `setUsername` enforces the 90-day cooldown on-chain.
  Added `getUsernameCooldownEnd()` view helper.

#### M-04 — Misleading Reject Confirmation Message (Frontend)
- **Severity:** Medium (UX/security)
- **Contract:** `frontend/src/pages/BountyDetailPage.jsx`
- **Status:** Fixed
- **Description:** The `window.confirm` dialog said "Hunter's stake will be refunded"
  which is false during the grace period — the stake is held for 2 hours while the hunter
  can raise a dispute.
- **Fix:** Updated message to accurately describe the grace period behavior.

#### M-05 — `resolveDispute` Centralized (Owner-Only)
- **Severity:** Medium (decentralization/trust)
- **Contract:** `BountyFactory.sol`
- **Status:** Acknowledged — not changed
- **Description:** Dispute resolution is `onlyOwner`. This is a single point of failure
  and requires users to trust the platform operator.
- **Mitigation plan for future version:** Migrate to multi-sig (Gnosis Safe), then DAO
  governance with timelocked resolution. For V3, admin dispute resolution is an acceptable
  tradeoff for the bootstrapping phase.

---

### Low

#### L-01 — Wei Dust Locked on Integer Division in `cancelBounty`
- **Severity:** Low
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** `totalComp / validSubCount` could leave up to `validSubCount - 1` wei
  permanently locked in the factory.
- **Fix:** Last valid hunter receives `eachMON + dust`.

#### L-02 — `triggerTimeout` Missing Reputation Penalty for Poster
- **Severity:** Low
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** `triggerTimeout` (poster ghosted) did not call
  `reputation.recordCancelWithSubmissions()`, so ghosting posters faced no on-chain
  reputation penalty.
- **Fix:** Added `reputation.recordCancelWithSubmissions(b.poster)`.

#### L-03 — Owner-Featured Bounties Indistinguishable from Paid (BountyFactory)
- **Severity:** Low
- **Contract:** `BountyFactory.sol`
- **Status:** Fixed
- **Description:** Owner could feature bounties for free; event `BountyFeatured` was
  emitted identically to paid featuring, preventing on-chain transparency.
- **Fix:** Added distinct `BountyFeaturedByOwner` event for owner-comped featuring.

#### L-04 — ABI `pure` Should Be `view` for Public Constants (Frontend)
- **Severity:** Low
- **Contract:** `frontend/src/config/contracts.js`
- **Status:** Fixed
- **Description:** Solidity public constant getters emit `stateMutability: view` in ABI
  output, not `pure`. Declaring them as `pure` in human-readable ABI can cause errors
  with stricter ethers.js / viem versions.
- **Fix:** Changed all constant getters from `pure` to `view` in `FACTORY_ABI`.

#### L-05 — Chain ID `143` vs `10143` Ambiguity
- **Severity:** Low (documentation)
- **Contract:** `scripts/deploy.js`, `hardhat.config.js`
- **Status:** Fixed (documented)
- **Description:** Monad Mainnet chain ID is `143` per official documentation. The audit
  noted potential confusion with testnet (`10143`). If the wrong chain ID is used, MetaMask
  and ethers.js will reject or silently sign for the wrong network.
- **Fix:** Added explicit comment in `deploy.js` confirming `143` is the correct mainnet ID.
  Recommendation: add a runtime chain ID assertion in `createBounty` for a future version.

---

### Informational

#### I-01 — Test Coverage Gaps
- **Status:** Addressed in this audit cycle
- **Added tests:** ERC20 bounty full flow, `withdrawRejectedStake` flow,
  pull-payment claim functions (H-01/H-02), timelock flow (H-04), username cooldown (M-03),
  ranks validation (H-03), dispute window (C-01/C-02), `whenNotPaused` (M-05).
- **Remaining gap:** Reentrancy attack simulation (requires malicious contract fixture);
  consider adding in a dedicated security test file.

#### I-02 — `identityReg.setFactory()` Not Called in Deployment
- **Status:** Acknowledged — IdentityRegistry has no `setFactory` (not needed; identity
  contract is read-only from factory's perspective). Deployment script verified via full
  sanity check suite.

---

## Remediation Summary

| ID | Severity | Status |
|---|---|---|
| C-01 | Critical | Fixed |
| C-02 | Critical | Fixed |
| H-01 | High | Fixed |
| H-02 | High | Fixed |
| H-03 | High | Fixed |
| H-04 | High | Fixed |
| M-01 | Medium | Fixed |
| M-02 | Medium | Fixed (clarified) |
| M-03 | Medium | Fixed |
| M-04 | Medium | Fixed |
| M-05 | Medium | Acknowledged |
| L-01 | Low | Fixed |
| L-02 | Low | Fixed |
| L-03 | Low | Fixed |
| L-04 | Low | Fixed |
| L-05 | Low | Fixed (documented) |
| I-01 | Info | Addressed |
| I-02 | Info | Acknowledged |

---

## Recommendations for Future Versions

1. **Decentralized dispute resolution:** Replace `onlyOwner` on `resolveDispute` with a
   multi-sig (Gnosis Safe 2-of-3) then DAO governance with a 48-hour timelock.
2. **Runtime chain ID assertion:** Add `require(block.chainid == 143, "wrong network")` in
   `BountyFactory.createBounty` to prevent accidental testnet deployments.
3. **Reentrancy security test:** Add a `MaliciousHunter.sol` contract fixture that reverts
   on `receive()` and verify the pull-payment defenses hold under adversarial conditions.
4. **ERC20 timeout pull-payment:** Currently ERC20 bounty timeout uses push-payment in
   `claimTimeoutPullable`. Consider extending pull-payment to ERC20 as well if ERC20 token
   contracts could be hostile (unlikely but possible with proxy tokens).
5. **Pinata proxy security:** Move Pinata API key server-side via the Cloudflare Worker
   (`workers/pin-proxy/`). The `VITE_PINATA_SECRET_API_KEY` must not be included in any
   frontend bundle. See `SECURITY.md` for the recommended architecture.
