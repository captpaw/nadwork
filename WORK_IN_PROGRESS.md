# NadWork — Work In Progress
**Status:** BERHENTI SEMENTARA — Lanjutkan dari sini
**Tanggal:** 2026-02-28

---

## Situasi Terakhir

User melihat hasil redesign dan TIDAK puas — menilai tampilannya hampir sama dengan desain lama (hanya ganti warna, bukan redesain sesungguhnya). User minta diulang dengan yang benar-benar baru.

**Server sudah jalan di:** `http://127.0.0.1:5173` (launch.json port 5173, --host 127.0.0.1)

---

## Yang Sudah Selesai ✅ (dari sesi sebelumnya)

Semua file di bawah ini sudah dimodifikasi dan berfungsi:
- `frontend/src/styles/theme.js` — token baru (violet #7c3aed)
- `frontend/src/styles/index.css` — global CSS baru
- `frontend/src/components/icons/index.jsx` — 50 custom icons
- `frontend/src/components/layout/AppHeader.jsx` — logo baru, 56px
- `frontend/src/components/layout/AppFooter.jsx` — tagline baru
- `frontend/src/components/common/Button.jsx` — violet
- `frontend/src/components/common/Card.jsx` — borders updated
- `frontend/src/components/common/Badge.jsx` — status colors updated
- `frontend/src/pages/HomePage.jsx` — rebrand + violet (tapi LAYOUT SAMA)
- `frontend/src/pages/HelpPage.jsx` — rebrand NadHunt→NadWork
- `frontend/src/pages/LeaderboardPage.jsx` — violet colors
- `frontend/src/pages/ProfilePage.jsx` — violet colors
- `frontend/src/pages/DashboardPage.jsx` — violet colors
- `frontend/src/pages/PostBountyPage.jsx` — violet colors
- `frontend/src/pages/BountyDetailPage.jsx` — violet colors
- `frontend/src/components/bounty/BountyCard.jsx` — violet
- `frontend/src/components/bounty/BountyFilter.jsx` — violet
- `frontend/src/components/bounty/DeadlineTimer.jsx` — violet
- `frontend/src/components/bounty/SubmitWorkModal.jsx` — violet
- `frontend/src/components/bounty/SubmissionViewer.jsx` — violet
- `frontend/src/components/common/EmptyState.jsx` — violet
- `frontend/src/components/common/Input.jsx` — violet
- `frontend/src/components/common/Modal.jsx` — violet
- `frontend/src/components/common/Spinner.jsx` — violet
- `frontend/src/components/common/Toast.jsx` — violet
- `frontend/src/components/identity/IdentityModal.jsx` — rebrand
- `frontend/src/hooks/useSubmissionNotifications.js` — storage key
- `frontend/src/main.jsx` — RainbowKit accent
- `frontend/src/App.jsx` — error button
- `frontend/index.html` — meta tags
- `.claude/launch.json` — dev server configs
- `CHANGES_REPORT.md` — laporan perubahan

---

## Yang HARUS Dikerjakan Selanjutnya 🔴

### Tugas Utama: REDESIGN ARSITEKTUR LAYOUT

User tidak puas karena layout-nya identik dengan versi lama. Butuh perubahan STRUKTURAL, bukan hanya warna.

**Konsep baru: "Precision Board"**

#### 1. AppHeader.jsx — Ubah ke 44px, nav semua ke kanan
```
[N nadwork]         [Bounties] [Post] [Leaderboard] [Dashboard] | [Connect]
```
- Hapus divider garis vertikal
- Semua nav di sisi kanan (tidak center-left)
- Tinggi: 44px (bukan 56px)
- Background: transparent awal, blur saat scroll

#### 2. HomePage.jsx — ARSITEKTUR BARU TOTAL

**Section 1: HERO SPLIT (kiri + kanan)**
```
Kiri 55%:                          Kanan 45%:
● LIVE ON MONAD                    ┌─────────────────────┐
                                   │ ● LIVE BOUNTIES     │
The on-chain                       │─────────────────────│
bounty platform.                   │ Spark Hackathon #1  │
                                   │ 1 MON · dev · 60d   │
Work. Win.                         │─────────────────────│
Earn here.                         │ (empty state)       │
                                   │─────────────────────│
[Browse] [Post ↗]                  │ View all →          │
                                   └─────────────────────┘
── 1 open ─── 3% fee ─── MON
```

**Section 2: BOUNTY LIST (TABLE format, bukan card grid)**
```
All Bounties (1)       [Category ▾] [Status ▾] [Search...]  [+ Post]
────────────────────────────────────────────────────────────────────
TITLE                              REWARD    STATUS    DEADLINE
────────────────────────────────────────────────────────────────────
Spark Hackathon #1 ↗               1 MON     ACTIVE    60d 1h
0xe3...414f  •  Development  •  0 subs
────────────────────────────────────────────────────────────────────
```

**Section 3: HOW IT WORKS (horizontal numbered timeline)**
```
01 ────────── 02 ────────── 03 ────────── 04
POST          SUBMIT        REVIEW        RELEASE
Lock MON...   Anyone...     Poster...     Smart contract...
```
(Connected by a horizontal line, step numbers in violet circles)

**Section 4: CTA — SOLID VIOLET BACKGROUND** ← perbedaan visual terbesar
```
████████████████ SOLID #7c3aed BACKGROUND ████████████████
         Start earning today.
    [Browse Bounties]    [Post a Bounty ↗]
█████████████████████████████████████████████████████████
```

#### 3. BountyCard.jsx — Tambah variant "row" untuk tabel
Atau buat BountyRow component inline di HomePage.

---

## Data Structure Bounty (untuk BountyRow)

Dari useBounties hook:
```js
bounty = {
  id: BigInt,
  title: string,           // dari IPFS meta atau langsung
  poster: address,
  totalReward: BigInt,     // dalam wei
  rewardType: number,      // 0=MON, 1=USDC
  status: number,          // 0=active, 1=completed, ...
  category: string,
  deadline: BigInt,        // timestamp detik
  submissionCount: BigInt,
  winnerCount: BigInt,
  ipfsHash: string,        // untuk fetch meta (title, desc, skills)
  featured: bool,
}
```

Untuk render title yang benar, tiap BountyRow perlu fetch IPFS meta (sama seperti BountyCard).

---

## File yang Perlu Dibaca Sebelum Mulai

1. `frontend/src/utils/format.js` — formatReward(), shortAddr(), isUrgent()
2. `frontend/src/config/contracts.js` — BOUNTY_STATUS, CATEGORY_LABELS
3. `frontend/src/components/bounty/BountyFilter.jsx` — untuk tahu interface filter

---

## Catatan Design Detail

- Background app: tetap `#0b0b0b`
- Hero headline: font-size 80-96px di desktop, letter-spacing -0.05em
- Table row hover: background #141414, cursor pointer
- Solid violet CTA section: background `#7c3aed`, text putih
- CTA buttons di violet section: putih (primary), transparent border putih (secondary)
- Timeline step numbers: 36px circle, bg `#141414`, border `#282828`, text violet[400]
- Connecting line: 1px solid `#282828`, horizontal

---

## Dev Server

Jalankan:
```
preview_start "Frontend (Vite)"  → port 5173
URL: http://127.0.0.1:5173
```
