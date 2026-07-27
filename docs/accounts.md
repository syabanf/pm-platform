# WIT Sprint OS — Akun untuk Sosialisasi

_Dibuat otomatis dari seed aplikasi pada 2026-07-27. Jangan diedit manual —
jalankan `npm run export:accounts` untuk memperbarui._

## Cara masuk

Buka **http://localhost:3000** (atau alamat tempat aplikasi dipasang).

Aplikasi ini masih **prototipe**: datanya ada di memori browser, dan
**password apa pun diterima** (asal tidak dikosongkan) — yang menentukan Anda
masuk sebagai siapa adalah **alamat email**. Reload halaman akan mengembalikan semua data ke kondisi awal,
jadi peserta bebas mencoba tanpa takut merusak apa pun.

Empat akun bertanda ⚡ tersedia sebagai tombol satu klik di layar login, tanpa
perlu mengetik apa pun.

## Akun

| | Nama | Email | Peran | Satu klik |
| --- | --- | --- | --- | --- |
| ⚡ | Admin | `admin@wit.id` | Administrator | ya |
| ⚡ | Fahmi | `fahmi@wit.id` | Delivery Lead | ya |
| ⚡ | Risya | `risya@wit.id` | System Analyst | ya |
| ⚡ | Reyza | `reyza@wit.id` | Fullstack Developer | ya |
|  | Aditiya | `aditiya@wit.id` | Backend Developer | — |
|  | Christian | `christian@wit.id` | QA Engineer | — |
|  | Vinza | `vinza@wit.id` | Technical Writer | — |

Email di luar daftar ini tetap bisa masuk — akan diperlakukan sebagai Delivery
Lead. Jadi peserta boleh mencoba alamatnya sendiri.

## Saran pembagian saat sosialisasi

| Peserta | Masuk sebagai | Yang paling relevan dilihat |
| --- | --- | --- |
| Delivery Lead / PM | Fahmi | Home → Needs Attention, laporan klien |
| System Analyst | Risya | Backlog dan refinement |
| Developer | Reyza | Sprint board, Daily |
| QA | Christian | Kolom QA di board, Definition of Done |
| Admin workspace | Admin | Settings: roles, master list, template laporan |

## Backend (belum dipakai aplikasi)

Bagian ini **tidak diperlukan untuk sosialisasi** — aplikasi belum terhubung ke
backend. Sertakan hanya bila yang hadir adalah tim teknis.

| | |
| --- | --- |
| Email | `admin@wit.id` |
| Password | `wit-admin-changeme` |

> Password di atas adalah **kredensial awal** yang tertulis di dalam kode
> migrasi, bukan rahasia. **Wajib diganti** sebelum backend dipakai sungguhan,
> dan jangan dibagikan di luar tim teknis.

Pendaftaran mandiri sudah tersedia di backend: `POST /auth/register` membuat
akun berstatus *pending*, `POST /auth/verify` mengaktifkannya, dan login
ditolak sebelum email terverifikasi.
