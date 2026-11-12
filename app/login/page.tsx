"use client";
import { useState } from "react";

export default function Login() {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (r.ok) { location.href = (await r.json()).to || "/"; return; }
    setBusy(false);
    setErr(r.status === 401 ? "Kode klien, username, atau password salah." : "Server belum siap: database atau pengaturan belum lengkap. Jika ini pemasangan baru, buka halaman /setup.");
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
          <label className="cs-field">Kode klien<input name="slug" required autoCapitalize="none" autoComplete="organization" /></label>
          <label className="cs-field">Username<input name="username" required autoCapitalize="none" autoComplete="username" /></label>
          <label className="cs-field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          {err && <p className="cs-err" role="alert">{err}</p>}
          <button className="cs-btn" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
        </form>
      </section>
    </div>
  );
}
