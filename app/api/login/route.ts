import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkPassword, signSession } from "@/lib/auth";
import { audit, userModules } from "@/lib/data";
import { MODULES } from "@/lib/modules";
import { clientIp, failLogin, lockedFor, okLogin } from "@/lib/throttle";

const fail = () => NextResponse.json({ ok: false }, { status: 401 });
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function POST(req: Request) {
  try { return await handle(req); }
  catch (e) {
    console.error("login", e);
    const m = String((e as Error)?.message || e);
    const hint = m.includes("SESSION_SECRET") ? "SESSION_SECRET belum diisi atau kurang dari 32 karakter di Vercel (Settings, Environment Variables), lalu Redeploy."
      : m.includes("DATABASE_URL") ? "DATABASE_URL belum terhubung. Hubungkan database di Vercel (Storage), lalu Redeploy."
      : /relation .* does not exist/.test(m) ? "Tabel database belum dibuat. Buat klien pertama lewat Aplikasi Lisensi (atau halaman /setup)."
      : "Server bermasalah. Buka halaman /status untuk memeriksa pengaturan.";
    return NextResponse.json({ ok: false, error: "server", hint }, { status: 500 });
  }
}

async function handle(req: Request) {
  const b = await req.json().catch(() => null);
  const hotelIn = norm(String(b?.hotel || b?.slug || "")), username = String(b?.username || "").trim().toLowerCase(), password = String(b?.password || "");
  if (!hotelIn || !username || !password) return fail();
  const ip = clientIp(req), acct = hotelIn + "|" + username;
  const wait = await lockedFor(ip, acct);
  if (wait) return NextResponse.json({ ok: false, error: "locked", minutes: Math.ceil(wait / 60) }, { status: 429 });
  // Nama hotel dicocokkan ke klien: bisa nama hotel, nama klien, atau kode klien (harus tepat satu klien aktif).
  const ts = await sql.query(
    "select t.id, (select h.id::text from hotels h where h.tenant_id=t.id and lower(trim(h.name))=$1 limit 1) as hid from tenants t where t.status='active' and (lower(t.slug)=$1 or lower(trim(t.name))=$1 or exists(select 1 from hotels h where h.tenant_id=t.id and lower(trim(h.name))=$1))", [hotelIn]);
  const t = ts.length === 1 ? ts[0] : null;
  const [u] = t ? await sql.query("select id,pass_hash,role,username,hotel_ids from users where tenant_id=$1 and lower(username)=$2 and active", [t.id, username]) : [];
  // GM dan staf yang terikat ke hotel tertentu hanya bisa masuk lewat nama hotelnya sendiri.
  const mine = u ? ((u.hotel_ids as string[]) || []).map(String) : [];
  const wrongHotel = !!(t && u && t.hid && u.role !== "owner" && mine.length && !mine.includes(String(t.hid)));
  if (!t || !u || wrongHotel || !checkPassword(password, u.pass_hash)) { await failLogin(ip, acct); return fail(); }
  await okLogin(acct);
  // Langsung ke aplikasi sesuai izin: staf dengan satu aplikasi masuk ke aplikasi itu; selainnya ke beranda.
  const mods = await userModules(t.id, u.id, u.role);
  const to = u.role === "staff" && mods.length === 1 ? (MODULES[mods[0]]?.href || "/m/" + mods[0]) : "/";
  const res = NextResponse.json({ ok: true, to });
  res.cookies.set("cs", signSession({ uid: u.id, tid: t.id, role: u.role, name: u.username, exp: Date.now() + 12 * 3600e3 }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 3600 });
  await audit(t.id, u.id, "login");
  return res;
}
