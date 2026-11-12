import { NextResponse } from "next/server";
import { audit, currentUser, userModules } from "@/lib/data";
import { putDoc, resolveHotel } from "@/lib/ops/store";

export const dynamic = "force-dynamic";
const json = (b: object, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

export async function PUT(req: Request) {
  const s = await currentUser(); if (!s) return json({ error: "Belum login." }, 401);
  if (!(await userModules(s.tid, s.uid, s.role)).includes("ops")) return json({ error: "Tidak punya akses Ops." }, 403);
  const raw = await req.text();
  if (raw.length > 4_000_000) return json({ error: "Data terlalu besar untuk disimpan (batas 4 MB). Hubungi admin." }, 413);
  let b: { hotel?: string; version?: number; data?: { v?: number; rooms?: unknown; wo?: unknown; staff?: unknown } };
  try { b = JSON.parse(raw); } catch { return json({ error: "Format tidak valid." }, 400); }
  // Hotel yang dituju harus hotel yang memang boleh diakses pengguna ini.
  const { hotel } = await resolveHotel(s, b?.hotel);
  if (!hotel || hotel.id !== b?.hotel) return json({ error: "Hotel tidak valid untuk akun Anda." }, 403);
  const d = b.data;
  if (!d || d.v !== 1 || !Array.isArray(d.rooms) || !Array.isArray(d.wo) || !Array.isArray(d.staff)) return json({ error: "Struktur data tidak valid." }, 400);
  const r = await putDoc(s.tid, hotel.id, Number(b.version) || 0, d, s.uid);
  if (!r.ok) return json({ error: "Data sudah diubah pengguna lain." }, 409);
  if (r.version === 1) await audit(s.tid, s.uid, "ops.init", { hotel: hotel.id });
  return json({ version: r.version });
}
