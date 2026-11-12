import { NextResponse } from "next/server";
import { audit, currentUser, userModules } from "@/lib/data";
import { getDoc, putDoc } from "@/lib/finance/store";

export const dynamic = "force-dynamic";
const json = (b: object, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });
async function who() {
  const s = await currentUser(); if (!s) return { err: json({ error: "Belum login." }, 401) };
  if (!(await userModules(s.tid, s.uid, s.role)).includes("finance")) return { err: json({ error: "Tidak punya akses Finance." }, 403) };
  return { s };
}

export async function GET() {
  const a = await who(); if (a.err) return a.err;
  const d = await getDoc(a.s!.tid);
  return json({ data: d?.data ?? null, version: d?.version ?? 0 });
}

export async function PUT(req: Request) {
  const a = await who(); if (a.err) return a.err;
  const raw = await req.text();
  if (raw.length > 4_000_000) return json({ error: "Data terlalu besar untuk disimpan (batas 4 MB). Hubungi admin." }, 413);
  let b: { version?: number; data?: { v?: number; acc?: unknown; inv?: unknown; bills?: unknown; tx?: unknown } };
  try { b = JSON.parse(raw); } catch { return json({ error: "Format tidak valid." }, 400); }
  const d = b?.data;
  if (!d || d.v !== 2 || !Array.isArray(d.acc) || !Array.isArray(d.inv) || !Array.isArray(d.bills) || !Array.isArray(d.tx)) return json({ error: "Struktur data tidak valid." }, 400);
  const r = await putDoc(a.s!.tid, Number(b.version) || 0, d, a.s!.uid);
  if (!r.ok) return json({ error: "Data sudah diubah pengguna lain." }, 409);
  if (r.version === 1) await audit(a.s!.tid, a.s!.uid, "finance.init");
  return json({ version: r.version });
}
