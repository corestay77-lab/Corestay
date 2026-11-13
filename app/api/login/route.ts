import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkPassword, signSession } from "@/lib/auth";
import { audit, userModules } from "@/lib/data";
import { MODULES } from "@/lib/modules";

const fail = () => NextResponse.json({ ok: false }, { status: 401 });

export async function POST(req: Request) {
  try { return await handle(req); }
  catch (e) { console.error("login", e); return NextResponse.json({ ok: false, error: "server" }, { status: 500 }); }
}

async function handle(req: Request) {
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug || "").trim().toLowerCase(), username = String(b?.username || "").trim().toLowerCase(), password = String(b?.password || "");
  if (!username || !password) return fail();
  // Kode klien boleh kosong: akun dicari di semua klien aktif, lalu dipastikan lewat password.
  // Bila diisi, pencarian dibatasi pada klien itu (cara lama tetap berlaku).
  const rows = await sql.query(
    "select u.id,u.pass_hash,u.role,u.username,u.tenant_id from users u join tenants t on t.id=u.tenant_id where t.status='active' and u.active and lower(u.username)=$1 and ($2::text='' or t.slug=$2::text) limit 10",
    [username, slug]);
  const ok = rows.filter((r) => checkPassword(password, r.pass_hash));
  if (ok.length > 1) return NextResponse.json({ ok: false, error: "ambiguous" }, { status: 409 });
  if (ok.length === 0) return fail();
  const u = ok[0], tid = u.tenant_id as string;
  // Pengguna (staf, GM, Owner) yang hanya punya satu aplikasi langsung masuk ke aplikasi itu; selainnya ke beranda.
  const mods = await userModules(tid, u.id, u.role);
  const to = mods.length === 1 ? (MODULES[mods[0]]?.href || "/m/" + mods[0]) : "/";
  const res = NextResponse.json({ ok: true, to });
  res.cookies.set("cs", signSession({ uid: u.id, tid, role: u.role, name: u.username, exp: Date.now() + 12 * 3600e3 }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 3600 });
  await audit(tid, u.id, "login");
  return res;
}
