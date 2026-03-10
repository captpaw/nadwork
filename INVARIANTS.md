# NadWork Contract Invariants

> **Definisi:** Invariant adalah kondisi yang HARUS selalu benar setelah setiap transaksi.
> Setiap perbaikan bug WAJIB memverifikasi bahwa semua invariant di bawah ini masih terpenuhi.
> Test otomatis ada di `test/invariants.test.js`.

---

## I. ETH Balance Invariants

### I-1: Factory Balance Coverage
```
address(factory).balance >= _totalPendingRefunds
                          + _totalPendingCancelComps
                          + _totalPendingTimeoutPayouts
                          + _totalPendingStakeRefunds   [setelah fix XC-02]
```
**Artinya:** Factory tidak boleh pernah sweep ETH yang sebenarnya adalah kewajiban kepada user.

### I-2: Escrow Balance Coverage
```
address(escrow).balance >= sum(unreleased _records[bountyId].amount)
                         + sum(unreleased creatorStakes[bountyId])
                         + sum(submissionStakes[bountyId][builder])
                         + sum(heldDisputeStakes[bountyId][builder])
```
**Artinya:** Setiap ETH yang ada di escrow harus bisa di-attributasi ke record yang spesifik.

### I-3: No ETH Stranded Post-Settlement
```
Jika escrow.isSettled(bountyId) == true:
  THEN _records[bountyId].amount sudah ditransfer (released atau refunded)
  AND  creatorStakes[bountyId] == 0
```

---

## II. State Machine Invariants

### II-1: Terminal States
```
Jika bounty.status == COMPLETED:
  THEN escrow.isSettled(bountyId) == true
  AND  bounty.winners.length >= 1

Jika bounty.status == CANCELLED atau EXPIRED:
  THEN escrow.isSettled(bountyId) == true
```

### II-2: Submission State Consistency
```
Jika submission.status == APPROVED:
  THEN submission.rejectedAt == 0
  AND  submission.disputed == false
  AND  submission.gracePeriodExpired == false

Jika submission.disputed == true:
  THEN submission.status == REJECTED
  AND  escrow.heldDisputeStakes[bountyId][builder] > 0

Jika submission.status == REJECTED AND submission.gracePeriodExpired == true:
  THEN submission.rejectedAt > 0
  AND  block.timestamp >= submission.rejectedAt + 2 hours [pada saat reject]
```

### II-3: Dispute State
```
Jika bounty.status == DISPUTED:
  THEN ada setidaknya 1 submission dengan disputed == true

Jika bounty.status != DISPUTED:
  THEN TIDAK ADA submission dengan disputed == true [kecuali post-resolveDispute]
```

### II-4: Claim Timelock Consistency (IdentityRegistry)
```
Jika _claimInitiatedAt[wallet] > 0:
  THEN _primaryOf[wallet] == _claimTargetPrimary[wallet]
  AND  wallet ada dalam _identities[_claimTargetPrimary[wallet]].linkedWallets
```
**Konsekuensi dari BUG-IR-1:** Jika unlinkWallet dipanggil, maka:
```
  THEN _claimInitiatedAt[wallet] harus di-clear
  AND  _claimTargetPrimary[wallet] harus di-clear
```

---

## III. Access Control Invariants

### III-1: Factory-Only Mutations
```
Semua fungsi berikut HANYA bisa dipanggil oleh factory:
  - BountyRegistry: registerBounty, addSubmission, setWinners, rejectSubmission,
                    markGracePeriodExpired, markDisputed, updateBountyStatus, setFeatured
  - NadWorkEscrow: depositNative, depositERC20, release, releaseToAll, claimTimeout,
                   claimTimeoutPullable, refund, depositSubmissionStake,
                   refundSubmissionStake, slashSubmissionStake, moveStakeToHeld,
                   releaseDisputeStake, slashHeldDisputeStake,                    refundCreatorStake,
                   slashCreatorStake
  - ReputationRegistry: recordSubmission, recordWin, recordBountyPosted,
                        recordBountyCompleted, recordFraudSubmission, recordFraudCancel,
                        recordCancelWithSubmissions, recordDisputeLost
```

### III-2: Pull-Payment Pool Isolation
```
sweep() TIDAK BOLEH menyentuh:
  - _totalPendingRefunds (dispute refunds)
  - _totalPendingCancelComps (cancel comps)
  - _totalPendingTimeoutPayouts (timeout payouts)
  - _totalPendingStakeRefunds [setelah fix XC-02]
```

---

## IV. Reputation Invariants

### IV-1: fraudCount Only Increases on Fraud
```
builders[primary].fraudCount > 0
  IMPLIES resolveDispute dengan inFavorOfBuilders==false pernah dipanggil (dispute denied)
  AND     recordFraudSubmission pernah dipanggil untuk hunter tersebut
```
**Konsekuensi dari BUG-RR-5:** `recordFraudSubmission` harus dipanggil di deny path jika dispute adalah tentang fraud submission.

### IV-2: Score is Non-Negative
```
getBuilderScore(builder) >= 0  [selalu, karena max(0, positive - penalty)]
getCreatorScore(creator) >= 0
```

---

## V. Timeout/Stake Pull-Payment Invariants

### V-1: Timeout Pool Correctly Funded
```
Jika triggerTimeout dipanggil untuk native bounty:
  THEN factory.balance naik sebesar hunterPool (dari escrow via claimTimeoutPullable)
  AND  _totalPendingTimeoutPayouts naik sebesar hunterPool
  AND  sum(pendingTimeoutPayouts[builder] for semua pendingBuilders) == builderPool
```

### V-2: Submission Stake Accounting
```
escrow.submissionStakes[bountyId][builder] > 0
  IMPLIES builder pernah submit ke bountyId
  AND     stake BELUM dikembalikan / di-slash / di-move ke heldDisputeStakes
```

### V-3: CEI Order for External Calls
```
Setiap fungsi yang memanggil _safeTransferMON atau external contract WAJIB:
  1. Semua CHECKS (require) dulu
  2. Semua EFFECTS (state changes) dulu
  3. Baru INTERACTIONS (external calls)
```

---

## VI. Username/Identity Invariants

### VI-1: Username Uniqueness
```
Untuk setiap dua wallet A dan B (A != B):
  _usernameTaken[x] == A  IMPLIES  _identities[B].username != x
```

### VI-2: Username Cooldown Consistency
```
Jika _usernameFreedAt[name] > 0 AND block.timestamp < _usernameFreedAt[name] + 90 days:
  THEN _usernameTaken[name] == address(0)
  AND  isUsernameAvailable(name, anyone) == false
```
**Konsekuensi dari BUG-IR-6:** `isUsernameAvailable` harus cek `_usernameFreedAt`.

### VI-3: Primary Wallet Consistency
```
Jika _primaryOf[wallet] != address(0):
  THEN wallet ada dalam _identities[_primaryOf[wallet]].linkedWallets
```

---

## VII. Checklist Verifikasi Per-Fix

Setiap kali melakukan perbaikan, centang:

```
□ I-1: Factory balance masih >= semua pending pools
□ I-2: Escrow balance masih >= semua unlocked records
□ II-1: Terminal states masih consistent
□ II-2: Submission states masih consistent
□ II-4: Claim timelock masih valid setelah unlink
□ III-2: sweep() tidak menyentuh reserved amounts
□ V-1: Timeout pool correctly funded
□ V-3: CEI order dipatuhi
□ VI-2: Username cooldown di-enforce di isUsernameAvailable
```

---

## VIII. Bug History → Invariants Added

| Bug ID | Invariant Added | Status |
|--------|----------------|--------|
| NE-1   | V-1: Timeout pool correctly funded | PENDING FIX |
| NE-2   | V-3: CEI order | PENDING FIX |
| BUG-IR-1 | II-4: Claim timelock consistency | PENDING FIX |
| BUG-IR-6 | VI-2: Username cooldown | PENDING FIX |
| BUG-RR-5 | IV-1: fraudCount only on actual fraud | PENDING FIX |
| M-02   | II-1: Terminal states (REVIEWING restore) | PENDING FIX |
| T-01   | V-2: Submission stake accounting | PENDING FIX |
| RR-1   | IV reputation lastActivity | PENDING FIX |
