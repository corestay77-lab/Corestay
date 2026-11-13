import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSession, listClients } from "@/lib/admin";
import { MODULES } from "@/lib/modules";

export const dynamic = "force-dynamic";
const daysLeft = (d: string | null) => (d ? Math.ceil((Date.parse(d + "T23:59:59Z") - Date.now()) / 864e5) : null);

export default async function Admin() {
  if (!(await adminSession())) redirect("/admin/login");
  let clients: Awaited<ReturnType<typeof listClients>> = [], err = "";
  try { clients = await listClients(); } catch { err = "Database belum siap atau belum ada klien. Buat klien pertama lewat /setup atau tombol di bawah."; }
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top"><span className="cs-brand">CoreStay Lisensi</span><form method="post" action="/api/admin/logout"><button className="cs-ghost">Keluar</button></form></div>
      <section className="cs-hero"><h1>Klien dan lisensi</h1><p>{clients.length} klien · {clients.filter((c) => c.status === "active").length} aktif</p></section>
      <Link href="/admin/new" className="cs-btn" style={{ textAlign: "center", textDecoration: "none", marginTop: 0, marginBottom: 14 }}>+ Klien baru</Link>
      {err && <p className="cs-mu">{err}</p>}
      <div className="cs-grid">
        {clients.map((c) => { const left = daysLeft(c.expires), exp = left !== null && left < 0, soon = left !== null && left >= 0 && left <= 30;
          return (
            <Link key={c.id} href={`/admin/c/${c.id}`} className="cs-glass cs-app" style={{ ["--c" as string]: c.status === "active" ? "#7c5cff" : "#ff6b81" }}>
              <div className="cs-row"><span className="cs-av">{c.name.slice(0, 2).toUpperCase()}</span><div style={{ flex: 1 }}><b>{c.name}</b><div className="cs-mu" style={{ fontSize: 13 }}>{c.slug} · {c.hotels} hotel · {c.users} pengguna</div></div></div>
              <div className="cs-chips" style={{ position: "relative" }}>
                {c.status !== "active" && <span className="cs-badge" style={{ color: "var(--cs-bd)" }}>Ditangguhkan</span>}
                {exp && <span className="cs-badge" style={{ color: "var(--cs-bd)" }}>Kedaluwarsa</span>}
                {soon && <span className="cs-badge" style={{ color: "#f2a93b" }}>{left} hari lagi</span>}
                {c.modules.map((m) => <span key={m} className="cs-badge">{MODULES[m]?.short || m}</span>)}
                {!c.modules.length && <span className="cs-mu" style={{ fontSize: 13 }}>Belum ada lisensi aktif</span>}
              </div>
              <small style={{ position: "relative" }}>{c.expires ? `Berlaku sampai ${c.expires}` : c.code ? "Tanpa batas waktu" : ""}</small>
            </Link>
          ); })}
      </div>
    </main></div>
  );
}
