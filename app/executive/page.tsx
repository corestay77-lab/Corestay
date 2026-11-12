import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/data";
import { MODULES } from "@/lib/modules";
import { buildSummary, type Tone } from "@/lib/exec/summary";

export const dynamic = "force-dynamic";
const SEV = ["", "var(--cs-bd)", "#f2a93b", "var(--cs-mu)"], TONE: Record<string, string> = { ok: "var(--cs-ok)", warn: "#f2a93b", bad: "var(--cs-bd)", none: "var(--cs-mu)" };
const LBL: Record<string, string> = { ok: "Baik", warn: "Perlu perhatian", bad: "Mendesak", none: "Belum ada data" };

export default async function Executive({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const s = await currentUser(); if (!s) redirect("/login");
  if (s.role === "staff") redirect("/");
  const { h } = await searchParams;
  const d = await buildSummary(s, h || null);
  const max = Math.max(1, ...d.trend.map((t) => t.v));
  return (
    <div className="cs-page"><main className="cs-wrap">
      <div className="cs-top"><Link href="/" className="cs-ghost">‹ Beranda</Link><span className="cs-brand">CoreStay</span></div>
      <section className="cs-hero">
        <h1>Dashboard Executive</h1>
        <p>{d.hotel ? d.hotel.name : d.hotels.length > 1 ? `Semua hotel (${d.hotels.length})` : d.hotels[0]?.name || "Ringkasan seluruh aplikasi"}</p>
        {d.hotels.length > 1 && (
          <div className="cs-chips"><Link href="/executive" className={"cs-chip" + (!d.hotel ? " on" : "")}>Semua hotel</Link>
            {d.hotels.map((x) => <Link key={x.id} href={`/executive?h=${x.id}`} className={"cs-chip" + (d.hotel?.id === x.id ? " on" : "")}>{x.name}</Link>)}</div>
        )}
      </section>
      {d.kpis.length > 0 && <div className="cs-kpis">{d.kpis.map((k) => <div key={k.l} className="cs-glass cs-kpi"><small>{k.l}</small><b style={{ color: k.tone ? TONE[k.tone] : undefined }}>{k.v}</b></div>)}</div>}
      {d.trend.some((t) => t.v > 0) && (
        <section className="cs-glass" style={{ marginTop: 14 }}>
          <b>Pendapatan 6 bulan terakhir</b>
          <svg viewBox="0 0 320 130" role="img" aria-label="Grafik pendapatan per bulan" style={{ width: "100%", marginTop: 10 }}>
            {d.trend.map((t, i) => { const bh = (t.v / max) * 92, x = i * 53 + 8; return (
              <g key={t.label}><rect x={x} y={104 - bh} width={36} height={bh} rx={6} fill="url(#g)" /><text x={x + 18} y={122} textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">{t.label}</text></g>); })}
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1c768" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs>
          </svg>
        </section>
      )}
      <h2 className="cs-h2">Isu utama</h2>
      <section className="cs-glass">
        {d.issues.length ? d.issues.map((i, k) => (
          <Link key={k} href={MODULES[i.mod].href} className="cs-issue"><span className="cs-dot" style={{ background: SEV[i.sev] }} /><div><span className="cs-badge" style={{ borderColor: MODULES[i.mod].color }}>{MODULES[i.mod].short}</span><div>{i.text}</div></div></Link>
        )) : <p className="cs-mu" style={{ margin: 0 }}>{d.mods.some((m) => m.status !== "none") ? "Tidak ada isu yang terdeteksi saat ini." : "Belum ada data untuk dianalisis. Mulai isi aplikasi di bawah."}</p>}
      </section>
      <h2 className="cs-h2">Ringkasan aplikasi</h2>
      <div className="cs-grid">
        {Object.keys(MODULES).map((k) => { const m = MODULES[k], sm = d.mods.find((x) => x.key === k), licensed = d.lic.includes(k), st = (sm?.status || "none") as Tone | "none";
          return licensed ? (
            <Link key={k} href={m.href} className="cs-glass cs-app" style={{ ["--c" as string]: m.color }}>
              <div className="cs-row"><span className="cs-ic">{m.icon}</span><div style={{ flex: 1 }}><b>{m.name}</b><div className="cs-mu" style={{ fontSize: 13 }}><span className="cs-dot" style={{ background: TONE[st], display: "inline-block", marginRight: 6 }} />{LBL[st]}</div></div></div>
              {sm?.stats.length ? <div className="cs-stats">{sm.stats.map((x) => <div key={x.l}><small>{x.l}</small><b style={{ color: x.tone ? TONE[x.tone] : undefined }}>{x.v}</b></div>)}</div> : <small>{sm?.note || "Belum ada data."}</small>}
              {sm?.stats.length && sm.note ? <small>{sm.note}</small> : null}
            </Link>
          ) : <div key={k} className="cs-glass cs-app cs-off" style={{ ["--c" as string]: m.color }}><span className="cs-ic">🔒</span><b>{m.name}</b><small>Belum aktif pada lisensi</small></div>; })}
      </div>
    </main></div>
  );
}
