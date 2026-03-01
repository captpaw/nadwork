# NadWork v2 — Audit Report
**Tanggal:** 2026-02-28
**Auditor:** Claude (Anthropic)
**Scope:** Smart contracts (Solidity), frontend (React/Viem/Ethers.js), hooks, utils
**Chain:** Monad Mainnet (chainId 143)
**Status kontrak live:**
| Kontrak | Address |
|---|---|
| BountyFactory | `0x2a5BE6861B700E4905DD698Ac1A951400617DA8a` |
| BountyRegistry | `0x21861096BD2674E1F2005F3c8D91962EF06A2F1F` |
| NadWorkEscrow | `0x481C5795D5478A960F2BEE596b63dBb421Dee8A4` |
| ReputationRegistry | `0xC2e8d910D0eCe1614976ee69F27486837b35E51d` |

---

## Ringkasan Eksekutif

NadWork adalah platform bounty on-chain untuk ekosistem Monad. Arsitektur kontrak sudah menggunakan pola yang tepat (Registry + Escrow + Factory, CEI pattern, nonReentrant guards). Namun ditemukan beberapa isu kritis dan tinggi yang perlu diperbaiki — terutama terkait penanganan ERC20, fund loss di dispute, dan ketiadaan test coverage untuk kontrak V2 yang sudah live.

**Total temuan: 26 isu** — 2 Kritis, 4 Tinggi, 8 Sedang, 12 Rendah.

---

## Legenda Severity

| Severity | Keterangan |
|---|---|
| 🔴 **KRITIS** | Potensi kehilangan dana atau sistem tidak teruji |
| 🟠 **TINGGI** | Bug yang menyebabkan fund loss atau fitur inti broken |
| 🟡 **SEDANG** | Bug signifikan yang mempengaruhi UX atau kebenaran data |
| 🔵 **RENDAH** | Improvements untuk kualitas, keamanan, dan maintainability |

---

## 🔴 KRITIS

---

### [K-1] Test Suite V1 — Zero Coverage untuk Kontrak V2 yang Live

**File:** `test/NadWork.test.js`
**Impact:** Kontrak yang sudah live di Monad Mainnet tidak punya test coverage sama sekali.

**Detail:**
Test yang ada ditulis untuk kontrak V1. Kontrak V2 sudah berubah sangat signifikan:

| Aspek | V1 | V2 |
|---|---|---|
| `createBounty` | 6 parameter | 9 parameter (`title`, `category`, `winnerCount`, `prizeWeights[]` ditambahkan) |
| Bounty types | `OPEN`, `FIRST_COME` | `OPEN` only |
| Approve winner | `approveWinner(single)` | `approveWinners(submissionIds[], ranks[])` |
| Fungsi baru | — | `raiseDispute`, `resolveDispute`, `triggerTimeout`, `setFeatured` |
| Kontrak baru | — | `ReputationRegistry` |
| Prize split | — | Multi-winner `prizeWeights[]` summing to 100 |

Menjalankan test suite saat ini akan gagal seluruhnya karena ABI sudah tidak kompatibel.

**Rekomendasi:** Tulis ulang test suite untuk V2. Prioritaskan coverage untuk:
- `createBounty` (MON + ERC20, validasi parameter)
- `approveWinners` (1 winner, 2 winners, 3 winners, partial approval)
- `cancelBounty` (tanpa submission, dengan submission, ERC20 bounty)
- `raiseDispute` + `resolveDispute` (in favor / not in favor)
- `triggerTimeout` (sebelum grace period, sesudah grace period)
- `ReputationRegistry` (recordWin, getHunterScore, getProjectScore)

---

### [K-2] Treasury Address = Deployer Address (Single Point of Failure)

**File:** `deployments/monad_mainnet.json`

```json
{
  "deployer": "0x22D4aa39e05058efAA1dCc5739B141c4c3dbAFA2",
  "treasury": "0x22D4aa39e05058efAA1dCc5739B141c4c3dbAFA2"
}
```

**Detail:**
Semua fee 3% dari setiap bounty yang selesai langsung masuk ke wallet yang sama dengan wallet yang mengontrol kontrak (`owner`). Jika private key wallet ini bocor atau dikompromikan, attacker dapat:

1. Sweep seluruh fee yang sudah terkumpul di treasury
2. Memanggil `setTreasury()` untuk redirect semua fee masa depan ke alamat mereka
3. Memanggil `pause()` di Escrow untuk membekukan semua bounty
4. Memanggil `sweep()` di Factory untuk mengambil seluruh dispute deposit yang belum resolved

**Rekomendasi:**
- Gunakan **multi-sig wallet** (Gnosis Safe / Safe.global) sebagai `treasury`
- Pisahkan `owner` key dan `treasury` address
- Pertimbangkan timelock untuk fungsi admin kritis (`setTreasury`, `setFactory`)

---

## 🟠 TINGGI

---

### [T-1] `resolveDispute` — Silent Fund Loss (Deposit Hunter Hilang)

**File:** `contracts/BountyFactory.sol`
**Impact:** Deposit 0.01 MON milik hunter bisa hilang permanen tanpa revert.

**Detail:**
Saat dispute diselesaikan dan deposit dikembalikan ke hunter yang menang, ada baris `ok;` yang merupakan **no-op** setelah pemanggilan transfer. Jika transfer MON ke hunter gagal (misalnya hunter menggunakan smart contract wallet yang revert di `receive()`), fungsi tetap melanjutkan tanpa revert dan deposit hilang selamanya.

**Kode bermasalah (dari audit sebelumnya):**
```solidity
(bool ok,) = hunter.call{value: DISPUTE_DEPOSIT}("");
ok; // ← NO-OP! tidak ada require
```

**Fix:**
```solidity
(bool ok,) = hunter.call{value: DISPUTE_DEPOSIT}("");
require(ok, "Factory: deposit refund failed");
```

---

### [T-2] `cancelBounty` — Kompensasi ERC20 Salah (Decimal Mismatch)

**File:** `contracts/BountyFactory.sol`, `frontend/src/pages/BountyDetailPage.jsx` (line 174), `frontend/src/pages/DashboardPage.jsx` (line 85)
**Impact:** Hunter yang kena cancel bounty USDC hampir tidak dapat kompensasi. Bug sama ada di dua tempat di frontend.

**Detail:**
Kontrak menghitung kompensasi dari `totalReward * 2%` — tetapi `totalReward` adalah raw ERC20 amount dalam unit token tersebut. Kompensasi selalu dibayar dalam MON, bukan ERC20.

Untuk USDC (6 decimal):
- Bounty 100 USDC → `totalReward = 100_000_000` (6 decimal units)
- Kompensasi per submission = `100_000_000 * 200 / 10_000 = 2_000_000`
- `require(msg.value >= 2_000_000)` → hanya butuh `0.000000000000002 MON` ≈ **nol**
- Hunter yang kena cancel hampir tidak mendapat kompensasi MON

Frontend memperbesar masalah dengan menggunakan `ethers.formatEther()` yang mengasumsikan 18 decimal:
```js
// BountyDetailPage.jsx line 174 & DashboardPage.jsx line 85:
const compMON = ethers.parseEther(
  String((Number(ethers.formatEther(bounty.totalReward)) * 0.02 * subCount).toFixed(6))
);
// formatEther(100_000_000) = 0.0000000001 ETH → kompensasi ≈ 0
```

**Rekomendasi:**
Untuk kompensasi cancellation ERC20 bounty, gunakan nilai flat MON (bukan persentase dari `totalReward`). Misalnya: `0.005 MON` per submission flat, terlepas dari jenis token bounty.

---

### [T-3] Public Profile Broken — Route `#/profile/:address` Tidak Diimplementasikan

**File:** `frontend/src/pages/BountyDetailPage.jsx` (line 265, 509), `frontend/src/App.jsx`
**Impact:** Link "By [poster]" di halaman bounty tidak berfungsi. Tidak bisa lihat profil user lain.

**Detail:**
BountyDetailPage me-link ke profil poster:
```jsx
<a href={'#/profile/' + bounty.poster}>
  {shortAddr(bounty.poster)}
</a>
```

Namun route yang terdaftar di App.jsx hanya `#/profile` (tanpa parameter address). Navigasi ke `#/profile/0x1234...5678` akan:
- Tidak match ke route `#/profile` (karena ada trailing path)
- Kemungkinan jatuh ke route `#/` (homepage) atau 404

Bahkan jika route match, `ProfilePage` menggunakan `useAccount()` (wallet yang sedang connect), bukan address dari URL, sehingga selalu tampilkan profil sendiri.

**Fix:**
1. Tambahkan parsing route di `useHashRoute()`:
   ```js
   if (hash.startsWith('/profile/')) return { page: 'profile', address: hash.slice(9) };
   if (hash === '/profile') return { page: 'profile', address: null };
   ```
2. Ubah `ProfilePage` agar menerima prop `targetAddress`:
   ```jsx
   export default function ProfilePage({ targetAddress }) {
     const { address: connectedAddress } = useAccount();
     const address = targetAddress || connectedAddress;
     // ...
   }
   ```

---

### [T-4] Tombol "Trigger Timeout" Muncul Sebelum Waktunya

**File:** `frontend/src/pages/BountyDetailPage.jsx` (line 527-529)
**Impact:** User kebingungan karena tombol muncul padahal klik akan selalu gagal/revert.

**Detail:**
```jsx
{address && !isPoster && isActive && submissions.length > 0 && (
  <Button variant="ghost" size="sm" onClick={handleTimeout}>
    Trigger Timeout
  </Button>
)}
```

Tombol ini ditampilkan kapanpun bounty masih ACTIVE dan ada submission, tanpa memeriksa apakah `deadline + GRACE_PERIOD (7 hari)` sudah lewat. Klik sebelum waktunya menghasilkan revert `"Factory: grace period active"`.

**Fix:**
```jsx
{address && !isPoster && isActive && submissions.length > 0 &&
 Date.now() / 1000 > Number(bounty.deadline) + 7 * 86400 && (
  <Button ...>Trigger Timeout</Button>
)}
```

---

## 🟡 SEDANG

---

### [S-1] Pagination + Client-Side Filter Tidak Konsisten

**File:** `frontend/src/hooks/useBounties.js`
**Impact:** "Load More" tidak berfungsi benar saat filter status atau search aktif.

**Detail:**
Saat filter `status = 'completed'` atau ada search query:
1. Hook fetch `getAllBounties(offset=0, limit=20)` → dapat 20 bounty dari total semua bounty
2. Filter client-side → mungkin hanya 3 yang lolos filter
3. `hasMore = offset + 20 < totalCount` → **true** berdasarkan total semua bounty, bukan filtered

Konsekuensi:
- "Showing 3 of 150" padahal hanya 8 bounty completed di seluruh sistem
- Klik "Load More" berkali-kali tapi data baru tidak muncul (halaman berikutnya tidak ada yang completed)
- Search hanya bekerja pada 20 bounty di page pertama — bounty di halaman 2+ tidak bisa ditemukan

**Rekomendasi:** Untuk status filter selain `active`, fetch semua tanpa pagination (jika total < 500), atau tambahkan view function di contract: `getBountiesByStatus(status, offset, limit)`.

---

### [S-2] `getProjectScore` Formula Menghasilkan Hasil yang Tidak Konsisten

**File:** `contracts/ReputationRegistry.sol` (line 86)

```solidity
return ((p.bountiesCompleted * 100) / p.bountiesPosted) * p.bountiesPosted;
```

**Detail:**
Karena integer division truncation, formula ini tidak equivalen dengan `bountiesCompleted * 100`:
- posted=3, completed=1: `(100/3)*3 = 33*3 = 99` (bukan 100)
- posted=7, completed=3: `(300/7)*7 = 42*7 = 294` (bukan 300)
- posted=10, completed=7: `(700/10)*10 = 700` ✓

Formula kehilangan presisi secara tidak konsisten tergantung pada nilai. Tidak ada tujuan matematis yang jelas dari struktur ini.

**Rekomendasi:** Jika tujuannya adalah "completion_rate * total_posted sebagai bobot", rumuskan dengan jelas:
```solidity
// Opsi sederhana: total bounty selesai × 100
return p.bountiesCompleted * 100;
// Atau: score = completionRate% * posted (dengan klarifikasi tujuan)
return (p.bountiesCompleted * 10000) / p.bountiesPosted; // rate dalam basis poin
```

---

### [S-3] ERC20 Rewards Tidak Berkontribusi ke Hunter Score

**File:** `contracts/ReputationRegistry.sol` (line 80)

```solidity
return (h.winCount * 30) + (h.submissionCount * 5) + (h.totalEarned / 1e15);
```

**Detail:**
`totalEarned` menyimpan raw token amount mentah. Untuk USDC (6 decimal):
- Menang 100 USDC → `totalEarned += 100_000_000`
- Kontribusi ke score: `100_000_000 / 1e15 = 0` (integer division, hasilnya nol karena `1e8 < 1e15`)

Hunter yang menang 1000 USDC tetap mendapat 0 poin dari `totalEarned`. Hanya bounty dengan reward MON (18 decimal) yang berkontribusi ke score.

**Rekomendasi:** Simpan `totalEarned` dalam USD value saat win (butuh oracle harga), atau normalisasi berdasarkan decimal token, atau gunakan terpisah antara MON earnings dan ERC20 earnings.

---

### [S-4] REGISTRY_ABI Mengandung Event yang Salah

**File:** `frontend/src/config/contracts.js` (line 54)

```js
export const REGISTRY_ABI = [
  // ...
  'event HunterUpdated(address indexed hunter, uint256 winCount, uint256 totalEarned)', // ← SALAH
];
```

**Detail:**
`HunterUpdated` adalah event milik `ReputationRegistry`, bukan `BountyRegistry`. BountyRegistry tidak pernah emit event ini. Event yang benar untuk registry adalah `BountyRegistered`, `SubmissionAdded`, `WinnersSet`, `BountyStatusUpdated`, `BountyFeatured`, `FactorySet`.

Meskipun tidak menyebabkan error fungsional saat ini, ini akan menyebabkan masalah jika ada kode yang subscribe ke event registry untuk `HunterUpdated`.

**Fix:** Hapus baris tersebut dari `REGISTRY_ABI`, atau pindahkan ke `REPUTATION_ABI` jika memang ingin listen event.

---

### [S-5] Cloudflare IPFS Gateway Deprecated

**File:** `frontend/src/config/pinata.js` (line 8)

```js
const GATEWAYS = [
  GATEWAY,                              // custom / Pinata
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/', // ← DEPRECATED sejak 2022
];
```

**Detail:**
Cloudflare menutup public IPFS gateway mereka pada akhir 2022. URL `cloudflare-ipfs.com` selalu mengembalikan error. Setiap fetch via gateway ini membuang 8 detik (timeout) sebelum lanjut ke fallback berikutnya — membuat load deskripsi bounty terasa lambat jika gateway pertama gagal.

**Fix:**
```js
const GATEWAYS = [
  GATEWAY,
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',           // Reliable alternative
  'https://nftstorage.link/ipfs/',     // NFT.Storage gateway
];
```

---

### [S-6] Leaderboard Hanya Scan Winner Addresses, Mengabaikan Hunters Aktif

**File:** `frontend/src/hooks/useLeaderboard.js` (line 26)

```js
if (b.winners) b.winners.forEach(w => {
  if (w && w !== ethers.ZeroAddress) hunters.add(w.toLowerCase());
});
```

**Detail:**
`scrapeActiveAddresses()` hanya mengambil alamat dari `b.winners`. Hunter yang aktif submit tapi belum pernah menang tidak akan muncul di leaderboard, meskipun mereka memiliki reputation score dari submissions. Ini membuat leaderboard tidak mencerminkan ekosistem hunter yang sesungguhnya.

**Rekomendasi:** Tambahkan scan submission hunters secara terpisah, atau tambahkan view function di contract untuk mendapat semua hunter addresses yang pernah submit.

---

### [S-7] Tidak Ada Escrow ABI di contracts.js

**File:** `frontend/src/config/contracts.js`

**Detail:**
ABI untuk `NadWorkEscrow` tidak di-export. Saat ini semua interaksi dengan escrow dilakukan melalui factory (benar secara arsitektur), namun tidak ada cara untuk frontend membaca state escrow secara langsung (misalnya `getRecord(bountyId)` untuk menampilkan info "deposited at" atau "amount in escrow").

**Rekomendasi:** Tambahkan minimal read-only ABI:
```js
export const ESCROW_ABI = [
  'function getRecord(uint256) view returns (tuple(address depositor, address rewardToken, uint256 amount, uint256 deadline, bool released, bool refunded))',
  'function isSettled(uint256) view returns (bool)',
];
```

---

### [S-8] Dual Provider (Wagmi + Ethers.js) Berpotensi Inconsistent Read State

**File:** `frontend/src/utils/ethers.js`, `frontend/src/config/wagmi.js`

**Detail:**
App menggunakan dua provider berbeda secara bersamaan:
- **Wagmi/Viem** untuk wallet connection dan write transactions
- **Ethers.js `JsonRpcProvider`** hardcoded ke `rpc.monad.xyz` untuk semua read calls

Ini berpotensi menyebabkan **race condition**: setelah user mengirim transaksi (via wagmi), halaman langsung refetch menggunakan ethers provider yang berbeda. Provider yang berbeda bisa memiliki block lag yang berbeda sehingga data yang dibaca belum mencerminkan transaksi yang baru saja dikonfirmasi.

**Rekomendasi:** Gunakan `wagmi`'s `readContract` / `useReadContract` untuk semua read calls, atau gunakan satu provider (`publicClient` dari wagmi config) secara konsisten.

---

## 🔵 RENDAH

---

### [R-1] Tidak Ada React Error Boundary

**File:** `frontend/src/App.jsx`

Tidak ada `<ErrorBoundary>` yang membungkus halaman. Jika satu komponen throw uncaught exception (misalnya karena data RPC tidak terduga), seluruh aplikasi blank white screen. Tambahkan error boundary minimal per-halaman atau global.

---

### [R-2] RPC URL Hardcoded dengan Alchemy Public Key

**File:** `frontend/src/utils/ethers.js`

```js
'https://monad-mainnet.g.alchemy.com/v2/public'
```

Alchemy `/v2/public` adalah free tier dengan rate limit sangat ketat. Untuk production scale, ini akan mulai throttle saat traffic meningkat.

**Fix:** Gunakan env variable:
```js
const RPC_URLS = [
  import.meta.env.VITE_RPC_URL || 'https://rpc.monad.xyz',
  'https://rpc.monad.xyz', // fallback
];
```

---

### [R-3] Tidak Ada Content Security Policy (CSP)

**File:** `frontend/index.html`

Tidak ada CSP meta tag atau header. Dengan bounty description yang dirender via `ReactMarkdown` (konten dari IPFS yang bisa diupload siapa saja), CSP yang ketat akan membatasi potensi XSS attack vector.

Bandingkan dengan project LNS yang sudah memiliki CSP lengkap. Tambahkan CSP minimal yang memblokir inline scripts dari sumber tidak dikenal.

---

### [R-4] `useProfile` Tidak Ada Polling

**File:** `frontend/src/hooks/useProfile.js`

Hook ini fetch sekali saat mount, tidak ada `setInterval`. Jika bounty di-approve saat user berada di halaman profile, stats (winCount, totalEarned, submissions) tidak update sampai user refresh manual atau navigate away lalu kembali.

**Fix:** Tambahkan polling interval 30-60 detik, atau refresh on-demand setelah `useSubmissionNotifications` detect perubahan.

---

### [R-5] `getReadContractWithFallback` Memanggil `getBlockNumber` Berlebihan

**File:** `frontend/src/utils/ethers.js` (line 29-31)

```js
const provider = new ethers.JsonRpcProvider(url);
await provider.getBlockNumber(); // test connection — ekstra 1 RPC call
return new ethers.Contract(address, abi, provider);
```

Setiap kali `useBounty` dipanggil (termasuk setiap 12 detik polling), ada 1 extra `eth_blockNumber` call hanya untuk "test connection" sebelum membuat contract instance. Ini membuang-buang RPC quota.

---

### [R-6] Integer Division Dust Terkunci Permanen di Escrow

**File:** `contracts/NadWorkEscrow.sol` (line 149, 172)

```solidity
uint256 eachAmount = hunterPool / hunters.length; // remainder hilang
```

Sisa pembagian (misalnya `hunterPool = 101 wei, hunters = 3 → eachAmount = 33, sisa 2 wei`) tetap tersimpan di kontrak setelah `r.released = true` — tidak bisa diambil kembali. Nilainya sangat kecil per transaksi tapi akan akumulasi seiring waktu.

---

### [R-7] Validasi `prizeWeights` Sum = 100 Tidak Jelas di Frontend

**File:** `frontend/src/pages/PostBountyPage.jsx`

Kontrak `release()` di escrow memerlukan `weightSum == 100`. Jika UI memungkinkan input manual weight yang tidak sum ke 100, transaksi akan revert. Pastikan validasi client-side dilakukan sebelum memanggil `createBounty`, dan tambahkan pesan error yang jelas.

---

### [R-8] Tidak Ada `beforeunload` Warning di PostBountyPage

**File:** `frontend/src/pages/PostBountyPage.jsx`

Form 3-step yang panjang tidak memiliki konfirmasi sebelum user navigate away. User yang tidak sengaja klik Back atau tombol browser bisa kehilangan semua input. Template autosave sudah ada tapi hanya tersimpan via explicit "Save Template" click.

**Fix:** Tambahkan event listener:
```js
useEffect(() => {
  const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
}, []);
```

---

### [R-9] Tidak Ada TypeScript

Seluruh frontend menggunakan JavaScript murni tanpa TypeScript. BigInt vs Number conversion dari ethers.js v6 sudah ditangani secara manual (`Number(bounty.status)`), namun tanpa TypeScript, kesalahan seperti ini mudah terlewat saat development.

---

### [R-10] Tidak Ada `.env.example` yang Lengkap untuk Frontend

**File:** `frontend/.env.example`

Dari `pinata.js`, `ethers.js`, dan `wagmi.js`, variabel environment yang dibutuhkan antara lain:
- `VITE_PINATA_API_KEY`
- `VITE_PINATA_SECRET_API_KEY`
- `VITE_PINATA_GATEWAY`
- `VITE_BOUNTY_FACTORY_ADDRESS`
- `VITE_BOUNTY_REGISTRY_ADDRESS`
- `VITE_ESCROW_ADDRESS`
- `VITE_REPUTATION_REGISTRY_ADDRESS`
- `VITE_USDC_ADDRESS`
- `VITE_RPC_URL`

Pastikan semua ini terdokumentasi di `.env.example` dengan nilai contoh atau keterangan cara mendapatkannya.

---

### [R-11] `useLeaderboard` Tidak Refresh Setelah Mount

**File:** `frontend/src/hooks/useLeaderboard.js`

Leaderboard hanya load sekali saat mount (dengan cache TTL 1 menit). Tidak ada cara untuk user me-refresh secara manual, dan tidak ada indicator kapan data terakhir diperbarui.

---

### [R-12] Tidak Ada Dokumentasi Setup / README

Repository tidak memiliki `README.md` yang menjelaskan:
- Cara install dependencies
- Cara deploy ke testnet / mainnet
- Cara setup Pinata (IPFS)
- Cara menjalankan frontend dev server
- Cara menjalankan test

---

## ✅ Yang Sudah Baik

| Aspek | Detail |
|---|---|
| **Arsitektur kontrak** | Separation of concerns yang baik: Registry (data) + Escrow (dana) + Factory (logika) |
| **CEI Pattern** | `NadWorkEscrow.sol` sudah Checks-Effects-Interactions di semua fungsi transfer |
| **Reentrancy protection** | `nonReentrant` sudah ada di semua fungsi yang transfer ETH/ERC20 di Escrow |
| **Gas limit pada transfer** | `_safeTransferMON` menggunakan `gas: 30_000` — mencegah griefing via heavy fallback |
| **ABI akurasi** | `contracts.js` V2 ABI sudah match dengan fungsi kontrak yang deployed |
| **IPFS multi-gateway** | Fallback 3 gateway untuk fetch metadata (minus Cloudflare yang deprecated) |
| **Featured bounty** | Frontend dan contract sudah konsisten — bounty featured bubble ke atas |
| **Pause mechanism** | Factory dan Escrow bisa di-pause untuk emergency response |
| **Dispute system** | Deposit required, refundable — mencegah spam dispute |
| **Multi-winner release** | Escrow `release()` sudah handle weighted distribution dengan benar |
| **Submission notifications** | `useSubmissionNotifications` tidak repeat-notify untuk status yang sama |
| **IPFS cache** | `jsonCache` Map di pinata.js mencegah re-fetch CID yang sama |
| **Leaderboard TTL cache** | 1 menit cache mencegah spam RPC calls pada halaman leaderboard |

---

## Prioritas Perbaikan

### Fase 1 — Segera (sebelum promosi ke komunitas lebih luas)

| ID | Issue | Effort |
|---|---|---|
| K-2 | Setup multi-sig treasury | Rendah — deploy ulang atau `setTreasury()` |
| T-1 | Fix `resolveDispute` silent fund loss | Sangat Rendah — 1 baris `require` |
| T-3 | Implementasi route `#/profile/:address` | Sedang — update routing + ProfilePage |
| T-4 | Guard tombol Trigger Timeout dengan deadline check | Sangat Rendah — 1 kondisi |
| S-4 | Hapus `HunterUpdated` dari `REGISTRY_ABI` | Sangat Rendah — hapus 1 baris |
| S-5 | Ganti Cloudflare IPFS gateway | Sangat Rendah — ganti 1 string |

### Fase 2 — Jangka Pendek (1-2 minggu)

| ID | Issue | Effort |
|---|---|---|
| K-1 | Tulis ulang test suite untuk V2 | Tinggi — ~4-6 jam |
| T-2 | Fix kompensasi ERC20 cancel | Sedang — butuh redesign formula + deploy ulang |
| S-1 | Perbaiki pagination + filter | Tinggi — perlu view function baru di contract |
| S-2 | Fix `getProjectScore` formula | Rendah — 1 baris di contract (deploy ulang) |
| S-3 | Perbaiki ERC20 contribution ke score | Sedang — butuh desain ulang scoring |
| R-1 | Tambah React Error Boundary | Rendah |
| R-2 | Pindah RPC URL ke env variable | Rendah |
| R-3 | Tambahkan CSP di `index.html` | Rendah |

### Fase 3 — Jangka Menengah (1 bulan)

| ID | Issue | Effort |
|---|---|---|
| S-8 | Unifikasi provider (wagmi only) | Sedang |
| S-6 | Scan semua hunters untuk leaderboard | Sedang |
| R-4 | Polling di `useProfile` | Rendah |
| R-7 | Validasi prizeWeights di frontend | Rendah |
| R-8 | beforeunload warning di PostBountyPage | Rendah |
| R-9 | Migrasi ke TypeScript | Tinggi — long-term effort |
| R-12 | Tulis README.md | Rendah |

---

## Kesimpulan

NadWork memiliki fondasi arsitektur yang solid. Kontrak yang diaudit menunjukkan pemahaman yang baik tentang keamanan smart contract — CEI pattern, reentrancy guards, dan separation of concerns sudah diimplementasikan dengan benar.

Namun ada beberapa isu yang perlu perhatian segera sebelum platform dipromosikan secara luas:

1. **[K-2]** Treasury single-key adalah risiko terbesar — setup multi-sig sekarang
2. **[T-1]** Silent fund loss di dispute perlu 1 baris fix
3. **[T-3]** Public profile viewing broken — ini adalah fitur yang terlihat rusak oleh semua user
4. **[K-1]** Test suite perlu ditulis ulang untuk V2 — tanpa ini tidak ada jaring pengaman untuk perubahan kontrak di masa depan

Setelah 6 isu Fase 1 diselesaikan, platform sudah layak dipromosikan ke komunitas Monad yang lebih luas.

---

*Report ini dibuat berdasarkan analisis statis source code. Tidak mencakup: pengujian fuzz, formal verification, audit gas optimization mendalam, atau pengujian di live network.*
