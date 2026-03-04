# Draft: Alur Penyelesaian Bounty Setelah Dispute

## Pertanyaan
Setelah dispute dan admin sudah resolve:
- Apakah poster harus menyelesaikan bounty dengan tombol Cancel?
- Atau waktu admin resolve, bounty otomatis selesai?

---

## Perilaku Kontrak Saat Ini

### 1. Saat bounty DISPUTED
- Status: `DISPUTED`
- Creator **tidak bisa** memanggil `cancelBounty` — kontrak hanya menerima status `ACTIVE` atau `REVIEWING`
- **Admin harus** memanggil `resolveDispute` untuk keluar dari status DISPUTED

### 2. Admin `resolveDispute(inFavorOfBuilders = true)` — Favor Builder
- Bounty status → **CANCELLED** (langsung di dalam `resolveDispute`)
- Escrow: release reward ke builder yang disputed
- Creator stake: di-slash 100% ke disputing builder
- **Kesimpulan: Otomatis selesai.** Creator tidak perlu tombol Cancel.

### 3. Admin `resolveDispute(inFavorOfBuilders = false)` — Favor Creator
- Builder dispute stake di-slash ke treasury
- Bounty status tergantung kondisi:
  - Jika escrow **belum settled** → status → **ACTIVE** atau **REVIEWING** (tergantung `reviewDeadline`)
  - Jika escrow **sudah settled** → status → **COMPLETED**
- **Kesimpulan:** Bounty *tidak* otomatis selesai (kecuali escrow sudah settled). Creator kembali punya kontrol dan bisa:
  - `approveApplication` + `setWinners` (curated) atau `approveSubmission` (open)
  - `triggerTimeout` jika sudah lewat deadline
  - `cancelBounty` jika ingin batalkan bounty

---

## Ringkasan

| Keputusan Admin       | Status akhir bounty | Perlu poster cancel? |
|-----------------------|---------------------|----------------------|
| Favor Hunter          | CANCELLED           | Tidak — otomatis     |
| Favor Poster          | ACTIVE / REVIEWING / COMPLETED | Mungkin — tergantung escrow & poster memilih approve/timeout/cancel |

---

## Opsi Pengembangan (jika ingin diubah)

### Opsi A: Tetap seperti sekarang
- Favor Builder → otomatis CANCELLED ✓
- Favor Creator → creator tetap bisa pilih approve/timeout/cancel setelah dispute denied

### Opsi B: Favor Poster juga otomatis selesai
- Setelah `resolveDispute(false)`, set status ke **CANCELLED** atau **COMPLETED** langsung
- **Kekurangan:** Untuk curated, creator mungkin ingin approve builder lain setelah dispute denied. Kalau otomatis CANCELLED, creator tidak bisa approve siapa pun.

### Opsi C: Status khusus "Resolved (Favor X)"
- Tambah status baru misal `RESOLVED_FAVOR_BUILDER` / `RESOLVED_FAVOR_CREATOR`
- Frontend tampilkan label yang lebih jelas (bukan sekadar CANCELLED)
- Perilaku escrow sama; hanya label UX yang berubah.

---

## Rekomendasi
Tetap **Opsi A** — perilaku kontrak saat ini sudah masuk akal:
- Favor Builder → selesai otomatis (CANCELLED)
- Favor Creator → creator kembali ke alur normal (approve / timeout / cancel)

Yang perlu diperbaiki adalah **frontend**: pastikan label status dan CTA (tombol Cancel, Apply, Submit) mengikuti status kontrak dengan benar (bug yang sudah diperbaiki: block apply/submit ketika ada disputed submission).
