import Link from "next/link";
import Brand from "@/components/Brand";

export const dynamic = "force-dynamic";
type C = { ok: boolean; l: string; h: string };

// Pemeriksaan pengaturan tanpa membuka data apa pun (hanya ya/tidak).
async function run(): Promise<{ checks: C[]; clients: number }> {
  const hasDb = !!process.env.DATABASE_URL, sec = (process.env.SESSION_SECRET || "").length >= 32;
  let conn = false, tables = false, n = 0;
  if (hasDb) try {
    const { sql } = await import("@/lib/db");
    await sql.query("select 1"); conn = true;
    try { const r = await sql.query("select count(*)::int as n from tenants"); tables = true; n = r[0].n; } catch { /* tabel belum ada */ }
  } catch { /* tidak tersambung */ }
  return { clients: n, checks: [
    { ok: hasDb, l: "DATABASE_URL terisi", h: "Di Vercel: Storage, buat database Postgres (Neon), hubungkan ke proyek ini, lalu Redeploy." },
    { ok: sec, l: "SESSION_SECRET terisi (minimal 32 karakter)", h: "Di Vercel: Settings, Environment Variables, tambahkan SESSION_SECRET berisi teks acak panjang (minimal 32 karakter), lalu Redeploy." },
    { ok: conn, l: "Database bisa dihubungi", h: "Periksa nilai DATABASE_URL. Pastikan database Neon aktif dan proyek sudah di-Redeploy setelah database dihubungkan." },
    { ok: tables, l: "Tabel database sudah dibuat", h: "Buat klien pertama lewat Aplikasi Lisensi (disarankan). Tabel dibuat otomatis saat klien pertama dibuat." },
    { ok: n > 0, l: "Sudah ada klien", h: "Buka Aplikasi Lisensi (login Superadmin), pilih Klien baru, isi nama hotel, login Owner, dan password. Lalu login di sini memakai nama hotel, login, dan password itu." },
  ] };
}

export default async function Status() {
  const { checks, clients } = await run(), next = checks.find((c) => !c.ok);
  return (
    <div className="cs-page"><main className="cs-wrap" style={{ maxWidth: 560 }}>
      <div className="cs-top"><Brand /><Link href="/login" className="cs-ghost">‹ Ke halaman masuk</Link></div>
      <section className="cs-hero"><h1>Status pengaturan</h1><p>{next ? "Ada pengaturan yang belum lengkap." : `Semua siap. ${clients} klien terdaftar.`}</p></section>
      <section className="cs-glass">
        {checks.map((c) => <div key={c.l} className="cs-issue"><span className="cs-dot" style={{ background: c.ok ? "var(--cs-ok)" : "var(--cs-bd)" }} /><div>{c.ok ? "✓" : "✗"} {c.l}</div></div>)}
      </section>
      {next && <section className="cs-glass" style={{ marginTop: 14 }}><b>Langkah berikutnya</b><p className="cs-mu" style={{ margin: "6px 0 0" }}>{next.h}</p></section>}
      {!next && <section className="cs-glass" style={{ marginTop: 14 }}><p className="cs-mu" style={{ margin: 0 }}>Pengaturan lengkap. Jika login tetap gagal, periksa kode klien, username, dan password. Nama hotel dan login tidak membedakan huruf besar atau kecil, password membedakan. Setelah 5 kali salah, akun terkunci 15 menit.</p></section>}
    </main></div>
  );
}
