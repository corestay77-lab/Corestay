import Link from "next/link";
import Brand from "@/components/Brand";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/data";
import { MODULES } from "@/lib/modules";
import { buildSummary, type Period, type Tone } from "@/lib/exec/summary";

export const dynamic = "force-dynamic";
const SEV = ["", "var(--cs-bd)", "#f2a93b", "var(--cs-mu)"], SEVL = ["", "Mendesak", "Perhatian", "Info"];
const TONE: Record<string, string> = { ok: "var(--cs-ok)", warn: "#f2a93b", bad: "var(--cs-bd)", none: "var(--cs-mu)" };
const LBL: Record<string, string> = { ok: "Baik", warn: "Perlu perhatian", bad: "Mendesak", none: "Belum ada data" };
const KC: Record<string, [string, string]> = { rev: ["#f1c768", "💰"], occ: ["#a98bff", "🛏️"], cash: ["#3be0a8", "🏦"], ar: ["#ff7aa0", "🧾"], att: ["#6ea0ff", "👥"], rating: ["#ffb347", "⭐"] };
const MENU: Record<string, string> = { hris: "Karyawan · Absensi QR · Jadwal · Payroll · Labor Cost · Approval", finance: "Invoice · Utang · Kas dan Bank · Laporan", crm: "Accounts · Opportunities · Reviews · Reports · Tasks", ops: "Papan Kamar · Work Order · Preventive Maintenance · Utilitas", budget: "Input anggaran · Laporan final · Proyeksi 10 tahun" };
const REPORTS: Record<string, string[]> = { finance: ["Pendapatan dan GOP", "Aging piutang", "Arus kas"], ops: ["Status kamar harian", "Work order terbuka"], crm: ["Pipeline penjualan", "Reputasi tamu"], hris: ["Rekap absensi hari ini", "Karyawan aktif"], budget: ["Laporan budget final terakhir"] };
const TABS = [["dashboard", "🏠", "Dashboard"], ["aplikasi", "▦", "Aplikasi"], ["approval", "✅", "Approval"], ["laporan", "📄", "Laporan"], ["pengaturan", "⚙️", "Pengaturan"]];

export default async function Executive({ searchParams }: { searchParams: Promise<{ h?: string; t?: string; p?: string }> }) {
  const s = await currentUser(); if (!s) redirect("/login");
  if (s.role === "staff") redirect("/");
  const q = await searchParams, tab = TABS.some((x) => x[0] === q.t) ? q.t! : "dashboard", period: Period = q.p === "h" || q.p === "w" ? q.p : "m";
  const d = await buildSummary(s, q.h || null, period);
  const owner = s.role === "owner", max = Math.max(1, ...d.trend.map((t) => t.v));
  const url = (o: { t?: string; p?: string; h?: string | null }) => { const u = new URLSearchParams(); const t = o.t ?? tab, p = o.p ?? period, h = o.h === undefined ? d.hotel?.id : o.h; if (t !== "dashboard") u.set("t", t); if (p !== "m") u.set("p", p); if (h) u.set("h", h); const x = u.toString(); return "/executive" + (x ? "?" + x : ""); };
  const order = (owner ? ["finance", "budget", "crm", "hris", "ops"] : ["ops", "hris", "crm", "budget", "finance"]).filter((k) => MODULES[k]);
  const pending = d.approvals.length, urgent = d.issues.filter((i) => i.sev === 1).length;
  const bw = d.trend.length > 8 ? 9 : 36, step = 320 / d.trend.length;
  return (
    <div className="cs-page"><main className="cs-wrap" style={{ paddingBottom: 120 }}>
      <div className="cs-top"><Brand suffix="Executive" /><span className="cs-badge">{owner ? "Owner" : "General Manager"} · {s.name}</span></div>

      {tab === "dashboard" && <>
        <section className="cs-hero">
          <h1>{owner ? "Selamat datang, Owner" : "Selamat datang, GM"}</h1>
          <p>{owner ? "Kinerja keuangan dan penjualan seluruh hotel Anda." : "Kondisi operasional dan tim hari ini."} {urgent ? `${urgent} isu mendesak.` : "Tidak ada isu mendesak."}</p>
          <div className="cs-chips">{(["h", "w", "m"] as Period[]).map((x) => <Link key={x} href={url({ p: x })} className={"cs-chip" + (period === x ? " on" : "")}>{x === "h" ? "Hari ini" : x === "w" ? "7 hari" : "Bulan ini"}</Link>)}</div>
          {d.hotels.length > 1 && <div className="cs-chips"><Link href={url({ h: null })} className={"cs-chip" + (!d.hotel ? " on" : "")}>Semua hotel</Link>{d.hotels.map((x) => <Link key={x.id} href={url({ h: x.id })} className={"cs-chip" + (d.hotel?.id === x.id ? " on" : "")}>{x.name}</Link>)}</div>}
        </section>
        {d.kpis.length > 0 && <div className="cs-kpis">{d.kpis.map((k) => { const [c, ic] = KC[k.k || "rev"]; return (
          <div key={k.l} className="cs-glass cs-kpi cs-tint" style={{ ["--c" as string]: c }}><span className="cs-kic">{ic}</span><small>{k.l}</small><b style={{ color: k.tone ? TONE[k.tone] : undefined }}>{k.v}</b>
            {k.d != null && <em className={k.d >= 0 ? "cs-up" : "cs-dn"}>{k.d >= 0 ? "▲" : "▼"} {Math.abs(k.d)}% vs periode lalu</em>}</div>); })}</div>}
        <div className="cs-duo">
          {d.trend.some((t) => t.v > 0) && <section className="cs-glass"><b>{d.trendTitle}</b>
            <svg viewBox="0 0 320 130" role="img" aria-label={d.trendTitle} style={{ width: "100%", marginTop: 10 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1c768" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs>
              {d.trend.map((t, i) => { const bh = (t.v / max) * 92, x = i * step + (step - bw) / 2; return <g key={i}><rect x={x} y={104 - bh} width={bw} height={Math.max(bh, 1)} rx={Math.min(6, bw / 2)} fill="url(#g)" />{t.label && <text x={x + bw / 2} y={122} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".7">{t.label}</text>}</g>; })}
            </svg></section>}
          {d.occ !== null && <section className="cs-glass cs-ringbox"><b>Okupansi</b>
            <svg viewBox="0 0 120 120" role="img" aria-label={`Okupansi ${d.occ}%`} style={{ width: 150, margin: "8px auto 0", display: "block" }}>
              <defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a98bff" /><stop offset="1" stopColor="#3be0a8" /></linearGradient></defs>
              <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="12" />
              <circle cx="60" cy="60" r="48" fill="none" stroke="url(#r)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(Math.min(d.occ, 100) / 100) * 301.6} 301.6`} transform="rotate(-90 60 60)" />
              <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill="currentColor">{d.occ}%</text></svg>
            <small className="cs-mu" style={{ textAlign: "center", display: "block" }}>dari kamar yang dijual (status Ops)</small></section>}
        </div>
        <h2 className="cs-h2">Isu utama</h2>
        <section className="cs-glass">
          {d.issues.length ? d.issues.map((i, k) => <Link key={k} href={MODULES[i.mod].href} className="cs-issue"><span className="cs-dot" style={{ background: SEV[i.sev] }} /><div><span className="cs-badge" style={{ borderColor: MODULES[i.mod].color, color: MODULES[i.mod].color }}>{MODULES[i.mod].short}</span> <span className="cs-mu" style={{ fontSize: 12 }}>{SEVL[i.sev]}</span><div>{i.text}</div></div></Link>)
            : <p className="cs-mu" style={{ margin: 0 }}>{d.mods.some((m) => m.status !== "none") ? "Tidak ada isu yang terdeteksi saat ini." : "Belum ada data untuk dianalisis. Mulai isi aplikasi lewat tab Aplikasi."}</p>}
        </section>
        <h2 className="cs-h2">Highlight departemen</h2>
        <div className="cs-grid">{order.map((k) => { const m = MODULES[k], sm = d.mods.find((x) => x.key === k), on = d.lic.includes(k), st = (sm?.status || "none") as Tone | "none";
          return on ? (
            <Link key={k} href={m.href} className="cs-glass cs-app cs-tint" style={{ ["--c" as string]: m.color }}>
              <div className="cs-row"><span className="cs-ic">{m.icon}</span><div style={{ flex: 1 }}><b>{m.name}</b><div className="cs-mu" style={{ fontSize: 13 }}><span className="cs-dot" style={{ background: TONE[st], display: "inline-block", marginRight: 6 }} />{LBL[st]}</div></div></div>
              {sm?.stats.length ? <div className="cs-stats">{sm.stats.map((x) => <div key={x.l}><small>{x.l}</small><b style={{ color: x.tone ? TONE[x.tone] : undefined }}>{x.v}{x.d != null ? <em className={x.d >= 0 ? "cs-up" : "cs-dn"}> {x.d >= 0 ? "▲" : "▼"}{Math.abs(x.d)}%</em> : null}</b></div>)}</div> : <small>{sm?.note || "Belum ada data."}</small>}
            </Link>) : <div key={k} className="cs-glass cs-app cs-off" style={{ ["--c" as string]: m.color }}><span className="cs-ic">🔒</span><b>{m.name}</b><small>Belum aktif pada lisensi</small></div>; })}</div>
        <p className="cs-mu" style={{ fontSize: 12, marginTop: 16 }}>Diperbarui {d.updated} WIB. Data dihitung langsung dari aplikasi saat halaman dibuka.</p>
      </>}

      {tab === "aplikasi" && <>
        <section className="cs-hero"><h1>Semua aplikasi</h1><p>Buka ringkasan dan laporan dari tiap aplikasi CoreStay. Aplikasi yang belum berlisensi terkunci.</p></section>
        <div className="cs-grid">{Object.keys(MODULES).map((k) => { const m = MODULES[k], on = d.lic.includes(k), sm = d.mods.find((x) => x.key === k);
          return on ? <Link key={k} href={m.href} className="cs-glass cs-app cs-tint" style={{ ["--c" as string]: m.color }}><div className="cs-row"><span className="cs-ic">{m.icon}</span><div style={{ flex: 1 }}><b>{m.name}</b><div className="cs-mu" style={{ fontSize: 13 }}>{m.desc}</div></div></div><small>{MENU[k]}</small><span className="cs-badge" style={{ alignSelf: "flex-start" }}>{LBL[(sm?.status || "none") as string]}</span></Link>
            : <div key={k} className="cs-glass cs-app cs-off" style={{ ["--c" as string]: m.color }}><span className="cs-ic">🔒</span><b>{m.name}</b><small>Belum aktif pada lisensi. Hubungi CoreStay untuk mengaktifkan.</small></div>; })}</div>
      </>}

      {tab === "approval" && <>
        <section className="cs-hero"><h1>Menunggu persetujuan</h1><p>{pending ? `${pending} permintaan perlu keputusan Anda.` : "Tidak ada permintaan yang menunggu."} Persetujuan dilakukan di aplikasi masing-masing.</p></section>
        {d.approvals.map((a, i) => <Link key={i} href={MODULES[a.mod].href} className="cs-glass cs-app cs-tint" style={{ ["--c" as string]: MODULES[a.mod].color, marginBottom: 12 }}><span className="cs-badge" style={{ alignSelf: "flex-start", borderColor: MODULES[a.mod].color }}>{MODULES[a.mod].short}</span><b>{a.title}</b><small className="cs-mu">{a.meta}</small><span className="cs-ghost" style={{ alignSelf: "flex-start" }}>Buka dan putuskan ›</span></Link>)}
        {!pending && <section className="cs-glass"><p className="cs-mu" style={{ margin: 0 }}>Sumber persetujuan saat ini: tagihan vendor berstatus Menunggu (Finance) dan payroll yang sudah diajukan (HRIS).</p></section>}
      </>}

      {tab === "laporan" && <>
        <section className="cs-hero"><h1>Pusat laporan</h1><p>Ringkasan laporan dari aplikasi yang aktif. Buka aplikasinya untuk laporan lengkap dan unduhan.</p></section>
        {Object.keys(MODULES).filter((k) => d.lic.includes(k)).map((k) => { const m = MODULES[k], sm = d.mods.find((x) => x.key === k);
          return <section key={k} className="cs-glass cs-tint" style={{ ["--c" as string]: m.color, marginBottom: 12 }}><div className="cs-row"><span className="cs-ic">{m.icon}</span><div style={{ flex: 1 }}><b>{m.name}</b></div><Link href={m.href} className="cs-ghost">Buka ›</Link></div>
            {REPORTS[k].map((r) => <details key={r} className="cs-det"><summary>{r}</summary>{sm?.stats.length ? <div className="cs-stats" style={{ marginTop: 10 }}>{sm.stats.map((x) => <div key={x.l}><small>{x.l}</small><b>{x.v}</b></div>)}</div> : <p className="cs-mu" style={{ margin: "8px 0 0" }}>{sm?.note || "Belum ada data."}</p>}</details>)}</section>; })}
      </>}

      {tab === "pengaturan" && <>
        <section className="cs-hero"><h1>Pengaturan</h1><p>Akun, lisensi, dan tim Anda.</p></section>
        <section className="cs-glass"><b>Akun</b><p className="cs-mu" style={{ margin: "6px 0 0" }}>{s.name} · {owner ? "Owner" : "General Manager"}{d.hotel ? ` · ${d.hotel.name}` : d.hotels.length ? ` · ${d.hotels.length} hotel` : ""}</p></section>
        <h2 className="cs-h2">Lisensi</h2>
        <section className="cs-glass"><p className="cs-mu" style={{ margin: 0 }}>{d.license ? `Kode ${d.license.code}${d.license.expires ? ` · berlaku sampai ${d.license.expires}` : " · tanpa batas waktu"}` : "Belum ada lisensi aktif."}</p>
          <div className="cs-chips">{Object.keys(MODULES).map((k) => <span key={k} className={"cs-chip" + (d.lic.includes(k) ? " on" : "")} style={{ cursor: "default" }}>{d.lic.includes(k) ? "✓ " : "🔒 "}{MODULES[k].short}</span>)}</div>
          <p className="cs-mu" style={{ fontSize: 13, marginBottom: 0 }}>Modul diaktifkan oleh admin CoreStay. Hubungi CoreStay untuk menambah modul atau memperpanjang.</p></section>
        <h2 className="cs-h2">Tim dan login</h2>
        <Link href="/team" className="cs-glass cs-app" style={{ ["--c" as string]: "#7c5cff" }}><span className="cs-ic">🔑</span><b>Kelola tim</b><small>Buat login Housekeeping, Engineering, Sales, dan tim lain.</small></Link>
        <form method="post" action="/api/logout" style={{ marginTop: 14 }}><button className="cs-ghost">Keluar</button></form>
      </>}

      <nav className="cs-bnav" aria-label="Menu Executive">
        {TABS.map(([k, ic, l]) => <Link key={k} href={url({ t: k })} className={tab === k ? "on" : ""}><span>{ic}</span>{l}{k === "approval" && pending > 0 ? <i>{pending}</i> : null}</Link>)}
      </nav>
    </main></div>
  );
}
