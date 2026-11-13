"use client";
import Link from "next/link";
import { useState } from "react";

export default function NewClient({ mods }: { mods: [string, string][] }) {
  const [sel, setSel] = useState<string[]>(mods.map((m) => m[0])), [msg, setMsg] = useState(""), [done, setDone] = useState<{ id: string; slug: string; user: string; code: string } | null>(null), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/admin/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, modules: sel }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (r.ok) setDone({ id: j.id, slug: String(d.slug).toLowerCase(), user: String(d.username).toLowerCase(), code: j.code }); else setMsg(j.error || "Gagal.");
  }
  if (done) return (
    <section className="cs-hero"><h1>Klien dibuat</h1>
      <p>Kode klien: <b>{done.slug}</b> · Username Owner: <b>{done.user}</b> · Lisensi: <b>{done.code}</b></p>
      <p style={{ marginTop: 10 }}>Berikan kode klien, username, dan password awal ke Owner hotel. Password tidak ditampilkan lagi.</p>
      <div className="cs-acts"><Link href={`/admin/c/${done.id}`} className="cs-ghost">Buka klien</Link><Link href="/admin" className="cs-ghost">Daftar klien</Link></div></section>
  );
  const flip = (m: string) => setSel(sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m]);
  return (
    <form className="cs-glass" onSubmit={go}>
      <h2 style={{ margin: 0, font: '700 22px "Playfair Display",Georgia,serif' }}>Klien baru</h2>
      <label className="cs-field">Nama klien<input name="name" required placeholder="Grup Hotel A" /></label>
      <label className="cs-field">Kode klien (untuk login)<input name="slug" required autoCapitalize="none" placeholder="grup-a" /></label>
      <label className="cs-field">Nama hotel pertama<input name="hotel" required /></label>
      <label className="cs-field">Kota<input name="city" /></label>
      <label className="cs-field">Username Owner<input name="username" required autoCapitalize="none" placeholder="owner" /></label>
      <label className="cs-field">Password awal Owner (min. 10 karakter)<input name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
      <label className="cs-field">Masa berlaku lisensi<select name="days" defaultValue="365"><option value="30">30 hari (uji coba)</option><option value="90">90 hari</option><option value="365">1 tahun</option><option value="730">2 tahun</option></select></label>
      <p className="cs-mu" style={{ margin: "16px 0 0", fontSize: 13 }}>Modul yang diaktifkan</p>
      <div className="cs-chips">{mods.map(([k, n]) => <button type="button" key={k} className={"cs-chip" + (sel.includes(k) ? " on" : "")} onClick={() => flip(k)}>{n}</button>)}</div>
      {msg && <p className="cs-err" role="alert">{msg}</p>}
      <button className="cs-btn" disabled={busy}>{busy ? "Membuat..." : "Buat klien"}</button>
    </form>
  );
}
