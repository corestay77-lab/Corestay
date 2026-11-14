"use client";
import { useState } from "react";

const FEATS: [string, string][] = [["👥", "HRIS & Payroll"], ["💰", "Finance"], ["🤝", "Sales CRM"], ["🛎️", "Operasional"], ["📊", "Hotel Budget"]];

export default function Login() {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (r.ok) { location.href = (await r.json()).to || "/"; return; }
    setBusy(false);
    const dj = r.status === 401 || r.status === 429 ? {} : await r.json().catch(() => ({}));
    setErr(r.status === 429 ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit." : r.status === 401 ? "Nama hotel, login, atau password salah." : dj.hint || "Server belum siap. Buka halaman /status untuk memeriksa pengaturan.");
  }
  const lic = process.env.NEXT_PUBLIC_LICENSE_URL;
  return (
    <div className="au-page">
      <span className="au-orb o1" /><span className="au-orb o2" /><span className="au-orb o3" />
      <main className="au-wrap">
        <section className="au-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="au-logo" src="/logo.png" alt="CoreStay Advisory" />
          <h1>Satu platform untuk seluruh operasional hotel.</h1>
          <p>HRIS, keuangan, penjualan, operasional, dan anggaran dalam satu tempat, dengan data setiap hotel terpisah dan aman.</p>
          <div className="au-feats">{FEATS.map(([i, n]) => <span key={n}><i style={{ fontStyle: "normal" }}>{i}</i>{n}</span>)}</div>
          <ul className="au-trust"><li>Data setiap hotel terpisah dan aman</li><li>Akses sesuai izin masing-masing pengguna</li><li>Terkunci otomatis setelah percobaan yang salah</li></ul>
        </section>
        <section className="au-card">
          <form onSubmit={go}>
            <h2>Masuk</h2>
            <p className="sub">Gunakan akun yang diberikan hotel Anda</p>
            <label className="au-field">Nama hotel<span className="box"><input name="hotel" required autoComplete="organization" placeholder="contoh: Hotel Grand Jakarta" /></span></label>
            <label className="au-field">Login<span className="box"><input name="username" required autoCapitalize="none" autoComplete="username" placeholder="nama login Anda" /></span></label>
            <label className="au-field">Password<span className="box"><input name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" /><button type="button" className="au-eye" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Sembunyikan" : "Lihat"}</button></span></label>
            {err && <p className="au-err" role="alert">{err}</p>}
            <button className="au-btn" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
            <p className="au-foot">Belum bisa masuk? <a href="/status">Cek status pengaturan</a>{lic ? <> · <a href={lic}>Superadmin</a></> : null}</p>
          </form>
        </section>
      </main>
      <p className="au-copy">© CoreStay Advisory</p>
    </div>
  );
}
