# NadWork — Laporan Lengkap Perbaikan Audit

> Tanggal: 4 Maret 2026  
> Scope: Smart Contracts, Frontend, Workers, Build Config, Tests

---

## 1. Smart Contracts

### 1.1 `contracts/BountyFactory.sol`

#### [Batch 1] Custom Errors — Modifiers & Core Functions
- Mengganti semua `require(..., "string")` di:
  - Modifier `onlyOwner`, `whenNotPaused`, `nonReentrant`
  - Konstruktor
  - `createBounty`
  - `submitWork`
- Diganti dengan **custom errors** menggunakan pola `if (...) revert FactoryXxx();`

#### [Batch 2] Custom Errors — Semua Fungsi Lainnya
- Mengganti semua sisa `require(..., "Factory: ...")` di:
  - `approveWinners`
  - `rejectSubmission`
  - `withdrawRejectedStake`
  - `cancelBounty`
  - `transitionToReviewing`
  - `expireBounty`
  - `triggerTimeout`
  - `claimTimeoutPayout`
  - `claimCancelComp`
  - `claimStakeRefund`
  - `raiseDispute`
  - `resolveDispute`
  - `claimDisputeRefund`
  - `applyToBounty`
  - `approveApplication`
  - `rejectApplication`
  - `setFeatured`
  - `sweep`
- Total **50+ custom errors** ditambahkan ke dalam kontrak.

#### Hasil Ukuran Bytecode

| Metrik | Sebelum | Sesudah |
|---|---|---|
| Deployed bytecode | > 24,576 bytes ⚠️ (warning EIP-170) | **22,784 bytes** ✅ |
| EIP-170 limit | 24,576 bytes | Margin aman: ~1,792 bytes |

---

### 1.2 `contracts/BountyRegistry.sol`

#### [Fix] Descending Loop Underflow
- **Root cause**: 3 fungsi view (`getActiveBounties`, `getBountiesByCategory`, `getFeaturedBounties`) menggunakan loop:
  ```solidity
  for (uint256 i = count; i >= 1; i--)
  ```
  Loop ini menyebabkan **integer underflow** pada `uint256` saat `i = 0`.
- **Fix**: Diubah ke pola aman:
  ```solidity
  for (uint256 i = count; i > 0; i--) {
      uint256 id = i - 1;
      ...
  }
  ```

---

## 2. Frontend

### 2.1 `frontend/src/config/pinata.js`

#### [Fix] IPFS Pin Proxy Token Enforcement
- **Root cause**: Jika `VITE_PIN_PROXY_URL` diset tapi `VITE_PIN_PROXY_TOKEN` kosong, request dikirim tanpa header token sehingga server mengembalikan **401 Unauthorized** secara diam-diam tanpa error jelas di sisi klien.
- **Fix**: Ditambahkan pengecekan **fail-fast** — jika URL proxy ada tapi token tidak ada (terutama di production), langsung throw error dengan pesan jelas sebelum request dikirim.

---

### 2.2 `frontend/src/components/bounty/SubmissionViewer.jsx`

#### [Fix] Unsafe URL Schemes pada DeliverableLink
- **Root cause**: Komponen `DeliverableLink` merender link deliverable sebagai `<a href={url}>` tanpa validasi skema URL. Skema berbahaya seperti `javascript:`, `data:`, `vbscript:` bisa menjadi link yang bisa diklik (XSS vector).
- **Fix**: `DeliverableLink` diubah untuk menggunakan validasi `SafeLink`, hanya mengizinkan skema `http:`, `https:`, dan `#`. URL lainnya dirender sebagai teks biasa (non-clickable).

---

### 2.3 `frontend/src/pages/AdminPage.jsx`

#### [Fix] On-Chain Owner Gating untuk Dispute Resolution
- **Root cause**: Tombol "Resolve Dispute" hanya diproteksi oleh `ADMIN_WALLETS` — array statis hardcoded di frontend. Ini adalah **client-side gating saja** yang tidak mencerminkan state on-chain dan mudah di-bypass di browser.
- **Fix**:
  - Membaca `factory.owner()` secara on-chain via `readContract` saat komponen mount.
  - Menghitung `isFactoryOwner` (boolean) dari hasil pembacaan tersebut.
  - Tombol "Resolve" **disabled** jika `isFactoryOwner === false`.
  - Guard tambahan di `handleResolve` sebelum mengirim transaksi.
  - Diperbaiki juga stale dependency di `useEffect` agar state owner selalu fresh.

---

## 3. Workers

### 3.1 `workers/pin-proxy/index.js`

#### [Fix] Error Distinction untuk Auth Token
- **Root cause**: Response error dari proxy tidak membedakan dua kondisi berbeda:
  1. Server misconfigured (`PROXY_AUTH_TOKEN` environment variable tidak diset di Cloudflare Worker)
  2. Client unauthorized (header token dari klien salah atau kosong)
  Kedua kondisi mengembalikan response yang sama sehingga menyulitkan debugging.
- **Fix**: Mengembalikan response error yang berbeda dan deskriptif untuk masing-masing kondisi, memudahkan operator membedakan antara misconfiguration server vs unauthorized request dari klien.

---

## 4. Build Config

### 4.1 `hardhat.config.js`

#### [Fix] Solidity Optimizer Runs
- Sempat diubah ke `runs: 50` sebagai langkah awal mengurangi bytecode.
- Setelah custom errors diterapkan dan ukuran bytecode terbukti aman (**22,784 bytes** dengan `runs: 200`), dikembalikan ke **`runs: 200`** karena:
  - Runtime gas lebih optimal untuk fungsi yang sering dipanggil.
  - Bytecode masih jauh di bawah limit EIP-170.

**Konfigurasi final:**
```js
optimizer: { enabled: true, runs: 200 },
viaIR: true,
```

---

## 5. Tests

### 5.1 `test/NadWork.test.js`

#### [Fix] Migrasi Revert Assertions ke Custom Errors
- Semua `.revertedWith("Factory: ...")` (string-based matching) dimigrasi ke:
  ```js
  .revertedWithCustomError(factory, "FactoryXxx")
  ```
  Sesuai dengan custom errors yang diterapkan di `BountyFactory.sol`.
- Mencakup **~20+ assertion** di seluruh test suite.

#### [Fix] Missing Local Setup Helpers
- Beberapa blok `describe` memiliki referensi ke fungsi `setup()` dan `setupTwoSubmissions()` yang tidak terdefinisi secara lokal, menyebabkan test error.
- Diperbaiki dengan menambahkan definisi lokal helper tersebut ke dalam blok `describe` yang membutuhkannya.

---

### 5.2 `test/invariants.test.js`

#### [Fix] Migrasi Revert Assertion
- 1 assertion `.revertedWith("Factory: nothing to sweep")` dimigrasi ke:
  ```js
  .revertedWithCustomError(factory, "FactoryNothingToSweep")
  ```

---

## Ringkasan Status Akhir

| Area | File | Status |
|---|---|---|
| Bytecode size (EIP-170) | `contracts/BountyFactory.sol` | ✅ 22,784 / 24,576 bytes |
| Loop underflow | `contracts/BountyRegistry.sol` | ✅ Diperbaiki |
| IPFS token enforcement | `frontend/src/config/pinata.js` | ✅ Fail-fast diterapkan |
| Unsafe URL schemes | `frontend/src/components/bounty/SubmissionViewer.jsx` | ✅ Hardened |
| On-chain owner gating | `frontend/src/pages/AdminPage.jsx` | ✅ Diterapkan |
| Worker auth clarity | `workers/pin-proxy/index.js` | ✅ Error distinctions |
| Optimizer config | `hardhat.config.js` | ✅ runs=200 |
| Test suite | `test/NadWork.test.js`, `test/invariants.test.js` | ✅ **142/142 passing** |
| Frontend build | — | ✅ Clean build |
