"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type U = { id: string; username: string; role: string; active: boolean; modules: string[] };
type H = { id: string; name: string; city: string | null };

export default function ClientAdmin(p: { id: string; status: string; mods: [string, string][]; active: string[]; expires: string | null; hotels: H[]; users: U[] }) {
  const r = useRouter(), [sel, setSel] = useState<string[]>(p.active), [exp, setExp] = useState(p.expires || ""), [msg, setMsg] = useState("");
  async function call(body: object) {
    const res = await fetch(`/api/admin/clients/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({})); setMsg(res.ok ? "Tersimpan." : d.error || "Gagal."); if (res.ok) r.refresh(); return res.ok;
  }
  const flip = (m: string) => setSel(sel.includes(m) ? sel.filter((x) => x !== m) : [...sel, m]);
  const extend = (n: number) => { const base = exp && Date.parse(exp) > Date.now() ? new Date(exp + "T00:00:00Z") : new Date(); base.setUTCDate(base.getUTCDate() + n); setExp(base.toISOString().slice(0, 10)); };
  return (
    <div>
      <h2 className="cs-h2" style={{ marginTop: 0 }}>Lisensi dan modul</h2>
      <section className="cs-glass">
        <p className="cs-mu" style={{ margin: 0, fontSize: 13 }}>Modul aktif</p>
        <div className="cs-chips">{p.mods.map(([k, n]) => <button type="button" key={k} className={"cs-chip" + (sel.includes(k) ? " on" : "")} onClick={() => flip(k)}>{n}</button>)}</div>
        <label className="cs-field">Berlaku sampai (kosongkan untuk tanpa batas)<input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></label>
        <div className="cs-acts">{[30, 90, 365].map((n) => <button type="button" key={n} className="cs-ghost" onClick={() => extend(n)}>+{n} hari</button>)}</div>
        <button className="cs-btn" onClick={() => call({ action: "license", modules: sel, expires: exp || null })}>Simpan lisensi</button>
      </section>
      {msg && <p className="cs-mu" role="status" style={{ marginTop: 10 }}>{msg}</p>}
      <h2 className="cs-h2">Status klien</h2>
      <section className="cs-glass"><p className="cs-mu" style={{ marginTop: 0 }}>{p.status === "active" ? "Klien aktif. Menangguhkan akan memblokir semua login dan akses modul klien ini, termasuk absen QR, tanpa menghapus data." : "Klien sedang ditangguhkan: tidak ada yang bisa login."}</p>
        <button className="cs-ghost" onClick={() => { if (p.status !== "active" || confirm("Tangguhkan klien ini? Semua penggunanya langsung tidak bisa masuk.")) call({ action: "status", status: p.status === "active" ? "suspended" : "active" }); }}>{p.status === "active" ? "Tangguhkan klien" : "Aktifkan kembali"}</button></section>
      <h2 className="cs-h2">Hotel ({p.hotels.length})</h2>
      <section className="cs-glass">
        {p.hotels.map((h) => <div key={h.id} className="cs-issue"><div><b>{h.name}</b>{h.city ? <span className="cs-mu"> · {h.city}</span> : null}</div></div>)}
        <form className="cs-acts" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget, d = Object.fromEntries(new FormData(f)); if (await call({ action: "hotel", ...d })) f.reset(); }}>
          <input name="name" required placeholder="Nama hotel baru" className="cs-ghost" style={{ flex: 1, minWidth: 140 }} /><input name="city" placeholder="Kota" className="cs-ghost" style={{ width: 120 }} /><button className="cs-ghost">Tambah hotel</button>
        </form>
      </section>
      <h2 className="cs-h2">Pengguna ({p.users.length})</h2>
      <div className="cs-grid">{p.users.map((u) => (
        <div key={u.id} className="cs-glass" style={{ opacity: u.active ? 1 : 0.55 }}>
          <b>{u.username}</b> <span className="cs-mu">· {u.role === "owner" ? "Owner" : u.role === "gm" ? "GM" : "Staf"}{u.active ? "" : " · nonaktif"}</span>
          <div className="cs-acts"><button className="cs-ghost" onClick={() => { const pw = prompt("Password baru (min. 10 karakter) untuk " + u.username); if (pw) call({ action: "reset", userId: u.id, password: pw }); }}>Reset password</button></div>
        </div>))}</div>
      <section className="cs-glass" style={{ marginTop: 12 }}>
        <b>Tambah Owner</b>
        <form className="cs-acts" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget, d = Object.fromEntries(new FormData(f)); if (await call({ action: "owner", ...d })) f.reset(); }}>
          <input name="username" required placeholder="username" autoCapitalize="none" className="cs-ghost" style={{ flex: 1, minWidth: 120 }} /><input name="password" type="password" required minLength={10} placeholder="password (min. 10)" autoComplete="new-password" className="cs-ghost" style={{ flex: 1, minWidth: 140 }} /><button className="cs-ghost">Tambah</button>
        </form>
      </section>
    </div>
  );
}
