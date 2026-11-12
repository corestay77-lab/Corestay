import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, tenantInfo, userModules } from "@/lib/data";
import { MODULES } from "@/lib/modules";

export default async function Home() {
  const s = await currentUser(); if (!s) redirect("/login");
  const [t, on] = await Promise.all([tenantInfo(s.tid), userModules(s.tid, s.uid, s.role)]);
  if (!t) redirect("/login");
  const mg = s.role !== "staff", RL: Record<string, string> = { owner: "Owner", gm: "General Manager", staff: "Staf" };
  // Staf hanya melihat aplikasi yang diberikan; Owner/GM juga melihat modul yang belum berlisensi (terkunci).
  const keys = Object.keys(MODULES).filter((k) => mg || on.includes(k));
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top">
        <span className="cs-brand">CoreStay</span>
        <form method="post" action="/api/logout"><button className="cs-ghost">Keluar</button></form>
      </div>
      <section className="cs-hero">
        <span className="cs-badge">{RL[s.role]} · {s.name}</span>
        <h1 style={{ marginTop: 12 }}>{mg ? "Executive" : t.name}</h1>
        <p>{t.name}{t.hotels.length ? " · " + t.hotels.map((h) => h.name).join(", ") : ""}</p>
      </section>
      <h2 className="cs-h2">Aplikasi</h2>
      <div className="cs-grid">
        {keys.map((k) => { const m = MODULES[k], style = { ["--c" as string]: m.color };
          return on.includes(k)
            ? <Link key={k} href={m.href} className="cs-glass cs-app" style={style}><span className="cs-ic">{m.icon}</span><b>{m.name}</b><small>{m.desc}</small>{!m.ready && <span className="cs-badge" style={{ alignSelf: "flex-start" }}>Segera hadir</span>}</Link>
            : <div key={k} className="cs-glass cs-app cs-off" style={style}><span className="cs-ic">🔒</span><b>{m.name}</b><small>Belum aktif pada lisensi</small></div>; })}
        {mg && <Link href="/executive" className="cs-glass cs-app" style={{ ["--c" as string]: "#f1c768" }}><span className="cs-ic">📈</span><b>Dashboard Executive</b><small>Ringkasan dan isu utama dari semua aplikasi</small></Link>}
        {mg && <Link href="/team" className="cs-glass cs-app" style={{ ["--c" as string]: "#7c5cff" }}><span className="cs-ic">🔑</span><b>Kelola tim</b><small>Buat login Housekeeping, Engineering, Sales, dan tim lain</small></Link>}
      </div>
      {!keys.length && <p className="cs-mu">Belum ada aplikasi yang diberikan ke akun Anda. Hubungi admin hotel.</p>}
    </main></div>
  );
}
