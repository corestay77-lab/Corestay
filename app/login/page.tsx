"use client";
import { useState } from "react";

export default function Login() {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (r.ok) { location.href = (await r.json()).to || "/"; return; }
    setBusy(false);
    const dj = r.status === 401 || r.status === 429 ? {} : await r.json().catch(() => ({}));
    setErr(r.status === 429 ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit." : r.status === 401 ? "Nama hotel, login, atau password salah." : dj.hint || "Server belum siap. Buka halaman /status untuk memeriksa pengaturan.");
  }
  return (
    <div className="cs-page cs-login">
      <section className="cs-side">
        <span className="cs-brand">CoreStay</span>
        <h1>Satu platform untuk seluruh operasional hotel.</h1>
        <p>HRIS, keuangan, penjualan, operasional, dan anggaran dalam satu tempat, dengan data setiap hotel terpisah dan aman.</p>
      </section>
      <section className="cs-form">
        <form className="cs-glass" onSubmit={go}>
          <h2 style={{ margin: 0, font: '700 22px "Playfair Display",Georgia,serif' }}>Masuk</h2>
          <p className="cs-mu" style={{ margin: "4px 0 0" }}>Gunakan akun yang diberikan hotel Anda</p>
          <label className="cs-field">Nama hotel<input name="hotel" required autoComplete="organization" placeholder="contoh: Hotel Grand Jakarta" /></label>
          <label className="cs-field">Login<input name="username" required autoCapitalize="none" autoComplete="username" /></label>
          <label className="cs-field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          {err && <p className="cs-err" role="alert">{err}</p>}
          <button className="cs-btn" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
          <p className="cs-mu" style={{ fontSize: 13, margin: "14px 0 0", textAlign: "center" }}>Belum bisa masuk? <a href="/status" style={{ color: "var(--cs-gd)" }}>Cek status pengaturan</a>{process.env.NEXT_PUBLIC_LICENSE_URL ? <> · <a href={process.env.NEXT_PUBLIC_LICENSE_URL} style={{ color: "var(--cs-gd)" }}>Superadmin</a></> : null}</p>
        </form>
      </section>
    </div>
  );
}
