# NadWork — Rebranding Draft

**Status:** Draft — belum ada yang diubah
**Scope:** Rename NadWork → NadWork + tagline baru + penyesuaian teks terkait

---

## Tagline Baru (Pilih Satu)

Tagline lama: **"Hunt. Submit. Earn."**

| Opsi | Tagline | Catatan |
|---|---|---|
| A | **"Work. Submit. Earn."** | Paling langsung, paralel dengan tagline lama |
| B | **"Post. Work. Earn."** | Merangkul dua sisi: poster & worker |
| C | **"Work. Win. Earn."** | Ritmis, tetap ada unsur kompetitif |
| D | **"Build. Submit. Earn."** | Menekankan output/deliverable |
| **E** | **"Work. Build. Earn."** | Lebih broad — cocok jika ke depan ada fitur tambahan |

> **Rekomendasi: Opsi C — "Work. Win. Earn."**
> Tetap ada nuansa kompetitif (bounty = ada yang menang), ritmis, dan setiap kata punya makna jelas:
> - **Work** = lakukan task
> - **Win** = menangkan bounty
> - **Earn** = terima reward

---

## Semua Perubahan yang Perlu Dilakukan

*(urutan dari yang paling terlihat user hingga internal)*

---

### 1. `frontend/index.html`

**Sekarang:**
```html
<meta name="description" content="NadWork — The on-chain bounty platform for Monad builders. Hunt. Submit. Earn." />
<meta property="og:title" content="NadWork — Hunt. Submit. Earn." />
<meta property="og:url" content="https://NadWork.xyz" />
<title>NadWork — Hunt. Submit. Earn.</title>
```

**Menjadi:**
```html
<meta name="description" content="NadWork — The on-chain bounty platform for Monad builders. Work. Win. Earn." />
<meta property="og:title" content="NadWork — Work. Win. Earn." />
<meta property="og:url" content="https://nadwork.xyz" />
<title>NadWork — Work. Win. Earn.</title>
```

---

### 2. `frontend/src/pages/HelpPage.jsx`

**Line 259:**
```
Sekarang : 'What is NadWork?', a: 'NadWork is an on-chain micro-task bounty platform...'
```
*(sudah pakai NadWork — tidak perlu ubah konten, hanya pastikan konsisten)*

**Line 272:**
```
Sekarang : '...NadWork admins review the case...'
Menjadi  : '...NadWork admins review the case...'
```

**Line 276:**
```
Sekarang : 'What is a NadWork Username?'
Menjadi  : 'What is a NadWork Username?'
```

**Line 277:**
```
Sekarang : '...including the NadWork team...'
Menjadi  : '...including the NadWork team...'
```

**Line 285:**
```
Sekarang : 'Which wallets does NadWork support?', a: 'NadWork supports any wallet...'
Menjadi  : 'Which wallets does NadWork support?', a: 'NadWork supports any wallet...'
```

**Line 318:**
```
Sekarang : 'Guides and answers for everything on NadWork...'
Menjadi  : 'Guides and answers for everything on NadWork...'
```

**Line 507:**
```
Sekarang : 'Join the NadWork community on Telegram or Twitter...'
Menjadi  : 'Join the NadWork community on Telegram or Twitter...'
```

**Line 511:**
```
Sekarang : href="https://t.me/NadWork"
Menjadi  : href="https://t.me/nadwork"
```

**Line 532:**
```
Sekarang : href="https://twitter.com/NadWork"
Menjadi  : href="https://twitter.com/nadwork"
```

---

### 3. `frontend/src/components/identity/IdentityModal.jsx`

**Line 214:**
```
Sekarang : '...permanent username on NadWork.'
Menjadi  : '...permanent username on NadWork.'
```

---

### 4. `frontend/src/components/icons/index.jsx`

**Line 2 (komentar):**
```
Sekarang : * NadWork Custom Icon System
Menjadi  : * NadWork Custom Icon System
```

**Line 446–447 (nama fungsi + komentar):**
```
Sekarang : // NadWork logo mark — geometric N (two diagonals in a square frame)
           export function IconNadWork({ size = 28, style, className }) {
Menjadi  : // NadWork logo mark — geometric N (two diagonals in a square frame)
           export function IconNadWork({ size = 28, style, className }) {
```

> **Catatan:** Rename fungsi `IconNadWork` → `IconNadWork` butuh update di semua tempat yang menggunakannya.

---

### 5. `frontend/src/hooks/useSubmissionNotifications.js`

**Line 3:**
```
Sekarang : const STORAGE_KEY = 'NadWork_sub_status_';
Menjadi  : const STORAGE_KEY = 'nadwork_sub_status_';
```

> **Catatan penting:** Perubahan STORAGE_KEY akan membuat notifikasi submission lama tidak terbaca — user yang sudah punya data di localStorage lama akan kembali dapat notif yang sudah mereka lihat. Pertimbangkan apakah ini masalah atau bisa diabaikan (karena production data).

---

### 6. `package.json`

**Sekarang:**
```json
"name": "NadWork",
"description": "NadWork — Micro-task bounty platform on Monad blockchain",
```

**Menjadi:**
```json
"name": "nadwork",
"description": "NadWork — Micro-task bounty platform on Monad blockchain",
```

---

### 7. `frontend/src/pages/BountyDetailPage.jsx`

**Line 185 (teks share Twitter — sudah NadWork):**
```
Sekarang : 'Work on it on NadWork — the on-chain bounty platform for Monad.'
```
*(sudah benar, tidak perlu diubah)*

---

## Ringkasan Perubahan

| File | Jumlah Perubahan | Jenis |
|---|---|---|
| `frontend/index.html` | 4 | Title, meta, URL |
| `frontend/src/pages/HelpPage.jsx` | 8 | Nama brand, link sosial |
| `frontend/src/components/identity/IdentityModal.jsx` | 1 | Nama brand |
| `frontend/src/components/icons/index.jsx` | 3 | Komentar + nama fungsi |
| `frontend/src/hooks/useSubmissionNotifications.js` | 1 | Storage key ⚠️ |
| `package.json` | 2 | name + description |
| **Total** | **19 perubahan** | — |

---

## Yang Tidak Perlu Diubah

- Smart contract (deployed on-chain — tidak bisa diubah nama kontrak)
- `AUDIT_REPORT.md` (dokumen historis, biarkan)
- `NADWORK_CONCEPT.md` (draft konsep terpisah)
- Semua logika bisnis, ABI, dan konfigurasi blockchain
- `hardhat.config.js`, `deployments/`, `scripts/`, `contracts/`

---

## Catatan Domain & Sosial

Untuk rebrand penuh, berikut yang perlu disiapkan di luar codebase:

| Aset | Lama | Baru |
|---|---|---|
| Domain | `NadWork.xyz` | `nadwork.xyz` |
| Twitter/X | `@NadWork` | `@nadwork` |
| Telegram | `t.me/NadWork` | `t.me/nadwork` |
| OG image | Bertuliskan NadWork | Update ke NadWork |

---

*Draft ini hanya untuk review. Belum ada perubahan pada codebase.*
