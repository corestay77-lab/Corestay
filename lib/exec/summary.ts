import { sql } from "@/lib/db";
import type { Sess } from "@/lib/auth";
import { tenantModules } from "@/lib/data";
import { getDoc as finDoc } from "@/lib/finance/store";
import { getDoc as opsDoc } from "@/lib/ops/store";
import { getDoc as crmDoc } from "@/lib/crm/store";
import { resolveHotel, type H } from "@/lib/hoteldoc";

export type Tone = "ok" | "warn" | "bad";
export type Stat = { l: string; v: string; tone?: Tone };
export type Issue = { sev: 1 | 2 | 3; mod: string; text: string };
export type ModSum = { key: string; status: Tone | "none"; stats: Stat[]; note?: string };
export type Summary = { hotels: H[]; hotel: H | null; lic: string[]; kpis: Stat[]; issues: Issue[]; mods: ModSum[]; trend: { label: string; v: number }[] };

const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);
export const rp = (n: number) => { const a = Math.abs(n), s = n < 0 ? "-" : ""; const f = (v: number, d: number) => v.toLocaleString("id-ID", { maximumFractionDigits: d });
  return a >= 1e9 ? `${s}Rp ${f(a / 1e9, 2)} M` : a >= 1e6 ? `${s}Rp ${f(a / 1e6, 1)} jt` : `${s}Rp ${f(Math.round(a), 0)}`; };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const BL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const worst = (is: Issue[], mod: string): Tone => { const m = Math.min(9, ...is.filter((i) => i.mod === mod).map((i) => i.sev)); return m === 1 ? "bad" : m === 2 ? "warn" : "ok"; };
const tot = (i: any) => Math.round(num(i.amount) * (100 + num(i.svc)) * (100 + num(i.tax)) / 100) / 100;

// Ringkasan dihitung dari data asli tiap modul. Setiap modul dibungkus try/catch: satu modul bermasalah tidak menjatuhkan dashboard.
export async function buildSummary(s: Sess, wanted: string | null): Promise<Summary> {
  const lic = await tenantModules(s.tid);
  const { hotel: first, hotels } = await resolveHotel(s, null);
  const pool = s.role === "owner" ? hotels : first ? [first] : [];
  const sel = wanted && wanted !== "all" ? pool.find((h) => h.id === wanted) || null : s.role === "owner" ? null : first;
  const targets = sel ? [sel] : pool;
  const td = today(), ym = td.slice(0, 7), pm = addDays(ym + "-01", -1).slice(0, 7);
  const issues: Issue[] = [], mods: ModSum[] = [], kpi: Record<string, Stat> = {};
  let trend: { label: string; v: number }[] = [];
  const none = (key: string, note: string) => mods.push({ key, status: "none", stats: [], note });

  if (lic.includes("finance")) try {
    const d = await finDoc(s.tid);
    if (!d) none("finance", "Belum ada data. Mulai catat transaksi di Finance."); else {
      const S: any = d.data, hn = sel?.name || null, hf = (r: any) => !hn || r.hotel === hn;
      const tx: any[] = (S.tx || []).filter(hf), inv: any[] = (S.inv || []).filter(hf), bills: any[] = (S.bills || []).filter(hf);
      const grp = (m: string, type: string, p: string) => sum(tx.filter((t) => t.type === type && String(t.cat || "").startsWith(p) && String(t.date || "").startsWith(m)), (t) => num(t.amount));
      const rev = grp(ym, "in", "rev-"), revP = grp(pm, "in", "rev-");
      const cost = grp(ym, "out", "dx-") + grp(ym, "out", "ux-"), gop = rev - cost, margin = rev > 0 ? Math.round((gop / rev) * 100) : 0;
      const cash = sum(S.acc || [], (a: any) => num(a.open)) + sum(S.tx || [], (t: any) => (t.type === "in" ? num(t.amount) : -num(t.amount)));
      const open = inv.filter((i) => i.status === "Terkirim"), over = open.filter((i) => String(i.due) < td), over30 = open.filter((i) => String(i.due) < addDays(td, -30));
      const ap = bills.filter((b) => b.status === "Menunggu" || b.status === "Disetujui"), apOver = ap.filter((b) => String(b.due) < td);
      const apSoon = ap.filter((b) => String(b.due) >= td && String(b.due) <= addDays(td, 7));
      if (cash < 0) issues.push({ sev: 1, mod: "finance", text: `Saldo kas total negatif (${rp(cash)})` });
      if (over30.length) issues.push({ sev: 1, mod: "finance", text: `${over30.length} invoice lewat jatuh tempo lebih dari 30 hari (${rp(sum(over30, tot))})` });
      else if (over.length) issues.push({ sev: 2, mod: "finance", text: `${over.length} invoice melewati jatuh tempo (${rp(sum(over, tot))})` });
      if (apOver.length) issues.push({ sev: 2, mod: "finance", text: `${apOver.length} tagihan vendor lewat jatuh tempo (${rp(sum(apOver, (b) => num(b.amount)))})` });
      if (apSoon.length) issues.push({ sev: 3, mod: "finance", text: `${apSoon.length} tagihan vendor jatuh tempo 7 hari ke depan (${rp(sum(apSoon, (b) => num(b.amount)))})` });
      if (revP > 0 && rev < revP * 0.9 && td.slice(8) >= "20") issues.push({ sev: 3, mod: "finance", text: `Pendapatan bulan ini ${pct(rev, revP)}% dari bulan lalu` });
      const t6 = [...Array(6)].map((_, k) => { const dt = new Date(td.slice(0, 7) + "-01T00:00:00Z"); dt.setUTCMonth(dt.getUTCMonth() - (5 - k)); return dt.toISOString().slice(0, 7); });
      trend = t6.map((m) => ({ label: BL[Number(m.slice(5)) - 1], v: grp(m, "in", "rev-") }));
      kpi.rev = { l: "Pendapatan bulan ini", v: rp(rev), tone: revP > 0 && rev < revP * 0.9 ? "warn" : undefined };
      kpi.cash = { l: "Saldo kas", v: rp(cash), tone: cash < 0 ? "bad" : undefined };
      kpi.ar = { l: "Piutang jatuh tempo", v: rp(sum(over, tot)), tone: over30.length ? "bad" : over.length ? "warn" : "ok" };
      mods.push({ key: "finance", status: "ok", stats: [{ l: "Pendapatan bulan ini", v: rp(rev) }, { l: "GOP bulan ini", v: rev > 0 ? `${margin}%` : "-", tone: rev > 0 && margin < 30 ? "warn" : undefined }, { l: "Piutang berjalan", v: rp(sum(open, tot)) }, { l: "Utang vendor", v: rp(sum(ap, (b) => num(b.amount))) }], note: hn ? undefined : "Saldo kas mencakup semua hotel." });
    }
  } catch (e) { console.error("exec finance", e); none("finance", "Data belum bisa dibaca."); }

  if (lic.includes("ops")) try {
    const docs = (await Promise.all(targets.map((h) => opsDoc(s.tid, h.id)))).filter(Boolean) as { data: any }[];
    if (!docs.length) none("ops", "Belum ada data. Buka aplikasi Ops untuk memulai."); else {
      const now = Date.now(); let rooms = 0, occ = 0, ooo = 0, ready = 0, dirty = 0, wo = 0, urg = 0, late = 0, oooLong = 0;
      for (const { data: S } of docs) {
        const R: any[] = S.rooms || []; rooms += R.length;
        occ += R.filter((r) => r.s === "OC" || r.s === "OD").length; ooo += R.filter((r) => r.s === "OOO" || r.s === "OOS").length;
        ready += R.filter((r) => r.s === "VC" || r.s === "VI").length; dirty += R.filter((r) => r.s === "VD" || r.s === "OD").length;
        oooLong += R.filter((r) => r.s === "OOO" && r.ooo?.since && now - num(r.ooo.since) > 5 * 864e5).length;
        const open = (S.wo || []).filter((w: any) => !w.done && !["Done", "Completed", "Closed", "Cancelled", "Selesai", "Batal"].includes(w.st));
        wo += open.length; urg += open.filter((w: any) => w.pr === "Urgent").length; late += open.filter((w: any) => num(w.due) && num(w.due) < now).length;
      }
      const sell = rooms - ooo, occP = pct(occ, sell);
      if (urg) issues.push({ sev: 1, mod: "ops", text: `${urg} work order Urgent belum selesai` });
      if (late) issues.push({ sev: 2, mod: "ops", text: `${late} work order melewati batas waktu` });
      if (oooLong) issues.push({ sev: 3, mod: "ops", text: `${oooLong} kamar Out of Order lebih dari 5 hari` });
      kpi.occ = { l: "Okupansi", v: `${occP}%` };
      mods.push({ key: "ops", status: "ok", stats: [{ l: "Okupansi", v: `${occP}%` }, { l: "Kamar siap jual", v: `${ready} dari ${rooms}` }, { l: "Kamar kotor", v: String(dirty) }, { l: "Work order terbuka", v: String(wo), tone: urg ? "bad" : late ? "warn" : undefined }] });
    }
  } catch (e) { console.error("exec ops", e); none("ops", "Data belum bisa dibaca."); }

  if (lic.includes("crm")) try {
    const docs = (await Promise.all(targets.map((h) => crmDoc(s.tid, h.id)))).filter(Boolean) as { data: any }[];
    if (!docs.length) none("crm", "Belum ada data. Buka aplikasi Sales CRM untuk memulai."); else {
      let pipe = 0, won = 0, leads = 0, tasks = 0, tg = 0, ac = 0; const rate: number[] = []; let neg = 0;
      for (const { data: S } of docs) {
        const O: any[] = S.opps || []; pipe += sum(O.filter((o) => !["Won", "Lost"].includes(o.st)), (o) => num(o.v)); won += sum(O.filter((o) => o.st === "Won"), (o) => num(o.v));
        leads += (S.leads || []).length; tasks += (S.tasks || []).filter((t: any) => !t.x).length;
        for (const t of S.team || []) { tg += num(t.tg); ac += num(t.ac); }
        for (const r of S.reviews || []) { rate.push(num(r.s)); if (num(r.s) > 0 && num(r.s) <= 2 && r.st === "To Respond") neg++; }
      }
      const avg = rate.length ? rate.reduce((a, b) => a + b, 0) / rate.length : 0;
      if (neg) issues.push({ sev: 2, mod: "crm", text: `${neg} ulasan negatif belum dibalas` });
      if (tg > 0 && pct(ac, tg) < 70) issues.push({ sev: 3, mod: "crm", text: `Pencapaian target sales ${pct(ac, tg)}%` });
      if (rate.length) kpi.rating = { l: "Rating tamu", v: `${avg.toFixed(1).replace(".", ",")} / 5`, tone: avg < 4 ? "warn" : "ok" };
      mods.push({ key: "crm", status: "ok", stats: [{ l: "Pipeline", v: rp(pipe * 1e6) }, { l: "Penjualan menang", v: rp(won * 1e6) }, { l: "Rating rata-rata", v: rate.length ? `${avg.toFixed(1).replace(".", ",")} / 5` : "-" }, { l: "Lead dan tugas terbuka", v: `${leads} dan ${tasks}` }] });
    }
  } catch (e) { console.error("exec crm", e); none("crm", "Data belum bisa dibaca."); }

  if (lic.includes("hris")) try {
    const hs = await sql.query(`select id, data from hr_hotel where tenant_id=$1 ${sel ? "and id=$2" : ""}`, sel ? [s.tid, sel.id] : [s.tid]);
    if (!hs.length) none("hris", "Belum ada data. Buka HRIS untuk memulai."); else {
      const ids = hs.map((h) => h.id as string);
      const emps = hs.flatMap((h) => ((h.data as any)?.emps || []) as any[]).filter((e) => e.status === "Aktif");
      const att = await sql.query("select status, coalesce(late_min,0) as late from hr_att where hotel_id = any($1::text[]) and work_date = $2", [ids, td]);
      const hadir = att.filter((a) => a.status === "Hadir").length, alpa = att.filter((a) => a.status === "Alpa").length, telat = att.filter((a) => num(a.late) > 0).length;
      const rate = pct(hadir, emps.length);
      if (att.length && emps.length >= 5 && rate < 85) issues.push({ sev: 2, mod: "hris", text: `Kehadiran hari ini ${rate}% (${hadir} dari ${emps.length} karyawan)` });
      if (alpa) issues.push({ sev: 2, mod: "hris", text: `${alpa} karyawan tanpa keterangan hari ini` });
      if (att.length) kpi.att = { l: "Kehadiran hari ini", v: `${rate}%`, tone: rate < 85 ? "warn" : "ok" };
      mods.push({ key: "hris", status: "ok", stats: [{ l: "Karyawan aktif", v: String(emps.length) }, { l: "Hadir hari ini", v: att.length ? `${hadir} (${rate}%)` : "belum ada absen" }, { l: "Terlambat", v: String(telat) }, { l: "Gaji pokok per bulan", v: rp(sum(emps, (e) => num(e.basic))) }], note: "Gaji pokok adalah jumlah gaji pokok karyawan aktif, belum termasuk tunjangan dan potongan." });
    }
  } catch (e) { console.error("exec hris", e); none("hris", "Data belum bisa dibaca."); }

  if (lic.includes("budget")) try {
    const [r] = await sql.query("select file_name, report_json, created_at from budget_report where tenant_id=$1 order by created_at desc limit 1", [s.tid]);
    if (!r) none("budget", "Belum ada laporan final. Susun di Hotel Budget."); else {
      const c: any = r.report_json?.calculated_data || {}, pick = (v: any) => (typeof v === "number" ? v : v && typeof v === "object" ? (v.budget ?? v.actual ?? null) : null);
      const revenue = pick(c.revenue), g = pick(c.gop), gm = pick(c.gopMargin);
      mods.push({ key: "budget", status: "ok", stats: [{ l: "Laporan terakhir", v: String(r.file_name || "-") }, { l: "Pendapatan anggaran", v: revenue == null ? "-" : rp(revenue) }, { l: "GOP anggaran", v: g == null ? "-" : rp(g) }, { l: "Margin GOP", v: gm == null ? "-" : `${Number(gm).toFixed(1).replace(".", ",")}%` }] });
    }
  } catch (e) { console.error("exec budget", e); none("budget", "Data belum bisa dibaca."); }

  issues.sort((a, b) => a.sev - b.sev);
  for (const m of mods) if (m.status === "ok") m.status = worst(issues, m.key);
  const kpis = ["rev", "occ", "cash", "ar", "att", "rating"].map((k) => kpi[k]).filter(Boolean) as Stat[];
  return { hotels: pool, hotel: sel, lic, kpis, issues, mods, trend };
}
