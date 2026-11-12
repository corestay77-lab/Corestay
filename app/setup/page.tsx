"use client";
import Link from "next/link";
import { useState } from "react";

export default function Setup() {
  const [msg, setMsg] = useState(""), [ok, setOk] = useState(false), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setOk(r.ok);
    setMsg(r.ok ? `Selesai. Login di halaman Masuk dengan kode klien "${d.slug}" dan username "${d.username}".` : d.error || "Gagal.");
  }
  return (
    <div className="cs-page"><main className="cs-wrap" style={{ maxWidth: 520 }}>
      <div className="cs-top"><span className="cs-brand">CoreStay</span></div>
      <form className="cs-glass" onSubmit={go}>
        <h2 style={{ margin: 0, font: '700 22px "Playfair Display",Georgia,serif' }}>Setup klien pertama</h2>
        <p className="cs-mu" style={{ margin: "4px 0 0" }}>Hanya berfungsi selama belum ada klien. Perlu SETUP_KEY dari pengaturan Vercel.</p>
        <label className="cs-field">Kunci setup<input name="key" type="password" required autoComplete="off" /></label>
        <label className="cs-field">Kode klien (untuk login)<input name="slug" required autoCapitalize="none" placeholder="grup-a" /></label>
        <label className="cs-field">Nama klien<input name="tenant" required placeholder="Grup A" /></label>
        <label className="cs-field">Nama hotel pertama<input name="hotel" required /></label>
        <label className="cs-field">Kota<input name="city" /></label>
        <label className="cs-field">Username Owner<input name="username" required autoCapitalize="none" placeholder="owner" /></label>
        <label className="cs-field">Password Owner (min. 10 karakter)<input name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
        {msg && <p className={ok ? "cs-okc" : "cs-err"} role="status">{msg}</p>}
        <button className="cs-btn" disabled={busy}>{busy ? "Menyiapkan..." : "Buat klien pertama"}</button>
        {ok && <p style={{ marginTop: 14 }}><Link href="/login" className="cs-ghost">Ke halaman Masuk</Link></p>}
      </form>
    </main></div>
  );
}
