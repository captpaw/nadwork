# Rencana & Draft Lengkap: Sistem Notifikasi Telegram untuk NadWork

> **Status:** Draft — Belum diimplementasi  
> **Tanggal:** Maret 2026

---

## 1. Ringkasan Eksekutif

Membangun sistem notifikasi berbasis Telegram Bot API agar pengguna NadWork menerima alert real-time untuk event penting: bounty baru, submission status, dispute, pembayaran, deadline, dll. User menghubungkan wallet dengan Telegram via bot; backend mendengarkan event on-chain (dan IPFS/metadata) lalu mengirim pesan ke user yang terhubung.

---

## 2. Tujuan

| Tujuan | Deskripsi |
|--------|-----------|
| User awareness | Builder/Creator tahu segera ketika ada event relevan (approval, rejection, dispute, dll.) |
| Retensi | Kurangi “lupa cek” — notifikasi mendorong user kembali ke app |
| UX | Alternatif selain cek in-app atau email |

---

## 3. Arsitektur Umum

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NADWORK ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend (React)          Smart Contracts (Monad)      Backend (Baru)   │
│  - Connect Telegram        - BountyFactory              - Notify Service │
│  - Preference toggle       - BountyRegistry             - Event Listener │
│                            - NadWorkEscrow              - DB: mappings   │
│                            - Events (emit)              - Telegram Bot   │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   Telegram Bot API    │
                            │   (api.telegram.org)  │
                            └───────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   User Telegram App   │
                            └───────────────────────┘
```

**Alur data:**
1. User menghubungkan wallet ↔ Telegram di frontend (atau lewat bot `/link`).
2. Backend menyimpan mapping `wallet ↔ telegram_chat_id`.
3. Listener (polling/WebSocket) mendengarkan event on-chain.
4. Service notifikasi menerjemahkan event → template pesan → kirim via Bot API.

---

## 4. Event yang Akan Di-Notify

### 4.1 Event untuk Builder

| Event | Trigger | Contoh Pesan |
|-------|---------|--------------|
| Application approved | `approveApplication` | "Your application to bounty «X» was approved. You can now submit work." |
| Submission approved | `approveWinners` (builder dalam winners) | "Congrats! Your submission for «X» was approved. Reward: Y MON." |
| Submission rejected | `rejectSubmission` | "Your submission for «X» was rejected. Stake will be held during grace period." |
| Revision requested | Off-chain (IPFS) | "Creator requested a revision for your submission on «X». Check the bounty page." |
| Dispute resolved (favor builder) | `resolveDispute` | "Dispute for «X» resolved in your favor. Reward and refund will be claimable." |
| Dispute resolved (favor creator) | `resolveDispute` | "Dispute for «X» resolved in favor of creator. See details in app." |
| Stake refund ready | `refund` / claim flow | "Your submission stake for «X» is ready to claim." |
| Deadline reminder | Cron / scheduled | "Bounty «X» ends in 24 hours. Submit your work soon." |

### 4.2 Event untuk Creator

| Event | Trigger | Contoh Pesan |
|-------|---------|--------------|
| New submission | `WorkSubmitted` | "New submission on bounty «X» from @builder. Review it now." |
| New application | `applyToBounty` | "New application for curated bounty «X» from @builder." |
| Bounty entered reviewing | `BountyEnteredReview` | "Bounty «X» entered reviewing. Approve winners or trigger timeout." |
| Dispute raised | `DisputeRaised` | "A Builder raised a dispute on bounty «X». Admin will resolve." |
| Timeout window active | `transitionToReviewing` / deadline | "Review window for «X» is open. Approve or trigger timeout." |
| Bounty expired | `BountyExpired` | "Bounty «X» expired. Rewards refunded." |

### 4.3 Event Umum

| Event | Penerima | Contoh Pesan |
|-------|----------|--------------|
| Featured bounty | Subscriber / opt-in | "New featured bounty: «X» — Y MON" |
| Bounty cancelled | Creator + Builders dengan submission | "Bounty «X» was cancelled. Compensation available if applicable." |

---

## 5. Komponen Teknis

### 5.1 Telegram Bot

- Buat bot via [@BotFather](https://t.me/BotFather).
- Simpan `BOT_TOKEN` di env (backend).
- Bot menerima:
  - `/start` — welcome + instruksi link wallet.
  - `/link <wallet>` atau flow OTP/link — untuk verifikasi ownership wallet.
  - `/unlink` — putus hubungan.
  - `/preferences` — atur jenis notifikasi (on/off per kategori).
  - `/help` — bantuan singkat.

### 5.2 Backend Service (Baru)

**Stack yang disarankan:**
- Node.js (Express/Fastify) atau Cloudflare Worker — sesuai stack NadWork.
- Database: SQLite / PostgreSQL / Supabase — untuk mapping `wallet ↔ telegram_chat_id` dan preference.
- Queue (opsional): Redis/Bull atau in-memory — untuk retry dan rate limit.

**Tabel minimal:**

```sql
-- wallet_telegram_mapping
CREATE TABLE wallet_telegram (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username VARCHAR(64),
  linked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(telegram_chat_id)
);

-- notification_preferences (opsional)
CREATE TABLE notification_prefs (
  wallet_address VARCHAR(42) PRIMARY KEY,
  submissions BOOLEAN DEFAULT true,
  applications BOOLEAN DEFAULT true,
  disputes BOOLEAN DEFAULT true,
  deadlines BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false
);
```

### 5.3 Event Listener (On-Chain)

- Subscribe ke event kontrak (via RPC `eth_subscribe` / WebSocket atau polling).
- Kontrak: BountyFactory, BountyRegistry (jika ada event terpisah).
- Event penting: `BountyCreated`, `WorkSubmitted`, `WinnersApproved`, `DisputeRaised`, `DisputeResolved`, `SubmissionRejected`, `BountyEnteredReview`, `BountyExpired`, dll.
- Untuk “revision requested” — off-chain: perlu webhook atau frontend yang memanggil backend saat creator upload revision request.

### 5.4 Notify Service

- Input: `{ eventType, bountyId, walletAddresses[], payload }`.
- Logic:
  1. Resolve `walletAddresses` → `telegram_chat_id[]` dari DB.
  2. Filter by preference (kalau pakai `notification_prefs`).
  3. Render template pesan (Markdown/HTML).
  4. Kirim ke Telegram Bot API (`sendMessage`).
- Handle rate limit (30 msg/sec untuk Bot API), retry dengan backoff.

---

## 6. Flow User: Menghubungkan Telegram

### Opsi A: Link via Bot (Recommended)

1. User buka `t.me/nadwork_bot`, klik Start.
2. Bot kirim: "To receive notifications, link your wallet. Go to NadWork → Profile → Notifications, and enter this code: `ABC123`."
3. User buka NadWork, Profile → Notifications, paste code `ABC123`.
4. Frontend memanggil backend: `POST /notifications/link { wallet, code }`.
5. Backend validasi: code `ABC123` terikat ke `telegram_chat_id` X. Simpan `wallet ↔ chat_id`.
6. Bot konfirmasi: "Wallet 0x1234…5678 linked. You'll receive notifications."

### Opsi B: Link via Frontend

1. User di Profile → Notifications klik "Connect Telegram".
2. Redirect ke `t.me/nadwork_bot?start=link_<random_token>`.
3. User klik Start; bot dapat `start` param, simpan `token → chat_id` di memori/DB (TTL 10 menit).
4. Frontend polling `GET /notifications/status?token=...` atau WebSocket.
5. Saat bot dapat Start, backend update `token` → siap. Frontend kirim `POST /notifications/link { wallet, token }`.
6. Backend map `wallet ↔ chat_id`, hapus token.

### Opsi C: Login dengan Wallet + Tanda Tangan

1. User di frontend sign message: `"Link NadWork to Telegram at {timestamp}"`.
2. User kirim signature ke bot: `/link <signature>`.
3. Bot forward ke backend; backend verify signature vs wallet, simpan mapping.
4. Lebih aman tapi UX lebih rumit.

**Rekomendasi awal:** Opsi A (code-based) — cukup aman, UX jelas.

---

## 7. Keamanan & Privasi

| Aspek | Langkah |
|-------|---------|
| Bot token | Simpan di env/secret, tidak pernah di frontend |
| Wallet–Telegram mapping | Hanya backend yang akses; jangan ekspos ke public API |
| Verifikasi link | Pastikan hanya pemilik wallet yang bisa link (sign message atau code one-time) |
| Rate limiting | Batasi jumlah link per IP/wallet per jam |
| Unlink | User bisa unlink kapan saja; hapus mapping dari DB |
| GDPR / Privacy | Siapkan kebijakan privasi; simpan hanya `chat_id` dan `wallet` (hashed jika perlu) |

---

## 8. Integrasi dengan NadWork

### 8.1 Perubahan Frontend (Draft)

- **Profile / Settings:** Bagian "Notifications" dengan:
  - Status: Linked / Not linked.
  - Tombol "Connect Telegram" (redirect ke bot atau tampilkan modal dengan kode).
  - Toggle per kategori (submissions, applications, disputes, deadlines) — opsional fase 2.
  - Tombol "Disconnect".
- **Config:** `VITE_TELEGRAM_BOT_USERNAME` untuk link ke bot.

### 8.2 Perubahan Backend (Baru)

- Folder `notifications/` atau service terpisah:
  - `telegram-bot/` — handler Bot API (webhook atau long polling).
  - `event-listener/` — subscribe ke RPC, parse event, panggil Notify Service.
  - `notify-service/` — template + kirim pesan.

### 8.3 Environment Variables

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=nadwork_bot
NOTIFY_DB_URL=...          # jika pakai DB terpisah
MONAD_RPC_URL=...          # untuk event listener
BOUNTY_FACTORY_ADDRESS=...
```

---

## 9. Fase Implementasi

### Fase 1: MVP (2–3 minggu)

- [ ] Buat bot di BotFather, simpan token
- [ ] Backend minimal: Express/Worker dengan endpoint `/link`, `/unlink`, `/webhook` (Telegram)
- [ ] DB: tabel `wallet_telegram` + `link_codes` (untuk Opsi A)
- [ ] Flow link: bot `/start` → generate code → user paste di frontend → link
- [ ] Event listener: subscribe `WorkSubmitted`, `WinnersApproved`, `SubmissionRejected`
- [ ] Notify service: kirim ke Builder/Creator terkait
- [ ] Frontend: halaman Notifications di Profile (Connect Telegram, status, Disconnect)

### Fase 2: Lengkap (1–2 minggu)

- [ ] Event tambahan: `DisputeRaised`, `DisputeResolved`, `BountyEnteredReview`, `BountyExpired`, `applyToBounty` (jika ada event)
- [ ] Preference per kategori (DB + API + UI)
- [ ] Template pesan dalam Bahasa Indonesia + Inggris
- [ ] Retry + rate limit handling
- [ ] Logging + monitoring

### Fase 3: Lanjutan (Opsional)

- [ ] Revision notification (webhook dari frontend saat creator request revision)
- [ ] Deadline reminder (cron job)
- [ ] Featured bounty broadcast (channel atau subgroup)
- [ ] Analytics: delivery rate, click-through

---

## 10. Contoh Template Pesan

### Submission Approved (Builder)

```
✅ Submission Approved

Your submission for «Build Monad DEX Router UI» was approved.

Reward: 4.0 MON
You can claim via the contract.

View bounty: https://nadwork.xyz/#/bounty/123
```

### New Submission (Creator)

```
📬 New Submission

@builder_username submitted work for «Design NadWork marketing kit».

Review now: https://nadwork.xyz/#/bounty/456
```

### Dispute Raised (Creator + Admin)

```
⚠️ Dispute Raised

A Builder raised a dispute on bounty «Integrate Monad RPC».

The BountyFactory owner will resolve. You'll be notified of the outcome.
```

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Telegram API down | Retry queue; fallback ke email (fase lanjut) |
| User tidak pakai Telegram | Tetap bisa pakai app tanpa link; notifikasi opsional |
| Spam | Rate limit per user; preference matikan notifikasi |
| Phishing | Hanya 1 bot resmi; jangan pernah minta seed phrase |
| DB breach | Hash/encrypt mapping; minimal data |

---

## 12. Estimasi Biaya

| Item | Biaya |
|------|-------|
| Telegram Bot API | Gratis |
| Backend hosting (VPS / Worker) | ~$5–20/bulan (sesuai traffic) |
| Database (Supabase free tier / VPS) | $0–10/bulan |
| Domain (jika webhook butuh HTTPS) | Sudah ada (nadwork) |

---

## 13. Referensi

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Bot Father](https://t.me/BotFather)
- NadWork contracts: `contracts/BountyFactory.sol` (events)
- `frontend/src/hooks/useNotifications.js` (jika ada — untuk referensi in-app notification)

---

## 14. Dokumen Terkait

- `docs/DRAFT_DISPUTE_RESOLUTION_FLOW.md`
- `docs/AGENT_INSTRUCTION_ADMIN_DASHBOARD.md` (jika ada)
- `INVARIANTS.md`

---

*Dokumen ini adalah draft perencanaan. Implementasi akan mengikuti setelah persetujuan dan prioritisasi.*
