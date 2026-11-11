import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit, currentUser, listUsers, tenantModules } from "@/lib/data";
const HOTELS = (tid: string) => sql.query("select id,name from hotels where tenant_id=$1 order by name", [tid]);

const deny = () => NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
// Hanya Owner dan GM yang boleh mengelola tim; tenant_id selalu dari sesi.
async function actor() { const s = await currentUser(); return s && s.role !== "staff" ? s : null; }

export async function GET() {
  const s = await actor(); if (!s) return deny();
  return NextResponse.json({ users: await listUsers(s.tid), modules: await tenantModules(s.tid), hotels: await HOTELS(s.tid), me: s.uid, role: s.role });
}

export async function POST(req: Request) {
  const s = await actor(); if (!s) return deny();
  const b = (await req.json().catch(() => null)) || {};
  const username = String(b.username || "").trim().toLowerCase(), password = String(b.password || ""), role = b.role === "gm" ? "gm" : "staff";
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return bad("Username 3-30 karakter: huruf, angka, titik, atau strip.");
  if (password.length < 10) return bad("Password minimal 10 karakter.");
  if (role === "gm" && s.role !== "owner") return deny();
  const lic = await tenantModules(s.tid);
  const mods = (Array.isArray(b.modules) ? b.modules : []).filter((m: string) => lic.includes(m));
  if (role === "staff" && !mods.length) return bad("Pilih minimal satu aplikasi untuk staf.");
  // Staf dan GM terikat ke satu hotel; bila klien hanya punya satu hotel, otomatis ke hotel itu.
  const hs = await HOTELS(s.tid); let hid = String(b.hotelId || "");
  if (hid && !hs.some((h) => String(h.id) === hid)) return bad("Hotel tidak valid.");
  if (!hid && hs.length === 1) hid = String(hs[0].id);
  if (!hid && hs.length > 1) return bad("Pilih hotel untuk pengguna ini.");
  try { await sql.query("insert into users(tenant_id,username,pass_hash,role,modules,hotel_ids) values($1,$2,$3,$4,$5,$6)", [s.tid, username, hashPassword(password), role, mods, hid ? [hid] : []]); }
  catch { return bad("Username sudah dipakai.", 409); }
  await audit(s.tid, s.uid, "user.create", { username, role, mods });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const s = await actor(); if (!s) return deny();
  const b = (await req.json().catch(() => null)) || {};
  if (!/^[0-9a-f-]{36}$/.test(String(b.id || ""))) return bad("ID tidak valid.");
  const [t] = await sql.query("select role from users where id=$1 and tenant_id=$2", [b.id, s.tid]);
  // Owner tidak bisa diubah lewat sini; GM hanya boleh mengelola staf; tidak boleh mengubah diri sendiri.
  if (!t || t.role === "owner" || b.id === s.uid || (s.role === "gm" && t.role !== "staff")) return deny();
  if (b.action === "toggle") await sql.query("update users set active = not active where id=$1 and tenant_id=$2", [b.id, s.tid]);
  else if (b.action === "reset") {
    const p = String(b.password || ""); if (p.length < 10) return bad("Password minimal 10 karakter.");
    await sql.query("update users set pass_hash=$1 where id=$2 and tenant_id=$3", [hashPassword(p), b.id, s.tid]);
  } else if (b.action === "modules") {
    const lic = await tenantModules(s.tid);
    await sql.query("update users set modules=$1 where id=$2 and tenant_id=$3", [(Array.isArray(b.modules) ? b.modules : []).filter((m: string) => lic.includes(m)), b.id, s.tid]);
  } else if (b.action === "hotel") {
    const hs = await HOTELS(s.tid); if (!hs.some((h) => String(h.id) === String(b.hotelId))) return bad("Hotel tidak valid.");
    await sql.query("update users set hotel_ids=$1 where id=$2 and tenant_id=$3", [[String(b.hotelId)], b.id, s.tid]);
  } else return bad("Aksi tidak dikenal.");
  await audit(s.tid, s.uid, "user." + b.action, { id: b.id });
  return NextResponse.json({ ok: true });
}
