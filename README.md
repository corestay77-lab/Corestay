# CoreStay App v0.2.0

Platform multi-hotel: login per klien, lisensi per modul, satu database Postgres dengan penanda klien (tenant_id).
Tahap saat ini: kerangka + modul pertama **HRIS & Payroll** (digabung dari CoreStay People v0.9.3).
Modul lain (Finance, CRM, Ops, Budget) masih penanda dan akan digabung satu per satu.
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

## Belum dilakukan / perlu diuji
- Belum pernah di-build atau dijalankan dengan database asli. Cek sintaks lolos, cek tipe belum.
- Uji wajib sebelum klien nyata: pengguna klien A tidak bisa membaca atau mengubah data klien B (HRIS, backup, absen QR).
- PWA/manifest HRIS dan versi desktop (Electron) tidak ikut digabung.
- Data HRIS lama dari proyek terpisah belum dimigrasikan (gunakan restore backup lewat Pengaturan, bila diperlukan).
- Pembatasan percobaan login dan ganti password sendiri belum ada.
