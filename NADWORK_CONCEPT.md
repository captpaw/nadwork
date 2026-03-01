# NadWork — Konsep Produk

**Versi:** 0.1 (Draft)
**Tanggal:** 2026-02-28
**Status:** Konsep — belum diimplementasi

---

## Latar Belakang

**NadHunt** adalah platform bounty kompetitif: satu poster, banyak hunter, satu pemenang.
Model ini cocok untuk task dengan output terukur — desain logo, write-up bug, script pendek.

Namun ekosistem Monad butuh lebih dari itu. Banyak kebutuhan kerja yang tidak cocok dengan format kompetisi:
- Developer yang dibutuhkan untuk 2 minggu integrasi API
- Auditor yang diperlukan untuk review smart contract secara menyeluruh
- Content writer yang direkrut untuk seri artikel jangka panjang

**NadWork** hadir untuk mengisi celah itu: **platform gig & freelance on-chain di Monad**.

---

## Diferensiasi: NadHunt vs NadWork

| Dimensi | NadHunt | NadWork |
|---|---|---|
| **Model** | Kompetisi terbuka | Kontrak langsung (direct hire) |
| **Alur kerja** | Post → Submit → Pilih pemenang | Post → Proposal → Negosiasi → Kontrak |
| **Pembayaran** | Satu kali setelah approve | Milestone-based, bertahap |
| **Durasi** | Biasanya singkat (days) | Bisa mingguan hingga bulanan |
| **Peserta** | Banyak hunter, 1 menang | 1 client, 1 worker |
| **Output** | Submission sudah jadi | Deliverable per milestone |
| **Risiko worker** | Kerja penuh, mungkin kalah | Dibayar per progress |

---

## Konsep Inti

### Alur Utama

```
CLIENT                          WORKER
  │                               │
  ├─ Post Job Listing             │
  │  (budget, scope, deadline)    │
  │                               │
  │         ◄──── Submit Proposal ┤
  │                (bid + plan)   │
  │                               │
  ├─ Accept Proposal ────────────►│
  │                               │
  ├─ Deposit Escrow (full budget) │
  │                               │
  │  [Milestone 1]                │
  │         ◄──── Deliverable ────┤
  ├─ Approve ───────────────────►│
  ├─ Release Payment (M1) ───────►│
  │                               │
  │  [Milestone 2] ...            │
  │         ◄──── Deliverable ────┤
  ├─ Approve + Release (M2) ─────►│
  │                               │
  ├─ Leave Review ────────────────►│
  │         ◄──── Leave Review ───┤
```

### Tiga Mode Kontrak

| Mode | Deskripsi | Use Case |
|---|---|---|
| **Fixed Price** | Budget tetap, dibayar per milestone | Development, design |
| **Time & Material** | Bayar per jam, client approve timesheet | Consulting, review |
| **Retainer** | Bayar bulanan flat, scope fleksibel | Ongoing support, content |

---

## Arsitektur Smart Contract

### Kontrak Baru

```
WorkFactory.sol
├── createJob(title, budget, token, milestones[], deadline)
├── submitProposal(jobId, bidAmount, plan, timeline)
├── acceptProposal(jobId, proposalId)
├── submitDeliverable(jobId, milestoneIdx, ipfsCid)
├── approveDeliverable(jobId, milestoneIdx)
├── requestRevision(jobId, milestoneIdx, reason)
├── raiseDispute(jobId, milestoneIdx)
└── cancelJob(jobId)

WorkEscrow.sol
├── deposit(jobId, token, amount)
├── releaseMilestone(jobId, milestoneIdx, workerAddress)
├── refundRemaining(jobId)
└── resolveDispute(jobId, winner, splitBps)

WorkRegistry.sol
├── getAllJobs(offset, limit)
├── getJobsByCategory(category, offset, limit)
├── getProposalsForJob(jobId)
├── getWorkerActiveContracts(address)
└── getClientPostedJobs(address)
```

### Shared dengan NadHunt

```
ReputationRegistry.sol  ← DIPAKAI BERSAMA (extended)
```

Reputation dari NadHunt (bounty wins) dan NadWork (gig completions) digabung dalam satu registry.
Score composite: `bounty_score + gig_score`.

---

## Sistem Reputasi (Extended)

### NadWork menambah dimensi baru ke ReputationRegistry:

```solidity
struct WorkerProfile {
    uint256 gigsCompleted;
    uint256 gigsTotal;          // termasuk yang canceled/disputed
    uint256 totalEarnedWork;    // earnings dari gigs (normalized)
    uint256 onTimeDeliveries;   // milestone delivered before deadline
    uint256 avgResponseTime;    // rata-rata waktu response proposal (detik)
}

struct ClientProfile {
    uint256 jobsPosted;
    uint256 jobsCompleted;
    uint256 avgPaymentDelay;    // rata-rata hari dari approve ke release
    bool fastPayer;             // flag: release < 24 jam dari approve
}
```

### Score Formula (Worker)

```
NadWork Score = (gigsCompleted × 50)
              + (onTimeRate × 30)       // (onTime / gigsTotal) × 30
              + (totalEarnedWork / 1e15) // normalized
              + NadHuntScore × 0.2      // bonus dari bounty history
```

Worker dengan rekam jejak di NadHunt mendapat **head start reputation** di NadWork.

---

## Kategori Pekerjaan

```
DEVELOPMENT
├── Smart Contract / Solidity
├── Frontend (React, Web3)
├── Backend / API
└── Full Stack

SECURITY
├── Smart Contract Audit
├── Penetration Testing
└── Code Review

DESIGN
├── UI/UX Design
├── Brand Identity
└── NFT / Generative Art

CONTENT
├── Technical Writing
├── Marketing Copy
└── Translation

RESEARCH
├── Market Research
├── Tokenomics Design
└── Competitive Analysis

OTHER
└── Custom
```

---

## Dispute Resolution

### Mekanisme 3-Tier:

```
Tier 1 — Negotiasi (0-48 jam)
  Client dan worker negosiasi langsung via platform messaging

Tier 2 — Arbitrase NadWork (48-96 jam)
  Platform mereview deliverable + revision history
  Platform tentukan: release penuh / partial / refund

Tier 3 — Arbitrase Komunitas (opsional, masa depan)
  NadWork token holders voting sebagai jury
  Diperlukan untuk dispute > 1000 MON
```

### Deposit Dispute

- Worker deposit: `0.005 MON` saat raise dispute (dikembalikan jika menang)
- Client deposit: `0.005 MON` saat raise dispute (dikembalikan jika menang)

---

## Tokenomics & Fee

| Event | Fee | Penerima |
|---|---|---|
| Job completed (milestones all done) | 3% dari total budget | NadWork treasury |
| Job canceled setelah accept | 1% dari budget yang sudah di-escrow | NadWork treasury |
| Dispute resolved | 0.5% dari disputed amount | NadWork treasury |

**Fee lebih rendah dari NadHunt (3%)** karena volume lebih besar per transaksi (gig > bounty).

---

## Frontend Pages (Konsep)

```
/               → Landing / Browse Jobs
/jobs           → Job listings (filter: category, budget, token, duration)
/jobs/:id       → Job detail + proposal list (public)
/jobs/:id/apply → Submit proposal form
/post-job       → Multi-step form: scope, milestones, budget, token
/dashboard      → Client: posted jobs + worker management
                  Worker: active gigs + proposal tracker
/contract/:id   → Active contract view + milestone tracker + messaging
/profile/:addr  → Worker/Client profile + reviews + stats
/leaderboard    → Top workers by category
```

---

## Relasi dengan NadHunt

NadWork dan NadHunt adalah **produk terpisah dengan reputasi bersama**:

```
Monad Ecosystem
│
├── NadHunt       ← Bounty platform (nadhunt.xyz)
│   └── BountyFactory, BountyRegistry, NadHuntEscrow
│
├── NadWork       ← Freelance platform (nadwork.xyz)
│   └── WorkFactory, WorkRegistry, WorkEscrow
│
└── ReputationRegistry (SHARED)
    └── Satu kontrak, dipakai dua platform
        Score dari NadHunt visible di NadWork profile
        Score dari NadWork visible di NadHunt profile
```

### Upgrade path untuk hunter NadHunt:
1. Hunter menang beberapa bounty → dapat reputation score
2. Score ini sudah terlihat di NadWork profile mereka
3. Client di NadWork bisa lihat rekam jejak NadHunt → lebih mudah dapat kontrak
4. Gig worker yang konsisten bisa "naik kelas" dari hunter ke contractor

---

## Tagline & Positioning

| | NadHunt | NadWork |
|---|---|---|
| **Tagline** | *"Hunt bounties. Earn on Monad."* | *"Get work done. On-chain."* |
| **Target user** | Developer/designer yang suka challenge | Freelancer yang cari income stabil |
| **Client type** | Project yang butuh satu deliverable | Project yang butuh ongoing work |
| **Tone** | Kompetitif, exciting | Professional, reliable |

---

## Roadmap Konseptual

### Phase 0 — Foundation (setelah NadHunt stabil)
- [ ] Audit & fix semua isu kritis NadHunt
- [ ] Pisahkan ReputationRegistry menjadi standalone contract
- [ ] Desain API contract NadWork

### Phase 1 — MVP NadWork
- [ ] WorkFactory + WorkEscrow (Fixed Price only)
- [ ] Frontend: browse jobs, submit proposal, milestone tracker
- [ ] Integration dengan shared ReputationRegistry
- [ ] Fixed Price mode only

### Phase 2 — Full Platform
- [ ] Time & Material mode
- [ ] In-platform messaging (end-to-end encrypted, IPFS-stored)
- [ ] Dispute resolution system (Tier 1 + Tier 2)
- [ ] Review system (dua arah: client ← → worker)

### Phase 3 — Ecosystem
- [ ] Retainer contracts
- [ ] Team gigs (beberapa worker satu project)
- [ ] NadWork token (governance + dispute arbitration)
- [ ] Mobile app

---

## Catatan

Dokumen ini adalah konsep awal. Tidak ada kode yang diubah atau ditambah.
Implementasi memerlukan keputusan lebih lanjut tentang:
- Apakah ReputationRegistry perlu di-upgrade (proxy pattern)
- Apakah dispute arbitration dilakukan off-chain atau on-chain
- Strategi launch: testnet dulu atau langsung mainnet

---

*Konsep ini dibuat sebagai komplemen NadHunt, bukan pengganti.*
