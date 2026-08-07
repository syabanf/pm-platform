# WIT Sprint OS — Ringkasan

Satu halaman untuk memahami seluruh sistem: apa yang dibangun, cara
menjalankannya, dan di mana detailnya berada. Ditulis untuk orang yang baru
membuka repo ini, atau yang kembali setelah lama.

Dokumen ini **ringkasan**, bukan sumber kebenaran. Setiap bagian menunjuk ke
dokumen yang mengaturnya.

---

## 1. Apa ini

Manajemen delivery untuk agency yang mengerjakan beberapa klien sekaligus: apa
yang perlu perhatian pagi ini, modul mana yang meleset, dan apa yang harus
dilaporkan ke klien hari Jumat.

Pekerjaan bersarang lima tingkat, dari yang terbesar:

```
Client  →  Project  →  Component  →  Component  →  Sprint  →  Task
```

**Client** perusahaannya. **Project** hasil yang mereka bayar. **Component** produk
atau sistem yang Anda bangun untuk itu. **Component** satu bagian dari modul
tersebut, dan **Component-lah yang memiliki Sprint**.

### Satu kosakata, dari layar sampai tabel

Kata yang Anda baca di layar adalah kata yang sama di kode, di URL, dan di
database:

| Di UI | Tipe / route | Tabel |
| ----- | ------------ | ----- |
| **Component** | `Component`, `/components/[componentId]` | `components` |
| **Component** | `Component`, `/components/[componentId]` | `components` |

Dulu tidak begitu: kode memakai `Module` dan `Component` — bergeser satu tingkat
dari label UI — jadi `component` bisa berarti Component atau induknya tergantung
file yang sedang dibuka. Sekarang tidak ada lagi yang perlu diterjemahkan.

> Satu kata yang **bukan** bagian dari hierarki ini: `src/components/` adalah
> folder komponen React, bukan tingkat Component. Begitu juga `components:` di
> `openapi.yaml`, yang bagian dari spesifikasi OpenAPI.

---

## 2. Dua bagian yang belum tersambung

| | Frontend | Backend |
| --- | --- | --- |
| Letak | `src/` | `backend/` |
| Teknologi | Next.js App Router, TypeScript, Tailwind v4 | Go 1.25, Echo v4, PostgreSQL 17, sqlc, pgx |
| Data | **di memori browser** — reload mengembalikan semuanya | PostgreSQL sungguhan |
| Status | jalan penuh sebagai prototipe | lengkap dan teruji |

**Keduanya belum terhubung.** Aplikasi berjalan sepenuhnya di store in-memory
(`src/lib/store.tsx`), tidak memanggil backend sama sekali. Ini disengaja:
backend bebas berkembang tanpa mengganggu aplikasi. Langkah menyambungkannya ada
di [backend/README.md](../backend/README.md#wiring-it-up-later).

---

## 3. Menjalankan

### Frontend

```bash
npm install && npm run dev        # http://localhost:3000
```

Tidak ada pendaftaran — pilih pengguna di layar login. Pengunjung pertama kali
mendapat panduan enam langkah, dan tombol **▶ Demo** di sidebar menjalankan
aplikasi sendiri, mengklik menyusuri tur lengkap.

Membuat, mengubah, dan menghapus semuanya aman dicoba; reload mengembalikan
kondisi awal.

### Backend

```bash
cd backend
cp .env.example .env
docker compose up -d              # Postgres :5432
make migrate-up
make run                          # API :8080
```

### Docker (keduanya)

```bash
cp .env.example .env      # semua variabel sudah terisi
docker compose up -d      # http://localhost:8081
```

Repo punya `Dockerfile` di root dan di `backend/`, plus `docker-compose.yml`
(build lokal) dan `docker-compose.ghcr.yml` (menarik image siap pakai), dengan
workflow build di `.github/workflows/container-images.yml`.

### Konfigurasi

Dua file template, keduanya sudah berisi nilai yang berfungsi:

| File | Untuk |
| ---- | ----- |
| `.env.example` | seluruh stack lewat Docker Compose |
| `backend/.env.example` | backend dijalankan langsung, tanpa Docker |

Salin ke `.env`, itu saja. Menghapus satu baris membuat default bawaan berlaku —
dan default di compose sengaja dibuat sama dengan default di
`internal/config/config.go`, jadi variabel yang tidak diset berperilaku persis
seperti binary-nya sendiri.

> Stack Docker menjalankan backend dengan `APP_ENV=production`, jadi token
> verifikasi tidak dikembalikan di response. Karena belum ada mailer,
> `.env.example` menyalakan `VERIFICATION_TOKEN_IN_LOG=true` supaya pendaftaran
> berfungsi — dengan konsekuensi log harus diperlakukan sebagai rahasia.

### Perintah harian

```bash
npm run test        # 46 test (vitest)
npm run e2e         # 15 test browser (Playwright)
npm run lint
npm run build
npm run export:accounts    # regenerate daftar akun demo

cd backend && make check   # fmt + vet + test
# e2e API menyeluruh — butuh Postgres; schema sekali pakai, database tak tersentuh
cd backend && TEST_DATABASE_URL=$DATABASE_URL go test ./e2e/
```

---

## 4. Akun

Ada **dua konsep orang** yang sengaja tidak disatukan:

- **members** — orang yang diberi pekerjaan. Punya kapasitas, skill, alokasi.
- **users** — akun login. Email, hash password bcrypt, role. Sebuah user boleh
  menunjuk member yang diwakilinya.

### Untuk sosialisasi / demo aplikasi

Daftar lengkap 7 akun ada di **[accounts.md](accounts.md)** (dan `accounts.csv`),
yang **dibuat otomatis dari seed** — jalankan `npm run export:accounts` untuk
memperbarui, jangan diedit manual.

Ringkasnya: password apa pun diterima asal tidak kosong, **email menentukan Anda
masuk sebagai siapa**, email asing masuk sebagai Delivery Lead, dan empat akun
tersedia sebagai tombol satu klik.

### Untuk backend

Setiap environment dimulai dengan satu administrator yang di-seed migrasi:
`admin@wit.id` / `wit-admin-changeme` — **kredensial bootstrap, bukan rahasia**
(hash-nya ada di dalam repo). Wajib diganti sebelum dipakai sungguhan.

Alur pendaftaran mandiri:

```
POST /auth/register  →  akun pending + token verifikasi
POST /auth/verify    →  alamat terbukti, akun aktif
POST /auth/login     →  ditolak selama masih pending
```

**Belum ada mailer.** Token harus punya tujuan, dan mode mana yang aktif dicetak
saat boot: di luar production token dikembalikan di response; di production
dengan `VERIFICATION_TOKEN_IN_LOG=true` ditulis ke log; tanpa keduanya
pendaftaran **menolak dengan 503** ketimbang membuat akun yang tak pernah bisa
diverifikasi.

**Authorization sudah jalan.** Login menerbitkan session token (opaque,
hash-nya saja yang disimpan; berlaku `SESSION_TTL`, default 7 hari), logout
mencabutnya seketika, dan seluruh operasi di luar alur auth memeriksa
`Authorization: Bearer <token>`. Kebijakannya dari permissions role yang
di-seed: semua session boleh membaca; menulis butuh `lead`/`admin`; segala
sesuatu di `/users` — termasuk membacanya — butuh `admin`. Akun buatan admin
lahir `active` (admin menjaminnya); akun self-register tetap `pending` sampai
alamatnya terbukti.

---

## 5. API

**Layanannya mendokumentasikan dirinya sendiri.** Jalankan, lalu buka
**http://localhost:8080/docs** — referensi lengkap 90 operasi dengan parameter,
skema request/response, dan `curl` siap tempel untuk tiap operasi. Halaman itu
digambar dari spesifikasi yang dibawa binary-nya sendiri, jadi selalu
menggambarkan versi yang benar-benar berjalan, dan tidak memuat apa pun dari CDN.

| Route | Isi |
| ----- | --- |
| `/docs` | halaman referensi |
| `/openapi.yaml` | spesifikasi, untuk generate client |
| `/openapi.json` | dokumen yang sama dalam JSON |

Sumbernya `backend/api/openapi.yaml` (OpenAPI 3.1). Spec **tidak bisa basi**:
`TestOpenAPIMatchesRouter` membandingkannya dengan route sungguhan dan
menggagalkan build bila keduanya berbeda — ke arah mana pun.

### Konvensi yang mudah salah

- **PATCH itu partial.** Hanya field yang dikirim yang ditulis. Inilah yang
  membuat dua editan bersamaan ke field berbeda sama-sama selamat.
- **`clientId` tidak diterima pada module** — diturunkan dari project, supaya
  sebuah module tidak bisa diklaim (atau ikut terhapus) oleh klien yang bukan
  pemiliknya. Pindahkan lewat `projectId`.
- **Semua list paginated.** `?limit=` (default 200, maks 1000) dan `?offset=`,
  dengan header `X-Has-More`.
- **`role` dan `memberId` tidak diterima saat membuat user** — keduanya
  pemberian wewenang, dan belum ada yang memeriksa kredensial.
- **Tanggal** menerima `YYYY-MM-DD` maupun RFC 3339.

Batas operasional (body 1 MB, statement 5 s, DELETE 120 s, pool 25, dll.)
seluruhnya ditabelkan di [backend/README.md](../backend/README.md#limits).

---

## 6. Data dan migrasi

Lima migrasi, dijalankan berurutan oleh `make migrate-up`:

| | Isi |
| --- | --- |
| `000001_init` | 18 tabel, seluruh hierarki |
| `000002_integrity_hardening` | foreign key komposit, CHECK bounds, index FK |
| `000003_list_indexes` | index yang cocok dengan cara list dibaca |
| `000004_master_data` | roles, master list, template laporan, satu member |
| `000005_users` | tabel `users` + token verifikasi, satu admin |

Master data ikut migrasi, bukan hanya `seed/seed.sql` — supaya database
production tidak lahir dengan `GET /roles` kosong. Semua insert idempoten.

`make seed` mengisi portofolio realistis untuk pengembangan (~1,16 juta baris
dalam 40 detik pada volume default).

**Migrasi database yang sudah berisi data** butuh pembersihan lebih dulu —
skrip remediasinya lengkap di
[backend/README.md](../backend/README.md#migrating-a-database-that-already-has-data).

---

## 7. Peta file

| Path | Isi |
| ---- | --- |
| `src/app/` | route (Next.js App Router) |
| `src/components/` | UI bersama; `ui.tsx` primitifnya |
| `src/lib/store.tsx` | store in-memory yang dibaca semua halaman |
| `src/lib/data.ts` | seed data |
| `src/lib/types.ts` | tipe domain |
| `backend/cmd/api/` | entrypoint: config, pool, graceful shutdown |
| `backend/internal/db/query/*.sql` | **sumber** query — edit di sini |
| `backend/internal/db/*.sql.go` | hasil generate sqlc — jangan diedit |
| `backend/internal/httpapi/` | server Echo, middleware, handler |
| `backend/migrations/` | golang-migrate |
| `backend/api/openapi.yaml` | spesifikasi API |
| `docs/accounts.md` | daftar akun demo (di-generate) |

---

## 8. Catatan lain

- Bekerja offline dan bisa dipasang sebagai PWA.
- Ponsel, tablet, dan desktop punya layout masing-masing; di perangkat sentuh
  bisa swipe antar tab dan dari tepi kiri untuk membuka menu.
- `⌘K` membuka pencarian dari mana saja.
- Tidak ada ORM di backend: setiap query ditulis tangan dan sqlc yang membuat
  Go-nya, sehingga compiler menangkap kolom yang berganti nama.

---

## 9. Yang masih terbuka

| Prioritas | Hal |
| --------- | --- |
| Besar | **Mailer** — supaya link verifikasi benar-benar terkirim |
| Sedang | **Store swap** — memindahkan store in-memory ke typed client (login + baca sudah terbukti di `/backend`); sisa: semua collection + write-back mutasi |
| Sedang | Endpoint rollup, agar dashboard tidak perlu ratusan request |
| Kecil | CRUD akun (user belum bisa diubah atau dihapus lewat API) |

---

## Dokumen lain

| Dokumen | Untuk |
| ------- | ----- |
| [README.md](../README.md) | pengantar produk dan cara menjalankan frontend |
| [backend/README.md](../backend/README.md) | rujukan backend lengkap — stack, limit, migrasi, ops |
| [docs/accounts.md](accounts.md) | daftar akun untuk sosialisasi (di-generate) |
| `http://localhost:8080/docs` | referensi API 90 operasi, dari layanan yang berjalan |
| [AGENTS.md](../AGENTS.md) | catatan untuk agen AI yang mengedit repo ini |
