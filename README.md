# CoreStay App v0.7.0

Platform multi-hotel: login per klien, lisensi per modul, satu database Postgres dengan penanda klien (tenant_id).
Tahap saat ini: kerangka + modul **HRIS & Payroll** (dari CoreStay People v0.9.3) + modul **Finance** (dari CoreStay Finance v1.2.0) + modul **Ops** (dari CoreStay Ops v1.0.0) + modul **Sales & CRM** (dari CoreStay CRM v1.8.0) + modul **Hotel Budget**.
Semua modul sudah tergabung; Supabase tidak dipakai lagi.
Aplikasi Lisensi (admin pembuat lisensi) menyusul; sementara klien didaftarkan lewat skrip.

## Pasang
1. Unggah ke GitHub, impor di Vercel.
2. Vercel, Storage, buat database Postgres (Neon), hubungkan ke proyek. `DATABASE_URL` terisi otomatis.
3. Tambahkan env `SESSION_SECRET` (acak, minimal 32 karakter), lalu Redeploy.
4. Lokal: `npm install`, salin `.env.example` ke `.env.local` dan isi keduanya.

## Mendaftarkan klien
`npm run tenant -- grup-a "Grup A" "Hotel A" "Jakarta" owner PasswordKuat123 hris,finance,crm,ops,budget 365`
Membuat tabel inti, klien, hotel pertama, pengguna Owner, dan lisensi. Login di /login: kode klien, username, password.
Tabel HRIS (hr_*) dibuat otomatis saat modul HRIS pertama kali dibuka.

## Membuat klien pertama dari browser (tanpa komputer)
1. Di Vercel, Settings, Environment Variables: isi `SETUP_KEY` (acak, minimal 12 karakter), lalu Redeploy.
2. Buka `https://NAMA-APP.vercel.app/setup`, isi kunci setup, kode klien, nama klien, hotel, username Owner, dan password (minimal 10 karakter).
3. Halaman ini hanya berfungsi bila belum ada klien. Setelah selesai, hapus `SETUP_KEY` dari Vercel.

## Alur pengguna
1. Admin CoreStay membuat klien, lisensi, dan Owner (sementara lewat skrip).
2. Owner/GM membuka Kelola tim (/team): membuat login Housekeeping, Engineering, Sales, dll, memilih aplikasi dan hotelnya.
3. Staf dengan satu aplikasi langsung masuk ke aplikasi itu; yang lain masuk ke beranda.

## Peta HRIS di platform
- Halaman: `/hris/*`. API: `/api/hris/*`. Absen karyawan lewat QR tetap publik di `/absen` dan `/api/absen` (hanya untuk hotel yang berlisensi HRIS).
- Owner = admin HRIS (semua hotel miliknya). GM dan staf = login satu hotel (ditetapkan di Kelola tim).
- Login lama HRIS (hr_user, hr_auth) dihapus; login, peran, dan akses mengikuti sesi CoreStay.
- Hotel yang dibuat di CoreStay otomatis mendapat data HRIS sendiri. Semua query HRIS dibatasi ke tenant_id dari sesi.
- Backup/restore hanya untuk data klien sendiri; restore mencocokkan hotel lewat nama dan tidak menyentuh hotel lain.
- CSS HRIS dicakup ke `.hris-root` (app/hris/hris.css) agar tidak bercampur dengan tampilan platform.

## Peta Finance di platform
- Halaman: `/finance` (disajikan server hanya untuk pengguna berlisensi Finance). API: `/api/finance/state`.
- UI Finance dipertahankan; penyimpanan localStorage diganti ke server: satu dokumen keuangan per klien (tabel `fin_doc`, dibuat otomatis), tersimpan otomatis beberapa detik setelah perubahan.
- Daftar hotel mengikuti hotel klien (bukan lagi Bandung/Jakarta/Bali/Surabaya). Klien baru mulai kosong dengan satu rekening bawaan; data contoh dihapus.
- Dua pengguna menyimpan bersamaan: yang kedua diminta memuat ulang (pengaman versi), data tidak saling menimpa diam-diam.
- Keterbatasan: dokumen dibatasi 4 MB per klien (batas permintaan server); semua pengguna Finance melihat semua hotel milik klien itu (belum dibatasi per hotel). Tahap berikutnya: pindah ke tabel terpisah per hotel bila data membesar.
- Data Finance lama di browser: unduh cadangan dari Finance lama, lalu "Pulihkan dari berkas" di Finance baru.

## Peta Ops di platform
- Halaman: `/ops` (Owner bisa berpindah hotel lewat pemilih hotel di bawah layar; GM dan staf hanya hotel yang ditetapkan). API: `/api/ops/state`.
- Satu dokumen Ops per hotel (tabel `ops_doc`, dibuat otomatis); tersimpan otomatis, dengan pengaman versi antar pengguna.
- Identitas mengikuti login CoreStay: Owner dan GM = peran GM di Ops. Staf = peran sesuai anggota tim Ops yang kolom "Username CoreStay"-nya sama dengan username login; bila belum ada yang cocok, staf hanya bisa melihat (Viewer). Pemilih pengguna di dalam Ops dimatikan.
- Hotel baru mulai kosong: daftar kamar bawaan (60 kamar, lantai 2-7) dipertahankan karena Ops belum punya menu tambah kamar; aset, jadwal PM, inventori, dan tim dikosongkan untuk diisi sendiri. Tombol "Kembalikan data contoh" dihapus.
- Keterbatasan: hak per jabatan di dalam Ops (GM, supervisor, teknisi) dijaga oleh tampilan di browser seperti aplikasi aslinya, belum oleh server. Dokumen dibatasi 4 MB per hotel.

## Peta Sales & CRM di platform
- Halaman: `/crm` (pemilih hotel untuk Owner; GM dan staf hanya hotel yang ditetapkan). API: `/api/crm/state`. Satu dokumen CRM per hotel (tabel `crm_doc`, dibuat otomatis).
- Identitas seperti Ops: Owner dan GM = Sales Manager. Staf = anggota tim CRM yang kolom "Username CoreStay"-nya sama dengan username login; bila belum ada yang cocok, hanya bisa melihat (Viewer). Pemilih pengguna di dalam CRM dimatikan.
- Hotel baru mulai kosong (akun, lead, penawaran, ulasan kosong); tombol "Reset demo data" dihapus. Tampilan CRM masih berbahasa Inggris dan Indonesia campur, sama seperti aplikasi aslinya.
- Penyimpanan Ops dan CRM memakai satu logika bersama (`lib/hoteldoc.ts`). Keterbatasan sama dengan Ops: hak per jabatan dijaga browser, dokumen maksimal 4 MB per hotel.

## Peta Hotel Budget di platform
- Halaman: `/budget` (hanya pengguna berlisensi Budget). API tetap di `/api/hotel-budget/*`.
- Supabase dihapus. Login mengikuti sesi CoreStay. Laporan final disimpan di Postgres bersama (tabel `budget_report`, dibuat otomatis) per klien: Owner dan GM melihat semua laporan klien, staf hanya laporan buatannya.
- Perbaikan keamanan: route validasi AI, unggah PDF, dan kirim email sebelumnya terbuka tanpa login; sekarang wajib login dan berlisensi Budget.
- Tailwind dipasang hanya untuk halaman Budget (dibatasi ke file halaman itu). Tampilan Budget perlu dicek visual setelah deploy.
- Opsional (kosong = fitur nonaktif): `GEMINI_API_KEY` (validasi AI), `RESEND_API_KEY` dan `HOTEL_BUDGET_EMAIL_FROM` (kirim email), `BLOB_READ_WRITE_TOKEN` (unggah PDF sementara).
- Draft `corestay-hotel-budget-draft` tetap dibaca HRIS lewat file (Sinkron di HRIS); sambungan langsung belum dibuat.

## Dashboard Executive (`/executive`, Owner dan GM)
- Membaca data asli semua modul berlisensi: Finance (pendapatan bulan ini, GOP, kas, piutang, utang vendor), Ops (okupansi, kamar, work order), Sales CRM (pipeline, rating, ulasan negatif), HRIS (kehadiran hari ini, karyawan aktif), Budget (laporan final terakhir).
- Isu utama dihitung otomatis dengan aturan sederhana (misalnya work order Urgent terbuka, piutang lewat 30 hari, ulasan negatif belum dibalas, kehadiran di bawah 85%). Ambang batasnya ada di `lib/exec/summary.ts` dan mudah disesuaikan.
- Owner bisa memilih satu hotel atau semua hotel. Saldo kas selalu tingkat klien (rekening Finance dipakai bersama).
- Modul tanpa data atau tanpa lisensi ditampilkan apa adanya; satu modul bermasalah tidak menjatuhkan dashboard.
- Keterbatasan: okupansi diperkirakan dari status kamar di Ops (belum dari PMS); ADR dan RevPAR belum ada karena belum ada sumber data. Gaji pokok HRIS belum termasuk tunjangan dan potongan. Perbandingan anggaran vs realisasi belum dibuat.

## Belum dilakukan / perlu diuji
- Belum pernah di-build atau dijalankan dengan database asli. Cek sintaks lolos, cek tipe belum.
- Uji wajib sebelum klien nyata: pengguna klien A tidak bisa membaca atau mengubah data klien B (HRIS, backup, absen QR).
- PWA/manifest HRIS dan versi desktop (Electron) tidak ikut digabung.
- Data HRIS lama dari proyek terpisah belum dimigrasikan (gunakan restore backup lewat Pengaturan, bila diperlukan).
- Pembatasan percobaan login dan ganti password sendiri belum ada.
