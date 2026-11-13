"use client";
import { useState } from "react";

export default function AdminLogin() {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (r.ok) { location.href = "/admin"; return; }
    const d = await r.json().catch(() => ({})); setBusy(false); setErr(d.error || "Gagal masuk.");
  }
  return (
    <div className="cs-page"><main className="cs-wrap" style={{ maxWidth: 440, paddingTop: 60 }}>
      <div className="cs-top"><span className="cs-brand">CoreStay Lisensi</span></div>
      <form className="cs-glass" onSubmit={go}>
        <h2 style={{ margin: 0, font: '700 22px "Playfair Display",Georgia,serif' }}>Masuk admin</h2>
        <p className="cs-mu" style={{ margin: "4px 0 0" }}>Khusus pengelola platform CoreStay</p>
        <label className="cs-field">Username<input name="username" required autoCapitalize="none" autoComplete="username" /></label>
        <label className="cs-field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {err && <p className="cs-err" role="alert">{err}</p>}
        <button className="cs-btn" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
      </form>
    </main></div>
  );
}
