import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkPassword, signSession } from "@/lib/auth";
import { audit, userModules } from "@/lib/data";
import { MODULES } from "@/lib/modules";
import { clientIp, failLogin, lockedFor, okLogin } from "@/lib/throttle";

const fail = () => NextResponse.json({ ok: false }, { status: 401 });

export async function POST(req: Request) {
  try { return await handle(req); }
  catch (e) { console.error("login", e); return NextResponse.json({ ok: false, error: "server" }, { status: 500 }); }
}

async function handle(req: Request) {
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug || "").trim().toLowerCase(), username = String(b?.username || "").trim().toLowerCase(), password = String(b?.password || "");
  if (!slug || !username || !password) return fail();
  const ip = clientIp(req), acct = slug + "|" + username;
  const wait = await lockedFor(ip, acct);
  if (wait) return NextResponse.json({ ok: false, error: "locked", minutes: Math.ceil(wait / 60) }, { status: 429 });
  const [t] = await sql.query("select id from tenants where slug=$1 and status='active'", [slug]);
  const [u] = t ? await sql.query("select id,pass_hash,role,username from users where tenant_id=$1 and lower(username)=$2 and active", [t.id, username]) : [];
  if (!t || !u || !checkPassword(password, u.pass_hash)) { await failLogin(ip, acct); return fail(); }
  await okLogin(acct);
  // Staf yang hanya punya satu aplikasi langsung masuk ke aplikasi itu; selainnya ke beranda.
  const mods = await userModules(t.id, u.id, u.role);
  const to = u.role === "staff" && mods.length === 1 ? (MODULES[mods[0]]?.href || "/m/" + mods[0]) : "/";
  const res = NextResponse.json({ ok: true, to });
  res.cookies.set("cs", signSession({ uid: u.id, tid: t.id, role: u.role, name: u.username, exp: Date.now() + 12 * 3600e3 }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 3600 });
  await audit(t.id, u.id, "login");
  return res;
}
