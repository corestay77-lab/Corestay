"use client";
import { useCallback, useEffect, useState } from "react";

type U = { id: string; username: string; role: string; modules: string[]; hotel_ids: string[]; active: boolean };
type H = { id: string; name: string };

export default function TeamClient({ names }: { names: Record<string, string> }) {
  const [users, setUsers] = useState<U[]>([]), [lic, setLic] = useState<string[]>([]), [hotels, setHotels] = useState<H[]>([]);
  const [me, setMe] = useState(""), [role, setRole] = useState(""), [sel, setSel] = useState<string[]>([]), [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/team"); if (!r.ok) return;
    const d = await r.json(); setUsers(d.users); setLic(d.modules); setHotels(d.hotels); setMe(d.me); setRole(d.role);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function call(method: string, body: object) {
    const r = await fetch("/api/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); setMsg(r.ok ? "Tersimpan." : d.error || "Gagal."); if (r.ok) load(); return r.ok;
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = e.currentTarget, d = Object.fromEntries(new FormData(f));
    if (await call("POST", { ...d, modules: sel })) { f.reset(); setSel([]); }
  }
  const flip = (m: string, a: string[]) => a.includes(m) ? a.filter((x) => x !== m) : [...a, m];
  const hname = (u: U) => hotels.find((h) => h.id === (u.hotel_ids || [])[0])?.name;
  return (
    <div>
      <h2 className="cs-h2" style={{ marginTop: 0 }}>Tambah pengguna</h2>
      <form onSubmit={add} className="cs-glass">
        <label className="cs-field">Username<input name="username" required autoCapitalize="none" /></label>
        <label className="cs-field">Password awal (min. 10 karakter)<input name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
        {role === "owner" && <label className="cs-field">Peran<select name="role" defaultValue="staff"><option value="staff">Staf (Housekeeping, Engineering, Sales, dll)</option><option value="gm">General Manager</option></select></label>}
        {hotels.length > 1 && <label className="cs-field">Hotel<select name="hotelId" defaultValue="">{<option value="">Pilih hotel</option>}{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>}
        <p className="cs-mu" style={{ margin: "16px 0 0", fontSize: 13 }}>Aplikasi untuk staf</p>
        <div className="cs-chips">{lic.map((m) => <button type="button" key={m} className={"cs-chip" + (sel.includes(m) ? " on" : "")} onClick={() => setSel(flip(m, sel))}>{names[m] || m}</button>)}</div>
        <button className="cs-btn">Buat login</button>
      </form>
      {msg && <p className="cs-mu" role="status" style={{ marginTop: 10 }}>{msg}</p>}
      <h2 className="cs-h2">Pengguna ({users.length})</h2>
      <div className="cs-grid">
        {users.map((u) => {
          const edit = u.role === "staff" || (role === "owner" && u.role === "gm");
          return (
            <div key={u.id} className="cs-glass" style={{ opacity: u.active ? 1 : 0.55 }}>
              <div className="cs-row">
                <span className="cs-av">{u.username.slice(0, 2).toUpperCase()}</span>
                <div><b>{u.username}</b><div className="cs-mu" style={{ fontSize: 13 }}>{u.role === "owner" ? "Owner" : u.role === "gm" ? "General Manager" : "Staf"}{hname(u) ? " · " + hname(u) : ""}{u.active ? "" : " · nonaktif"}</div></div>
              </div>
              {u.role === "staff"
                ? <div className="cs-chips">{lic.map((m) => <button type="button" key={m} className={"cs-chip" + (u.modules.includes(m) ? " on" : "")} onClick={() => call("PATCH", { id: u.id, action: "modules", modules: flip(m, u.modules) })}>{names[m] || m}</button>)}</div>
                : <p className="cs-mu" style={{ fontSize: 13, margin: "10px 0 0" }}>Akses ke semua aplikasi berlisensi</p>}
              {edit && u.id !== me && (
                <div className="cs-acts">
                  <button type="button" className="cs-ghost" onClick={() => call("PATCH", { id: u.id, action: "toggle" })}>{u.active ? "Nonaktifkan" : "Aktifkan"}</button>
                  <button type="button" className="cs-ghost" onClick={() => { const p = prompt("Password baru (min. 10 karakter) untuk " + u.username); if (p) call("PATCH", { id: u.id, action: "reset", password: p }); }}>Reset password</button>
                  {hotels.length > 1 && <select className="cs-ghost" aria-label="Hotel" value={(u.hotel_ids || [])[0] || ""} onChange={(e) => e.target.value && call("PATCH", { id: u.id, action: "hotel", hotelId: e.target.value })}><option value="">Pilih hotel</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
