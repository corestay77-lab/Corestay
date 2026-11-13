import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminSession, clientDetail } from "@/lib/admin";
import { MODULES } from "@/lib/modules";
import ClientAdmin from "./ClientAdmin";

export const dynamic = "force-dynamic";
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  if (!(await adminSession())) redirect("/admin/login");
  const { id } = await params;
  const d = await clientDetail(id); if (!d) notFound();
  const mods = Object.entries(MODULES).map(([k, m]) => [k, m.name] as [string, string]);
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top"><Link href="/admin" className="cs-ghost">‹ Daftar klien</Link><span className="cs-brand">CoreStay Lisensi</span></div>
      <section className="cs-hero"><span className="cs-badge">{d.t.status === "active" ? "Aktif" : "Ditangguhkan"}</span><h1 style={{ marginTop: 10 }}>{d.t.name}</h1><p>Kode klien: {d.t.slug} · dibuat {d.t.created} · lisensi {d.t.code || "-"}</p></section>
      <ClientAdmin id={d.t.id} status={d.t.status} mods={mods} active={d.t.modules} expires={d.t.expires} hotels={d.hotels} users={d.users} />
      <h2 className="cs-h2">Aktivitas terakhir</h2>
      <section className="cs-glass">{d.audit.length ? d.audit.map((a, i) => <div key={i} className="cs-issue"><div><b>{a.action}</b> <span className="cs-mu">· {a.username || "admin"} · {a.at}</span></div></div>) : <p className="cs-mu" style={{ margin: 0 }}>Belum ada aktivitas.</p>}</section>
    </main></div>
  );
}
